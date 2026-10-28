import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/queryClient';
import {
  completeRecording,
  createRecording,
  getRecordingSummary,
  getRecordingTranscript,
  uploadRecordingBlob,
} from '@/api/recording/recording.api';
import type { MeetingSummary, Transcript } from '@/api/recording/recording.types';

export type RecorderStage =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'failed';

/** One participant's audio, as handed to the recorder. */
export interface SpeakerTrack {
  speakerId: string;
  speakerName: string;
  stream: MediaStream;
}

/** Server allowlist. A type outside it is rejected by createRecording. */
const ALLOWED_AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'] as const;

/** Records every participant on their own track, then runs the AI pipeline. Tracks are captured separately and never mixed. Simultaneous speech is what garbles a transcript, so mixing everyone into one stream is exactly what this avoids. The server transcribes each track on its own and attributes the words using the roster, then sends the attributed transcript to the summariser. Audio is captured mono at a low bitrate: speech only needs to be intelligible, and it keeps a full hour per participant inside the provider's upload limit without any server-side conversion step. */
export const useMeetingRecorder = (options?: {
  meetingId?: string;
  projectId?: string;
  /** Called the moment a failure is recorded, so the caller can react in its own
   * event path instead of watching `error` from an effect (which would render twice). */
  onError?: (message: string) => void;
}) => {
  const queryClient = useQueryClient();

  // Meeting and project ids are fixed for the lifetime of a room, so they are
  // read through a ref instead of being memo dependencies.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const recordersRef = useRef<MediaRecorder[]>([]);
  const chunksRef = useRef<Map<string, Blob[]>>(new Map());
  const startedAtRef = useRef<number>(0);

  const [stage, setStage] = useState<RecorderStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [rawAudioUrls, setRawAudioUrls] = useState<Array<{ speakerId: string; speakerName: string; url: string }>>([]);

  const fail = useCallback((message: string) => {
    setError(message);
    optionsRef.current?.onError?.(message);
  }, []);

  const startRecording = useCallback(async (tracks: SpeakerTrack[]) => {
    setError(null);
    const usable = tracks.filter((track) => track.stream.getAudioTracks().length > 0);
    if (usable.length === 0) {
      setStage('failed');
      fail('No participant audio is available to record yet');
      return;
    }

    const supportedType = typeof MediaRecorder !== 'undefined'
      ? ALLOWED_AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || ''
      : '';
    const mimeType = supportedType || undefined;

    const recorders: MediaRecorder[] = [];
    try {
      for (const track of usable) {
        // Create an audio-only MediaStream containing only the active audio tracks
        const audioTracks = track.stream.getAudioTracks().filter((t) => t.readyState === 'live');
        const audioOnlyStream = new MediaStream(audioTracks);

        const options: MediaRecorderOptions = {};
        if (mimeType && MediaRecorder.isTypeSupported(mimeType)) {
          options.mimeType = mimeType;
        }

        const recorder = new MediaRecorder(audioOnlyStream, options);
        const collected: Blob[] = [];
        chunksRef.current.set(track.speakerId, collected);
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) collected.push(event.data);
        };
        recorders.push(recorder);
      }
    } catch (err) {
      recorders.forEach((recorder) => {
        if (recorder.state !== 'inactive') recorder.stop();
      });
      setStage('failed');
      fail(err instanceof Error ? err.message : 'Could not start recording');
      return;
    }

    recordersRef.current = recorders;

    startedAtRef.current = Date.now();
    setElapsedMs(0);
    try {
      recorders.forEach((recorder) => {
        if (recorder.state === 'inactive') {
          recorder.start(500); // deliver data every 500ms
        }
      });
      setStage('recording');
    } catch (err) {
      recorders.forEach((recorder) => {
        try {
          if (recorder.state !== 'inactive') recorder.stop();
        } catch {
          // ignore
        }
      });
      setStage('failed');
      fail(err instanceof Error ? err.message : 'Failed to start media recorder');
    }
  }, [fail]);

  /** Stops every track and runs the upload chain. Each participant's audio goes to its own server-derived object; the recording is only reported successful once the server has verified them all. */
  const stopRecording = useCallback(async () => {
    const recorders = recordersRef.current;
    if (recorders.length === 0) return;

    const durationMs = Date.now() - startedAtRef.current;
    const mimeType = recorders[0]?.mimeType ?? 'audio/webm';

    await Promise.all(
      recorders.map(
        (recorder) =>
          new Promise<void>((resolve) => {
            if (recorder.state === 'inactive') {
              resolve();
              return;
            }
            recorder.onstop = () => resolve();
            try {
              recorder.requestData();
            } catch {
              // ignore
            }
            recorder.stop();
          })
      )
    );
    recordersRef.current = [];

    const speakers = Array.from(chunksRef.current.entries())
      .map(([speakerId, blobs]) => ({
        speakerId,
        speakerName: speakerId,
        blob: new Blob(blobs, { type: mimeType })
      }))
      .filter((speaker) => speaker.blob.size > 0);

    // Create playable raw audio URLs
    const audioUrls = speakers.map((s) => ({
      speakerId: s.speakerId,
      speakerName: s.speakerName,
      url: URL.createObjectURL(s.blob),
    }));
    setRawAudioUrls(audioUrls);

    if (speakers.length === 0) {
      setStage('failed');
      fail('No audio was captured');
      return;
    }

    setStage('uploading');
    setError(null);

    try {
      const recording = await createRecording({
        contentType: mimeType,
        meetingId: optionsRef.current?.meetingId,
        projectId: optionsRef.current?.projectId,
        speakers: speakers.map((speaker) => ({
          speakerId: speaker.speakerId,
          speakerName: speaker.speakerName
        })),
      });
      if (!recording.recordingId) {
        throw new Error('The server did not return a recording id');
      }

      for (const [index, speaker] of speakers.entries()) {
        await uploadRecordingBlob(recording.recordingId, speaker.blob, mimeType, index);
      }
      await completeRecording(recording.recordingId, { durationMs });

      setRecordingId(recording.recordingId);
      setStage('processing');
      await queryClient.invalidateQueries({ queryKey: queryKeys.recordings.all });
    } catch (err) {
      setStage('failed');
      fail(err instanceof Error ? err.message : 'Could not save the recording');
    }
  }, [queryClient, fail]);

  const summaryQuery = useQuery<MeetingSummary | null>({
    queryKey: queryKeys.recordings.summary(recordingId ?? 'none'),
    queryFn: () => getRecordingSummary(recordingId as string),
    retry: false,
    enabled: Boolean(recordingId) && stage === 'processing',
    refetchInterval: (query) => {
      const status = query.state.data?.summaryStatus;
      if (status === 'READY' || status === 'FAILED') return false;
      return 5_000;
    },
  });

  const transcriptQuery = useQuery<Transcript | null>({
    queryKey: queryKeys.recordings.transcript(recordingId ?? 'none'),
    queryFn: () => getRecordingTranscript(recordingId as string),
    retry: false,
    enabled: Boolean(recordingId),
    refetchInterval: (query) => {
      const status = query.state.data?.transcriptStatus;
      if (status === 'READY' || status === 'FAILED') return false;
      return 5_000;
    },
  });

  const reset = useCallback(() => {
    setStage('idle');
    setRecordingId(null);
    setError(null);
    setElapsedMs(0);
    queryClient.removeQueries({ queryKey: queryKeys.recordings.all });
  }, [queryClient]);

  return {
    stage,
    error,
    recordingId,
    elapsedMs,
    isRecording: stage === 'recording',
    startRecording,
    stopRecording,
    summary: summaryQuery.data,
    transcript: transcriptQuery.data,
    rawAudioUrls,
    isSummaryReady: summaryQuery.data?.summaryStatus === 'READY',
    reset,
  };
};