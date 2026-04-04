# Wildlands Forge

Procedural tile map generator built with Three.js (100x100 mobile preset). Each tile stores a
height value and a biome color, then renders in a fixed isometric view.

## Run

Use any local HTTP server (module imports require it):

```bash
python -m http.server 5173
```

Open `http://localhost:5173`.

## Controls

- Pick a mode and click the map to evolve tiles.
- Use the height delta slider to push land up or down.
- Switch the renderer to Merged if instancing fails on your GPU.
- Step generations forward/back to explore evolution states (stored locally).
- Save/Load stores the map in localStorage.
- Snow and lava biomes can appear in later generations on big rock peaks.

## Console API

```js
window.wildlands.evolve(32, 48, "forest", 0.1);
window.wildlands.regenerate();
window.wildlands.save();
```
