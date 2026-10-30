# Inextis AI Studio

AI tools for Inextis Events: a CEO dashboard, an AI 3D Booth Studio (Claude + Blender), a LinkedIn-safe Lead Engine and a Screen Adapter for event LED screens.

| Folder | What's in it |
| --- | --- |
| [`inextis_studio/`](inextis_studio/) | The Next.js web app. See its [README](inextis_studio/README.md) for setup and features. |
| [`booth_demo/`](booth_demo/) | Blender scripts: the booth parts kit with materials (`kit.py`), the render script used by the app (`render_glb.py`), and the original plan-to-booth builder (`build.py`). |

## Quick start

```bash
cd inextis_studio
pnpm install
cp .env.example .env.local   # then add your Anthropic API key and Blender path
pnpm build && pnpm start     # http://localhost:3000
```

To open it from other devices on the same Wi-Fi: `pnpm start -H 0.0.0.0`, then visit `http://<this-computer's-IP>:3000`.
