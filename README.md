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
- Fire can spread from lava or other fires to adjacent forests and burns into dirt.
- Ships occasionally spawn on water and can disappear over time.
- Ships can spawn near a single shoreline; nearby grass may gain a small house.
- Houses can seed nearby houses; some seeds become bigger two-tile houses.
- Roads can appear to connect nearby big houses (villages).

## Console API

```js
window.wildlands.evolve(32, 48, "forest", 0.1);
window.wildlands.regenerate();
window.wildlands.save();
```
