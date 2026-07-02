/**
 * Desk surface detection — finds the largest uniform brightness region
 * in the lower portion of a camera frame (assumes overhead/angled desk view).
 */

export const DESK_DEFAULTS = {
  scanStartY: 0.25,     // scan from 25% down (skip upper frame with user's face)
  scanEndY: 1.0,        // scan to bottom
  brightnessBins: 10,   // quantize V into this many bins
  minAreaRatio: 0.04,   // desk must be at least 4% of frame
  expansionSteps: 1,    // grow region by N pixels after flood fill
};

/**
 * @param {Uint8ClampedArray} rgba - process canvas pixel data (RGBA)
 * @param {number} width
 * @param {number} height
 * @param {object} options
 * @returns {{ quad: Array|null, rect: {x,y,width,height}|null }}
 *   Normalized [0-1] coordinates. quad: 4 corners, rect: AABB.
 */
export function detectDeskFromRgba(rgba, width, height, options = {}) {
  const opts = { ...DESK_DEFAULTS, ...options };
  const yStart = Math.floor(opts.scanStartY * height);
  const yEnd = Math.floor(opts.scanEndY * height);
  const binCount = opts.brightnessBins;

  if (yEnd <= yStart || width < 4) return { quad: null, rect: null };

  // Quantize V (brightness) into bins, build mask of the largest bin
  const binArea = new Uint32Array(binCount);
  const pixelBin = new Uint8Array(width * height);

  for (let y = yStart; y < yEnd; y++) {
    const rowBase = y * width;
    for (let x = 0; x < width; x++) {
      const i = (rowBase + x) * 4;
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const v = Math.max(r, g, b) / 255; // simple V = max(R,G,B)
      const bin = Math.min(binCount - 1, Math.floor(v * binCount));
      pixelBin[rowBase + x] = bin;
      binArea[bin]++;
    }
  }

  // Find the dominant brightness bin in the scan region
  let domBin = 0;
  let domCount = 0;
  for (let b = 0; b < binCount; b++) {
    if (binArea[b] > domCount) {
      domCount = binArea[b];
      domBin = b;
    }
  }

  const scanPixels = (yEnd - yStart) * width;
  if (domCount < opts.minAreaRatio * scanPixels) {
    return { quad: null, rect: null };
  }

  // Flood fill the largest contiguous region in the dominant bin
  const visited = new Uint8Array(width * height);
  let bestRegion = null;
  let bestArea = 0;

  for (let y = yStart; y < yEnd; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx]) continue;
      if (pixelBin[idx] !== domBin) continue;

      // Flood fill
      const stack = [[x, y]];
      visited[idx] = 1;
      let regionArea = 0;
      let minX = x, maxX = x, minY = y, maxY = y;

      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        regionArea++;

        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (const [dx, dy] of [[0, 1],[1, 0],[0, -1],[-1, 0]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= width || ny < yStart || ny >= yEnd) continue;
          const nidx = ny * width + nx;
          if (visited[nidx]) continue;
          if (pixelBin[nidx] !== domBin) {
            // Tolerance: accept adjacent bins within ±1
            if (Math.abs(pixelBin[nidx] - domBin) <= 1) {
              // ok
            } else {
              continue;
            }
          }
          visited[nidx] = 1;
          stack.push([nx, ny]);
        }
      }

      if (regionArea > bestArea) {
        bestArea = regionArea;
        bestRegion = { minX, maxX, minY, maxY };
      }
    }
  }

  if (!bestRegion || bestArea < opts.minAreaRatio * scanPixels) {
    return { quad: null, rect: null };
  }

  const { minX, maxX, minY, maxY } = bestRegion;
  const rect = {
    x: minX / width,
    y: minY / height,
    width: (maxX - minX) / width,
    height: (maxY - minY) / height,
  };
  const quad = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];

  return { quad, rect };
}

/**
 * Build desk area from user-drawn corners.
 * @param {Array<{x:number,y:number}>} corners - 2 or 4 normalized [0-1] points
 * @returns {{ quad: Array, rect: {x,y,width,height} }}
 */
export function deskAreaFromCorners(corners) {
  let quad;
  if (corners.length === 2) {
    const [a, b] = corners;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);
    quad = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
  } else {
    quad = corners.slice(0, 4);
  }
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const rect = {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
  return { quad, rect };
}

/**
 * Point-in-polygon test (ray casting).
 */
export function pointInPolygon(point, polygon) {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    if (
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}
