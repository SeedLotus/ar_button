const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ROOTS = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

export function nextPadChordNotes(preset = {}, step = 0, fallbackNote = "C3") {
  if (preset.kind !== "pad" || !Array.isArray(preset.progression) || !preset.progression.length) {
    return [fallbackNote];
  }
  const index = wrapIndex(step, preset.progression.length);
  const notes = chordSymbolToNotes(preset.progression[index], 3);
  return notes.length ? notes : [fallbackNote];
}

export function chordSymbolToNotes(symbol, octave = 3) {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) return [];
  return parsed.intervals.map((interval) => noteName(parsed.rootSemitone + interval, octave));
}

function parseChordSymbol(symbol) {
  const match = String(symbol || "")
    .trim()
    .match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!match) return null;

  const root = `${match[1].toUpperCase()}${match[2] || ""}`;
  const rootSemitone = ROOTS[root];
  if (!Number.isFinite(rootSemitone)) return null;

  const quality = String(match[3] || "").trim().toLowerCase();
  const intervals = baseIntervalsForQuality(quality);
  if (quality.includes("maj7")) {
    intervals.push(11);
  } else if (quality.includes("7")) {
    intervals.push(10);
  } else if (quality.includes("6")) {
    intervals.push(9);
  }
  return { rootSemitone, intervals };
}

function baseIntervalsForQuality(quality) {
  if (quality.includes("dim")) return [0, 3, 6];
  if (quality.includes("aug") || quality.includes("+")) return [0, 4, 8];
  if (quality.startsWith("m") && !quality.startsWith("maj")) return [0, 3, 7];
  return [0, 4, 7];
}

function noteName(semitone, octave) {
  const normalized = wrapIndex(semitone, 12);
  const octaveOffset = Math.floor(semitone / 12);
  return `${NOTE_NAMES[normalized]}${octave + octaveOffset}`;
}

function wrapIndex(index, count) {
  const safeCount = Math.max(1, Number(count) || 1);
  return ((Math.trunc(Number(index) || 0) % safeCount) + safeCount) % safeCount;
}
