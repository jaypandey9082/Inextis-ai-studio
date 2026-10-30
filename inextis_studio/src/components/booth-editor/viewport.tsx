"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Grid,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
  TransformControls,
} from "@react-three/drei";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { PART_MAP } from "@/lib/booth/registry";
import type { Part, Plan } from "@/lib/booth/schema";
import { useEditor } from "@/lib/booth/store";
import { buildPart, buildPlatform } from "@/lib/booth/three/build";

import { viewportCamera, viewportCapture } from "./bridge";

function useBrandFont() {
  const [font, setFont] = useState<string | null>(null);
  useEffect(() => {
    const f =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-jost")
        .trim() || "sans-serif";
    document.fonts.load(`600 48px ${f}`).finally(() => setFont(f));
  }, []);
  return font;
}

function disposeTree(o: THREE.Object3D) {
  o.traverse((c) => {
    if ((c as THREE.Mesh).geometry) (c as THREE.Mesh).geometry.dispose();
  });
}

const PartNode = memo(function PartNode({
  part,
  plan,
  font,
  planView,
  onRef,
}: {
  part: Part;
  plan: Plan;
  font: string;
  planView: boolean;
  onRef: (id: string, o: THREE.Group | null) => void;
}) {
  const select = useEditor((s) => s.select);
  // Geometry only depends on the part's settings, so dragging (x, y, rot) never rebuilds it
  const content = useMemo(
    () =>
      buildPart(
        { ...part, x: 0, y: 0, rot: 0 },
        { plan, ph: plan.platform.height, font },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      part.type,
      part.name,
      JSON.stringify(part.p),
      JSON.stringify(plan.palette),
      plan.platform.height,
      plan.platform.accent.join(),
      font,
    ],
  );
  useEffect(() => () => disposeTree(content), [content]);
  // In the floor plan a roof would hide everything under it, so draw it as a light
  // tint with a dashed outline that lets clicks through to the parts below
  const outline = useMemo(() => {
    if (part.type !== "roof") return null;
    const e = PART_MAP.roof.extent(part.p);
    const [hw, hd] = [e.w / 2, e.d / 2];
    const g = new THREE.Group();
    const edge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => new THREE.Vector3(x, y, e.h + 0.05))),
      new THREE.LineDashedMaterial({ color: "#f5a524", dashSize: 0.25, gapSize: 0.15 }),
    );
    edge.computeLineDistances();
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(e.w, e.d),
      new THREE.MeshBasicMaterial({ color: "#f5a524", transparent: true, opacity: 0.3, depthWrite: false }),
    );
    fill.position.z = e.h + 0.04;
    for (const o of [edge, fill]) {
      o.raycast = () => {};
      g.add(o);
    }
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part.type, JSON.stringify(part.p)]);
  useEffect(
    () => () =>
      outline?.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose();
      }),
    [outline],
  );
  useEffect(() => {
    content.traverse((o) => {
      if (!o.userData.canopy) return;
      // hidden meshes still catch clicks, so switch picking off too
      o.visible = !planView;
      o.raycast = planView ? () => {} : THREE.Mesh.prototype.raycast;
    });
  }, [content, planView]);
  return (
    <group
      ref={(o) => onRef(part.id, o)}
      position={[part.x, part.y, 0]}
      rotation={[0, 0, (part.rot * Math.PI) / 180]}
      onPointerDown={(e) => {
        e.stopPropagation();
        select(part.id);
      }}
    >
      <primitive object={content} />
      {outline && planView && <primitive object={outline} />}
    </group>
  );
});

function Platform({ plan }: { plan: Plan }) {
  const obj = useMemo(
    () => buildPlatform(plan),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan.size.join(), JSON.stringify(plan.platform)],
  );
  useEffect(() => () => disposeTree(obj), [obj]);
  return <primitive object={obj} />;
}

function Selection({ target }: { target: THREE.Object3D | null }) {
  const helper = useMemo(() => {
    const h = new THREE.Box3Helper(
      new THREE.Box3(),
      new THREE.Color("#ee8022"),
    );
    (h.material as THREE.LineBasicMaterial).depthTest = false;
    h.renderOrder = 10;
    return h;
  }, []);
  useFrame(() => {
    if (target) helper.box.setFromObject(target);
  });
  return target ? <primitive object={helper} /> : null;
}

// Labels are plain HTML over the canvas, positioned from 3D points each frame
type LabelSpec = {
  key: string;
  text: string;
  cls: string;
  pos?: [number, number, number];
  obj?: THREE.Object3D;
};
type ScreenLabel = {
  key: string;
  text: string;
  cls: string;
  x: number;
  y: number;
};

function LabelProjector({
  specs,
  onChange,
}: {
  specs: LabelSpec[];
  onChange: (l: ScreenLabel[]) => void;
}) {
  const { camera, size } = useThree();
  const box = useMemo(() => new THREE.Box3(), []);
  const last = useRef("");
  useFrame(() => {
    const out: ScreenLabel[] = [];
    for (const sp of specs) {
      let v: THREE.Vector3;
      if (sp.obj) {
        box.setFromObject(sp.obj);
        v = new THREE.Vector3(
          (box.min.x + box.max.x) / 2,
          box.max.y + 0.25,
          (box.min.z + box.max.z) / 2,
        );
      } else v = new THREE.Vector3(...(sp.pos ?? [0, 0, 0]));
      v.project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) continue;
      out.push({
        key: sp.key,
        text: sp.text,
        cls: sp.cls,
        x: Math.round(((v.x + 1) / 2) * size.width),
        y: Math.round(((1 - v.y) / 2) * size.height),
      });
    }
    const sig = JSON.stringify(out);
    if (sig !== last.current) {
      last.current = sig;
      onChange(out);
    }
  });
  return null;
}

function planLabels(plan: Plan): LabelSpec[] {
  const [w, d] = plan.size;
  const dim =
    "rounded bg-surface/90 px-1.5 py-0.5 text-[10.5px] font-medium text-ink shadow";
  const sides: Record<string, [number, number, number]> = {
    front: [0, 0.05, d / 2 + 1.5],
    back: [0, 0.05, -d / 2 - 1.1],
    left: [-w / 2 - 1.6, 0.05, 1.2],
    right: [w / 2 + 1.6, 0.05, 0],
  };
  return [
    { key: "dim-w", text: `${w} m`, cls: dim, pos: [0, 0.05, d / 2 + 0.45] },
    { key: "dim-d", text: `${d} m`, cls: dim, pos: [-w / 2 - 0.5, 0.05, 0] },
    ...(["front", "back", "left", "right"] as const).map((sd) => ({
      key: `side-${sd}`,
      text: `${sd} ${plan.openSides.includes(sd) ? "open" : "closed"}`,
      cls: `text-[10px] font-semibold uppercase tracking-[0.18em] ${plan.openSides.includes(sd) ? "text-accent" : "text-white/40"}`,
      pos: sides[sd],
    })),
    ...plan.parts.map((p) => ({
      key: `part-${p.id}`,
      text: p.name,
      cls: "whitespace-nowrap text-[9.5px] font-medium text-white/75 [text-shadow:0_1px_2px_rgb(0_0_0)]",
      pos: [p.x, 0.05, -p.y] as [number, number, number],
    })),
  ];
}

function CaptureBridge() {
  const { gl, scene, camera, controls } = useThree();
  useEffect(() => {
    viewportCapture.current = () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/jpeg", 0.82);
    };
    viewportCamera.current = () => {
      const cam = camera as THREE.PerspectiveCamera;
      if (!cam.isPerspectiveCamera) return null;
      const t =
        (controls as unknown as { target?: THREE.Vector3 } | null)?.target ??
        new THREE.Vector3(0, 1.2, 0);
      // three (x, y, z) Y-up -> booth (x, -z, y) Z-up; vertical fov -> 36 mm-sensor lens for a 16:9 render
      const hfov =
        2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * (16 / 9));
      return {
        loc: [cam.position.x, -cam.position.z, cam.position.y],
        target: [t.x, -t.z, t.y],
        lens: Math.round((18 / Math.tan(hfov / 2)) * 10) / 10,
      };
    };
    return () => {
      viewportCapture.current = null;
      viewportCamera.current = null;
    };
  }, [gl, scene, camera, controls]);
  return null;
}

function Cameras({ plan, view }: { plan: Plan; view: "3d" | "plan" }) {
  const { size } = useThree();
  const [w, d] = plan.size;
  const s = Math.max(w, d, 9);
  const zoom = Math.min(size.width / (w * 1.45), size.height / (d * 1.6));
  return view === "plan" ? (
    <>
      <OrthographicCamera
        makeDefault
        position={[0, 60, 0]}
        zoom={zoom}
        up={[0, 0, -1]}
        near={0.1}
        far={200}
        onUpdate={(c) => c.lookAt(0, 0, 0)}
      />
      <OrbitControls makeDefault enableRotate={false} target={[0, 0, 0]} />
    </>
  ) : (
    <>
      <PerspectiveCamera
        makeDefault
        position={[-s * 1.25, s * 0.95, s * 1.4]}
        fov={38}
        near={0.1}
        far={400}
      />
      <OrbitControls
        makeDefault
        target={[0, 1.2, 0]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={2}
        maxDistance={s * 4}
      />
    </>
  );
}

export function Viewport({ readOnly = false }: { readOnly?: boolean }) {
  const plan = useEditor((s) => s.plan);
  const selectedId = useEditor((s) => s.selectedId);
  const view = useEditor((s) => s.view);
  const tool = useEditor((s) => s.tool);
  const { select, beginDrag, dragPart, endDrag } = useEditor.getState();
  const font = useBrandFont();
  const refs = useRef(new Map<string, THREE.Group>());
  const [selectedObj, setSelectedObj] = useState<THREE.Group | null>(null);

  useEffect(() => {
    setSelectedObj(selectedId ? (refs.current.get(selectedId) ?? null) : null);
  }, [selectedId, plan?.parts.length]);

  const [labels, setLabels] = useState<ScreenLabel[]>([]);
  const selected = plan?.parts.find((p) => p.id === selectedId) ?? null;
  const specs = useMemo<LabelSpec[]>(() => {
    if (!plan) return [];
    const out = view === "plan" ? planLabels(plan) : [];
    if (!readOnly && selected && selectedObj) {
      const e = PART_MAP[selected.type]?.extent(selected.p);
      if (e)
        out.push({
          key: "selected",
          text: `${selected.name} · ${e.w.toFixed(1)} × ${e.d.toFixed(1)} m`,
          cls: "whitespace-nowrap rounded-full bg-ink/90 px-2.5 py-1 text-[11px] font-medium text-white shadow-lg",
          obj: selectedObj,
        });
    }
    return out;
  }, [plan, view, selected, selectedObj, readOnly]);

  if (!plan) return null;
  const onRef = (id: string, o: THREE.Group | null) => {
    if (o) refs.current.set(id, o);
    else refs.current.delete(id);
  };

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onPointerMissed={() => !readOnly && select(null)}
      >
        <color attach="background" args={["#121317"]} />
        <fog attach="fog" args={["#121317", 35, 110]} />
        <Cameras plan={plan} view={view} />
        <CaptureBridge />
        <hemisphereLight args={["#e8eeff", "#1a1a1f", 0.9]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[-14, 22, 12]}
          intensity={1.8}
          castShadow={view === "3d"}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[12, 10, -10]} intensity={0.5} />
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.002, 0]} receiveShadow>
          <planeGeometry args={[300, 300]} />
          <meshStandardMaterial color="#1b1c21" roughness={0.4} />
        </mesh>
        <Grid
          position={[0, 0.001, 0]}
          cellSize={0.5}
          sectionSize={1}
          cellColor="#272a31"
          sectionColor="#363a44"
          fadeDistance={70}
          infiniteGrid
        />
        <group rotation-x={-Math.PI / 2}>
          <Platform plan={plan} />
          {font &&
            plan.parts.map((p) => (
              <PartNode
                key={p.id}
                part={p}
                plan={plan}
                font={font}
                planView={view === "plan"}
                onRef={onRef}
              />
            ))}
        </group>
        <LabelProjector specs={specs} onChange={setLabels} />
        {!readOnly && selectedObj && selected && (
          <>
            <Selection target={selectedObj} />
            <TransformControls
              object={selectedObj}
              mode={tool === "move" ? "translate" : "rotate"}
              space="world"
              showX={tool === "move"}
              showY={tool === "rotate"}
              showZ={tool === "move"}
              translationSnap={0.1}
              rotationSnap={Math.PI / 12}
              size={0.8}
              onMouseDown={() => beginDrag()}
              onMouseUp={() => endDrag()}
              onObjectChange={() => {
                const o = selectedObj;
                const rot =
                  Math.round(((o.rotation.z * 180) / Math.PI) * 100) / 100;
                dragPart(
                  selected.id,
                  Math.round(o.position.x * 100) / 100,
                  Math.round(o.position.y * 100) / 100,
                  rot,
                );
              }}
            />
          </>
        )}
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {labels.map((l) => (
          <div
            key={l.key}
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${l.cls}`}
            style={{ left: l.x, top: l.y }}
          >
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
