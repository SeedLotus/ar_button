const DEFAULT_OPTIONS = {
  smoothing: 0.34,
  anchorSmoothing: 0.2,
  deadZonePx: 3,
  relativeDeadZonePx: 2,
  holdTtlMs: 120,
};

export class HandStabilizer {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.tracks = [];
  }

  setOptions(options = {}) {
    this.options = { ...this.options, ...options };
  }

  reset() {
    this.tracks = [];
  }

  update(rawHands = [], timeMs = 0, viewport = {}) {
    const view = normalizeViewport(viewport);
    const nextTracks = [];
    const hands = [];

    for (let index = 0; index < rawHands.length; index += 1) {
      const raw = normalizeHand(rawHands[index]);
      if (!raw) continue;

      const previous = this.tracks[index] || null;
      const track = stabilizeHand(previous, raw, timeMs, view, this.options);
      nextTracks[index] = track;
      hands.push({
        landmarks: clonePoints(track.landmarks),
        held: false,
        rawLandmarks: raw,
      });
    }

    for (let index = rawHands.length; index < this.tracks.length; index += 1) {
      const previous = this.tracks[index];
      if (!previous || timeMs - previous.lastSeenAt > this.options.holdTtlMs) continue;
      nextTracks[index] = previous;
      hands.push({
        landmarks: clonePoints(previous.landmarks),
        held: true,
        rawLandmarks: null,
      });
    }

    this.tracks = nextTracks.filter(Boolean);
    return hands;
  }
}

function stabilizeHand(previous, raw, timeMs, view, options) {
  const rawAnchor = handAnchor(raw);
  const anchor = stabilizePoint(
    previous?.anchor,
    rawAnchor,
    options.anchorSmoothing,
    options.deadZonePx,
    view,
  );
  const relatives = raw.map((point, index) => {
    const relative = subtractPoint(point, rawAnchor);
    return stabilizePoint(
      previous?.relatives?.[index],
      relative,
      options.smoothing,
      options.relativeDeadZonePx,
      view,
    );
  });
  const landmarks = relatives.map((point) => addPoint(anchor, point));

  return {
    anchor,
    relatives,
    landmarks,
    lastSeenAt: timeMs,
  };
}

function normalizeHand(hand) {
  if (!Array.isArray(hand) || hand.length === 0) return null;
  return hand.map((point) => ({
    x: Number(point?.x) || 0,
    y: Number(point?.y) || 0,
    z: Number(point?.z) || 0,
  }));
}

function handAnchor(hand) {
  const wrist = hand[0] || { x: 0, y: 0, z: 0 };
  const palm = hand[9] || wrist;
  return {
    x: (wrist.x + palm.x) / 2,
    y: (wrist.y + palm.y) / 2,
    z: (wrist.z + palm.z) / 2,
  };
}

function stabilizePoint(previous, current, smoothing, deadZonePx, view) {
  if (!previous) return { ...current };
  if (pixelDistance(previous, current, view) <= deadZonePx) return { ...previous };
  const alpha = clamp(smoothing, 0, 1);
  return {
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
    z: previous.z + (current.z - previous.z) * alpha,
  };
}

function pixelDistance(a, b, view) {
  const dx = (b.x - a.x) * view.width;
  const dy = (b.y - a.y) * view.height;
  const dz = (b.z - a.z) * Math.min(view.width, view.height);
  return Math.hypot(dx, dy, dz);
}

function subtractPoint(point, anchor) {
  return {
    x: point.x - anchor.x,
    y: point.y - anchor.y,
    z: point.z - anchor.z,
  };
}

function addPoint(anchor, point) {
  return {
    x: clamp(anchor.x + point.x, 0, 1),
    y: clamp(anchor.y + point.y, 0, 1),
    z: anchor.z + point.z,
  };
}

function clonePoints(points) {
  return points.map((point) => ({ ...point }));
}

function normalizeViewport(viewport) {
  return {
    width: Math.max(1, Number(viewport.width) || 1),
    height: Math.max(1, Number(viewport.height) || 1),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
