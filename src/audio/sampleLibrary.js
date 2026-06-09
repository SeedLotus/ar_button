const AUDIO_EXTENSIONS = new Set(["wav", "aif", "aiff", "mp3", "flac", "ogg", "m4a", "webm"]);

const INSTRUMENT_ALIASES = {
  kick: ["kick", "bd", "bassdrum", "bass drum"],
  snare: ["snare", "snr", "sd", "rim", "rimshot"],
  hihat: ["hihat", "hi hat", "hat", "hh", "closedhat", "openhat"],
  pad: ["pad", "pads", "ambient", "atmosphere", "texture", "chord"],
  clap: ["clap", "clp", "handclap", "hand clap"],
  tom: ["tom", "floor tom", "lowtom", "hightom"],
};

export function createSampleLibrary(files = []) {
  return Array.from(files)
    .filter(isAudioFile)
    .map((file, index) => {
      const name = file.name || `sample-${index + 1}`;
      return {
        id: `sample-${index}`,
        name,
        path: file.webkitRelativePath || name,
        file,
        instrument: inferSampleInstrument(name),
      };
    });
}

export function samplesForInstrument(library = [], instrument, limit = 10) {
  return library
    .filter((sample) => sample.instrument === instrument || sample.instrument === "unknown")
    .sort((a, b) => rankSample(a, instrument) - rankSample(b, instrument))
    .slice(0, limit);
}

export function inferSampleInstrument(fileName = "") {
  const normalized = normalizeName(fileName);
  const compact = normalized.replaceAll(" ", "");
  for (const [instrument, aliases] of Object.entries(INSTRUMENT_ALIASES)) {
    if (aliases.some((alias) => matchesAlias(normalized, compact, alias))) return instrument;
  }
  return "unknown";
}

function isAudioFile(file) {
  if (file?.type?.startsWith("audio/")) return true;
  const extension = (file?.name || "").split(".").pop()?.toLowerCase();
  return AUDIO_EXTENSIONS.has(extension);
}

function rankSample(sample, instrument) {
  if (sample.instrument === instrument) return 0;
  if (sample.instrument === "unknown") return 1;
  return 2;
}

function matchesAlias(normalized, compact, alias) {
  const normalizedAlias = normalizeName(alias);
  if (normalizedAlias.includes(" ")) return normalized.includes(normalizedAlias);
  return normalized.split(" ").includes(normalizedAlias) || compact.includes(normalizedAlias);
}

function normalizeName(fileName) {
  return String(fileName)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
