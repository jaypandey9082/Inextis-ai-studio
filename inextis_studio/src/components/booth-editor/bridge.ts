// Hooks from the 3D viewport to the rest of the editor. Kept on globalThis because the
// viewport is lazy-loaded, which can give it a separate copy of ordinary module state.

type Cam = { loc: [number, number, number]; target: [number, number, number]; lens: number };
type Bridge = { capture: { current: (() => string) | null }; camera: { current: (() => Cam | null) | null } };

const g = globalThis as unknown as { __inextisViewport?: Bridge };
g.__inextisViewport ??= { capture: { current: null }, camera: { current: null } };

// A JPEG of the current view (thumbnails)
export const viewportCapture = g.__inextisViewport.capture;
// The editor camera in booth coordinates (Z-up), so Blender can render "what I see"
export const viewportCamera = g.__inextisViewport.camera;
