import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { STORAGE_ROOT } from "@/lib/paths";

// Wrap a Node fs.ReadStream in a web ReadableStream by hand instead of using
// Readable.toWeb(): when a <video> element aborts a range request mid-stream
// (very common while scrubbing/hover-previewing), toWeb() can try to enqueue
// into an already-closed controller and throw an uncaught exception that
// crashes the whole dev server. Here every enqueue/close is guarded, and
// cancel() destroys the underlying fd instead of leaking it.
function toWebStream(nodeStream: fs.ReadStream): ReadableStream<Uint8Array> {
  let closed = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk) => {
        if (closed) return;
        try {
          controller.enqueue(chunk as Buffer);
        } catch {
          closed = true;
        }
      });
      nodeStream.on("end", () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed, ignore
        }
      });
      nodeStream.on("error", (err) => {
        if (closed) return;
        closed = true;
        try {
          controller.error(err);
        } catch {
          // already closed, ignore
        }
      });
    },
    cancel() {
      closed = true;
      nodeStream.destroy();
    },
  });
}

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const rel = segments.join("/");
  const full = path.normalize(path.join(STORAGE_ROOT, rel));

  if (!full.startsWith(STORAGE_ROOT) || !fs.existsSync(full)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = path.extname(full).toLowerCase();
  const contentType = MIME[ext] || "application/octet-stream";
  const stat = fs.statSync(full);
  const range = req.headers.get("range");

  if (range && ext === ".mp4") {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    const start = match ? parseInt(match[1], 10) : 0;
    const end = match && match[2] ? parseInt(match[2], 10) : stat.size - 1;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(full, { start, end });
    return new NextResponse(toWebStream(stream), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": contentType,
      },
    });
  }

  const stream = fs.createReadStream(full);
  return new NextResponse(toWebStream(stream), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
