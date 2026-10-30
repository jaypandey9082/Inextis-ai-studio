// Makes the Blender exports look right in a web 3D viewer: removes the studio
// floor and replaces procedural (Blender-only) materials with flat glTF colours.
// Run after import-booths: node scripts/fix-glb.mjs
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";

const pub = path.resolve(import.meta.dirname, "../public/booths");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// name -> [baseColor rgb, emissive rgb, emissive strength]
const looks = {
  LEDRibbon: [[0.1, 0.05, 0.3], [0.42, 0.16, 1.0], 2.2],
  LEDIce: [[0.2, 0.3, 0.45], [0.55, 0.75, 1.0], 1.6],
  Screen: [[0.05, 0.1, 0.3], [0.12, 0.42, 1.0], 1.8],
  TextGlow: [[1, 1, 1], [1, 1, 1], 2.0],
  Oak: [[0.72, 0.52, 0.32]],
  FloorOak: [[0.62, 0.44, 0.27]],
  DoorWood: [[0.48, 0.32, 0.2]],
  GrassCarpet: [[0.28, 0.56, 0.16]],
  GrassTop: [[0.3, 0.6, 0.18]],
  Moss: [[0.2, 0.42, 0.12]],
  SkyGrassPrint: [[0.93, 0.97, 0.92], [0.85, 0.95, 0.8], 0.6],
};

for (const file of ["nova_tech_pavilion", "greenleaf_eco_pavilion"]) {
  const target = path.join(pub, `${file}.glb`);
  const doc = await io.read(target);
  const root = doc.getRoot();
  const strengthExt = doc.createExtension(KHRMaterialsEmissiveStrength);

  for (const node of root.listNodes()) {
    if (node.getName().startsWith("HallFloor")) node.dispose();
  }
  for (const mat of root.listMaterials()) {
    const look = looks[mat.getName()];
    if (!look) continue;
    const [base, emissive = [0, 0, 0], strength = 1] = look;
    mat.setBaseColorTexture(null).setEmissiveTexture(null);
    mat.setBaseColorFactor([...base, 1]).setEmissiveFactor(emissive).setRoughnessFactor(0.6).setMetallicFactor(0);
    if (strength !== 1) mat.setExtension("KHR_materials_emissive_strength", strengthExt.createEmissiveStrength().setEmissiveStrength(strength));
  }
  await io.write(target, doc);
  console.log("fixed", file);
}
