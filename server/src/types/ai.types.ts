/**
 * Provider-neutral contracts for the local AI pipeline.
 *
 * The Recording domain depends on these three interfaces only. FFmpeg, Whisper
 * and Ollama are adapters behind them, so any one can be replaced without
 * touching the Recording API, models or orchestration.
 */

export interface AudioExtractionInput {
  /** Server-derived storage key. Never supplied by a client. */
  storageKey: string;
  /** Validated recording MIME type; drives the input format hint, not the key. */
  recordingMimeType: string;
  recordingId: string;
  /** Free-text context for operators, e.g. "speaker 2 of 3". */
  label?: string;
}

export interface AudioExtractionResult {
  /**
   * Absolute paths to temporary silence-trimmed, 16 kHz mono FLAC chunks.
   * Split because a full meeting exceeds the transcription API's per-file
   * ceiling. The caller must delete the containing directory when done.
   */
  filePaths: string[];
  /** Combined duration across all chunks in milliseconds. */
  durationMs: number | null;
}

export interface AudioExtractor {
  extract(input: AudioExtractionInput): Promise<AudioExtractionResult>;
}

export interface TranscriptionInput {
  filePath: string;
  /** Omit for automatic language detection. */
  language?: string;
}

export interface TranscriptionSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  language: string | null;
  durationMs: number | null;
  segments: TranscriptionSegment[];
}

/** One participant's captured audio, identified by the roster at record time. */
export interface RecordingSpeaker {
  speakerId: string;
  speakerName: string;
  /**
   * Index into the recording's speaker list. The storage key is derived from
   * this, so a client cannot address another speaker's object.
   */
  speakerIndex: number;
}

export interface Transcriber {
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

export interface SummaryActionItem {
  text: string;
  /** Only present when the transcript actually names someone. */
  assignee: string | null;
}

export interface SummarizationInput {
  transcript: string;
  /** The only other context given. Keeps the model grounded. */
  recordingTitle?: string;
}

export interface SummarizationResult {
  summary: string;
  keyPoints: string[];
  actionItems: SummaryActionItem[];
}

export interface Summarizer {
  summarize(input: SummarizationInput): Promise<SummarizationResult>;
}
