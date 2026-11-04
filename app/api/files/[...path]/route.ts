import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { STORAGE_ROOT } from "@/lib/paths";

function toWebStream(stream: fs.ReadStream) {
  return Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>;
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
