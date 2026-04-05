import * as THREE from "./vendor/three.module.js";

const MOBILE_MAP_SIZE = 100;
const IS_MOBILE = true;
const MAP_WIDTH = MOBILE_MAP_SIZE;
const MAP_HEIGHT = MAP_WIDTH;
const MAX_PIXEL_RATIO = 1;
const STORAGE_KEY = "wildlands-map-v1";
const TIMELINE_KEY = "wildlands-timeline-v1";
const RENDERER_KEY = "wildlands-renderer";

const BIOMES = [
  { name: "water", color: "#3c6fa8" },
  { name: "sand", color: "#d3b178" },
  { name: "grass", color: "#86b368" },
  { name: "forest", color: "#2f6f53" },
  { name: "rock", color: "#8f8a86" },
  { name: "snow", color: "#e6eef2" },
  { name: "lava", color: "#d55a3a" },
  { name: "shallow", color: "#6fa7d9" },
  { name: "sakura", color: "#d98ab7" },
  { name: "fire", color: "#e35b2f" },
  { name: "dirt", color: "#7a5b3b" },
  { name: "ship", color: "#7a5a3a" },
  { name: "sail", color: "#eef0f2" },
];

const BIOME_BASE_HEIGHT = [
  0.06, 0.16, 0.28, 0.4, 0.46, 0.46, 0.46, 0.1, 0.34, 0.3, 0.24, 0.26, 0.48,
];
const BIOME_JITTER = [
  0.0, 0.02, 0.025, 0.035, 0.03, 0.03, 0.03, 0.01, 0.03, 0.03, 0.02, 0.015, 0.02,
];
const BIOME_BASELINE_WEIGHT = [
  0.05, 0.25, 0.35, 0.4, 0.25, 0.25, 0.25, 0.08, 0.32, 0.34, 0.3, 0.2, 0.2,
];
const BASELINE_AMPLITUDE = 0.18;
const BASELINE_SCALE = 1 / 42;
const BASELINE_EXP = 1.25;
const EVOLUTION_BASELINE_GAIN = 0.12;
const EVOLUTION_DETAIL_SCALE = 1 / 10;
const EVOLUTION_DETAIL_AMPLITUDE = 0.045;
const EVOLUTION_DETAIL_OCTAVES = 3;
const EVOLUTION_MAX = 6;
const EVOLUTION_BASELINE_ACTIVE = false;
const ROCK_CLUSTER_BOOST = 0.2;
const ROCK_LONELY_DROP = 0.07;
const ROCK_LONELY_INFLUENCE = 0.1;
const ROCK_CLUSTER_THRESHOLD = 0.38;
const LONELY_ROCK_CHANCE = 0.01;
const ROCK_BIG_THRESHOLD = 0.52;
const SNOW_ELEVATION_THRESHOLD = 0.62;
const SNOW_ROCK_THRESHOLD = 0.4;
const SNOW_LOCAL_RADIUS = 5;
const SNOW_LOCAL_RATIO = 0.88;
const SNOW_CHANCE = 0.4;
const SNOW_PERSIST_CHANCE = 0.976;
const LAVA_SEED_CHANCE = 0.55;
const LAVA_FLOW_CHANCE = 0.7;
const LAVA_PERSIST_CHANCE = 0.99;
const LAVA_FROM_HIGHER_CHANCE = 0.4;
const LAVA_PERSIST_WITH_LOWER_MULT = 0.85;
const LAVA_PERSIST_BLOCKED_MULT = 0.6;
const LAVA_MIN_DROP = 0.01;
const LAVA_FLOW_THRESHOLD = ROCK_CLUSTER_THRESHOLD;
const LAVA_ROCK_THRESHOLD = 0.5;
const LAVA_PEAK_POOL = 4;
const FOREST_GRASS_FLIP_CHANCE = 0.00005;
const SHALLOW_WATER_RADIUS = 1;
const SAKURA_SEED_CHANCE = 0.00002;
const SAKURA_NEAR_CHANCE = 0.01;
const SAKURA_DISAPPEAR_CHANCE = 0.02;
const SAKURA_NEIGHBOR_RADIUS = 1;
const SAKURA_SHADE_VARIANCE = 0.12;
const SAKURA_FOREST_THRESHOLD = 0.44;
const FIRE_SPREAD_CHANCE = 0.6;
const FIRE_FROM_LAVA_CHANCE = 0.9;
const FIRE_TO_DIRT_CHANCE = 0.65;
const FIRE_SHADE_VARIANCE = 0.18;
const SHIP_APPEAR_CHANCE = 0.22;
const SHIP_DISAPPEAR_CHANCE = 0.22;
const SHIP_MIN_DISTANCE = 6;
const SHIP_SHORE_BUFFER = 2;
const FOG_APPEAR_CHANCE = 0.22;
const FOG_DISAPPEAR_CHANCE = 0.22;
const FOG_MOVE_CHANCE = 0.36;
const FOG_RADIUS_MIN = 8;
const FOG_RADIUS_MAX = 28;
const FOG_SOFTNESS = 1.35;
const FOG_LIGHTEN = 0.28;
const FOG_HAZE_BLEND = 0.18;
const FOG_HAZE_BOOST = 0.35;
const FOG_HAZE_MIN = 0.12;
const FOG_HAZE_MAX = 0.45;
const FLASH_DURATION = 1000;
const FLASH_HEIGHT_EPSILON = 0.01;
const FLASH_JUMP_SCALE = 0.22;

const BIOME_INDEX = BIOMES.reduce((acc, biome, index) => {
  acc[biome.name] = index;
  return acc;
}, {});

const isRockSurface = (biomeIndex) =>
  biomeIndex === BIOME_INDEX.rock ||
  biomeIndex === BIOME_INDEX.snow ||
  biomeIndex === BIOME_INDEX.lava;

const isLavaPassable = (biomeIndex) =>
  biomeIndex !== BIOME_INDEX.water &&
  biomeIndex !== BIOME_INDEX.shallow &&
  biomeIndex !== BIOME_INDEX.ship &&
  biomeIndex !== BIOME_INDEX.sail;

const isShipBiome = (biomeIndex) =>
  biomeIndex === BIOME_INDEX.ship || biomeIndex === BIOME_INDEX.sail;

const isWaterBiome = (biomeIndex) =>
  biomeIndex === BIOME_INDEX.water || biomeIndex === BIOME_INDEX.shallow;

class MapData {
  constructor(width, height, seed) {
    this.width = width;
    this.height = height;
    this.seed = seed;
    this.generation = 0;
    this.heightMode = "layered";
    this.heights = new Float32Array(width * height);
    this.biomes = new Uint8Array(width * height);
    this.fog = new Float32Array(width * height);
  }

  index(x, y) {
    return y * this.width + x;
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getHeight(x, y) {
    return this.heights[this.index(x, y)];
  }

  getBiome(x, y) {
    return this.biomes[this.index(x, y)];
  }

  setTile(x, y, height, biomeIndex) {
    const idx = this.index(x, y);
    this.heights[idx] = height;
    this.biomes[idx] = biomeIndex;
  }

  serialize() {
    return {
      width: this.width,
      height: this.height,
      seed: this.seed,
      generation: this.generation,
      heightMode: this.heightMode,
      heights: Array.from(this.heights),
      biomes: Array.from(this.biomes),
      fog: Array.from(this.fog),
    };
  }

  static fromJSON(data) {
    const map = new MapData(data.width, data.height, data.seed);
    map.generation = data.generation || 0;
    map.heightMode = data.heightMode || "legacy";
    map.heights.set(data.heights);
    map.biomes.set(data.biomes);
    if (Array.isArray(data.fog) && data.fog.length === map.fog.length) {
      map.fog.set(data.fog);
    }
    return map;
  }
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (a, b, t) => a + (b - a) * t;
const fade = (t) => t * t * (3 - 2 * t);

const mulberry32 = (seed) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hash2 = (x, y, seed) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h ^= Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const biomeHeightFor = (biomeIndex, x, y, seed, baseline = 0, rockInfluence = 0) => {
  const base = BIOME_BASE_HEIGHT[biomeIndex];
  const jitter = (hash2(x, y, seed + 9103) - 0.5) * 2 * BIOME_JITTER[biomeIndex];
  const baselineShift = baseline * BIOME_BASELINE_WEIGHT[biomeIndex];
  let heightValue = base + jitter + baselineShift;

  if (isRockSurface(biomeIndex)) {
    if (rockInfluence < 0.2) {
      heightValue -= ROCK_LONELY_DROP;
    }
    heightValue += rockInfluence * ROCK_CLUSTER_BOOST;
  }

  return clamp(heightValue, 0, 1);
};

const valueNoise = (x, y, seed) => {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const sx = fade(x - x0);
  const sy = fade(y - y0);

  const n0 = lerp(hash2(x0, y0, seed), hash2(x1, y0, seed), sx);
  const n1 = lerp(hash2(x0, y1, seed), hash2(x1, y1, seed), sx);
  return lerp(n0, n1, sy);
};

const fbm = (x, y, seed, octaves = 5) => {
  let value = 0;
  let amplitude = 0.55;
  let frequency = 1;
  let max = 0;

  for (let i = 0; i < octaves; i += 1) {
    value += amplitude * valueNoise(x * frequency, y * frequency, seed + i * 101);
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / max;
};

const baseElevationFor = (x, y, seed) => {
  const nx = x * BASELINE_SCALE;
  const ny = y * BASELINE_SCALE;
  let elevation = fbm(nx, ny, seed, 5);
  elevation = Math.pow(elevation, BASELINE_EXP);
  return elevation;
};

const baselineFromElevation = (elevation) => (elevation - 0.5) * BASELINE_AMPLITUDE;

const baselineForGeneration = (elevation, x, y, seed, generation) => {
  const baseBaseline = baselineFromElevation(elevation);
  if (!EVOLUTION_BASELINE_ACTIVE) {
    return baseBaseline;
  }
  const evolution = Math.min(generation, EVOLUTION_MAX);
  if (evolution <= 0) {
    return baseBaseline;
  }
  const detail = fbm(
    x * EVOLUTION_DETAIL_SCALE,
    y * EVOLUTION_DETAIL_SCALE,
    seed + 6000 + generation * 23,
    EVOLUTION_DETAIL_OCTAVES,
  );
  const detailShift = (detail - 0.5) * EVOLUTION_DETAIL_AMPLITUDE * evolution;
  return baseBaseline * (1 + EVOLUTION_BASELINE_GAIN * evolution) + detailShift;
};

const chooseAutoBiome = (height) => {
  if (height < 0.1) {
    return BIOME_INDEX.water;
  }
  if (height < 0.2) {
    return BIOME_INDEX.sand;
  }
  if (height < 0.33) {
    return BIOME_INDEX.grass;
  }
  if (height < 0.5) {
    return BIOME_INDEX.forest;
  }
  return BIOME_INDEX.rock;
};

const isNearWater = (x, y, waterMask, width, height, radius = 2) => {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      if (waterMask[ny * width + nx]) {
        return true;
      }
    }
  }
  return false;
};

const isNearLand = (x, y, waterMask, width, height, radius = 1) => {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      if (!waterMask[ny * width + nx]) {
        return true;
      }
    }
  }
  return false;
};

const buildRockInfluence = (width, height, seed, heightMap, waterMask) => {
  const size = width * height;
  const influence = new Float32Array(size);
  const rng = mulberry32(seed + 1039);
  const mapSpan = Math.max(width, height);
  const clusterCount = Math.max(4, Math.floor(mapSpan / 55));
  const maxTries = 32;

  for (let c = 0; c < clusterCount; c += 1) {
    let best = null;
    let bestScore = -Infinity;

    for (let tries = 0; tries < maxTries; tries += 1) {
      const x = Math.floor(rng() * width);
      const y = Math.floor(rng() * height);
      const idx = y * width + x;
      if (waterMask[idx]) {
        continue;
      }
      const score = heightMap[idx] + rng() * 0.25;
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }

    if (!best) {
      continue;
    }

    const radius = 3 + rng() * 8;
    const radiusSq = radius * radius;
    const startX = Math.max(0, Math.floor(best.x - radius));
    const endX = Math.min(width - 1, Math.ceil(best.x + radius));
    const startY = Math.max(0, Math.floor(best.y - radius));
    const endY = Math.min(height - 1, Math.ceil(best.y + radius));

    for (let y = startY; y <= endY; y += 1) {
      for (let x = startX; x <= endX; x += 1) {
        const idx = y * width + x;
        if (waterMask[idx]) {
          continue;
        }
        const dx = x - best.x;
        const dy = y - best.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > radiusSq) {
          continue;
        }
        const dist = Math.sqrt(distSq);
        const falloff = 1 - dist / radius;
        const intensity = Math.pow(falloff, 1.6);
        if (intensity > influence[idx]) {
          influence[idx] = intensity;
        }
      }
    }
  }

  return influence;
};

const generateMapData = (width, height, seed) => {
  const map = new MapData(width, height, seed);
  map.generation = 0;
  const size = width * height;
  const rng = mulberry32(seed);
  const heightMap = new Float32Array(size);
  const waterMask = new Uint8Array(size);
  const seaLevel = 0.24;
  const scale = BASELINE_SCALE;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const nx = x * scale;
      const ny = y * scale;
      let elevation = fbm(nx, ny, seed, 5);
      elevation = Math.pow(elevation, BASELINE_EXP);
      heightMap[idx] = elevation;
      if (elevation < seaLevel) {
        waterMask[idx] = 1;
      }
    }
  }

  const riverMask = new Uint8Array(size);
  const riverCount = Math.max(2, Math.floor(width / 85));
  const maxSteps = width + height;

  for (let r = 0; r < riverCount; r += 1) {
    let startX = Math.floor(rng() * width);
    let startY = Math.floor(rng() * Math.max(4, height * 0.25));
    let bestScore = -Infinity;

    for (let tries = 0; tries < 24; tries += 1) {
      const x = Math.floor(rng() * width);
      const y = Math.floor(rng() * Math.max(4, height * 0.25));
      const idx = y * width + x;
      const score = heightMap[idx];
      if (score > bestScore) {
        bestScore = score;
        startX = x;
        startY = y;
      }
    }

    let x = startX;
    let y = startY;

    for (let step = 0; step < maxSteps; step += 1) {
      const idx = y * width + x;
      riverMask[idx] = 1;
      waterMask[idx] = 1;
      heightMap[idx] = Math.max(heightMap[idx] - 0.08, 0);

      if (x <= 1 || x >= width - 2 || y >= height - 2) {
        break;
      }

      const candidates = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ];
      let best = null;
      let bestValue = Infinity;

      for (const candidate of candidates) {
        if (!map.inBounds(candidate.x, candidate.y)) {
          continue;
        }
        const cIdx = candidate.y * width + candidate.x;
        const heightValue = heightMap[cIdx];
        const downhill = heightValue + rng() * 0.03;
        const downwardBias = (height - candidate.y) / height;
        const score = downhill + downwardBias * 0.15;

        if (score < bestValue) {
          bestValue = score;
          best = candidate;
        }
      }

      if (!best) {
        break;
      }

      x = best.x;
      y = best.y;
    }
  }

  const rockInfluence = buildRockInfluence(width, height, seed, heightMap, waterMask);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const elevation = heightMap[idx];
      const baseline = baselineForGeneration(elevation, x, y, seed, map.generation);
      const isRiver = riverMask[idx] === 1;
      const isWater = waterMask[idx] === 1 || isRiver;
      const nearWater = !isWater && isNearWater(x, y, waterMask, width, height, 2);
      const nearLand =
        isWater &&
        !isRiver &&
        isNearLand(x, y, waterMask, width, height, SHALLOW_WATER_RADIUS);
      let biome = BIOME_INDEX.grass;

      if (isWater) {
        biome = nearLand ? BIOME_INDEX.shallow : BIOME_INDEX.water;
      } else if (rockInfluence[idx] > ROCK_CLUSTER_THRESHOLD) {
        biome = BIOME_INDEX.rock;
      } else if (nearWater && elevation < 0.55) {
        biome = BIOME_INDEX.sand;
      } else if (elevation < 0.38) {
        biome = BIOME_INDEX.grass;
      } else if (elevation < 0.65) {
        biome = rng() < 0.65 ? BIOME_INDEX.forest : BIOME_INDEX.grass;
      } else {
        biome = BIOME_INDEX.forest;
      }

      if (!isWater && biome !== BIOME_INDEX.rock && rng() < LONELY_ROCK_CHANCE && elevation > 0.38) {
        biome = BIOME_INDEX.rock;
        rockInfluence[idx] = Math.max(rockInfluence[idx], ROCK_LONELY_INFLUENCE);
      }

      const influence =
        biome === BIOME_INDEX.rock ? Math.max(rockInfluence[idx], ROCK_LONELY_INFLUENCE) : 0;
      map.heights[idx] = biomeHeightFor(biome, x, y, seed, baseline, influence);
      map.biomes[idx] = biome;
    }
  }

  return map;
};

const saveMap = (mapData, serialized) => {
  try {
    const payload = serialized || mapData.serialize();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Unable to save map data.", error);
  }
};

const loadMap = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return null;
    }
    return MapData.fromJSON(JSON.parse(data));
  } catch (error) {
    console.warn("Unable to load map data.", error);
    return null;
  }
};

const clearSavedMap = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TIMELINE_KEY);
  } catch (error) {
    console.warn("Unable to clear map data.", error);
  }
};

const saveTimeline = (timeline) => {
  try {
    localStorage.setItem(TIMELINE_KEY, JSON.stringify(timeline));
  } catch (error) {
    console.warn("Unable to save timeline.", error);
  }
};

const loadTimeline = () => {
  try {
    const data = localStorage.getItem(TIMELINE_KEY);
    if (!data) {
      return null;
    }
    const parsed = JSON.parse(data);
    if (!parsed || !Array.isArray(parsed.maps) || parsed.maps.length === 0) {
      return null;
    }
    const index = clamp(parsed.index ?? parsed.currentIndex ?? 0, 0, parsed.maps.length - 1);
    return { index, maps: parsed.maps };
  } catch (error) {
    console.warn("Unable to load timeline.", error);
    return null;
  }
};

const createTimelineFromMap = (map) => ({
  index: map.generation || 0,
  maps: [map.serialize()],
});

const applyLayeredHeights = (map) => {
  const size = map.width * map.height;
  const elevationMap = new Float32Array(size);
  const waterMask = new Uint8Array(size);

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const idx = map.index(x, y);
      elevationMap[idx] = baseElevationFor(x, y, map.seed);
      if (map.biomes[idx] === BIOME_INDEX.water || map.biomes[idx] === BIOME_INDEX.shallow) {
        waterMask[idx] = 1;
      }
    }
  }

  const rockInfluence = buildRockInfluence(map.width, map.height, map.seed, elevationMap, waterMask);

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const idx = map.index(x, y);
      const biomeIndex = map.biomes[idx];
      const baseline = baselineForGeneration(elevationMap[idx], x, y, map.seed, map.generation);
      const influence = isRockSurface(biomeIndex)
        ? Math.max(rockInfluence[idx], ROCK_LONELY_INFLUENCE)
        : 0;
      map.heights[idx] = biomeHeightFor(biomeIndex, x, y, map.seed, baseline, influence);
    }
  }

  map.heightMode = "layered";
};

const findLavaTile = (map, elevationMap) => {
  let best = null;
  let bestElevation = -Infinity;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const idx = map.index(x, y);
      if (map.biomes[idx] !== BIOME_INDEX.lava) {
        continue;
      }
      const elevation = elevationMap[idx];
      if (elevation > bestElevation) {
        bestElevation = elevation;
        best = { x, y, idx };
      }
    }
  }
  return best;
};

const localRockMax = (map, elevationMap, rockInfluence, cx, cy, radius, threshold) => {
  let maxElevation = -Infinity;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = cx + dx;
      const y = cy + dy;
      if (!map.inBounds(x, y)) {
        continue;
      }
      const idx = map.index(x, y);
      if (!isRockSurface(map.biomes[idx])) {
        continue;
      }
      if (rockInfluence[idx] < threshold) {
        continue;
      }
      const elevation = elevationMap[idx];
      if (elevation > maxElevation) {
        maxElevation = elevation;
      }
    }
  }
  return maxElevation;
};

const collectRockPeaks = (map, elevationMap, rockInfluence, threshold) => {
  const peaks = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const idx = map.index(x, y);
      if (!isRockSurface(map.biomes[idx])) {
        continue;
      }
      if (rockInfluence[idx] < threshold) {
        continue;
      }
      const elevation = elevationMap[idx];
      let isPeak = true;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) {
            continue;
          }
          const nx = x + dx;
          const ny = y + dy;
          if (!map.inBounds(nx, ny)) {
            continue;
          }
          const nIdx = map.index(nx, ny);
          if (!isRockSurface(map.biomes[nIdx])) {
            continue;
          }
          if (rockInfluence[nIdx] < threshold) {
            continue;
          }
          if (elevationMap[nIdx] > elevation + 0.0005) {
            isPeak = false;
            break;
          }
        }
        if (!isPeak) {
          break;
        }
      }
      if (isPeak) {
        peaks.push({ x, y, idx, elevation });
      }
    }
  }
  return peaks;
};

const chooseLavaPeak = (peaks, seed, generation) => {
  if (!peaks.length) {
    return null;
  }
  const sorted = peaks.slice().sort((a, b) => b.elevation - a.elevation);
  const poolSize = Math.min(LAVA_PEAK_POOL, sorted.length);
  const pickRoll = hash2(poolSize, generation, seed + 5099);
  const pickIndex = Math.floor(pickRoll * poolSize);
  return sorted[pickIndex];
};

const flipForestGrassAt = (map, elevationMap, x, y) => {
  const idx = map.index(x, y);
  const current = map.biomes[idx];
  if (current !== BIOME_INDEX.grass && current !== BIOME_INDEX.forest) {
    return;
  }
  const nextBiome = current === BIOME_INDEX.grass ? BIOME_INDEX.forest : BIOME_INDEX.grass;
  map.biomes[idx] = nextBiome;
  const baseline = baselineForGeneration(elevationMap[idx], x, y, map.seed, map.generation);
  map.heights[idx] = biomeHeightFor(nextBiome, x, y, map.seed, baseline, 0);
};

const baseVegetationBiome = (elevation) =>
  elevation > SAKURA_FOREST_THRESHOLD ? BIOME_INDEX.forest : BIOME_INDEX.grass;

const hasNeighborBiome = (map, x, y, biomeIndex, radius = 1, manhattan = false) => {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      if (manhattan && Math.abs(dx) + Math.abs(dy) > radius) {
        continue;
      }
      const nx = x + dx;
      const ny = y + dy;
      if (!map.inBounds(nx, ny)) {
        continue;
      }
      const idx = map.index(nx, ny);
      if (map.biomes[idx] === biomeIndex) {
        return true;
      }
    }
  }
  return false;
};

const hasSakuraNeighbor = (map, x, y, radius = 1) =>
  hasNeighborBiome(map, x, y, BIOME_INDEX.sakura, radius, true);

const fogHasPresence = (fog) => {
  for (let i = 0; i < fog.length; i += 1) {
    if (fog[i] > 0.05) {
      return true;
    }
  }
  return false;
};

const stampFogCloud = (fog, width, height, cx, cy, radius, softness) => {
  const radiusSq = radius * radius;
  const startX = Math.max(0, Math.floor(cx - radius));
  const endX = Math.min(width - 1, Math.ceil(cx + radius));
  const startY = Math.max(0, Math.floor(cy - radius));
  const endY = Math.min(height - 1, Math.ceil(cy + radius));

  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const distSq = dx * dx + dy * dy;
      if (distSq > radiusSq) {
        continue;
      }
      const dist = Math.sqrt(distSq);
      const falloff = 1 - dist / radius;
      const intensity = Math.pow(falloff, softness);
      const idx = y * width + x;
      if (intensity > fog[idx]) {
        fog[idx] = intensity;
      }
    }
  }
};

const shiftFogLeft = (source, target, width, height) => {
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 1; x < width; x += 1) {
      const srcIdx = row + x;
      const dstIdx = row + x - 1;
      const value = source[srcIdx];
      if (value > target[dstIdx]) {
        target[dstIdx] = value;
      }
    }
  }
};

const applyFogEvolution = (map, previousMap) => {
  const size = map.width * map.height;
  if (!map.fog || map.fog.length !== size) {
    map.fog = new Float32Array(size);
  }
  const nextFog = new Float32Array(size);
  const previousFog =
    previousMap && previousMap.fog && previousMap.fog.length === size ? previousMap.fog : null;
  const hadFog = previousFog ? fogHasPresence(previousFog) : false;
  const rng = mulberry32(map.seed + map.generation * 3203);
  const roll = rng();

  if (!hadFog) {
    if (roll < FOG_APPEAR_CHANCE) {
      const cx = Math.floor(rng() * map.width);
      const cy = Math.floor(rng() * map.height);
      const radius = lerp(FOG_RADIUS_MIN, FOG_RADIUS_MAX, rng());
      stampFogCloud(nextFog, map.width, map.height, cx, cy, radius, FOG_SOFTNESS);
    }
  } else if (roll < FOG_DISAPPEAR_CHANCE) {
    // Fog dissipates.
  } else if (roll < FOG_DISAPPEAR_CHANCE + FOG_MOVE_CHANCE) {
    shiftFogLeft(previousFog, nextFog, map.width, map.height);
  } else {
    nextFog.set(previousFog);
  }

  map.fog.set(nextFog);
};

const findLowerNeighbor = (map, elevationMap, rockInfluence, x, y) => {
  const idx = map.index(x, y);
  const currentElevation = elevationMap[idx];
  const candidates = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
  let best = null;
  let bestElevation = currentElevation;

  for (const candidate of candidates) {
    if (!map.inBounds(candidate.x, candidate.y)) {
      continue;
    }
    const cIdx = map.index(candidate.x, candidate.y);
    if (!isLavaPassable(map.biomes[cIdx])) {
      continue;
    }
    if (isRockSurface(map.biomes[cIdx]) && rockInfluence[cIdx] < LAVA_FLOW_THRESHOLD) {
      continue;
    }
    const elevation = elevationMap[cIdx];
    if (elevation < bestElevation - LAVA_MIN_DROP) {
      bestElevation = elevation;
      best = { x: candidate.x, y: candidate.y, idx: cIdx };
    }
  }

  return best;
};

const hasHigherLavaNeighbor = (lavaMap, elevationMap, x, y) => {
  if (!lavaMap) {
    return false;
  }
  const idx = lavaMap.index(x, y);
  const elevation = elevationMap[idx];
  const neighbors = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
  for (const neighbor of neighbors) {
    if (!lavaMap.inBounds(neighbor.x, neighbor.y)) {
      continue;
    }
    const nIdx = lavaMap.index(neighbor.x, neighbor.y);
    if (lavaMap.biomes[nIdx] !== BIOME_INDEX.lava) {
      continue;
    }
    if (elevationMap[nIdx] > elevation + LAVA_MIN_DROP) {
      return true;
    }
  }
  return false;
};

const hasLowerLavaNeighbor = (lavaMap, elevationMap, x, y) => {
  if (!lavaMap) {
    return false;
  }
  const idx = lavaMap.index(x, y);
  const elevation = elevationMap[idx];
  const neighbors = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
  for (const neighbor of neighbors) {
    if (!lavaMap.inBounds(neighbor.x, neighbor.y)) {
      continue;
    }
    const nIdx = lavaMap.index(neighbor.x, neighbor.y);
    if (lavaMap.biomes[nIdx] !== BIOME_INDEX.lava) {
      continue;
    }
    if (elevationMap[nIdx] < elevation - LAVA_MIN_DROP) {
      return true;
    }
  }
  return false;
};

const collectLavaTiles = (lavaMap) => {
  if (!lavaMap) {
    return [];
  }
  const tiles = [];
  for (let y = 0; y < lavaMap.height; y += 1) {
    for (let x = 0; x < lavaMap.width; x += 1) {
      const idx = lavaMap.index(x, y);
      if (lavaMap.biomes[idx] === BIOME_INDEX.lava) {
        tiles.push({ x, y, idx });
      }
    }
  }
  return tiles;
};

const collectShipComponents = (map) => {
  if (!map) {
    return [];
  }
  const components = [];
  const visited = new Uint8Array(map.width * map.height);
  const queue = [];

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const startIdx = map.index(x, y);
      if (visited[startIdx] || !isShipBiome(map.biomes[startIdx])) {
        continue;
      }
      const component = [];
      visited[startIdx] = 1;
      queue.length = 0;
      queue.push({ x, y });
      while (queue.length) {
        const current = queue.pop();
        const idx = map.index(current.x, current.y);
        component.push({ x: current.x, y: current.y, idx, biome: map.biomes[idx] });
        const neighbors = [
          { x: current.x + 1, y: current.y },
          { x: current.x - 1, y: current.y },
          { x: current.x, y: current.y + 1 },
          { x: current.x, y: current.y - 1 },
        ];
        for (const neighbor of neighbors) {
          if (!map.inBounds(neighbor.x, neighbor.y)) {
            continue;
          }
          const nIdx = map.index(neighbor.x, neighbor.y);
          if (visited[nIdx] || !isShipBiome(map.biomes[nIdx])) {
            continue;
          }
          visited[nIdx] = 1;
          queue.push(neighbor);
        }
      }
      if (component.length) {
        components.push(component);
      }
    }
  }
  return components;
};

const shipHasWaterBuffer = (map, originX, originY, length, width, horizontal, buffer) => {
  const endX = originX + (horizontal ? length - 1 : width - 1);
  const endY = originY + (horizontal ? width - 1 : length - 1);
  const minX = originX - buffer;
  const minY = originY - buffer;
  const maxX = endX + buffer;
  const maxY = endY + buffer;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (!map.inBounds(x, y)) {
        return false;
      }
      const idx = map.index(x, y);
      if (!isWaterBiome(map.biomes[idx])) {
        return false;
      }
    }
  }
  return true;
};

const stampShip = (map, elevationMap, originX, originY, length, width, horizontal, sailOffsets) => {
  for (let wy = 0; wy < width; wy += 1) {
    for (let wx = 0; wx < length; wx += 1) {
      const x = originX + (horizontal ? wx : wy);
      const y = originY + (horizontal ? wy : wx);
      if (!map.inBounds(x, y)) {
        return false;
      }
      const idx = map.index(x, y);
      if (map.biomes[idx] !== BIOME_INDEX.water && map.biomes[idx] !== BIOME_INDEX.shallow) {
        return false;
      }
    }
  }

  for (let wy = 0; wy < width; wy += 1) {
    for (let wx = 0; wx < length; wx += 1) {
      const x = originX + (horizontal ? wx : wy);
      const y = originY + (horizontal ? wy : wx);
      const idx = map.index(x, y);
      let biome = BIOME_INDEX.ship;
      for (const offset of sailOffsets) {
        if (wx === offset.x && wy === offset.y) {
          biome = BIOME_INDEX.sail;
          break;
        }
      }
      map.biomes[idx] = biome;
      const baseline = baselineForGeneration(
        elevationMap[idx],
        x,
        y,
        map.seed,
        map.generation,
      );
      map.heights[idx] = biomeHeightFor(biome, x, y, map.seed, baseline, 0);
    }
  }
  return true;
};

const applySpecialBiomes = (map, previousMap) => {
  if (map.generation <= 0) {
    return;
  }

  const hasPrevious =
    previousMap && previousMap.width === map.width && previousMap.height === map.height;
  const size = map.width * map.height;
  const elevationMap = new Float32Array(size);
  const waterMask = new Uint8Array(size);
  const flipCandidates = [];
  const sakuraNext = new Uint8Array(size);

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const idx = map.index(x, y);
      elevationMap[idx] = baseElevationFor(x, y, map.seed);
      const biomeIndex = map.biomes[idx];
      if (isShipBiome(biomeIndex)) {
        map.biomes[idx] = BIOME_INDEX.water;
        waterMask[idx] = 1;
        const baseline = baselineForGeneration(
          elevationMap[idx],
          x,
          y,
          map.seed,
          map.generation,
        );
        map.heights[idx] = biomeHeightFor(BIOME_INDEX.water, x, y, map.seed, baseline, 0);
        continue;
      }
      if (biomeIndex === BIOME_INDEX.water || biomeIndex === BIOME_INDEX.shallow) {
        waterMask[idx] = 1;
      }
      if (biomeIndex === BIOME_INDEX.snow || biomeIndex === BIOME_INDEX.lava) {
        map.biomes[idx] = BIOME_INDEX.rock;
      }
      if (biomeIndex === BIOME_INDEX.grass || biomeIndex === BIOME_INDEX.forest) {
        flipCandidates.push({ x, y });
      }
    }
  }

  if (flipCandidates.length) {
    const targetFlips = Math.min(
      flipCandidates.length,
      Math.floor(flipCandidates.length * FOREST_GRASS_FLIP_CHANCE),
    );
    if (targetFlips > 0) {
      const rng = mulberry32(map.seed + map.generation * 1723);
      for (let i = 0; i < targetFlips; i += 1) {
        const pickIndex = Math.floor(rng() * flipCandidates.length);
        const candidate = flipCandidates[pickIndex];
        flipForestGrassAt(map, elevationMap, candidate.x, candidate.y);
        flipCandidates[pickIndex] = flipCandidates[flipCandidates.length - 1];
        flipCandidates.pop();
      }
    }
  }

  if (hasPrevious) {
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const idx = map.index(x, y);
        const biomeIndex = map.biomes[idx];
        if (
          biomeIndex === BIOME_INDEX.water ||
          biomeIndex === BIOME_INDEX.shallow ||
          biomeIndex === BIOME_INDEX.rock ||
          biomeIndex === BIOME_INDEX.snow ||
          biomeIndex === BIOME_INDEX.lava ||
          biomeIndex === BIOME_INDEX.fire ||
          biomeIndex === BIOME_INDEX.dirt ||
          biomeIndex === BIOME_INDEX.ship ||
          biomeIndex === BIOME_INDEX.sail
        ) {
          continue;
        }

        const wasSakura = previousMap.biomes[idx] === BIOME_INDEX.sakura;
        const roll = hash2(x, y, map.seed + map.generation * 2407);
        if (wasSakura) {
          if (roll >= SAKURA_DISAPPEAR_CHANCE) {
            sakuraNext[idx] = 1;
          }
        } else {
          const near = hasSakuraNeighbor(previousMap, x, y, SAKURA_NEIGHBOR_RADIUS);
          const chance = near ? SAKURA_NEAR_CHANCE : SAKURA_SEED_CHANCE;
          if (roll < chance) {
            sakuraNext[idx] = 1;
          }
        }
      }
    }

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const idx = map.index(x, y);
        if (sakuraNext[idx]) {
          map.biomes[idx] = BIOME_INDEX.sakura;
          const baseline = baselineForGeneration(
            elevationMap[idx],
            x,
            y,
            map.seed,
            map.generation,
          );
          map.heights[idx] = biomeHeightFor(BIOME_INDEX.sakura, x, y, map.seed, baseline, 0);
        } else if (map.biomes[idx] === BIOME_INDEX.sakura) {
          const baseBiome = baseVegetationBiome(elevationMap[idx]);
          map.biomes[idx] = baseBiome;
          const baseline = baselineForGeneration(
            elevationMap[idx],
            x,
            y,
            map.seed,
            map.generation,
          );
          map.heights[idx] = biomeHeightFor(baseBiome, x, y, map.seed, baseline, 0);
        }
      }
    }
  }

  const rockInfluence = buildRockInfluence(map.width, map.height, map.seed, elevationMap, waterMask);

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const idx = map.index(x, y);
      if (map.biomes[idx] !== BIOME_INDEX.rock) {
        continue;
      }
      if (rockInfluence[idx] < SNOW_ROCK_THRESHOLD) {
        continue;
      }
      const elevation = elevationMap[idx];
      if (elevation < SNOW_ELEVATION_THRESHOLD) {
        continue;
      }
      const localMax = localRockMax(
        map,
        elevationMap,
        rockInfluence,
        x,
        y,
        SNOW_LOCAL_RADIUS,
        SNOW_ROCK_THRESHOLD,
      );
      if (!(localMax > 0)) {
        continue;
      }
      const ratio = elevation / localMax;
      if (ratio < SNOW_LOCAL_RATIO) {
        continue;
      }
      const roll = hash2(x, y, map.seed + map.generation * 1907);
      const hadSnow = hasPrevious && previousMap.biomes[idx] === BIOME_INDEX.snow;
      const chance = hadSnow ? SNOW_PERSIST_CHANCE : SNOW_CHANCE;
      if (roll < chance) {
        map.biomes[idx] = BIOME_INDEX.snow;
      }
    }
  }

  const peaks = collectRockPeaks(map, elevationMap, rockInfluence, LAVA_ROCK_THRESHOLD);
  const nextLava = new Uint8Array(size);
  const previousLavaTiles = hasPrevious ? collectLavaTiles(previousMap) : [];
  let lavaCount = 0;

  if (previousLavaTiles.length) {
    for (const lavaTile of previousLavaTiles) {
      const next = findLowerNeighbor(
        map,
        elevationMap,
        rockInfluence,
        lavaTile.x,
        lavaTile.y,
      );
      if (next) {
        const flowRoll = hash2(
          lavaTile.x,
          lavaTile.y,
          map.seed + map.generation * 2081,
        );
        if (flowRoll < LAVA_FLOW_CHANCE) {
          if (!nextLava[next.idx]) {
            nextLava[next.idx] = 1;
            lavaCount += 1;
          }
        }
      }

      let persistChance = LAVA_PERSIST_CHANCE;
      if (hasLowerLavaNeighbor(previousMap, elevationMap, lavaTile.x, lavaTile.y)) {
        persistChance *= LAVA_PERSIST_WITH_LOWER_MULT;
      }
      if (!next) {
        persistChance *= LAVA_PERSIST_BLOCKED_MULT;
      }
      const keepRoll = hash2(
        lavaTile.x,
        lavaTile.y,
        map.seed + map.generation * 2137,
      );
      if (keepRoll < persistChance) {
        if (!nextLava[lavaTile.idx]) {
          nextLava[lavaTile.idx] = 1;
          lavaCount += 1;
        }
      }
    }
  }

  if (hasPrevious) {
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const idx = map.index(x, y);
        if (!isLavaPassable(map.biomes[idx])) {
          continue;
        }
        if (isRockSurface(map.biomes[idx]) && rockInfluence[idx] < LAVA_ROCK_THRESHOLD) {
          continue;
        }
        if (previousMap.biomes[idx] === BIOME_INDEX.lava) {
          continue;
        }
        if (!hasHigherLavaNeighbor(previousMap, elevationMap, x, y)) {
          continue;
        }
        const roll = hash2(x, y, map.seed + map.generation * 2191);
        if (roll < LAVA_FROM_HIGHER_CHANCE) {
          if (!nextLava[idx]) {
            nextLava[idx] = 1;
            lavaCount += 1;
          }
        }
      }
    }
  }

  if (!lavaCount && peaks.length) {
    const seedRoll = hash2(peaks.length, map.generation, map.seed + 2029);
    if (seedRoll < LAVA_SEED_CHANCE) {
      const lavaSeed = chooseLavaPeak(peaks, map.seed, map.generation);
      if (lavaSeed) {
        nextLava[lavaSeed.idx] = 1;
        lavaCount += 1;
      }
    }
  }

  if (lavaCount) {
    for (let i = 0; i < size; i += 1) {
      if (nextLava[i]) {
        map.biomes[i] = BIOME_INDEX.lava;
      }
    }
  }

  if (hasPrevious) {
    const fireNext = new Uint8Array(size);
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const idx = map.index(x, y);
        if (previousMap.biomes[idx] !== BIOME_INDEX.fire) {
          continue;
        }
        const roll = hash2(x, y, map.seed + map.generation * 2297);
        if (roll < FIRE_TO_DIRT_CHANCE) {
          map.biomes[idx] = BIOME_INDEX.dirt;
          const baseline = baselineForGeneration(
            elevationMap[idx],
            x,
            y,
            map.seed,
            map.generation,
          );
          map.heights[idx] = biomeHeightFor(BIOME_INDEX.dirt, x, y, map.seed, baseline, 0);
        } else {
          fireNext[idx] = 1;
        }
      }
    }

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const idx = map.index(x, y);
        if (map.biomes[idx] !== BIOME_INDEX.forest && map.biomes[idx] !== BIOME_INDEX.sakura) {
          continue;
        }
        const fromFire = hasNeighborBiome(previousMap, x, y, BIOME_INDEX.fire, 1, true);
        const fromLava = hasNeighborBiome(map, x, y, BIOME_INDEX.lava, 1, true);
        if (!fromFire && !fromLava) {
          continue;
        }
        const chance = fromLava
          ? FIRE_FROM_LAVA_CHANCE
          : FIRE_SPREAD_CHANCE;
        const roll = hash2(x, y, map.seed + map.generation * 2351);
        if (roll < chance) {
          fireNext[idx] = 1;
        }
      }
    }

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const idx = map.index(x, y);
        if (!fireNext[idx]) {
          continue;
        }
        map.biomes[idx] = BIOME_INDEX.fire;
        const baseline = baselineForGeneration(
          elevationMap[idx],
          x,
          y,
          map.seed,
          map.generation,
        );
        map.heights[idx] = biomeHeightFor(BIOME_INDEX.fire, x, y, map.seed, baseline, 0);
      }
    }
  }

  if (hasPrevious) {
    const shipComponents = collectShipComponents(previousMap);
    if (shipComponents.length) {
      const shipRng = mulberry32(map.seed + map.generation * 2711);
      for (const component of shipComponents) {
        if (shipRng() < SHIP_DISAPPEAR_CHANCE) {
          continue;
        }
        for (const tile of component) {
          const idx = map.index(tile.x, tile.y);
          if (map.biomes[idx] !== BIOME_INDEX.water && map.biomes[idx] !== BIOME_INDEX.shallow) {
            continue;
          }
          map.biomes[idx] = tile.biome;
          const baseline = baselineForGeneration(
            elevationMap[idx],
            tile.x,
            tile.y,
            map.seed,
            map.generation,
          );
          map.heights[idx] = biomeHeightFor(tile.biome, tile.x, tile.y, map.seed, baseline, 0);
        }
      }
    }
  }

  {
    const shipRng = mulberry32(map.seed + map.generation * 2789);
    if (shipRng() < SHIP_APPEAR_CHANCE) {
      const length = 4;
      const width = 3;
      const sailOffsets = [{ x: 1, y: 1 }, { x: 2, y: 1 }];
      const horizontal = shipRng() < 0.5;
      const maxX = horizontal ? map.width - length : map.width - width;
      const maxY = horizontal ? map.height - width : map.height - length;
      const tries = 24;
      for (let attempt = 0; attempt < tries; attempt += 1) {
        const x = Math.floor(shipRng() * (maxX + 1));
        const y = Math.floor(shipRng() * (maxY + 1));
        if (hasNeighborBiome(map, x, y, BIOME_INDEX.ship, SHIP_MIN_DISTANCE)) {
          continue;
        }
        if (!shipHasWaterBuffer(map, x, y, length, width, horizontal, SHIP_SHORE_BUFFER)) {
          continue;
        }
        if (stampShip(map, elevationMap, x, y, length, width, horizontal, sailOffsets)) {
          break;
        }
      }
    }
  }

  applyFogEvolution(map, hasPrevious ? previousMap : null);
};

const container = document.getElementById("canvas-wrap");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0f1418, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1418);
scene.fog = new THREE.Fog(0x0f1418, 220, 520);

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
const hemisphere = new THREE.HemisphereLight(0xfdf1d8, 0x1f2a33, 0.65);
const directional = new THREE.DirectionalLight(0xffffff, 0.9);
directional.position.set(120, 180, 80);
scene.add(ambient, hemisphere, directional);

const mapSpan = Math.max(MAP_WIDTH, MAP_HEIGHT);
const frustumSize = mapSpan * 1.15;
const camera = new THREE.OrthographicCamera();

const updateCamera = () => {
  const aspect = window.innerWidth / window.innerHeight;
  camera.left = (-frustumSize * aspect) / 2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;
  camera.near = 0.1;
  camera.far = 1000;
  camera.zoom = window.innerWidth < 720 ? 0.85 : 1;
  camera.position.set(mapSpan * 0.7, mapSpan * 0.7, mapSpan * 0.7);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
};

updateCamera();

const tileCount = MAP_WIDTH * MAP_HEIGHT;
const instancingSupported =
  renderer.capabilities.isWebGL2 || renderer.extensions.has("ANGLE_instanced_arrays");
const DEFAULT_RENDERER = IS_MOBILE ? "instanced" : "merged";
let rendererWarning = "";

const dummy = new THREE.Object3D();
const color = new THREE.Color();
const fogTint = new THREE.Color(0xe3ebf2);
const fogHaze = new THREE.Color(0xb8c8d6);
const BASE_HEIGHT = 0.12;
const HEIGHT_SCALE = 5.2;
const REVEAL_BAND = 0.18;
const REVEAL_MIN_SCALE = 0.02;
const REVEAL_DURATION = 2600;
const REVEAL_JITTER = 0.05;

const heightToUnits = (height, biomeIndex) => {
  const shaped = Math.pow(height, 1.2);
  if (biomeIndex === BIOME_INDEX.water || biomeIndex === BIOME_INDEX.shallow) {
    return BASE_HEIGHT * 0.5;
  }
  return BASE_HEIGHT + shaped * HEIGHT_SCALE;
};

const colorForBiome = (biomeIndex, heightValue, fogValue = 0, x = 0, y = 0, seed = 0) => {
  color.set(BIOMES[biomeIndex].color);
  if (biomeIndex !== BIOME_INDEX.water && biomeIndex !== BIOME_INDEX.shallow) {
    const shade = (heightValue - 0.5) * 0.18;
    color.offsetHSL(0, 0, shade);
  }
  if (biomeIndex === BIOME_INDEX.sakura) {
    const offset = (hash2(x, y, seed + 4047) - 0.5) * 2;
    const hueShift = 0.015 * offset;
    const satShift = -0.08 * Math.abs(offset);
    const lightShift = offset * SAKURA_SHADE_VARIANCE;
    color.offsetHSL(hueShift, satShift, lightShift);
  }
  if (biomeIndex === BIOME_INDEX.fire) {
    const offset = (hash2(x, y, seed + 5153) - 0.5) * 2;
    const hueShift = 0.05 * offset;
    const satShift = 0.12;
    const lightShift = offset * FIRE_SHADE_VARIANCE;
    color.offsetHSL(hueShift, satShift, lightShift);
  }
  if (fogValue > 0) {
    const amount = clamp(fogValue * FOG_LIGHTEN, 0, 1);
    color.lerp(fogTint, amount);
    const hazeStrength = clamp(
      FOG_HAZE_MIN + fogValue * FOG_HAZE_BOOST,
      FOG_HAZE_MIN,
      FOG_HAZE_MAX,
    );
    color.lerp(fogHaze, hazeStrength * FOG_HAZE_BLEND);
  }
  return color;
};

const revealJitterFor = (x, y, seed) => hash2(x, y, seed + 7421);

const evolveMapData = (sourceMap, generationIndex) => {
  const map = MapData.fromJSON(sourceMap.serialize());
  map.generation = generationIndex;
  applyLayeredHeights(map);
  applySpecialBiomes(map, sourceMap);
  return map;
};

let timeline = loadTimeline();
let mapData = null;

if (timeline) {
  const candidate = MapData.fromJSON(timeline.maps[timeline.index]);
  if (candidate.width === MAP_WIDTH && candidate.height === MAP_HEIGHT) {
    mapData = candidate;
  } else {
    timeline = null;
  }
}

if (!mapData) {
  mapData = loadMap();
  if (mapData && mapData.width === MAP_WIDTH && mapData.height === MAP_HEIGHT) {
    timeline = createTimelineFromMap(mapData);
  } else {
    const seed = Math.floor(Math.random() * 1000000);
    mapData = generateMapData(MAP_WIDTH, MAP_HEIGHT, seed);
    timeline = createTimelineFromMap(mapData);
  }
}

mapData.generation = timeline ? timeline.index : mapData.generation;

if (mapData.heightMode !== "layered") {
  applyLayeredHeights(mapData);
}

if (timeline) {
  timeline.maps[timeline.index] = mapData.serialize();
  saveTimeline(timeline);
}
saveMap(mapData);

const persistMapState = () => {
  const snapshot = mapData.serialize();
  if (timeline) {
    timeline.maps[timeline.index] = snapshot;
    saveTimeline(timeline);
  }
  saveMap(mapData, snapshot);
};

let tileMesh = null;
let updateTileVisual = null;
let refreshTiles = null;
let revealMaterial = null;
let syncFlashMask = null;
const flashMaskTiles = new Float32Array(tileCount);
const flashState = { active: false, start: 0, duration: FLASH_DURATION };
const revealState = { active: false, start: 0, duration: REVEAL_DURATION };

const REVEAL_VERTEX_DECL = `
uniform float uReveal;
uniform float uRevealBand;
uniform float uRevealMin;
uniform float uRevealWidth;
uniform float uRevealJitter;
uniform float uFlash;
uniform float uFlashJump;
attribute float revealJitter;
attribute float flashMask;
varying float vReveal;
varying float vFlash;
`;

const REVEAL_FRAGMENT_DECL = `
uniform vec3 uRevealDark;
uniform float uFlash;
uniform vec3 uFlashColor;
varying float vReveal;
varying float vFlash;
`;

const REVEAL_VERTEX_BLOCK = `
vec4 revealWorldPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  revealWorldPosition = batchingMatrix * revealWorldPosition;
#endif
#ifdef USE_INSTANCING
  revealWorldPosition = instanceMatrix * revealWorldPosition;
#endif
revealWorldPosition = modelMatrix * revealWorldPosition;

float revealPos = clamp((revealWorldPosition.x + uRevealWidth * 0.5) / uRevealWidth, 0.0, 1.0);
float jitter = (revealJitter - 0.5) * uRevealJitter;
revealPos = clamp(revealPos + jitter, 0.0, 1.0);
float revealWave = smoothstep(0.0, uRevealBand, uReveal - revealPos);
float revealScale = mix(uRevealMin, 1.0, revealWave);
revealWorldPosition.y *= revealScale;
float flashScale = 1.0 + uFlash * flashMask * uFlashJump;
revealWorldPosition.y *= flashScale;
vReveal = revealWave;
vFlash = flashMask;
`;

const REVEAL_PROJECT_BLOCK = `
vec4 mvPosition = viewMatrix * revealWorldPosition;
gl_Position = projectionMatrix * mvPosition;
`;

const REVEAL_WORLD_BLOCK = `
vec4 worldPosition = revealWorldPosition;
`;

const REVEAL_FRAGMENT_BLOCK = `
diffuseColor.rgb = mix(uRevealDark, diffuseColor.rgb, vReveal);
diffuseColor.rgb = mix(diffuseColor.rgb, uFlashColor, clamp(vFlash * uFlash, 0.0, 1.0));
`;

const applyRevealMaterial = (material) => {
  material.userData.revealUniforms = {
    uReveal: { value: 1 + REVEAL_BAND },
    uRevealBand: { value: REVEAL_BAND },
    uRevealMin: { value: REVEAL_MIN_SCALE },
    uRevealWidth: { value: MAP_WIDTH },
    uRevealJitter: { value: REVEAL_JITTER },
    uRevealDark: { value: new THREE.Color(0x1a1a1a) },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(0xf2e6a0) },
    uFlashJump: { value: FLASH_JUMP_SCALE },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, material.userData.revealUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${REVEAL_VERTEX_DECL}`)
      .replace(
        "#include <displacementmap_vertex>",
        `#include <displacementmap_vertex>\n${REVEAL_VERTEX_BLOCK}`,
      )
      .replace("#include <project_vertex>", REVEAL_PROJECT_BLOCK)
      .replace("#include <worldpos_vertex>", REVEAL_WORLD_BLOCK);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${REVEAL_FRAGMENT_DECL}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${REVEAL_FRAGMENT_BLOCK}`);
  };

  material.customProgramCacheKey = () => "reveal-wave-v2";
};

const createTileMaterial = () => {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  applyRevealMaterial(material);
  revealMaterial = material;
  return material;
};

const setRevealUniform = (value) => {
  if (!revealMaterial || !revealMaterial.userData.revealUniforms) {
    return;
  }
  revealMaterial.userData.revealUniforms.uReveal.value = value;
};

const setFlashUniform = (value) => {
  if (!revealMaterial || !revealMaterial.userData.revealUniforms) {
    return;
  }
  revealMaterial.userData.revealUniforms.uFlash.value = value;
};

const startRevealAnimation = () => {
  if (!tileMesh) {
    return;
  }
  flashState.active = false;
  setFlashUniform(0);
  tileMesh.scale.set(1, 1, 1);
  revealState.active = true;
  revealState.start = performance.now();
  setRevealUniform(0);
};

const startFlashAnimation = () => {
  revealState.active = false;
  setRevealUniform(1 + REVEAL_BAND);
  flashState.active = true;
  flashState.start = performance.now();
  setFlashUniform(0);
};

const updateRevealAnimation = (time) => {
  if (!revealState.active || !tileMesh) {
    return;
  }
  const elapsed = time - revealState.start;
  const t = clamp(elapsed / revealState.duration, 0, 1);
  const eased = 1 - Math.pow(1 - t, 3);
  const progress = eased * (1 + REVEAL_BAND);
  setRevealUniform(progress);
  if (t >= 1) {
    setRevealUniform(1 + REVEAL_BAND);
    revealState.active = false;
  }
};

const updateFlashAnimation = (time) => {
  if (!flashState.active || !tileMesh) {
    return;
  }
  const elapsed = time - flashState.start;
  const t = clamp(elapsed / flashState.duration, 0, 1);
  const strength = Math.sin(t * Math.PI);
  setFlashUniform(strength);
  if (t >= 1) {
    setFlashUniform(0);
    flashState.active = false;
  }
};

const flashChangesBetween = (previousMap, currentMap, options = {}) => {
  if (!currentMap) {
    return;
  }
  const { biomesOnly = false } = options;
  const size = currentMap.width * currentMap.height;
  let changedCount = 0;
  flashMaskTiles.fill(0);

  if (
    !previousMap ||
    previousMap.width !== currentMap.width ||
    previousMap.height !== currentMap.height
  ) {
    for (let i = 0; i < size; i += 1) {
      flashMaskTiles[i] = 1;
    }
    changedCount = size;
  } else {
    for (let i = 0; i < size; i += 1) {
      if (previousMap.biomes[i] !== currentMap.biomes[i]) {
        flashMaskTiles[i] = 1;
        changedCount += 1;
        continue;
      }
      if (!biomesOnly && Math.abs(previousMap.heights[i] - currentMap.heights[i]) > FLASH_HEIGHT_EPSILON) {
        flashMaskTiles[i] = 1;
        changedCount += 1;
      }
    }
  }

  if (syncFlashMask) {
    syncFlashMask();
  }
  if (changedCount > 0) {
    startFlashAnimation();
  } else {
    flashState.active = false;
    setFlashUniform(0);
  }
};

const buildInstancedTiles = (material) => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const revealJitters = new Float32Array(tileCount);
  const revealJitterAttribute = new THREE.InstancedBufferAttribute(revealJitters, 1);
  const flashMaskAttribute = new THREE.InstancedBufferAttribute(flashMaskTiles, 1);
  geometry.setAttribute("revealJitter", revealJitterAttribute);
  geometry.setAttribute("flashMask", flashMaskAttribute);
  const mesh = new THREE.InstancedMesh(geometry, material, tileCount);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(tileCount * 3), 3);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const updateTile = (x, y, markDirty = true) => {
    if (!mapData.inBounds(x, y)) {
      return;
    }
    const idx = mapData.index(x, y);
    const heightValue = mapData.heights[idx];
    const biomeIndex = mapData.biomes[idx];
    const fogValue = mapData.fog ? mapData.fog[idx] : 0;
    const worldHeight = heightToUnits(heightValue, biomeIndex);

    dummy.position.set(x - MAP_WIDTH / 2 + 0.5, worldHeight / 2, y - MAP_HEIGHT / 2 + 0.5);
    dummy.scale.set(1, worldHeight, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(idx, dummy.matrix);
    mesh.setColorAt(idx, colorForBiome(biomeIndex, heightValue, fogValue, x, y, mapData.seed));

    if (markDirty) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  };

  const refresh = () => {
    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const idx = mapData.index(x, y);
        revealJitters[idx] = revealJitterFor(x, y, mapData.seed);
        updateTile(x, y, false);
      }
    }
    revealJitterAttribute.needsUpdate = true;
    flashMaskAttribute.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  };

  syncFlashMask = () => {
    flashMaskAttribute.needsUpdate = true;
  };

  return { mesh, updateTile, refresh };
};

const buildMergedTiles = (material) => {
  const baseGeometry = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const basePositions = baseGeometry.getAttribute("position").array;
  const baseNormals = baseGeometry.getAttribute("normal").array;
  const tileStride = basePositions.length;
  const tileVertices = tileStride / 3;
  baseGeometry.dispose();

  const positions = new Float32Array(tileCount * tileStride);
  const normals = new Float32Array(tileCount * tileStride);
  const colors = new Float32Array(tileCount * tileStride);
  const revealJitters = new Float32Array(tileCount * tileVertices);
  const flashMasks = new Float32Array(tileCount * tileVertices);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("revealJitter", new THREE.BufferAttribute(revealJitters, 1));
  geometry.setAttribute("flashMask", new THREE.BufferAttribute(flashMasks, 1));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const writeTile = (x, y, writeNormals, markDirty) => {
    if (!mapData.inBounds(x, y)) {
      return;
    }
    const idx = mapData.index(x, y);
    const heightValue = mapData.heights[idx];
    const biomeIndex = mapData.biomes[idx];
    const fogValue = mapData.fog ? mapData.fog[idx] : 0;
    const worldHeight = heightToUnits(heightValue, biomeIndex);
    const xOffset = x - MAP_WIDTH / 2 + 0.5;
    const zOffset = y - MAP_HEIGHT / 2 + 0.5;
    const tileColor = colorForBiome(
      biomeIndex,
      heightValue,
      fogValue,
      x,
      y,
      mapData.seed,
    );
    const r = tileColor.r;
    const g = tileColor.g;
    const b = tileColor.b;
    const jitter = revealJitterFor(x, y, mapData.seed);
    const baseCount = basePositions.length;
    const offset = idx * tileStride;
    const jitterOffset = idx * tileVertices;
    const flashOffset = idx * tileVertices;
    const flashValue = flashMaskTiles[idx];

    for (let i = 0; i < tileVertices; i += 1) {
      revealJitters[jitterOffset + i] = jitter;
      flashMasks[flashOffset + i] = flashValue;
    }

    for (let i = 0; i < baseCount; i += 3) {
      const outIndex = offset + i;
      positions[outIndex] = basePositions[i] + xOffset;
      positions[outIndex + 1] = (basePositions[i + 1] + 0.5) * worldHeight;
      positions[outIndex + 2] = basePositions[i + 2] + zOffset;
      colors[outIndex] = r;
      colors[outIndex + 1] = g;
      colors[outIndex + 2] = b;
      if (writeNormals) {
        normals[outIndex] = baseNormals[i];
        normals[outIndex + 1] = baseNormals[i + 1];
        normals[outIndex + 2] = baseNormals[i + 2];
      }
    }

    if (markDirty) {
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      geometry.attributes.revealJitter.needsUpdate = true;
      geometry.attributes.flashMask.needsUpdate = true;
    }
  };

  const updateTile = (x, y, markDirty = true) => {
    writeTile(x, y, false, markDirty);
  };

  const refresh = () => {
    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        writeTile(x, y, true, false);
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.attributes.revealJitter.needsUpdate = true;
    geometry.attributes.flashMask.needsUpdate = true;
  };

  syncFlashMask = () => {
    for (let i = 0; i < tileCount; i += 1) {
      const flashValue = flashMaskTiles[i];
      const offset = i * tileVertices;
      for (let v = 0; v < tileVertices; v += 1) {
        flashMasks[offset + v] = flashValue;
      }
    }
    geometry.attributes.flashMask.needsUpdate = true;
  };

  return { mesh, updateTile, refresh };
};

const disposeTileMesh = (mesh) => {
  if (!mesh) {
    return;
  }
  if (mesh.material && !Array.isArray(mesh.material) && mesh.material === revealMaterial) {
    revealMaterial = null;
  }
  scene.remove(mesh);
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }
  if (mesh.material) {
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((mat) => mat.dispose());
    } else {
      mesh.material.dispose();
    }
  }
};

const getStoredRenderer = () => {
  try {
    const stored = localStorage.getItem(RENDERER_KEY);
    if (stored === "instanced" || stored === "merged") {
      return stored;
    }
  } catch (error) {
    console.warn("Unable to read renderer preference.", error);
  }
  return DEFAULT_RENDERER;
};

let rendererMode = DEFAULT_RENDERER;

const setRendererMode = (mode, persist = true, warning = "") => {
  rendererWarning = warning;
  let targetMode = mode;
  if (targetMode !== "instanced" && targetMode !== "merged") {
    targetMode = DEFAULT_RENDERER;
  }
  if (targetMode === "instanced" && !instancingSupported) {
    targetMode = "merged";
    rendererWarning = "Instancing unsupported, using merged renderer.";
  }

  rendererMode = targetMode;

  if (persist) {
    try {
      localStorage.setItem(RENDERER_KEY, rendererMode);
    } catch (error) {
      console.warn("Unable to store renderer preference.", error);
    }
  }

  disposeTileMesh(tileMesh);
  const material = createTileMaterial();
  const tiles =
    rendererMode === "instanced" ? buildInstancedTiles(material) : buildMergedTiles(material);
  tileMesh = tiles.mesh;
  updateTileVisual = tiles.updateTile;
  refreshTiles = tiles.refresh;
  refreshTiles();
  if (syncFlashMask) {
    syncFlashMask();
  }
  startRevealAnimation();
};

setRendererMode(getStoredRenderer(), false);

const hoverLabel = document.getElementById("hover");
const lastLabel = document.getElementById("last");
const mapSizeLabel = document.getElementById("map-size");
const modeSelect = document.getElementById("mode");
const rendererSelect = document.getElementById("renderer");
const genPrevButton = document.getElementById("gen-prev");
const genNextButton = document.getElementById("gen-next");
const genIndexLabel = document.getElementById("gen-index");
const deltaInput = document.getElementById("delta");
const deltaValue = document.getElementById("delta-value");
const coordX = document.getElementById("coord-x");
const coordY = document.getElementById("coord-y");
const applyButton = document.getElementById("apply");
const regenerateButton = document.getElementById("regenerate");
const saveButton = document.getElementById("save");
const loadButton = document.getElementById("load");
const clearButton = document.getElementById("clear");
const rendererNote = document.getElementById("renderer-note");
let lastNoteUpdate = 0;
let fallbackChecked = false;
let fallbackFrames = 0;

if (mapSizeLabel) {
  mapSizeLabel.textContent = `${MAP_WIDTH}x${MAP_HEIGHT}`;
}
if (coordX) {
  coordX.max = String(MAP_WIDTH - 1);
  coordX.value = String(Math.min(Number(coordX.value) || 0, MAP_WIDTH - 1));
}
if (coordY) {
  coordY.max = String(MAP_HEIGHT - 1);
  coordY.value = String(Math.min(Number(coordY.value) || 0, MAP_HEIGHT - 1));
}

if (rendererSelect) {
  rendererSelect.value = rendererMode;
  rendererSelect.addEventListener("change", () => {
    setRendererMode(rendererSelect.value);
    rendererSelect.value = rendererMode;
    fallbackChecked = false;
    fallbackFrames = 0;
  });
}


const updateGenerationReadout = () => {
  if (!genIndexLabel) {
    return;
  }
  const currentIndex = timeline ? timeline.index : mapData.generation || 0;
  genIndexLabel.textContent = currentIndex;
  if (genPrevButton) {
    genPrevButton.disabled = currentIndex <= 0;
  }
};

const evolveGeneration = (direction) => {
  if (!timeline) {
    timeline = createTimelineFromMap(mapData);
  }
  const previousMap = mapData;
  if (direction > 0) {
    if (timeline.index < timeline.maps.length - 1) {
      timeline.index += 1;
      mapData = MapData.fromJSON(timeline.maps[timeline.index]);
    } else {
      const nextGen = timeline.index + 1;
      const evolved = evolveMapData(mapData, nextGen);
      timeline.maps.push(evolved.serialize());
      timeline.index = nextGen;
      mapData = evolved;
    }
  } else if (direction < 0) {
    if (timeline.index === 0) {
      return;
    }
    timeline.index -= 1;
    mapData = MapData.fromJSON(timeline.maps[timeline.index]);
  } else {
    return;
  }

  mapData.generation = timeline.index;
  if (mapData.heightMode !== "layered") {
    applyLayeredHeights(mapData);
  }
  if (timeline) {
    timeline.maps[timeline.index] = mapData.serialize();
  }
  refreshTiles();
  flashChangesBetween(previousMap, mapData, { biomesOnly: true });
  updateReadout(lastLabel, null, null);
  updateGenerationReadout();
  persistMapState();
};

if (genPrevButton) {
  genPrevButton.addEventListener("click", () => {
    evolveGeneration(-1);
  });
}

if (genNextButton) {
  genNextButton.addEventListener("click", () => {
    evolveGeneration(1);
  });
}

updateGenerationReadout();

const updateReadout = (label, x, y) => {
  if (x === null || y === null) {
    label.textContent = "-";
    return;
  }
  const idx = mapData.index(x, y);
  const heightValue = mapData.heights[idx];
  const biomeIndex = mapData.biomes[idx];
  const fogValue = mapData.fog ? mapData.fog[idx] : 0;
  const fogLabel = fogValue > 0.2 ? " | fog" : "";
  label.textContent = `${x}, ${y} | ${BIOMES[biomeIndex].name} | h=${heightValue.toFixed(2)}${fogLabel}`;
};

deltaInput.addEventListener("input", () => {
  deltaValue.textContent = Number(deltaInput.value).toFixed(2);
});

const updateRendererNote = (time) => {
  if (!rendererNote) {
    return;
  }
  if (time - lastNoteUpdate < 500) {
    return;
  }
  const modeLabel = rendererMode === "instanced" ? "Instanced" : "Merged";
  const glLabel = renderer.capabilities.isWebGL2 ? "WebGL2" : "WebGL1";
  const calls = renderer.info.render.calls;
  const tris = renderer.info.render.triangles;
  const noteText = `${modeLabel} | ${glLabel} | calls ${calls} | tris ${tris}`;
  rendererNote.textContent = rendererWarning ? `${rendererWarning} ${noteText}` : noteText;
  lastNoteUpdate = time;
};

const applyActionAt = (x, y, action, delta) => {
  if (!mapData.inBounds(x, y)) {
    return;
  }
  const idx = mapData.index(x, y);
  let heightValue = mapData.heights[idx];
  let biomeIndex = mapData.biomes[idx];
  const elevation = baseElevationFor(x, y, mapData.seed);
  const baseline = baselineForGeneration(elevation, x, y, mapData.seed, mapData.generation);

  switch (action) {
    case "raise":
      heightValue = clamp(heightValue + delta, 0, 1);
      biomeIndex = chooseAutoBiome(heightValue);
      break;
    case "lower":
      heightValue = clamp(heightValue - delta, 0, 1);
      biomeIndex = chooseAutoBiome(heightValue);
      break;
    case "water":
      biomeIndex = BIOME_INDEX.water;
      heightValue = biomeHeightFor(biomeIndex, x, y, mapData.seed, baseline, 0);
      break;
    case "sand":
      biomeIndex = BIOME_INDEX.sand;
      heightValue = biomeHeightFor(biomeIndex, x, y, mapData.seed, baseline, 0);
      break;
    case "grass":
      biomeIndex = BIOME_INDEX.grass;
      heightValue = biomeHeightFor(biomeIndex, x, y, mapData.seed, baseline, 0);
      break;
    case "forest":
      biomeIndex = BIOME_INDEX.forest;
      heightValue = biomeHeightFor(biomeIndex, x, y, mapData.seed, baseline, 0);
      break;
    case "rock":
      biomeIndex = BIOME_INDEX.rock;
      heightValue = biomeHeightFor(
        biomeIndex,
        x,
        y,
        mapData.seed,
        baseline,
        ROCK_LONELY_INFLUENCE,
      );
      break;
    default:
      break;
  }

  mapData.heights[idx] = heightValue;
  mapData.biomes[idx] = biomeIndex;
  updateTileVisual(x, y);
  updateReadout(lastLabel, x, y);
  persistMapState();
};

applyButton.addEventListener("click", () => {
  applyActionAt(
    Number(coordX.value),
    Number(coordY.value),
    modeSelect.value,
    Number(deltaInput.value),
  );
});

regenerateButton.addEventListener("click", () => {
  const seed = Math.floor(Math.random() * 1000000);
  mapData = generateMapData(MAP_WIDTH, MAP_HEIGHT, seed);
  timeline = createTimelineFromMap(mapData);
  refreshTiles();
  startRevealAnimation();
  updateReadout(lastLabel, null, null);
  persistMapState();
  updateGenerationReadout();
});

saveButton.addEventListener("click", () => {
  persistMapState();
});

loadButton.addEventListener("click", () => {
  const loadedTimeline = loadTimeline();
  if (loadedTimeline) {
    const candidate = MapData.fromJSON(loadedTimeline.maps[loadedTimeline.index]);
    if (candidate.width !== MAP_WIDTH || candidate.height !== MAP_HEIGHT) {
      return;
    }
    timeline = loadedTimeline;
    mapData = candidate;
  } else {
    const loaded = loadMap();
    if (!loaded || loaded.width !== MAP_WIDTH || loaded.height !== MAP_HEIGHT) {
      return;
    }
    mapData = loaded;
    timeline = createTimelineFromMap(mapData);
  }

  mapData.generation = timeline ? timeline.index : mapData.generation;
  if (mapData.heightMode !== "layered") {
    applyLayeredHeights(mapData);
  }

  if (timeline) {
    timeline.maps[timeline.index] = mapData.serialize();
  }
  refreshTiles();
  startRevealAnimation();
  updateReadout(lastLabel, null, null);
  updateGenerationReadout();
  persistMapState();
});

clearButton.addEventListener("click", () => {
  clearSavedMap();
  timeline = null;
  updateGenerationReadout();
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;

const setPointerFromEvent = (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
};

renderer.domElement.addEventListener("pointermove", (event) => {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(tileMesh);
  if (hits.length) {
    const hit = hits[0];
    const x = clamp(Math.floor(hit.point.x + MAP_WIDTH / 2), 0, MAP_WIDTH - 1);
    const y = clamp(Math.floor(hit.point.z + MAP_HEIGHT / 2), 0, MAP_HEIGHT - 1);
    if (mapData.inBounds(x, y)) {
      hovered = { x, y };
      updateReadout(hoverLabel, x, y);
    } else {
      hovered = null;
      updateReadout(hoverLabel, null, null);
    }
  } else {
    hovered = null;
    updateReadout(hoverLabel, null, null);
  }
});

renderer.domElement.addEventListener("click", () => {
  if (!hovered) {
    return;
  }
  applyActionAt(hovered.x, hovered.y, modeSelect.value, Number(deltaInput.value));
});

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateCamera();
});

const animate = (time) => {
  updateRevealAnimation(time);
  updateFlashAnimation(time);
  renderer.render(scene, camera);

  if (!fallbackChecked && rendererMode === "instanced") {
    fallbackFrames += 1;
    if (fallbackFrames > 4) {
      if (renderer.info.render.calls === 0) {
        setRendererMode("merged", true, "Instancing inactive, switched to merged renderer.");
      }
      fallbackChecked = true;
    }
  }

  updateRendererNote(time);
};

renderer.setAnimationLoop(animate);

window.wildlands = {
  get mapData() {
    return mapData;
  },
  get generation() {
    return timeline ? timeline.index : mapData.generation;
  },
  regenerate: () => regenerateButton.click(),
  evolve: (x, y, mode, delta = 0.08) => applyActionAt(x, y, mode, delta),
  stepGeneration: (direction) => evolveGeneration(direction),
  save: () => persistMapState(),
  load: () => loadButton.click(),
};
