"""Booth parts library: every part is built from parameters with real sizes (metres)
and records its own quantities so a bill of quantities can be priced afterwards."""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

BOQ = []  # (category, item, qty, unit, rate_key)


def boq(category, item, qty, unit, rate_key):
    BOQ.append((category, item, round(qty, 2), unit, rate_key))


# ---------------------------------------------------------------- scene setup

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    BOQ.clear()
    MATS.clear()


def setup_render(samples=96, width=1600, height=900, device="GPU"):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    if device == "GPU":
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.refresh_devices()
        for d in prefs.devices:
            d.use = d.type == "METAL"
    scene.cycles.device = device
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    world = bpy.data.worlds.new("Hall")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.012, 0.013, 0.018, 1)
    bg.inputs["Strength"].default_value = 1.0
    scene.world = world


# ---------------------------------------------------------------- materials

MATS = {}


def _new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links, m.node_tree.nodes["Principled BSDF"]


def mat_basic(name, color, rough=0.4, metal=0.0, coat=0.0):
    if name in MATS:
        return MATS[name]
    m, _, _, p = _new_mat(name)
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Coat Weight"].default_value = coat
    MATS[name] = m
    return m


def mat_emit(name, color, strength=6.0):
    if name in MATS:
        return MATS[name]
    m, nodes, links, p = _new_mat(name)
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Emission Color"].default_value = (*color, 1)
    p.inputs["Emission Strength"].default_value = strength
    MATS[name] = m
    return m


def mat_glass(name="Glass"):
    if name in MATS:
        return MATS[name]
    m, _, _, p = _new_mat(name)
    p.inputs["Base Color"].default_value = (0.85, 0.92, 1.0, 1)
    p.inputs["Roughness"].default_value = 0.03
    p.inputs["Transmission Weight"].default_value = 1.0
    p.inputs["IOR"].default_value = 1.45
    MATS[name] = m
    return m


def mat_led_dots(name, colors, density=16.0, strength=3.2, flow=0.35):
    """LED mesh skin: a dot grid whose colour flows along the length (UV u, metres)."""
    if name in MATS:
        return MATS[name]
    m, n, l, p = _new_mat(name)
    p.inputs["Base Color"].default_value = (0.02, 0.02, 0.04, 1)
    p.inputs["Roughness"].default_value = 0.35
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (density, density, density)
    l.new(tc.outputs["UV"], mp.inputs["Vector"])
    vor = n.new("ShaderNodeTexVoronoi")
    vor.inputs["Randomness"].default_value = 0.0
    l.new(mp.outputs["Vector"], vor.inputs["Vector"])
    dots = n.new("ShaderNodeValToRGB")
    dots.color_ramp.elements[0].position = 0.13
    dots.color_ramp.elements[0].color = (1, 1, 1, 1)
    dots.color_ramp.elements[1].position = 0.19
    dots.color_ramp.elements[1].color = (0, 0, 0, 1)
    l.new(vor.outputs["Distance"], dots.inputs["Fac"])
    wave = n.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = flow
    wave.inputs["Distortion"].default_value = 2.0
    l.new(tc.outputs["UV"], wave.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].color = (*colors[0], 1)
    els[1].color = (*colors[-1], 1)
    if len(colors) > 2:
        mid = els.new(0.5)
        mid.color = (*colors[1], 1)
    l.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    em = n.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = strength
    l.new(ramp.outputs["Color"], em.inputs["Color"])
    mix = n.new("ShaderNodeMixShader")
    l.new(dots.outputs["Color"], mix.inputs["Fac"])
    l.new(p.outputs["BSDF"], mix.inputs[1])
    l.new(em.outputs["Emission"], mix.inputs[2])
    out = n["Material Output"]
    l.new(mix.outputs["Shader"], out.inputs["Surface"])
    MATS[name] = m
    return m


def mat_screen(name, colors, strength=2.2, scale=2.5):
    """Screen / LED wall content: soft moving-graphics look."""
    if name in MATS:
        return MATS[name]
    m, n, l, p = _new_mat(name)
    tc = n.new("ShaderNodeTexCoord")
    tex = n.new("ShaderNodeTexMagic")
    tex.inputs["Scale"].default_value = scale
    tex.inputs["Distortion"].default_value = 1.5
    l.new(tc.outputs["UV"], tex.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].color = (*colors[0], 1)
    els[1].color = (*colors[-1], 1)
    if len(colors) > 2:
        els.new(0.55).color = (*colors[1], 1)
    l.new(tex.outputs["Fac"], ramp.inputs["Fac"])
    em = n.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = strength
    l.new(ramp.outputs["Color"], em.inputs["Color"])
    l.new(em.outputs["Emission"], n["Material Output"].inputs["Surface"])
    MATS[name] = m
    return m


def mat_wood(name="Oak", light=(0.62, 0.42, 0.24), dark=(0.38, 0.22, 0.11), scale=3.0):
    if name in MATS:
        return MATS[name]
    m, n, l, p = _new_mat(name)
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale * 0.08, scale)
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    wave = n.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 2.0
    wave.inputs["Distortion"].default_value = 6.0
    wave.inputs["Detail"].default_value = 4.0
    l.new(mp.outputs["Vector"], wave.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].color = (*light, 1)
    l.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.45
    p.inputs["Coat Weight"].default_value = 0.2
    MATS[name] = m
    return m


def mat_grass(name="Grass", scale=60.0):
    if name in MATS:
        return MATS[name]
    m, n, l, p = _new_mat(name)
    tc = n.new("ShaderNodeTexCoord")
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 8.0
    l.new(tc.outputs["Object"], noise.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.04, 0.16, 0.02, 1)
    ramp.color_ramp.elements[1].color = (0.30, 0.58, 0.10, 1)
    l.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], p.inputs["Base Color"])
    bump = n.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.8
    l.new(noise.outputs["Fac"], bump.inputs["Height"])
    l.new(bump.outputs["Normal"], p.inputs["Normal"])
    p.inputs["Roughness"].default_value = 0.9
    MATS[name] = m
    return m


def mat_sky_grass_graphic(name="SkyGrassPrint"):
    """Printed header graphic: blue sky fading to a grass edge (UV v = height 0..1)."""
    if name in MATS:
        return MATS[name]
    m, n, l, p = _new_mat(name)
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["UV"], sep.inputs["Vector"])
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 180.0
    l.new(tc.outputs["UV"], noise.inputs["Vector"])
    mathn = n.new("ShaderNodeMath")
    mathn.operation = "MULTIPLY_ADD"
    mathn.inputs[1].default_value = 0.35
    l.new(noise.outputs["Fac"], mathn.inputs[0])
    l.new(sep.outputs["Y"], mathn.inputs[2])
    ramp = n.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.32, (0.10, 0.40, 0.04, 1)
    e[1].position, e[1].color = 1.0, (0.62, 0.82, 1.0, 1)
    e.new(0.52).color = (0.45, 0.75, 0.25, 1)
    e.new(0.62).color = (0.78, 0.90, 1.0, 1)
    l.new(mathn.outputs["Value"], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Emission Color"].default_value = (1, 1, 1, 1)
    l.new(ramp.outputs["Color"], p.inputs["Emission Color"])
    p.inputs["Emission Strength"].default_value = 0.6
    p.inputs["Roughness"].default_value = 0.6
    MATS[name] = m
    return m


# ---------------------------------------------------------------- mesh helpers

def _obj(name, mesh, mat=None, collection=None):
    ob = bpy.data.objects.new(name, mesh)
    (collection or bpy.context.scene.collection).objects.link(ob)
    if mat:
        mesh.materials.append(mat)
    for poly in mesh.polygons:
        poly.use_smooth = False
    return ob


def box(name, size, center, mat, rot_z=0.0, bevel=0.0):
    sx, sy, sz = (s / 2 for s in size)
    verts = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
             (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    _box_uv(me, size)
    ob = _obj(name, me, mat)
    ob.location = center
    ob.rotation_euler.z = rot_z
    if bevel:
        b = ob.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 3
    return ob


def _box_uv(me, size):
    uv = me.uv_layers.new()
    sx, sy, sz = size
    for poly in me.polygons:
        nrm = poly.normal
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if abs(nrm.z) > 0.5:
                u, v = co.x + sx / 2, co.y + sy / 2
            elif abs(nrm.y) > 0.5:
                u, v = co.x + sx / 2, co.z + sz / 2
            else:
                u, v = co.y + sy / 2, co.z + sz / 2
            uv.data[li].uv = (u, v)


def cylinder(name, radius, depth, center, mat, segments=48, radius2=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius,
                          radius2=radius if radius2 is None else radius2, depth=depth)
    bm.to_mesh(me)
    bm.free()
    ob = _obj(name, me, mat)
    for poly in me.polygons:
        poly.use_smooth = True
    ob.location = center
    return ob


def ribbon(name, points, height, mat, thickness=0.06, closed=False, normalized_v=False):
    """Vertical band following a 3D centre line: the base of the band sits on each point."""
    verts, faces, uvs = [], [], []
    length = 0.0
    lens = [0.0]
    for a, b in zip(points, points[1:]):
        length += (Vector(b) - Vector(a)).length
        lens.append(length)
    for (x, y, z) in points:
        verts.append((x, y, z))
        verts.append((x, y, z + height))
    n = len(points)
    rng = n if closed else n - 1
    for i in range(rng):
        j = (i + 1) % n
        faces.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uv = me.uv_layers.new()
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            pi = vi // 2
            u = lens[pi] if not (closed and pi == 0 and poly.index == rng - 1) else length + (
                (Vector(points[0]) - Vector(points[-1])).length)
            v = (vi % 2) * (1.0 if normalized_v else height)
            uv.data[li].uv = (u, v)
    ob = _obj(name, me, mat)
    for poly in me.polygons:
        poly.use_smooth = True
    s = ob.modifiers.new("Thickness", "SOLIDIFY")
    s.thickness = thickness
    s.offset = 0
    return ob, length


def arc_points(cx, cy, r, a0, a1, z0=0.0, z1=None, steps=64):
    z1 = z0 if z1 is None else z1
    pts = []
    for i in range(steps + 1):
        t = i / steps
        a = math.radians(a0 + (a1 - a0) * t)
        z = z0 + (z1 - z0) * (0.5 - 0.5 * math.cos(math.pi * t))
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a), z))
    return pts


def bezier_points(p0, p1, p2, p3, steps=64):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1 - t
        pts.append(tuple(mt ** 3 * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t ** 3 * d
                         for a, b, c, d in zip(p0, p1, p2, p3)))
    return pts


def text(name, body, location, size, mat, rot_z=0.0, extrude=0.03, align="CENTER", facing="-Y"):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = "CENTER"
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    cu.materials.append(mat)
    ob.location = location
    ob.rotation_euler = (math.radians(90), 0, rot_z)
    return ob


# ---------------------------------------------------------------- booth parts

def hall_floor(size=80):
    box("HallFloor", (size, size, 0.02), (0, 0, -0.01),
        mat_basic("HallFloor", (0.10, 0.10, 0.11), rough=0.28, coat=0.3))


def platform(w, d, h=0.10, finish="white", edge_light=True, accent=(0.3, 0.6, 1.0)):
    mat = {"white": mat_basic("PlatformWhite", (0.88, 0.89, 0.9), rough=0.12, coat=0.6),
           "wood": mat_wood("FloorOak", light=(0.72, 0.52, 0.32), dark=(0.55, 0.36, 0.2), scale=1.2)}[finish]
    box("Platform", (w, d, h), (0, 0, h / 2), mat)
    boq("Flooring", f"Raised platform {w}x{d} m, {finish} finish", w * d * 10.764, "sq ft", "platform_sqft")
    if edge_light:
        em = mat_emit("EdgeLight", accent, 8)
        t = 0.03
        for nm, s, c in (("EdgeF", (w, t, 0.03), (0, -d / 2 - t / 2, h * 0.5)),
                         ("EdgeB", (w, t, 0.03), (0, d / 2 + t / 2, h * 0.5)),
                         ("EdgeL", (t, d, 0.03), (-w / 2 - t / 2, 0, h * 0.5)),
                         ("EdgeR", (t, d, 0.03), (w / 2 + t / 2, 0, h * 0.5))):
            box(nm, s, c, em)
        boq("Lighting", "LED edge strip around platform", 2 * (w + d), "rm", "led_strip_rm")
    return h


def wall(name, w, h, center_xy, base_z, mat, rot_z=0.0, thick=0.12, finish="laminate"):
    box(name, (w, thick, h), (center_xy[0], center_xy[1], base_z + h / 2), mat, rot_z=rot_z)
    rate = {"laminate": "fabrication_sqft", "wood": "wood_fabrication_sqft"}[finish]
    boq("Fabrication", f"{name} wall {w}x{h} m ({finish})", w * h * 10.764, "sq ft", rate)


def led_panel(name, w, h, center, rot_z, mat, rental=True):
    box(name, (w, 0.08, h), center, mat, rot_z=rot_z)
    boq("AV / LED", f"{name} LED screen {w}x{h} m", w * h, "sq m", "led_screen_sqm")


def led_ribbon(name, points, height, mat, thickness=0.12):
    ob, length = ribbon(name, points, height, mat, thickness=thickness)
    boq("AV / LED", f"{name} flexible LED ribbon {length:.1f} m x {height} m", length * height, "sq m",
        "flexible_led_sqm")
    return ob


def white_band(name, points, height, closed=False):
    ob, length = ribbon(name, points, height, mat_basic("BandWhite", (0.92, 0.93, 0.95), rough=0.25),
                        thickness=0.16, closed=closed)
    boq("Fabrication", f"{name} curved fascia band {length:.1f} m x {height} m", length * height * 10.764,
        "sq ft", "curved_fabrication_sqft")
    return ob


def slat_wall(name, x0, x1, y, base_z, h, slat=0.06, gap=0.12, depth=0.10, mat=None, backlit=None):
    mat = mat or mat_basic("SlatBlack", (0.03, 0.03, 0.035), rough=0.3)
    n = int((x1 - x0) / (slat + gap))
    for i in range(n):
        x = x0 + i * (slat + gap) + slat / 2
        box(f"{name}_{i}", (slat, depth, h), (x, y, base_z + h / 2), mat)
    if backlit:
        box(f"{name}_backlight", (x1 - x0, 0.03, h - 0.2), ((x0 + x1) / 2, y + depth / 2 + 0.08, base_z + h / 2),
            backlit)
    boq("Fabrication", f"{name} slat wall {x1 - x0:.1f} m x {h} m ({n} slats)", (x1 - x0) * h * 10.764, "sq ft",
        "slat_wall_sqft")


def touch_table(name, x, y, base_z, rot_z=0.0, screen=None):
    white = mat_basic("KioskWhite", (0.93, 0.94, 0.95), rough=0.2, coat=0.4)
    box(f"{name}_base", (1.1, 0.7, 0.85), (x, y, base_z + 0.425), white, rot_z=rot_z, bevel=0.03)
    top = box(f"{name}_screen", (1.0, 0.6, 0.03), (x, y, base_z + 0.87), screen, rot_z=rot_z)
    top.rotation_euler.x = math.radians(-8)
    boq("AV / LED", "Interactive touch table 55 in", 1, "nos", "touch_table")


def totem(name, x, y, base_z, rot_z=0.0, screen=None, h=2.0):
    white = mat_basic("KioskWhite", (0.93, 0.94, 0.95), rough=0.2, coat=0.4)
    box(f"{name}_body", (0.65, 0.35, h), (x, y, base_z + h / 2), white, rot_z=rot_z, bevel=0.02)
    off = Vector((0, -0.18, 0))
    off.rotate(Matrix.Rotation(rot_z, 3, "Z"))
    box(f"{name}_screen", (0.52, 0.02, 0.95), (x + off.x, y + off.y, base_z + h * 0.6), screen, rot_z=rot_z)
    boq("AV / LED", "Digital totem 43 in", 1, "nos", "totem")


def counter(name, x, y, base_z, w=2.6, rot_z=0.0, glow=None, brand_mat=None, label=None):
    white = mat_basic("CounterWhite", (0.95, 0.95, 0.96), rough=0.15, coat=0.7)
    box(f"{name}_body", (w, 0.7, 1.05), (x, y, base_z + 0.525), white, rot_z=rot_z, bevel=0.05)
    if glow:
        box(f"{name}_glow", (w * 0.96, 0.72, 0.04), (x, y, base_z + 0.08), glow, rot_z=rot_z)
    if label and brand_mat:
        text(f"{name}_label", label, (x, y - 0.37, base_z + 0.62), 0.16, brand_mat, rot_z=rot_z)
    boq("Furniture", f"Reception counter {w} m with logo", 1, "nos", "counter")


def chair(name, x, y, base_z, rot_z=0.0, color=(0.92, 0.92, 0.93)):
    m = mat_basic(f"Chair{color}", color, rough=0.35)
    cylinder(f"{name}_stem", 0.03, 0.42, (x, y, base_z + 0.21), mat_basic("Chrome", (0.8, 0.8, 0.82), 0.15, 1.0))
    cylinder(f"{name}_seat", 0.24, 0.06, (x, y, base_z + 0.45), m)
    back = Vector((0, 0.2, 0))
    back.rotate(Matrix.Rotation(rot_z, 3, "Z"))
    box(f"{name}_back", (0.42, 0.05, 0.38), (x + back.x, y + back.y, base_z + 0.68), m, rot_z=rot_z, bevel=0.02)
    boq("Furniture", "Chair", 1, "nos", "chair")


def round_table(name, x, y, base_z, top_mat=None):
    top_mat = top_mat or mat_basic("TableTop", (0.95, 0.95, 0.96), rough=0.15, coat=0.5)
    cylinder(f"{name}_leg", 0.04, 0.72, (x, y, base_z + 0.36), mat_basic("Chrome", (0.8, 0.8, 0.82), 0.15, 1.0))
    cylinder(f"{name}_top", 0.4, 0.03, (x, y, base_z + 0.73), top_mat)
    boq("Furniture", "Round table", 1, "nos", "table")


def lounge(name, x, y, base_z, rot_z=0.0, seats=4, color=(0.92, 0.92, 0.93)):
    round_table(f"{name}_t", x, y, base_z)
    for i in range(seats):
        a = rot_z + 2 * math.pi * i / seats
        chair(f"{name}_c{i}", x + 0.85 * math.cos(a), y + 0.85 * math.sin(a), base_z, rot_z=a - math.pi / 2,
              color=color)


def sofa(name, x, y, base_z, w=1.8, rot_z=0.0, color=(0.95, 0.68, 0.12)):
    m = mat_basic(f"Sofa{color}", color, rough=0.7)
    box(f"{name}_seat", (w, 0.8, 0.42), (x, y, base_z + 0.21), m, rot_z=rot_z, bevel=0.06)
    back = Vector((0, 0.32, 0))
    back.rotate(Matrix.Rotation(rot_z, 3, "Z"))
    box(f"{name}_back", (w, 0.18, 0.5), (x + back.x, y + back.y, base_z + 0.62), m, rot_z=rot_z, bevel=0.06)
    boq("Furniture", "Lounge sofa", 1, "nos", "sofa")


def plant(name, x, y, base_z, size=1.0, pot=(0.88, 0.88, 0.86), kind="bush"):
    pm = mat_basic(f"Pot{pot}", pot, rough=0.5)
    leaf = mat_basic("Leaf", (0.05, 0.22, 0.05), rough=0.55)
    cylinder(f"{name}_pot", 0.18 * size, 0.38 * size, (x, y, base_z + 0.19 * size), pm, radius2=0.22 * size)
    tex = bpy.data.textures.get("LeafNoise") or bpy.data.textures.new("LeafNoise", "CLOUDS")
    tex.noise_scale = 0.18
    blobs = [(0, 0, 0.62, 0.32)] if kind == "bush" else [(0, 0, 0.9, 0.3), (0.12, 0.08, 1.35, 0.26),
                                                       (-0.1, -0.06, 1.7, 0.22)]
    for i, (dx, dy, dz, r) in enumerate(blobs):
        me = bpy.data.meshes.new(f"{name}_leaf{i}")
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=4, radius=r * size)
        bm.to_mesh(me)
        bm.free()
        ob = _obj(f"{name}_leaf{i}", me, leaf)
        for poly in me.polygons:
            poly.use_smooth = True
        ob.location = (x + dx * size, y + dy * size, base_z + dz * size)
        d = ob.modifiers.new("Leafy", "DISPLACE")
        d.texture = tex
        d.strength = 0.22 * size
    if kind == "tree":
        cylinder(f"{name}_trunk", 0.03 * size, 1.2 * size, (x, y, base_z + 0.8 * size),
                 mat_basic("Trunk", (0.25, 0.16, 0.08), 0.8))
    boq("Decor", f"Live plant ({kind})", 1, "nos", "plant_large" if kind == "tree" or size > 1.3 else "plant_small")


def area_light(name, location, size, energy, color=(1, 1, 1), rot=(0, 0, 0)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.size = size
    ld.energy = energy
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    ob.location = location
    ob.rotation_euler = rot
    bpy.context.scene.collection.objects.link(ob)
    return ob


def spot(name, location, target, energy=800, angle=45, color=(1, 0.95, 0.88)):
    ld = bpy.data.lights.new(name, "SPOT")
    ld.energy = energy
    ld.spot_size = math.radians(angle)
    ld.spot_blend = 0.6
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    ob.location = location
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    boq("Lighting", "Spot / profile light", 1, "nos", "light_fixture")
    return ob


def camera(name, location, target, lens=30):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    ob = bpy.data.objects.new(name, cd)
    ob.location = location
    ob.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(ob)
    return ob
