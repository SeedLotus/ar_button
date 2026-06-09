export const INSTRUMENTS = [
  { id: "kick", label: "Kick", zhLabel: "底鼓", color: "#ff4f5e" },
  { id: "snare", label: "Snare", zhLabel: "军鼓", color: "#ffc94d" },
  { id: "hihat", label: "Hi-hat", zhLabel: "踩镲", color: "#62df84" },
  { id: "pad", label: "Pad", zhLabel: "铺底", color: "#47d7cb" },
  { id: "clap", label: "Clap", zhLabel: "拍手", color: "#68c8ff" },
  { id: "tom", label: "Tom", zhLabel: "通鼓", color: "#d86cff" },
];

export const DEFAULT_DRUM_KIT = {
  kick: { volumeDb: 0, pitch: 0, decay: 0.72 },
  snare: { volumeDb: -2, pitch: 0, decay: 0.42 },
  hihat: { volumeDb: -8, pitch: 4, decay: 0.18 },
  pad: { volumeDb: -7, pitch: 0, decay: 1.8 },
  clap: { volumeDb: -4, pitch: 0, decay: 0.48 },
  tom: { volumeDb: -2, pitch: -3, decay: 0.68 },
};

export function normalizeDrumKitSettings(raw = {}) {
  const normalized = {};
  for (const instrument of INSTRUMENTS) {
    const fallback = DEFAULT_DRUM_KIT[instrument.id];
    const value = raw[instrument.id] || {};
    normalized[instrument.id] = {
      volumeDb: clamp(numberOr(value.volumeDb, fallback.volumeDb), -24, 6),
      pitch: clamp(numberOr(value.pitch, fallback.pitch), -24, 24),
      decay: clamp(numberOr(value.decay, fallback.decay), 0.05, 2.5),
    };
  }
  return normalized;
}

export function serializeDrumKitSettings(settings = {}) {
  return normalizeDrumKitSettings(settings);
}

export function instrumentMeta(instrumentId) {
  return INSTRUMENTS.find((instrument) => instrument.id === instrumentId) || INSTRUMENTS[0];
}

function numberOr(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
