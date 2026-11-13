import { toFileUrl } from "./url";
import { liveWaitedMs } from "./scheduler";
import type { ClipResult, Job } from "./types";

export type ClientClip = Omit<ClipResult, "words"> & {
  videoUrl: string;
  thumbUrl: string;
  rawUrl: string;
  words?: ClipResult["words"];
};
export type ClientJob = Omit<Job, "clips"> & { clips: ClientClip[] };

/** Job as the browser sees it: file paths become URLs. Word timings are heavy and only the editor needs them. */
export function toClientJob(job: Job, withWords = false): ClientJob {
  return {
    ...job,
    waitedMs: liveWaitedMs(job.id) ?? job.waitedMs,
    clips: job.clips.map(({ words, ...c }) => ({
      ...c,
      ...(withWords ? { words } : {}),
      // jobs saved by older versions may lack some paths — never let one bad record break the whole list
      videoUrl: c.videoPath ? toFileUrl(c.videoPath) : "",
      thumbUrl: c.thumbPath ? toFileUrl(c.thumbPath) : "",
      rawUrl: c.rawPath ? toFileUrl(c.rawPath) : "",
    })),
  };
}
