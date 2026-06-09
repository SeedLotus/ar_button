import { rgbToHsv } from "../detection/colorSegmentation.js";

export const COLOR_PANEL_PRESETS = [
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#14b8a6",
  "#38bdf8",
  "#2563eb",
  "#a855f7",
  "#ec4899",
  "#ffffff",
  "#94a3b8",
  "#111827",
];

const SATURATION_RANGE = { min: 0.12, max: 0.9, outMin: 0.55, outMax: 1.95 };
const BRIGHTNESS_RANGE = { min: 0.05, max: 0.8, outMin: 0.72, outMax: 1.58 };

export function cameraFilterFromControls({ saturationValue, valueValue } = {}) {
  const saturation = mapRange(Number(saturationValue), SATURATION_RANGE);
  const brightness = mapRange(Number(valueValue), BRIGHTNESS_RANGE);
  return {
    saturation,
    brightness,
    cssFilter: `saturate(${formatFilterNumber(saturation)}) brightness(${formatFilterNumber(brightness)})`,
  };
}

export function colorRulePatchFromHex(hex) {
  const rgb = hexToRgb(hex);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  return {
    hueCenter: Math.round(normalizeHue(hsv.h)),
    minSaturation: clamp(hsv.s - 0.1, 0.05, 0.95),
    minValue: clamp(hsv.v - 0.16, 0.04, 0.95),
    maxValue: 1,
  };
}

export function colorRulePreviewCss(rule = {}) {
  const hue = Math.round(normalizeHue(numberOr(rule.hueCenter, 0)));
  const saturation = Math.round(clamp(numberOr(rule.minSaturation, 0.5) + 0.16, 0.08, 1) * 100);
  const lightness = Math.round(clamp(numberOr(rule.minValue, 0.55) + 0.06, 0.16, 0.74) * 100);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

export function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function normalizeHexColor(hex) {
  const raw = String(hex || "").trim();
  const short = raw.match(/^#?([0-9a-fA-F]{3})$/);
  if (short) {
    return `#${short[1].split("").map((char) => `${char}${char}`).join("").toLowerCase()}`;
  }
  const full = raw.match(/^#?([0-9a-fA-F]{6})$/);
  if (!full) return "#ffffff";
  return `#${full[1].toLowerCase()}`;
}

function mapRange(value, range) {
  const number = Number.isFinite(value) ? value : range.min;
  const t = (clamp(number, range.min, range.max) - range.min) / (range.max - range.min);
  return range.outMin + t * (range.outMax - range.outMin);
}

function formatFilterNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, "");
}

function normalizeHue(hue) {
  return ((hue % 360) + 360) % 360;
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
