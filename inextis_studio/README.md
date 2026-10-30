# Inextis AI Studio

A web app for Inextis Events. It has a CEO dashboard for Dhruv and three AI tools:

| Page | What it does |
| --- | --- |
| `/` Overview | Revenue vs target, pipeline, funnel, projects in delivery, cash to collect, upcoming expos, "Ask anything" |
| `/booths` 3D Booth Studio | **Fully working.** Claude designs a booth from a brief; edit it in 3D with live costing; render it in Blender |
| `/leads` Lead Engine | Researched target companies, message drafts, pipeline, reply classifier, LinkedIn post drafts and Conversation Ad preview |
| `/screens` Screen Adapter | One key visual adapted live to all 11 screens on the NOVA booth, with ZIP download |

## Run it

```bash
pnpm install
pnpm build && pnpm start      # production (fast)
pnpm dev                      # development (slower to load, reloads on edits)
```

Open http://localhost:3000.

## Setup

Create `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
BLENDER_PATH=/Users/<you>/Applications/Blender.app/Contents/MacOS/Blender
```

- **Claude** (`claude-opus-5-5`) designs and edits booths, and powers the dashboard's Ask box and the Lead Engine's reply classifier and rewrites. Without a key, the booth AI is unavailable and the other AI features use prepared answers.
- **Blender 5.2 LTS** renders booths. Download the official build from blender.org and set `BLENDER_PATH`. Renders use the Mac's GPU (Metal).

## 3D Booth Studio

1. **New booth** (`/booths/new`): brief, size, stall type (open sides), height limit, brand colours, up to 3 reference images. Claude plans zones, then places parts from the Inextis parts library (30 types); layout errors get one automatic repair round. About 30–60 s and ₹8–12 of AI usage per design.
2. **Editor** (`/booths/[id]`):
   - click a part to select; drag arrows to move (snaps 0.1 m) or press R to rotate (15°)
   - properties panel for sizes, materials and text
   - D duplicates, Delete removes, ⌘Z / ⇧⌘Z undo / redo
   - 3D and Plan (top-down) views
   - live costing from the rate card; layout checks button
   - "Ask AI to change the booth" chat (5–10 s per change, undoable)
   - autosave and named versions
3. **Render** (button in the editor): Blender imports the editor's exact 3D model, applies realistic materials, lights and cameras, and renders Aerial, Front or the current editor view. Draft ≈ 25–30 s, Final ≈ 1.5 min per view. Each render also saves a `.blend` (Blender) and `.fbx` (3ds Max) file.

### How it fits together

- `src/lib/booth/schema.ts`: the booth plan, the single source of truth.
- `src/lib/booth/registry.ts`: the parts library, with settings, sizes and cost lines. Add new parts here and in `three/build.ts`.
- `src/lib/booth/three/build.ts`: three.js geometry for each part, used both by the editor and for the GLB sent to Blender.
- `src/lib/booth/costing.ts`: prices a plan from `src/data/rate-card.json`. Replace that file with Inextis's real rate card.
- `src/lib/booth/validate.ts`: layout checks.
- `src/lib/booth/ai.ts`: Claude design and edit calls.
- `src/lib/booth/render-jobs.ts` and `../booth_demo/render_glb.py`: the Blender render queue and script; materials come from `../booth_demo/kit.py`.
- Projects are saved in `data/projects/<id>/project.json`. Renders and thumbnails go in `public/projects/<id>/`, served through `/api/files` so new files work in production.

Checks:

```bash
pnpm tsx scripts/convert-templates.ts   # rebuild the NOVA / GreenLeaf templates and check costing matches the original CSVs
pnpm tsx scripts/check-validator.ts     # layout checks catch deliberately broken plans
```

## Data

- Dashboard numbers and pipeline deals are sample data from one dataset (`src/lib/business.ts`), with fictional client names, so every number agrees. Replace it with CRM data later.
- Lead Engine target companies are real, from public sources linked on each card; contacts are shown as roles only.
- Booth costs use illustrative rates until the real rate card is added.
