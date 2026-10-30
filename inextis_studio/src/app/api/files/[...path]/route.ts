// Serves project files (renders, thumbnails, .blend/.fbx) written after the server
// started: `next start` only serves public/ files that existed at startup.
// /projects/* falls back here via the rewrite in next.config.ts.

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public", "projects");
const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".glb": "model/gltf-binary",
  ".blend": "application/octet-stream",
  ".fbx": "application/octet-stream",
  ".csv": "text/csv",
};

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...path]">) {
  const { path: parts } = await ctx.params;
  const file = path.resolve(ROOT, ...parts);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!file.startsWith(ROOT + path.sep) || !type) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(file);
    const headers: Record<string, string> = { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" };
    if (type === "application/octet-stream") headers["Content-Disposition"] = `attachment; filename="${path.basename(file)}"`;
    return new Response(new Uint8Array(data), { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
