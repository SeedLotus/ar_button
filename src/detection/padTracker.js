const DEFAULT_OPTIONS = {
  confirmFrames: 2,
  smoothing: 0.32,
  missingTtlMs: 420,
  maxMatchDistance: 58,
  minIoU: 0.04,
};

export class PadTracker {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.tracks = [];
    this.nextTrackId = 1;
  }

  reset() {
    this.tracks = [];
    this.nextTrackId = 1;
  }

  update(candidates = [], timeMs = 0, options = {}) {
    if (options.locked) {
      return this.getPads();
    }

    const unmatchedTracks = new Set(this.tracks);
    const matchedCandidates = new Set();

    for (const candidate of candidates) {
      const match = findBestTrack(candidate, unmatchedTracks, this.options);
      if (!match) continue;

      updateTrack(match, candidate, timeMs, this.options);
      unmatchedTracks.delete(match);
      matchedCandidates.add(candidate);
    }

    for (const candidate of candidates) {
      if (matchedCandidates.has(candidate)) continue;
      this.tracks.push(createTrack(candidate, this.nextTrackId, timeMs));
      this.nextTrackId += 1;
    }

    const ttl = this.options.missingTtlMs;
    this.tracks = this.tracks.filter((track) => timeMs - track.lastSeenAt <= ttl);
    return this.getPads();
  }

  getPads() {
    return this.tracks
      .filter((track) => track.hits >= this.options.confirmFrames)
      .map((track) => clonePad(track.pad));
  }
}

function createTrack(candidate, nextTrackId, timeMs) {
  const id = `tracked-${nextTrackId}`;
  const pad = normalizeTrackedPad(candidate, id);
  return {
    id,
    hits: 1,
    lastSeenAt: timeMs,
    pad,
  };
}

function updateTrack(track, candidate, timeMs, options) {
  const alpha = clamp(options.smoothing, 0, 1);
  const previous = track.pad;
  const next = normalizeTrackedPad(candidate, track.id);

  track.hits += 1;
  track.lastSeenAt = timeMs;
  track.pad = {
    ...previous,
    sourceId: candidate.id,
    instrument: next.instrument,
    label: next.label,
    ruleId: next.ruleId,
    hue: smoothCircularHue(previous.hue, next.hue, alpha),
    area: lerp(previous.area, next.area, alpha),
    bounds: smoothBounds(previous.bounds, next.bounds, alpha),
    centroid: smoothPoint(previous.centroid, next.centroid, alpha),
    color: smoothColor(previous.color, next.color, alpha),
  };
  track.pad.outline = boundsToOutline(track.pad.bounds);
}

function normalizeTrackedPad(candidate, id) {
  const bounds = { ...candidate.bounds };
  return {
    ...candidate,
    id,
    sourceId: candidate.id,
    bounds,
    centroid: { ...candidate.centroid },
    color: { ...candidate.color },
    outline: candidate.outline ? candidate.outline.map((point) => ({ ...point })) : boundsToOutline(bounds),
  };
}

function findBestTrack(candidate, tracks, options) {
  let best = null;
  let bestScore = Infinity;
  for (const track of tracks) {
    const score = matchScore(candidate, track.pad, options);
    if (score < bestScore) {
      best = track;
      bestScore = score;
    }
  }
  return Number.isFinite(bestScore) ? best : null;
}

function matchScore(candidate, trackedPad, options) {
  if (
    candidate.ruleId &&
    trackedPad.ruleId &&
    candidate.ruleId !== trackedPad.ruleId
  ) {
    return Infinity;
  }

  const distance = pointDistance(candidate.centroid, trackedPad.centroid);
  const iou = boundsIoU(candidate.bounds, trackedPad.bounds);
  const canMatch = distance <= options.maxMatchDistance || iou >= options.minIoU;
  if (!canMatch) return Infinity;

  const instrumentPenalty = candidate.instrument === trackedPad.instrument ? 0 : 40;
  const ruleBonus = candidate.ruleId && candidate.ruleId === trackedPad.ruleId ? -18 : 0;
  return distance + instrumentPenalty + ruleBonus - iou * 30;
}

function smoothPoint(a, b, alpha) {
  return {
    x: lerp(a.x, b.x, alpha),
    y: lerp(a.y, b.y, alpha),
  };
}

function smoothBounds(a, b, alpha) {
  return {
    x: lerp(a.x, b.x, alpha),
    y: lerp(a.y, b.y, alpha),
    width: lerp(a.width, b.width, alpha),
    height: lerp(a.height, b.height, alpha),
  };
}

function smoothColor(a, b, alpha) {
  return {
    r: Math.round(lerp(a.r, b.r, alpha)),
    g: Math.round(lerp(a.g, b.g, alpha)),
    b: Math.round(lerp(a.b, b.b, alpha)),
  };
}

function smoothCircularHue(a, b, alpha) {
  const from = normalizeHue(a);
  const to = normalizeHue(b);
  let diff = to - from;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return normalizeHue(from + diff * alpha);
}

function boundsIoU(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  if (intersection <= 0) return 0;
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  return intersection / (areaA + areaB - intersection);
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

function clonePad(pad) {
  return {
    ...pad,
    bounds: { ...pad.bounds },
    centroid: { ...pad.centroid },
    color: { ...pad.color },
    outline: pad.outline.map((point) => ({ ...point })),
  };
}

function lerp(a, b, alpha) {
  return a + (b - a) * alpha;
}

function normalizeHue(hue) {
  return ((hue % 360) + 360) % 360;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
