// Web Worker entry: runs engine requests off the main thread so the board never freezes.
import { runEngineRequest, type EngineRequest } from "./engineProtocol";

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<EngineRequest>) => void) | null;
  postMessage: (msg: unknown) => void;
};

ctx.onmessage = (e: MessageEvent<EngineRequest>) => {
  ctx.postMessage(runEngineRequest(e.data));
};
