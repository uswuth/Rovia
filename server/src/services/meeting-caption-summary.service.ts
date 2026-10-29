import { Types } from 'mongoose';
import { Meeting } from '../models/meeting.model.js';
import { Recording } from '../models/recording.model.js';
import { Transcript } from '../models/transcript.model.js';
import { Summary } from '../models/summary.model.js';
import { logger } from '../utils/logger.js';
import { recordingExpiresAt } from '../utils/recording.js';
import { OpenRouterSummarizer } from './ai/openrouter-summarizer.js';
import { LiveCaptionTurn, meetingLiveTranscripts } from '../socket/socket.js';

const summarizer = new OpenRouterSummarizer();

/**
 * Automatically compiles real-time captions into a permanent Transcript and AI Summary
 * when a meeting ends. No audio upload or FFmpeg processing required.
 */
export const processMeetingEndCaptions = async (
  meetingId: string,
  organizationId: string,
  endedByUserId: string,
  aiSummaryEnabled = false
): Promise<void> => {
  try {
    const turns: LiveCaptionTurn[] = meetingLiveTranscripts.get(meetingId) || [];

    const meeting = await Meeting.findOne({ _id: meetingId, organization_id: organizationId });
    if (!meeting) {
      logger.warn(`Could not process captions: Meeting ${meetingId} not found`);
      return;
    }

    // Map speaker statistics and compile clean transcript
    const speakerMap = new Map<string, { speakerName: string; texts: string[] }>();
    const fullDialogue: string[] = [];

    for (const turn of turns) {
      const name = turn.speakerName || 'Participant';
      if (!speakerMap.has(turn.speakerId)) {
        speakerMap.set(turn.speakerId, { speakerName: name, texts: [] });
      }
      speakerMap.get(turn.speakerId)!.texts.push(turn.text);
      fullDialogue.push(`${name}: ${turn.text}`);
    }

    const transcriptText = fullDialogue.join('\n\n').trim();

    // 1. Create or resolve Recording record for this meeting
    let recording = await Recording.findOne({ meeting_id: meetingId, organization_id: organizationId });
    if (!recording) {
      recording = new Recording({
        _id: new Types.ObjectId(),
        organization_id: organizationId,
        created_by: endedByUserId,
        meeting_id: meetingId,
        project_id: meeting.project_id || null,
        recording_mime_type: 'audio/webm',
        recording_size_bytes: transcriptText.length,
        recording_duration_ms: (meeting.meeting_duration_minutes || 30) * 60 * 1000,
        recording_status: 'READY',
        recording_expires_at: recordingExpiresAt(),
        storage_key: `meetings/${meetingId}/transcript`,
        recording_speakers: Array.from(speakerMap.entries()).map(([id, info], idx) => ({
          speakerId: id,
          speakerName: info.speakerName,
          speakerIndex: idx,
          storageKey: `meetings/${meetingId}/speaker-${idx}`,
          mimeType: 'audio/webm',
          sizeBytes: 0,
          uploaded: true
        }))
      });
      await recording.save();
    }

    const recordingId = recording._id.toString();
    const recObjectId = new Types.ObjectId(recordingId);

    // 2. Create or update Transcript record
    const speakersPayload = Array.from(speakerMap.entries()).map(([speakerId, info]) => ({
      speakerId,
      speakerName: info.speakerName,
      speakerText: info.texts.join(' '),
      speakerDurationMs: 0,
      spoke: info.texts.length > 0
    }));

    let transcriptDoc = await Transcript.findOne({
      recording_id: { $in: [recordingId, recObjectId] },
      organization_id: organizationId
    });
    if (!transcriptDoc) {
      transcriptDoc = new Transcript({
        organization_id: organizationId,
        recording_id: recObjectId,
        transcript_status: 'READY',
        transcript_text: transcriptText,
        transcript_speakers: speakersPayload
      });
    } else {
      transcriptDoc.transcript_status = 'READY';
      transcriptDoc.transcript_text = transcriptText;
      transcriptDoc.transcript_speakers = speakersPayload;
    }
    await transcriptDoc.save();
    logger.info(`Live transcript saved for meeting ${meetingId} (${transcriptText.length} chars)`);

    // Clean up in-memory buffer
    meetingLiveTranscripts.delete(meetingId);

    // If AI summary was not enabled by host, stop here; transcript is safely saved in DB.
    if (!aiSummaryEnabled) {
      logger.info(`AI Summary skipped for meeting ${meetingId} (aiSummaryEnabled is false)`);
      return;
    }

    // 3. Generate AI Summary using OpenRouter if speech occurred
    let summaryDoc = await Summary.findOne({
      $or: [
        { transcript_id: transcriptDoc._id },
        { recording_id: recObjectId }
      ],
      organization_id: organizationId
    });
    if (!summaryDoc) {
      summaryDoc = new Summary({
        organization_id: organizationId,
        recording_id: recObjectId,
        transcript_id: transcriptDoc._id,
        created_by: endedByUserId,
        summary_status: 'PROCESSING'
      });
      await summaryDoc.save();
    }

    if (!transcriptText) {
      summaryDoc.summary_status = 'READY';
      summaryDoc.summary_text = 'No speech was detected in this meeting.';
      summaryDoc.summary_key_points = [];
      summaryDoc.summary_action_items = [];
      await summaryDoc.save();
      logger.info(`Summary READY (empty) for meeting ${meetingId}`);
      return;
    }

    try {
      const summaryResult = await summarizer.summarize({
        transcript: transcriptText,
        recordingTitle: meeting.meeting_title
      });

      summaryDoc.summary_status = 'READY';
      summaryDoc.summary_text = summaryResult.summary;
      summaryDoc.summary_key_points = summaryResult.keyPoints;
      summaryDoc.summary_action_items = summaryResult.actionItems;
      await summaryDoc.save();
      logger.info(`Auto AI Summary successfully generated for meeting ${meetingId}`);
    } catch (err) {
      logger.error(`AI Summarization failed for meeting ${meetingId}: ${(err as Error).message}`);
      summaryDoc.summary_status = 'FAILED';
      await summaryDoc.save();
    }
  } catch (error) {
    logger.error(`Failed to process meeting end captions for ${meetingId}: ${(error as Error).message}`);
  }
};

/**
 * On-demand generation of AI summary for a meeting that has a transcript saved.
 */
export const generateMeetingAiSummaryOnDemand = async (
  meetingId: string,
  organizationId: string,
  userId: string
): Promise<unknown> => {
  const meeting = await Meeting.findOne({ _id: meetingId, organization_id: organizationId });
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  const recording = await Recording.findOne({ meeting_id: meetingId, organization_id: organizationId });
  if (!recording) {
    throw new Error('No recording or transcript found for this meeting');
  }

  const transcript = await Transcript.findOne({
    recording_id: { $in: [recording._id, recording._id.toString()] },
    organization_id: organizationId
  });
  if (!transcript || !transcript.transcript_text) {
    throw new Error('Transcript text is empty or not found');
  }

  let summaryDoc = await Summary.findOne({ transcript_id: transcript._id, organization_id: organizationId });
  if (!summaryDoc) {
    summaryDoc = new Summary({
      organization_id: organizationId,
      recording_id: recording._id,
      transcript_id: transcript._id,
      created_by: userId,
      summary_status: 'PROCESSING'
    });
    await summaryDoc.save();
  } else {
    summaryDoc.summary_status = 'PROCESSING';
    await summaryDoc.save();
  }

  try {
    const summaryResult = await summarizer.summarize({
      transcript: transcript.transcript_text,
      recordingTitle: meeting.meeting_title
    });

    summaryDoc.summary_status = 'READY';
    summaryDoc.summary_text = summaryResult.summary;
    summaryDoc.summary_key_points = summaryResult.keyPoints;
    summaryDoc.summary_action_items = summaryResult.actionItems;
    await summaryDoc.save();
    return summaryDoc;
  } catch (err) {
    summaryDoc.summary_status = 'FAILED';
    await summaryDoc.save();
    throw err;
  }
};


