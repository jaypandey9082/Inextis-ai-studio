// Copies the booth demo outputs (renders, 3D files, costing) into the app
// and writes src/data/booths.json. Run: node scripts/import-booths.mjs
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.resolve(root, "../booth_demo");
const pub = path.join(root, "public/booths");
fs.mkdirSync(pub, { recursive: true });

const slugs = {
  nova_tech_pavilion: { client: "NOVA Energy", sector: "Energy tech", status: "Ready for review", owner: "Design team" },
  greenleaf_eco_pavilion: { client: "GreenLeaf Fuels", sector: "Fuels / green energy", status: "Ready for review", owner: "Design team" },
};

function parseCsv(text) {
  return text
    .trim()
    .split("\n")
    .map((line) => {
      const out = [];
      let cur = "";
      let q = false;
      for (const ch of line) {
        if (ch === '"') q = !q;
        else if (ch === "," && !q) {
          out.push(cur);
          cur = "";
        } else cur += ch;
      }
      out.push(cur);
      return out;
    });
}

const booths = [];
for (const [file, meta] of Object.entries(slugs)) {
  const plan = JSON.parse(fs.readFileSync(path.join(src, "plans", `${file}.json`), "utf8"));
  const rows = parseCsv(fs.readFileSync(path.join(src, "output", `${file}_costing.csv`), "utf8"));
  const lines = [];
  const totals = {};
  for (const r of rows.slice(1)) {
    if (r.length < 6) continue;
    const amount = Number(r[5]);
    if (r[0]) lines.push({ category: r[0], item: r[1], qty: Number(r[2]), unit: r[3], rate: Number(r[4]), amount });
    else if (r[1]) totals[r[1]] = amount;
  }
  const byCategory = {};
  for (const l of lines) byCategory[l.category] = (byCategory[l.category] ?? 0) + l.amount;

  for (const view of ["aerial", "front"]) {
    fs.copyFileSync(path.join(src, "output/jpg", `${file}_${view}.jpg`), path.join(pub, `${file}_${view}.jpg`));
  }
  fs.copyFileSync(path.join(src, "output", `${file}.glb`), path.join(pub, `${file}.glb`));
  fs.copyFileSync(path.join(src, "output", `${file}_costing.csv`), path.join(pub, `${file}_costing.csv`));
  fs.copyFileSync(path.join(src, "plans", `${file}.json`), path.join(pub, `${file}_plan.json`));

  booths.push({
    slug: file.replaceAll("_", "-"),
    file,
    title: plan.title,
    brief: plan.brief,
    size: plan.size,
    partsCount: plan.parts.length,
    ...meta,
    lines,
    byCategory,
    totals,
  });
}

fs.writeFileSync(path.join(root, "src/data/booths.json"), JSON.stringify(booths, null, 2));
console.log(`Imported ${booths.length} booths`, booths.map((b) => `${b.slug}: ${Object.keys(b.totals).join(" | ")}`));
