"""Render a booth exported from the Inextis AI Studio editor.

The editor exports the exact geometry as GLB; this script imports it, swaps each
material (matched by name) for its photo-quality version from kit.py, turns text
planes into real extruded 3D letters, adds the hall, lights and cameras, renders
the requested views and saves .blend and .fbx files.

Run:  blender -b --factory-startup -P render_glb.py -- job.json
"""

import json
import math
import os
import sys
import time

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402


def say(*parts):
    print(*parts, flush=True)


def material_for(base, job):
    pal = job["palette"]
    led = [tuple(c) for c in pal["led"]]
    screen = [tuple(c) for c in pal["screen"]]
    table = {
        "Laminate": lambda: kit.mat_basic("Laminate", (0.92, 0.93, 0.95), rough=0.22, coat=0.4),
        "BandWhite": lambda: kit.mat_basic("BandWhite", (0.92, 0.93, 0.95), rough=0.25),
        "PlatformWhite": lambda: kit.mat_basic("PlatformWhite", (0.88, 0.89, 0.9), rough=0.12, coat=0.6),
        "KioskWhite": lambda: kit.mat_basic("KioskWhite", (0.93, 0.94, 0.95), rough=0.2, coat=0.4),
        "CounterWhite": lambda: kit.mat_basic("CounterWhite", (0.95, 0.95, 0.96), rough=0.15, coat=0.7),
        "TableTop": lambda: kit.mat_basic("TableTop", (0.95, 0.95, 0.96), rough=0.15, coat=0.5),
        "Oak": lambda: kit.mat_wood("Oak"),
        "FloorOak": lambda: kit.mat_wood("FloorOak", light=(0.72, 0.52, 0.32), dark=(0.55, 0.36, 0.2), scale=1.2),
        "DoorWood": lambda: kit.mat_wood("DoorWood", light=(0.45, 0.3, 0.18), dark=(0.3, 0.18, 0.1), scale=2),
        "LEDRibbon": lambda: kit.mat_led_dots("LEDRibbon", led),
        "LEDIce": lambda: kit.mat_led_dots("LEDIce", [(0.6, 0.85, 1.0), (0.2, 0.5, 1.0)], density=9, strength=5, flow=0.6),
        "Screen": lambda: kit.mat_screen("Screen", screen),
        "Glow": lambda: kit.mat_emit("Glow", tuple(pal["glow"]), 10),
        "EdgeLight": lambda: kit.mat_emit("EdgeLight", tuple(job["accent"]), 8),
        "TextGlow": lambda: kit.mat_emit("TextGlow", (1, 1, 1), 5),
        "BrandGreen": lambda: kit.mat_basic("BrandGreen", (0.02, 0.22, 0.06), rough=0.4),
        "Ink": lambda: kit.mat_basic("Ink", (0.05, 0.08, 0.3), 0.4),
        "SlatBlack": lambda: kit.mat_basic("SlatBlack", (0.03, 0.03, 0.035), rough=0.3),
        "Chrome": lambda: kit.mat_basic("Chrome", (0.8, 0.8, 0.82), 0.15, 1.0),
        "Leaf": lambda: kit.mat_basic("Leaf", (0.05, 0.22, 0.05), rough=0.55),
        "Trunk": lambda: kit.mat_basic("Trunk", (0.25, 0.16, 0.08), 0.8),
        "Moss": lambda: kit.mat_grass("Moss", scale=25.0),
        "GrassTop": lambda: kit.mat_grass("GrassTop", scale=40),
        "GrassCarpet": lambda: kit.mat_grass("GrassCarpet", scale=90),
        "Bamboo": lambda: kit.mat_basic("Bamboo", (0.62, 0.46, 0.22), 0.45, coat=0.3),
        "BambooBack": lambda: kit.mat_basic("BambooBack", (0.12, 0.08, 0.05), 0.6),
        "Wire": lambda: kit.mat_basic("Wire", (0.1, 0.1, 0.1), 0.4),
        "Bezel": lambda: kit.mat_basic("Bezel", (0.02, 0.02, 0.02), 0.3),
        "SkyGrassPrint": lambda: kit.mat_sky_grass_graphic(),
        "Glass": lambda: kit.mat_glass("Glass"),
    }
    make = table.get(base)
    return make() if make else None


def replace_materials(job):
    swapped, kept = 0, 0
    for ob in list(bpy.data.objects):
        if ob.type != "MESH":
            continue
        for slot in ob.material_slots:
            if not slot.material:
                continue
            base = slot.material.name.split(".")[0]
            new = material_for(base, job)
            if new:
                slot.material = new
                swapped += 1
            else:
                # coloured chairs, sofas, pots and graphics keep their imported colour
                bsdf = slot.material.node_tree.nodes.get("Principled BSDF") if slot.material.use_nodes else None
                if bsdf:
                    bsdf.inputs["Roughness"].default_value = 0.45
                kept += 1
    say(f"MATERIALS swapped={swapped} kept={kept}")


def replace_text(job):
    styles = {"white_glow": lambda: kit.mat_emit("TextGlow", (1, 1, 1), 5),
              "brand_green": lambda: kit.mat_basic("BrandGreen", (0.02, 0.22, 0.06), rough=0.4),
              "ink": lambda: kit.mat_basic("Ink", (0.05, 0.08, 0.3), 0.4)}
    count = 0
    for ob in list(bpy.data.objects):
        body = ob.get("inextis_text")
        if not body:
            continue
        size = float(ob.get("inextis_text_size", 0.4))
        style = ob.get("inextis_text_style", "white_glow")
        m = ob.matrix_world
        # the importer adds its own axis rotation to each node, so use the plane's real face normal
        normal = (m.to_3x3() @ ob.data.polygons[0].normal) if ob.data.polygons else Vector((0, -1, 0))
        rot_z = math.atan2(normal.x, -normal.y)
        loc = m.to_translation()
        bpy.data.objects.remove(ob, do_unlink=True)
        kit.text(f"Text_{count}", body, (loc.x, loc.y, loc.z), size, styles.get(style, styles["white_glow"])(), rot_z=rot_z)
        count += 1
    say(f"TEXT replaced={count}")


def main():
    job = json.load(open(sys.argv[sys.argv.index("--") + 1]))
    t0 = time.time()
    out = job["out"]
    os.makedirs(out, exist_ok=True)
    final = job["quality"] == "final"
    res = (1920, 1080) if final else (1280, 720)
    kit.reset_scene()
    kit.setup_render(128 if final else 28, *res, device=job.get("device", "GPU"))
    kit.hall_floor()

    bpy.ops.import_scene.gltf(filepath=job["glb"])
    replace_materials(job)
    replace_text(job)

    lt = job["lighting"]
    w, d = job["size"]
    kit.area_light("Top", (0, 0, 10), max(w, d) * 1.1, lt["topEnergy"], tuple(lt["tint"]))
    kit.area_light("Fill", (0, -d - 8, 6), 10, lt["topEnergy"] * 0.35, tuple(lt["tint"]), rot=(math.radians(60), 0, 0))
    for i, s in enumerate(lt["spots"]):
        kit.spot(f"Spot{i}", s, (0, 0, 1.2), energy=1600, angle=50, color=tuple(lt["tint"]))

    views = job["views"]
    images = []
    for i, v in enumerate(views):
        cam = kit.camera(f"Cam_{v['name']}", v["loc"], v["target"], v["lens"])
        bpy.context.scene.camera = cam
        path = os.path.join(out, f"{v['name']}.png")
        bpy.context.scene.render.filepath = path
        say(f"PROGRESS {i}/{len(views)} rendering {v['name']}")
        bpy.ops.render.render(write_still=True)
        images.append(path)
        say(f"RENDERED {path}")

    say("PROGRESS saving files")
    blend = os.path.join(out, f"{job['name']}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    fbx = os.path.join(out, f"{job['name']}.fbx")
    bpy.ops.export_scene.fbx(filepath=fbx, use_selection=False, object_types={"MESH", "EMPTY", "CAMERA", "LIGHT"}, apply_scale_options="FBX_SCALE_ALL")
    say(f"FILES {json.dumps([blend, fbx])}")
    say(f"DONE {time.time() - t0:.1f}")


try:
    main()
except Exception as e:  # report to the job runner
    import traceback

    traceback.print_exc()
    print(f"FAILED {e}", flush=True)
    sys.exit(1)
