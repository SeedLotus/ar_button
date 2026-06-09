const DEFAULT_OPTIONS = {
  triggerSpeed: 0.018,
  cooldownMs: 110,
  zWeight: 1,
  screenWeight: 0.18,
  downwardYWeight: 0.35,
  smoothing: 1,
  noiseFloor: 0,
  noiseMultiplier: 1,
  dwellMs: 0,
  releaseSpeed: 0,
};

export class TapDetector {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.tracks = new Map();
    this.lastSignal = 0;
    this.lastDiagnostics = null;
  }

  setOptions(options = {}) {
    this.options = { ...this.options, ...options };
  }

  reset() {
    this.tracks.clear();
    this.lastSignal = 0;
    this.lastDiagnostics = null;
  }

  update(finger, point, timeMs, context = {}) {
    if (!point || typeof point.x !== "number" || typeof point.y !== "number") {
      return null;
    }

    const currentRaw = normalizePoint(point, timeMs);
    const current = relativeToAnchor(currentRaw, context.anchor);
    const previous = this.tracks.get(finger);

    if (!previous) {
      this.tracks.set(finger, {
        previous: current,
        filtered: current,
        stableSince: timeMs,
        lastTapAt: -Infinity,
        state: "idle",
        waitingForRelease: false,
      });
      this.lastDiagnostics = diagnostics(finger, 0, "init", "idle", timeMs);
      return null;
    }

    const filtered = smoothPoint(previous.filtered, current, this.options.smoothing);
    const dx = filtered.x - previous.previous.x;
    const dy = filtered.y - previous.previous.y;
    const dz = filtered.z - previous.previous.z;
    const screenMotion = Math.hypot(dx, dy) * this.options.screenWeight;
    const downwardScreenMotion = Math.max(0, dy) * this.options.downwardYWeight;
    const zMotion = Math.max(0, dz) * this.options.zWeight;
    const signal = screenMotion + downwardScreenMotion + zMotion;
    this.lastSignal = signal;

    const threshold = this.options.triggerSpeed +
      this.options.noiseFloor * this.options.noiseMultiplier;
    const releaseSpeed = Math.max(this.options.releaseSpeed, this.options.noiseFloor);
    const requiresRelease = releaseSpeed > 0;
    if (signal <= releaseSpeed) {
      previous.stableSince = Math.min(previous.stableSince, timeMs);
      previous.waitingForRelease = false;
      previous.state = "armed";
    } else if (previous.state === "idle") {
      previous.stableSince = timeMs;
      previous.state = "hover";
    }

    const dwellReady = timeMs - previous.stableSince >= this.options.dwellMs;
    const outsideCooldown = timeMs - previous.lastTapAt >= this.options.cooldownMs;
    let event = null;
    let reason = "below-threshold";
    if (!dwellReady) reason = "dwell";
    else if (requiresRelease && previous.waitingForRelease) reason = "release";
    else if (!outsideCooldown) reason = "cooldown";

    if (
      signal >= threshold &&
      dwellReady &&
      outsideCooldown &&
      (!requiresRelease || !previous.waitingForRelease)
    ) {
      previous.lastTapAt = timeMs;
      previous.waitingForRelease = requiresRelease;
      previous.state = "hit";
      reason = "hit";
      event = {
        finger,
        x: currentRaw.x,
        y: currentRaw.y,
        z: currentRaw.z,
        timeMs,
        signal,
        threshold,
      };
    }

    previous.previous = filtered;
    previous.filtered = filtered;
    this.tracks.set(finger, previous);
    this.lastDiagnostics = diagnostics(finger, signal, reason, previous.state, timeMs, threshold);
    return event;
  }
}

function normalizePoint(point, timeMs) {
  return {
    x: point.x,
    y: point.y,
    z: typeof point.z === "number" ? point.z : 0,
    timeMs,
  };
}

function relativeToAnchor(point, anchor) {
  if (!anchor) return point;
  return {
    x: point.x - anchor.x,
    y: point.y - anchor.y,
    z: point.z - (anchor.z ?? 0),
    timeMs: point.timeMs,
  };
}

function smoothPoint(previous, current, smoothing) {
  const alpha = Math.max(0, Math.min(1, smoothing));
  return {
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
    z: previous.z + (current.z - previous.z) * alpha,
    timeMs: current.timeMs,
  };
}

function diagnostics(finger, signal, reason, state, timeMs, threshold = 0) {
  return { finger, signal, reason, state, timeMs, threshold };
}
