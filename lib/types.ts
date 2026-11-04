export type JobStage =
  | "queued"
  | "downloading"
  | "transcribing"
  | "analyzing"
  | "rendering"
  | "done"
  | "error";

export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  words: Word[];
}

export interface Transcript {
  method: "whisper" | "heuristic";
  language?: string;
  duration: number;
  segments: TranscriptSegment[];
}

export interface ClipResult {
  id: string;
  index: number;
  start: number;
  end: number;
  duration: number;
  title: string;
  hook: string;
  score: number;
  reason: string;
  videoPath: string;
  thumbPath: string;
}

export interface Job {
  id: string;
  createdAt: number;
  updatedAt: number;
  source: {
    type: "url" | "upload";
    url?: string;
    filename?: string;
    platform?: string;
  };
  stage: JobStage;
  progress: number;
  message: string;
  error?: string;
  sourceDuration?: number;
  transcriptMethod?: "whisper" | "heuristic";
  clips: ClipResult[];
}
