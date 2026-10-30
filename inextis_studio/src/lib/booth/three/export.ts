"use client";

import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { Plan } from "../schema";
import { buildBooth } from "./build";

export function brandFont() {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-jost").trim() || "sans-serif";
}

// The whole booth as a binary glTF: the exact geometry Blender renders
export async function exportGlb(plan: Plan): Promise<ArrayBuffer> {
  const root = buildBooth(plan, brandFont());
  root.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(root, { binary: true, onlyVisible: true });
  return result as ArrayBuffer;
}

export function download(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
