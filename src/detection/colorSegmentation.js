const DEFAULT_OPTIONS = {
  minArea: 36,
  minSaturation: 0.42,
  minValue: 0.18,
  maxPads: 8,
  roi: null,
  colorRules: null,
  excludeRects: null,
};

export const DEFAULT_COLOR_RULES = [
  {
    id: "kick-red",
    instrument: "kick",
    label: "Kick",
    zhLabel: "底鼓",
    enabled: true,
    hueCenter: 356,
    hueRange: 18,
    minSaturation: 0.5,
    minValue: 0.22,
    maxValue: 1,
  },
  {
    id: "snare-yellow",
    instrument: "snare",
    label: "Snare",
    zhLabel: "军鼓",
    enabled: true,
    hueCenter: 45,
    hueRange: 28,
    minSaturation: 0.45,
    minValue: 0.24,
    maxValue: 1,
  },
  {
    id: "hihat-green",
    instrument: "hihat",
    label: "Hi-hat",
    zhLabel: "踩镲",
    enabled: true,
    hueCenter: 125,
    hueRange: 46,
    minSaturation: 0.38,
    minValue: 0.22,
    maxValue: 1,
  },
  {
    id: "pad-cyan",
    instrument: "pad",
    label: "Pad",
    zhLabel: "铺底",
    enabled: true,
    hueCenter: 185,
    hueRange: 16,
    minSaturation: 0.34,
    minValue: 0.24,
    maxValue: 1,
  },
  {
    id: "clap-blue",
    instrument: "clap",
    label: "Clap",
    zhLabel: "拍手",
    enabled: true,
    hueCenter: 225,
    hueRange: 34,
    minSaturation: 0.52,
    minValue: 0.24,
    maxValue: 1,
  },
  {
    id: "tom-purple",
    instrument: "tom",
    label: "Tom",
    zhLabel: "通鼓",
    enabled: true,
    hueCenter: 295,
    hueRange: 36,
    minSaturation: 0.45,
    minValue: 0.22,
    maxValue: 1,
  },
];

export function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2);
    else h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  return { h, s, v: max };
}

export function instrumentForHue(hue) {
  const h = ((hue % 360) + 360) % 360;
  if (h < 20 || h >= 340) return "kick";
  if (h < 75) return "snare";
  if (h < 180) return "hihat";
  if (h < 205) return "pad";
  if (h < 260) return "clap";
  return "tom";
}

export function detectColorPadsFromRgba(rgba, width, height, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const roi = normalizeRoi(opts.roi, width, height);
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const colorRules = normalizeColorRules(opts.colorRules);
  const excludeRects = normalizeRects(opts.excludeRects, width, height);

  for (let y = roi.y; y < roi.y + roi.height; y += 1) {
    for (let x = roi.x; x < roi.x + roi.width; x += 1) {
      if (pointInAnyRect(x, y, excludeRects)) continue;
      const pixelIndex = y * width + x;
      const i = pixelIndex * 4;
      if (rgba[i + 3] < 32) continue;

      const hsv = rgbToHsv(rgba[i], rgba[i + 1], rgba[i + 2]);
      const ruleIndex = colorRules
        ? findMatchingRuleIndex(hsv, colorRules, opts)
        : -1;
      if (ruleIndex >= 0) {
        mask[pixelIndex] = ruleIndex + 1;
      } else if (!colorRules && hsv.s >= opts.minSaturation && hsv.v >= opts.minValue) {
        mask[pixelIndex] = 1;
      }
    }
  }

  const pads = [];
  for (let y = roi.y; y < roi.y + roi.height; y += 1) {
    for (let x = roi.x; x < roi.x + roi.width; x += 1) {
      const startIndex = y * width + x;
      if (!mask[startIndex] || visited[startIndex]) continue;

      const component = floodFill(mask, visited, rgba, width, height, x, y, roi);
      if (component.area < opts.minArea) continue;

      const hue = averageHue(component.hueSin, component.hueCos);
      const rule = colorRules ? colorRules[component.maskValue - 1] : null;
      const instrument = rule?.instrument || instrumentForHue(hue);
      pads.push({
        id: `pad-${pads.length + 1}`,
        instrument,
        label: rule?.label || instrument,
        ruleId: rule?.id || null,
        hue,
        area: component.area,
        bounds: component.bounds,
        centroid: {
          x: component.sumX / component.area,
          y: component.sumY / component.area,
        },
        color: {
          r: Math.round(component.sumR / component.area),
          g: Math.round(component.sumG / component.area),
          b: Math.round(component.sumB / component.area),
        },
        outline: boundsToOutline(component.bounds),
      });
    }
  }

  return pads.sort((a, b) => b.area - a.area).slice(0, opts.maxPads);
}

export function matchesColorRule(hsv, rule) {
  if (!rule || rule.enabled === false) return false;
  const minSaturation = numberOr(rule.minSaturation, 0);
  const minValue = numberOr(rule.minValue, 0);
  const maxValue = numberOr(rule.maxValue, 1);
  if (hsv.s < minSaturation || hsv.v < minValue || hsv.v > maxValue) return false;

  const center = normalizeHue(numberOr(rule.hueCenter, 0));
  const range = clamp(numberOr(rule.hueRange, 180), 0, 180);
  return hueDistance(hsv.h, center) <= range;
}

export function createColorRuleFromSample(instrument, hsv, options = {}) {
  const hueRange = numberOr(options.hueRange, 18);
  const saturationSlack = numberOr(options.saturationSlack, 0.16);
  const valueSlack = numberOr(options.valueSlack, 0.18);
  return {
    id: `${instrument}-sampled`,
    instrument,
    label: options.label || instrument,
    enabled: true,
    hueCenter: Math.round(normalizeHue(hsv.h)),
    hueRange,
    minSaturation: clamp(hsv.s - saturationSlack, 0.18, 0.95),
    minValue: clamp(hsv.v - valueSlack, 0.08, 0.95),
    maxValue: 1,
  };
}

export function sampleColorRuleFromRgba(rgba, width, height, x, y, options = {}) {
  const radius = clamp(Math.round(numberOr(options.radius, 7)), 2, 28);
  const centerX = clamp(Math.round(numberOr(x, 0)), 0, width - 1);
  const centerY = clamp(Math.round(numberOr(y, 0)), 0, height - 1);
  const pixels = [];

  for (let yy = Math.max(0, centerY - radius); yy <= Math.min(height - 1, centerY + radius); yy += 1) {
    for (let xx = Math.max(0, centerX - radius); xx <= Math.min(width - 1, centerX + radius); xx += 1) {
      const dx = xx - centerX;
      const dy = yy - centerY;
      if (dx * dx + dy * dy > radius * radius) continue;
      const i = (yy * width + xx) * 4;
      if (rgba[i + 3] < 32) continue;
      const hsv = rgbToHsv(rgba[i], rgba[i + 1], rgba[i + 2]);
      if (hsv.v < 0.16) continue;
      pixels.push({
        r: rgba[i],
        g: rgba[i + 1],
        b: rgba[i + 2],
        hsv,
        score: hsv.v * 0.78 + hsv.s * 0.22,
      });
    }
  }

  const source = pixels.length > 0
    ? pixels.sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.ceil(pixels.length * 0.68)))
    : [{
      r: rgba[(centerY * width + centerX) * 4],
      g: rgba[(centerY * width + centerX) * 4 + 1],
      b: rgba[(centerY * width + centerX) * 4 + 2],
      hsv: rgbToHsv(
        rgba[(centerY * width + centerX) * 4],
        rgba[(centerY * width + centerX) * 4 + 1],
        rgba[(centerY * width + centerX) * 4 + 2],
      ),
      score: 1,
    }];

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumS = 0;
  let sumV = 0;
  let hueSin = 0;
  let hueCos = 0;
  let totalWeight = 0;
  for (const pixel of source) {
    const weight = Math.max(0.12, pixel.hsv.v * (0.45 + pixel.hsv.s));
    const radians = (pixel.hsv.h * Math.PI) / 180;
    sumR += pixel.r * weight;
    sumG += pixel.g * weight;
    sumB += pixel.b * weight;
    sumS += pixel.hsv.s * weight;
    sumV += pixel.hsv.v * weight;
    hueSin += Math.sin(radians) * weight;
    hueCos += Math.cos(radians) * weight;
    totalWeight += weight;
  }

  const hsv = {
    h: averageHue(hueSin, hueCos),
    s: sumS / totalWeight,
    v: sumV / totalWeight,
  };
  const hueRange = numberOr(options.hueRange, hsv.s < 0.34 ? 34 : 24);
  const rule = createColorRuleFromSample(options.instrument || instrumentForHue(hsv.h), hsv, {
    label: options.label,
    hueRange,
    saturationSlack: hsv.s < 0.34 ? 0.16 : 0.12,
    valueSlack: 0.26,
  });
  return {
    rule,
    hsv,
    rgb: {
      r: Math.round(sumR / totalWeight),
      g: Math.round(sumG / totalWeight),
      b: Math.round(sumB / totalWeight),
    },
    count: source.length,
    radius,
    x: centerX,
    y: centerY,
  };
}

export function hitTestPads(pads, x, y, padding = 0) {
  for (const pad of pads) {
    const b = pad.bounds;
    if (
      x >= b.x - padding &&
      x <= b.x + b.width + padding &&
      y >= b.y - padding &&
      y <= b.y + b.height + padding
    ) {
      return pad;
    }
  }
  return null;
}

function normalizeRoi(roi, width, height) {
  if (!roi) return { x: 0, y: 0, width, height };
  const x = clamp(Math.floor(roi.x), 0, width - 1);
  const y = clamp(Math.floor(roi.y), 0, height - 1);
  const right = clamp(Math.ceil(roi.x + roi.width), x + 1, width);
  const bottom = clamp(Math.ceil(roi.y + roi.height), y + 1, height);
  return { x, y, width: right - x, height: bottom - y };
}

function normalizeRects(rects, width, height) {
  if (!Array.isArray(rects) || rects.length === 0) return [];
  return rects
    .filter((rect) => rect && rect.width > 0 && rect.height > 0)
    .map((rect) => normalizeRoi(rect, width, height));
}

function pointInAnyRect(x, y, rects) {
  for (const rect of rects) {
    if (
      x >= rect.x &&
      x < rect.x + rect.width &&
      y >= rect.y &&
      y < rect.y + rect.height
    ) {
      return true;
    }
  }
  return false;
}

function floodFill(mask, visited, rgba, width, height, startX, startY, roi) {
  const stack = [startY * width + startX];
  const startIndex = startY * width + startX;
  const maskValue = mask[startIndex];
  visited[startIndex] = 1;

  const component = {
    maskValue,
    area: 0,
    sumX: 0,
    sumY: 0,
    sumR: 0,
    sumG: 0,
    sumB: 0,
    hueSin: 0,
    hueCos: 0,
    bounds: {
      x: startX,
      y: startY,
      width: 1,
      height: 1,
    },
  };

  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;
  const roiRight = roi.x + roi.width;
  const roiBottom = roi.y + roi.height;

  while (stack.length > 0) {
    const index = stack.pop();
    const x = index % width;
    const y = Math.floor(index / width);
    const i = index * 4;
    const hsv = rgbToHsv(rgba[i], rgba[i + 1], rgba[i + 2]);
    const radians = (hsv.h * Math.PI) / 180;

    component.area += 1;
    component.sumX += x;
    component.sumY += y;
    component.sumR += rgba[i];
    component.sumG += rgba[i + 1];
    component.sumB += rgba[i + 2];
    component.hueSin += Math.sin(radians);
    component.hueCos += Math.cos(radians);

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);

    visitNeighbor(x - 1, y);
    visitNeighbor(x + 1, y);
    visitNeighbor(x, y - 1);
    visitNeighbor(x, y + 1);
  }

  component.bounds = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
  return component;

  function visitNeighbor(x, y) {
    if (x < roi.x || y < roi.y || x >= roiRight || y >= roiBottom) return;
    const next = y * width + x;
    if (mask[next] !== maskValue || visited[next]) return;
    visited[next] = 1;
    stack.push(next);
  }
}

function normalizeColorRules(rules) {
  if (!Array.isArray(rules)) return null;
  const normalized = rules
    .filter((rule) => rule && rule.enabled !== false)
    .map((rule, index) => ({
      ...rule,
      id: rule.id || `${rule.instrument || "rule"}-${index}`,
      instrument: rule.instrument || "clap",
      label: rule.label || rule.instrument || "clap",
      hueCenter: normalizeHue(numberOr(rule.hueCenter, 0)),
      hueRange: clamp(numberOr(rule.hueRange, 20), 0, 180),
      minSaturation: clamp(numberOr(rule.minSaturation, 0.45), 0, 1),
      minValue: clamp(numberOr(rule.minValue, 0.18), 0, 1),
      maxValue: clamp(numberOr(rule.maxValue, 1), 0, 1),
    }));
  return normalized.length > 0 ? normalized : [];
}

function findMatchingRuleIndex(hsv, rules, options) {
  for (let i = 0; i < rules.length; i += 1) {
    if (matchesColorRule(hsv, rules[i])) return i;
  }
  return -1;
}

function averageHue(sin, cos) {
  let hue = (Math.atan2(sin, cos) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  return hue;
}

function boundsToOutline(bounds) {
  const x2 = bounds.x + bounds.width;
  const y2 = bounds.y + bounds.height;
  return [
    { x: bounds.x, y: bounds.y },
    { x: x2, y: bounds.y },
    { x: x2, y: y2 },
    { x: bounds.x, y: y2 },
  ];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeHue(hue) {
  return ((hue % 360) + 360) % 360;
}

function hueDistance(a, b) {
  const diff = Math.abs(normalizeHue(a) - normalizeHue(b));
  return Math.min(diff, 360 - diff);
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
