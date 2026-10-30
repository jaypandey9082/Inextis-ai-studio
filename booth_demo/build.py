"""Build a booth from a JSON plan, render it, export it and price it.

Run:  blender -b --factory-startup -P build.py -- plans/<plan>.json [--samples 96] [--res 1600 900] [--views aerial,front]
"""

import argparse
import csv
import json
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))


def resolve_path(p):
    if p["kind"] == "arc":
        closed = (p["a1"] - p["a0"]) >= 360
        pts = kit.arc_points(p["cx"], p["cy"], p["r"], p["a0"], p["a1"], p.get("z0", 0.0), p.get("z1"), steps=128)
        return pts[:-1] if closed else pts
    if p["kind"] == "spiral":
        pts = []
        steps = 96
        for i in range(steps + 1):
            t = i / steps
            ease = t * t * (3 - 2 * t)
            a = math.radians(p["a0"] + (p["a1"] - p["a0"]) * t)
            r = p["r0"] + (p["r1"] - p["r0"]) * ease
            z = p["z0"] + (p["z1"] - p["z0"]) * ease
            pts.append((p["cx"] + r * math.cos(a), p["cy"] + r * math.sin(a), z))
        return pts
    raise ValueError(f"unknown path kind {p['kind']}")


def build(plan):
    w, d = plan["size"]
    pal = plan["palette"]
    pf = plan["platform"]
    kit.hall_floor()
    ph = kit.platform(w, d, pf.get("height", 0.1), pf["finish"], pf.get("edge_light", True),
                      tuple(pf.get("accent", (0.3, 0.6, 1.0))))

    white = kit.mat_basic("Laminate", (0.92, 0.93, 0.95), rough=0.22, coat=0.4)
    wood = kit.mat_wood("Oak")
    led = kit.mat_led_dots("LEDRibbon", [tuple(c) for c in pal.get("led", [(0.5, 0.2, 1), (0.1, 0.5, 1)])])
    led_ice = kit.mat_led_dots("LEDIce", [(0.6, 0.85, 1.0), (0.2, 0.5, 1.0)], density=9, strength=5, flow=0.6)
    screen = kit.mat_screen("Screen", [tuple(c) for c in pal["screen"]])
    glow = kit.mat_emit("Glow", tuple(pal.get("glow", (0.3, 0.5, 1.0))), 10)
    text_mats = {"white_glow": kit.mat_emit("TextGlow", (1, 1, 1), 5),
                 "brand_green": kit.mat_basic("BrandGreen", (0.02, 0.22, 0.06), rough=0.4)}
    finish_mat = {"laminate": white, "wood": wood}

    for part in plan["parts"]:
        t = part["type"]
        if t == "block":
            sx, sy, sz = part["size"]
            cx, cy = part["center"]
            kit.box(part["name"], (sx, sy, sz), (cx, cy, ph + sz / 2), finish_mat[part["finish"]])
            rate = "fabrication_sqft" if part["finish"] == "laminate" else "wood_fabrication_sqft"
            kit.boq("Fabrication", f"{part['name']} structure {sx}x{sy}x{sz} m ({part['finish']})",
                    2 * (sx + sy) * sz * 10.764, "sq ft", rate)
        elif t == "wall":
            rot = math.radians(part.get("rot", 0))
            kit.wall(part["name"], part["w"], part["h"], (part["x"], part["y"]), ph, finish_mat[
                "laminate" if part["finish"] == "laminate" else "wood"], rot_z=rot, finish=part["finish"])
        elif t == "led_panel":
            content = {"dots": led, "dots_ice": led_ice, "screen": screen}[part["content"]]
            rot = math.radians(part.get("rot", 0))
            if part.get("frame"):
                kit.box(f"{part['name']}_frame", (part["w"] + 0.3, 0.2, part["h"] + 0.3),
                        (part["x"], part["y"] + 0.12, part["z"]), white, rot_z=rot)
                kit.boq("Fabrication", f"{part['name']} frame", (part["w"] + 0.3) * (part["h"] + 0.3) * 10.764,
                        "sq ft", "fabrication_sqft")
            kit.led_panel(part["name"], part["w"], part["h"], (part["x"], part["y"], part["z"]), rot, content)
        elif t == "led_ribbon":
            kit.led_ribbon(part["name"], resolve_path(part["path"]), part["height"], led)
        elif t == "white_band":
            pts = resolve_path(part["path"])
            if part["path"].get("z0") is None:
                pts = [(x, y, ph) for (x, y, _) in pts]
            kit.white_band(part["name"], pts, part["height"], closed=part.get("closed", False))
        elif t == "floor_arc":
            pts = [(x, y, ph) for (x, y, _) in resolve_path(part["path"])]
            _, length = kit.ribbon(part["name"], pts, 0.012, glow, thickness=0.05)
            kit.boq("Lighting", f"{part['name']} floor light line", length, "rm", "led_strip_rm")
        elif t == "column":
            mat = white if part.get("white", True) else kit.mat_basic("Chrome", (0.8, 0.8, 0.82), 0.15, 1.0)
            kit.cylinder(part["name"], 0.11, part["h"], (part["x"], part["y"], ph + part["h"] / 2), mat)
            kit.boq("Fabrication", f"{part['name']} support column {part['h']} m", 1, "nos", "column")
        elif t == "slat_wall":
            kit.slat_wall(part["name"], part["x0"], part["x1"], part["y"], ph, part["h"],
                          backlit=glow if part.get("backlit") else None)
        elif t == "text":
            kit.text(part["body"][:12], part["body"], (part["x"], part["y"], part["z"]), part["size"],
                     text_mats[part["mat"]], rot_z=math.radians(part.get("rot", 0)))
            kit.boq("Graphics", f"Brand lettering '{part['body']}'", len(part["body"]) * part["size"] * part[
                "size"] * 10.764, "sq ft", "graphics_sqft")
        elif t == "counter":
            kit.counter(part["name"], part["x"], part["y"], ph, w=part.get("w", 2.4), glow=glow,
                        brand_mat=kit.mat_basic("Ink", (0.05, 0.08, 0.3), 0.4),
                        label=part.get("label"))
        elif t == "touch_table":
            kit.touch_table(f"Touch{part['x']}", part["x"], part["y"], ph, math.radians(part.get("rot", 0)), screen)
        elif t == "totem":
            kit.totem(f"Totem{part['x']}", part["x"], part["y"], ph, part.get("rot", 0), screen)
        elif t == "seating_rows":
            for r in range(part["rows"]):
                for c in range(part["cols"]):
                    kit.chair(f"Seat{r}{c}", part["x0"] + c * part["dx"], part["y0"] - r * part["dy"], ph,
                              rot_z=math.pi, color=(0.12, 0.14, 0.2))
        elif t == "lounge":
            kit.lounge(part["name"], part["x"], part["y"], ph, seats=part.get("seats", 4))
        elif t == "sofa":
            kit.sofa(part["name"], part["x"], part["y"], ph, w=part.get("w", 1.8), rot_z=math.radians(part.get("rot", 0)))
        elif t == "plant":
            kit.plant(f"Plant{part['x']}_{part['y']}", part["x"], part["y"], ph, part.get("size", 1.0),
                      kind=part.get("kind", "bush"))
        elif t == "plant_row":
            n = part["count"]
            for i in range(n):
                x = part["x0"] + (part["x1"] - part["x0"]) * i / max(n - 1, 1)
                kit.plant(f"Row{i}", x, part["y"], ph, part["size"], pot=(0.35, 0.36, 0.38))
        elif t == "moss_panel":
            kit.box(part["name"], (part["w"], 0.06, part["h"]), (part["x"], part["y"], part["z"]),
                    kit.mat_grass("Moss", scale=25.0))
            kit.boq("Decor", f"{part['name']} preserved moss wall {part['w']}x{part['h']} m",
                    part["w"] * part["h"] * 10.764, "sq ft", "moss_wall_sqft")
        elif t == "tv":
            bez = kit.mat_basic("Bezel", (0.02, 0.02, 0.02), 0.3)
            kit.box(f"{part['name']}_bezel", (part["w"] + 0.06, 0.05, part["h"] + 0.06),
                    (part["x"], part["y"] + 0.01, part["z"]), bez)
            kit.box(part["name"], (part["w"], 0.05, part["h"]), (part["x"], part["y"] - 0.01, part["z"]), screen)
            kit.boq("AV / LED", f"{part['name']} 55 in display", 1, "nos", "tv_55")
        elif t == "beam":
            ln = part["x1"] - part["x0"]
            cx = (part["x0"] + part["x1"]) / 2
            kit.box(part["name"], (ln, part["depth"], part["h"]), (cx, part["y"], part["z"]), wood)
            kit.box(f"{part['name']}_print", (ln, 0.02, part["h"] - 0.06),
                    (cx, part["y"] - part["depth"] / 2 - 0.012, part["z"]), kit.mat_sky_grass_graphic())
            kit.boq("Fabrication", f"{part['name']} header beam {ln} m", ln * part["h"] * 2 * 10.764, "sq ft",
                    "wood_fabrication_sqft")
            kit.boq("Graphics", f"{part['name']} printed header graphic", ln * part["h"] * 10.764, "sq ft",
                    "graphics_sqft")
        elif t == "grass_strip":
            ln = part["x1"] - part["x0"]
            kit.box(part["name"], (ln, part["depth"], 0.14), ((part["x0"] + part["x1"]) / 2, part["y"], part["z"]),
                    kit.mat_grass("GrassTop", scale=40))
            kit.boq("Decor", f"{part['name']} grass topping", ln * part["depth"] * 10.764, "sq ft", "grass_carpet_sqft")
        elif t == "bamboo_panel":
            back = kit.mat_basic("BambooBack", (0.12, 0.08, 0.05), 0.6)
            bam = kit.mat_basic("Bamboo", (0.62, 0.46, 0.22), 0.45, coat=0.3)
            ln = part["x1"] - part["x0"]
            kit.box(f"{part['name']}_back", (ln + 0.2, 0.04, part["h"] + 0.2),
                    ((part["x0"] + part["x1"]) / 2, part["y"] + 0.05, ph + 0.4 + part["h"] / 2), back)
            n = int(ln / 0.11)
            for i in range(n):
                kit.cylinder(f"{part['name']}_{i}", 0.04, part["h"],
                             (part["x0"] + 0.05 + i * 0.11, part["y"], ph + 0.4 + part["h"] / 2), bam, segments=12)
            kit.boq("Fabrication", f"{part['name']} bamboo slat panel {ln:.1f} m", ln * part["h"] * 10.764, "sq ft",
                    "slat_wall_sqft")
        elif t == "door":
            dk = kit.mat_wood("DoorWood", light=(0.45, 0.3, 0.18), dark=(0.3, 0.18, 0.1), scale=2)
            kit.box(part["name"], (part["w"], 0.06, part["h"]), (part["x"], part["y"] - 0.06, ph + part["h"] / 2), dk)
            kit.box(f"{part['name']}_handle", (0.15, 0.04, 0.03), (part["x"] + 0.35, part["y"] - 0.11, ph + 1.05),
                    kit.mat_basic("Chrome", (0.8, 0.8, 0.82), 0.15, 1.0))
            kit.boq("Fabrication", "Store room door with lock", 1, "nos", "door")
        elif t == "grass_patch":
            kit.box(part["name"], (part["w"], part["d"], 0.014), (part["x"], part["y"], ph + 0.007),
                    kit.mat_grass("GrassCarpet", scale=90))
            kit.boq("Flooring", f"{part['name']} artificial grass {part['w']}x{part['d']} m",
                    part["w"] * part["d"] * 10.764, "sq ft", "grass_carpet_sqft")
        elif t == "hanging_plants":
            n = part["count"]
            wire = kit.mat_basic("Wire", (0.1, 0.1, 0.1), 0.4)
            for i in range(n):
                x = part["x0"] + (part["x1"] - part["x0"]) * i / max(n - 1, 1)
                kit.cylinder(f"Wire{i}", 0.006, 0.45, (x, part["y"], part["z"] + 0.62), wire, segments=6)
                kit.plant(f"Hang{i}", x, part["y"], part["z"], 0.42, pot=(0.95, 0.95, 0.95))
        elif t == "roof_planters":
            for i in range(part["nx"]):
                for j in range(part["ny"]):
                    x = part["x0"] + (part["x1"] - part["x0"]) * i / max(part["nx"] - 1, 1)
                    y = part["y0"] + (part["y1"] - part["y0"]) * j / max(part["ny"] - 1, 1)
                    kit.box(f"Planter{i}{j}", (0.55, 0.55, 0.25), (x, y, part["z"] + 0.125), white)
                    kit.plant(f"Roof{i}{j}", x, y, part["z"] + 0.05, 0.42, pot=(0.95, 0.95, 0.95))
        else:
            raise ValueError(f"unknown part type {t}")

    lt = plan["lighting"]
    kit.area_light("Top", (0, 0, 10), max(w, d) * 1.1, lt["top_energy"], tuple(lt["tint"]))
    kit.area_light("Fill", (0, -d - 8, 6), 10, lt["top_energy"] * 0.35, tuple(lt["tint"]),
                   rot=(math.radians(60), 0, 0))
    for i, s in enumerate(lt["spots"]):
        kit.spot(f"Spot{i}", s, (0, 0, 1.2), energy=1600, angle=50, color=tuple(lt["tint"]))
    return ph


def price(rate_card, out_csv):
    rows, subtotal = [], 0.0
    for cat, item, qty, unit, key in kit.BOQ:
        rate = rate_card[key]
        amt = qty * rate
        subtotal += amt
        rows.append([cat, item, qty, unit, rate, round(amt)])
    rows.sort(key=lambda r: (r[0], -r[5]))
    inst = subtotal * rate_card["install_dismantle_pct"] / 100
    fee = (subtotal + inst) * rate_card["management_fee_pct"] / 100
    pre_gst = subtotal + inst + fee
    gst = pre_gst * rate_card["gst_pct"] / 100
    with open(out_csv, "w", newline="") as f:
        wr = csv.writer(f)
        wr.writerow(["Category", "Item", "Qty", "Unit", "Rate (INR)", "Amount (INR)"])
        wr.writerows(rows)
        wr.writerow([])
        for label, val in (("Subtotal", subtotal), (f"Install & dismantle {rate_card['install_dismantle_pct']}%", inst),
                           (f"Management fee {rate_card['management_fee_pct']}%", fee), ("Total before GST", pre_gst),
                           (f"GST {rate_card['gst_pct']}%", gst), ("Total", pre_gst + gst)):
            wr.writerow(["", label, "", "", "", round(val)])
    return {"lines": len(rows), "subtotal": round(subtotal), "pre_gst": round(pre_gst), "total": round(pre_gst + gst)}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("plan")
    ap.add_argument("--samples", type=int, default=96)
    ap.add_argument("--res", type=int, nargs=2, default=[1600, 900])
    ap.add_argument("--views", default="")
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--device", default="GPU", choices=["GPU", "CPU"])
    a = ap.parse_args(argv)

    plan = json.load(open(os.path.join(HERE, a.plan) if not os.path.isabs(a.plan) else a.plan))
    out = os.path.join(HERE, "output")
    os.makedirs(out, exist_ok=True)
    kit.reset_scene()
    kit.setup_render(a.samples, *a.res, device=a.device)
    build(plan)

    wanted = set(a.views.split(",")) if a.views else None
    for v in plan["views"]:
        cam = kit.camera(f"Cam_{v['name']}", v["loc"], v["target"], v["lens"])
        if a.no_render or (wanted and v["name"] not in wanted):
            continue
        bpy.context.scene.camera = cam
        bpy.context.scene.render.filepath = os.path.join(out, f"{plan['name']}_{v['name']}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", bpy.context.scene.render.filepath)

    summary = price(json.load(open(os.path.join(HERE, "rate_card.json"))),
                    os.path.join(out, f"{plan['name']}_costing.csv"))
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, f"{plan['name']}.glb"), export_format="GLB",
                              export_apply=True, export_cameras=False, export_lights=False)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, f"{plan['name']}.blend"), compress=True)
    print("COST", json.dumps(summary))


main()
