# Sealed Orders (working title)

A 3D, top-down, online capital-ship battle game: simultaneous secret orders, free movement to plotted
destinations, broadside arcs, directional shields, armour saves and critical hits — all on d6s you roll yourself.

This first slice is a design mockup:

- **Ruleset** — [`docs/rules.md`](docs/rules.md)
- **Playable 2v2 squadron battle mockup** — `design/Main.dc.html` (three.js scene, rules engine, AI opponent,
  hot-seat mode, manual dice tray, top-down ship inspector) and the rulebook page `design/Rules.dc.html`. These are the sources of the Claude Design
  canvas; `design/canvas.json` is its layout index.
- **Ship models** — `assets/ships/*.glb`, two battleships and two cruisers from the asset pack reduced from ~70 MB
  (1.9M triangles, 4K textures) to ~1.1 MB each (≈38k triangles, 1K WebP textures).

## Tools

```bash
tools/optimize-model.sh "<pack model>.glb" assets/ships/<name>.glb   # shrink a pack model
node tools/split-model.mjs assets/ships/<name>.glb out/<name>          # mesh JSON + texture files (for hosts that reject .glb)
node tools/balance-sim.js                                              # 1,500 AI-vs-AI 2v2 battles through the rules engine
```

`tools/split-model.mjs` and the optimizer need `@gltf-transform/core`, `@gltf-transform/extensions`
and `@gltf-transform/cli` (4.1.x).
