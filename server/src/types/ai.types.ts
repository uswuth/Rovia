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
}

export interface AudioExtractionResult {
  /** Absolute path to a temporary 16 kHz mono PCM WAV. Caller must delete it. */
  filePath: string;
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
