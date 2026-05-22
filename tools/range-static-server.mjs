#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] || process.cwd());
const port = Number(process.argv[3] || process.env.PORT || 5056);
const host = process.env.HOST || "0.0.0.0";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const requested = decoded === "/" ? "/index.html" : decoded;
  const full = path.resolve(root, `.${requested}`);
  if (!full.startsWith(root)) return null;
  return full;
}

const server = http.createServer((req, res) => {
  const filePath = safePath(req.url || "/");
  if (!filePath) return send(res, 403, {}, "Forbidden");

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, {}, "Not found");

    const ext = path.extname(filePath).toLowerCase();
    const contentType = types[ext] || "application/octet-stream";
    const common = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    };

    if (req.method === "HEAD") {
      return send(res, 200, { ...common, "Content-Length": stat.size }, "");
    }

    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match) return send(res, 416, { "Content-Range": `bytes */${stat.size}` }, "");

      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (start >= stat.size || end >= stat.size || start > end) {
        return send(res, 416, { "Content-Range": `bytes */${stat.size}` }, "");
      }

      res.writeHead(206, {
        ...common,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, { ...common, "Content-Length": stat.size });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, host, () => {
  console.log(`Node range server: http://${host}:${port}`);
  console.log(`Root: ${root}`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Keep process alive through the server listener.
}
