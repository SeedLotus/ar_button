import { hitTestPads } from "./colorSegmentation.js";

const DEFAULT_OPTIONS = {
  targetPadding: 8,
  lockTtlMs: 220,
  globalCooldownMs: 65,
  touchDwellMs: 70,
};

export class TapArbiter {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.locks = new Map();
    this.touches = new Map();
    this.lastHitAt = -Infinity;
    this.lastDiagnostics = null;
  }

  setOptions(options = {}) {
    this.options = { ...this.options, ...options };
  }

  reset() {
    this.locks.clear();
    this.touches.clear();
    this.lastHitAt = -Infinity;
    this.lastDiagnostics = null;
  }

  updateHover(finger, point, pads, timeMs) {
    if (!point) return;

    const pad = hitTestPads(pads, point.x, point.y, this.options.targetPadding);
    if (pad) {
      this.locks.set(finger, { padId: pad.id, timeMs });
      this.lastDiagnostics = diagnostics("tap", finger, "locked", "hover", timeMs);
      return;
    }

    const lock = this.locks.get(finger);
    if (lock && timeMs - lock.timeMs > this.options.lockTtlMs) {
      this.locks.delete(finger);
    }
  }

  resolveTap(tap, pads, timeMs = tap?.timeMs ?? 0) {
    if (!tap || timeMs - this.lastHitAt < this.options.globalCooldownMs) {
      return null;
    }

    const lockedPad = this.findLockedPad(tap.finger, pads, timeMs);
    const directPad = lockedPad || hitTestPads(
      pads,
      tap.x,
      tap.y,
      this.options.targetPadding,
    );
    if (!directPad) return null;

    this.lastHitAt = timeMs;
    this.locks.delete(tap.finger);
    return {
      pad: directPad,
      finger: tap.finger,
      signal: tap.signal,
      timeMs,
      x: tap.x,
      y: tap.y,
      mode: "tap",
    };
  }

  resolveTouch(finger, point, pads, timeMs = 0) {
    if (!point) {
      this.touches.delete(finger);
      this.setTouchIdleDiagnostics(finger, timeMs);
      return null;
    }

    const pad = hitTestPads(pads, point.x, point.y, this.options.targetPadding);
    if (!pad) {
      this.touches.delete(finger);
      this.setTouchIdleDiagnostics(finger, timeMs);
      return null;
    }

    let touch = this.touches.get(finger);
    if (!touch || touch.padId !== pad.id) {
      touch = {
        padId: pad.id,
        enteredAt: timeMs,
        lastSeenAt: timeMs,
        fired: false,
        lastHitAt: -Infinity,
      };
      this.touches.set(finger, touch);
      this.lastDiagnostics = diagnostics("touch", finger, "dwell", "hover", timeMs);
      return null;
    }

    touch.lastSeenAt = timeMs;
    const dwellReady = timeMs - touch.enteredAt >= this.options.touchDwellMs;
    const outsideCooldown = timeMs - this.lastHitAt >= this.options.globalCooldownMs;
    if (touch.fired) {
      this.lastDiagnostics = diagnostics("touch", finger, "release", "held", timeMs);
      return null;
    }
    if (!dwellReady) {
      this.lastDiagnostics = diagnostics("touch", finger, "dwell", "hover", timeMs);
      return null;
    }
    if (!outsideCooldown) {
      this.lastDiagnostics = diagnostics("touch", finger, "cooldown", "cooldown", timeMs);
      return null;
    }

    touch.fired = true;
    touch.lastHitAt = timeMs;
    this.lastHitAt = timeMs;
    this.lastDiagnostics = diagnostics("touch", finger, "hit", "hit", timeMs);
    return {
      pad,
      finger,
      signal: 0,
      timeMs,
      x: point.x,
      y: point.y,
      mode: "touch",
    };
  }

  getPadFeedback(pads, timeMs = 0) {
    const feedback = [];
    for (const [finger, lock] of this.locks.entries()) {
      if (timeMs - lock.timeMs > this.options.lockTtlMs) continue;
      const pad = pads.find((item) => item.id === lock.padId);
      if (pad) feedback.push({ pad, finger, mode: "tap", state: "locked", progress: 1 });
    }
    for (const [finger, touch] of this.touches.entries()) {
      const pad = pads.find((item) => item.id === touch.padId);
      if (!pad) continue;
      const state = touch.fired
        ? (timeMs - touch.lastHitAt < 180 ? "hit" : "held")
        : "hover";
      const progress = clamp(
        (timeMs - touch.enteredAt) / Math.max(1, this.options.touchDwellMs),
        0,
        1,
      );
      feedback.push({ pad, finger, mode: "touch", state, progress });
    }
    return feedback;
  }

  setTouchIdleDiagnostics(finger, timeMs) {
    if (this.touches.size === 0) {
      this.lastDiagnostics = diagnostics("touch", finger, "outside", "idle", timeMs);
    }
  }

  findLockedPad(finger, pads, timeMs) {
    const lock = this.locks.get(finger);
    if (!lock) return null;
    if (timeMs - lock.timeMs > this.options.lockTtlMs) {
      this.locks.delete(finger);
      return null;
    }
    return pads.find((pad) => pad.id === lock.padId) || null;
  }
}

function diagnostics(mode, finger, reason, state, timeMs) {
  return { mode, finger, reason, state, timeMs };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
