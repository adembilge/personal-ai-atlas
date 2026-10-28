import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "dist",
  ),
  port = Number(process.env.PORT || 8766);
http
  .createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(request.url, "http://localhost").pathname,
      );
    } catch {
      response.writeHead(400);
      response.end("Bad address");
      return;
    }
    const mount = "/personal-ai-atlas";
    if (pathname === mount) pathname = "/";
    else if (pathname.startsWith(mount + "/"))
      pathname = pathname.slice(mount.length);
    let file = path.resolve(root, "." + pathname);
    if (file === root) file = path.join(root, "index.html");
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403);
      response.end("Not available");
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.setHeader("Cache-Control", "no-store");
      response.setHeader(
        "Content-Type",
        {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".json": "application/json; charset=utf-8",
          ".md": "text/markdown; charset=utf-8",
        }[path.extname(file)] || "application/octet-stream",
      );
      response.end(data);
    });
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Local: http://127.0.0.1:${port}/personal-ai-atlas/`),
  );
