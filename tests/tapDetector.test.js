import assert from "node:assert/strict";
import test from "node:test";

import { TapDetector } from "../src/detection/tapDetector.js";

test("TapDetector emits one tap when z movement crosses the threshold", () => {
  const detector = new TapDetector({
    triggerSpeed: 0.018,
    zWeight: 1,
    cooldownMs: 120,
  });

  assert.equal(detector.update("index", { x: 0.5, y: 0.5, z: 0.0 }, 0), null);
  const tap = detector.update("index", { x: 0.5, y: 0.51, z: 0.025 }, 16);

  assert.ok(tap);
  assert.equal(tap.finger, "index");
  assert.ok(tap.signal >= 0.018);
});

test("TapDetector suppresses repeated events inside the cooldown window", () => {
  const detector = new TapDetector({
    triggerSpeed: 0.01,
    cooldownMs: 100,
  });

  detector.update("index", { x: 0.1, y: 0.1, z: 0 }, 0);
  assert.ok(detector.update("index", { x: 0.1, y: 0.1, z: 0.02 }, 16));
  assert.equal(
    detector.update("index", { x: 0.1, y: 0.1, z: 0.05 }, 50),
    null,
  );
  assert.ok(detector.update("index", { x: 0.1, y: 0.1, z: 0.08 }, 140));
});

test("TapDetector keeps independent cooldowns for different fingers", () => {
  const detector = new TapDetector({
    triggerSpeed: 0.01,
    cooldownMs: 100,
  });

  detector.update("index", { x: 0.1, y: 0.1, z: 0 }, 0);
  detector.update("middle", { x: 0.2, y: 0.1, z: 0 }, 0);

  assert.equal(
    detector.update("index", { x: 0.1, y: 0.1, z: 0.02 }, 16)?.finger,
    "index",
  );
  assert.equal(
    detector.update("middle", { x: 0.2, y: 0.1, z: 0.02 }, 24)?.finger,
    "middle",
  );
});

test("TapDetector ignores stationary landmark jitter below the noise floor", () => {
  const detector = new TapDetector({
    triggerSpeed: 0.004,
    noiseFloor: 0.006,
    noiseMultiplier: 1.4,
    cooldownMs: 80,
    smoothing: 0.35,
  });

  detector.update("index", { x: 0.5, y: 0.5, z: 0 }, 0);
  for (let i = 1; i < 20; i += 1) {
    const jitter = i % 2 === 0 ? 0.002 : -0.002;
    const tap = detector.update(
      "index",
      { x: 0.5 + jitter, y: 0.5 - jitter, z: jitter },
      i * 16,
    );
    assert.equal(tap, null);
  }
});

test("TapDetector subtracts anchor motion so whole-hand movement does not trigger", () => {
  const detector = new TapDetector({
    triggerSpeed: 0.006,
    cooldownMs: 80,
    screenWeight: 0.8,
    zWeight: 1,
  });

  detector.update(
    "index",
    { x: 0.4, y: 0.4, z: 0 },
    0,
    { anchor: { x: 0.2, y: 0.2, z: 0 } },
  );
  const tap = detector.update(
    "index",
    { x: 0.44, y: 0.44, z: 0.04 },
    16,
    { anchor: { x: 0.24, y: 0.24, z: 0.04 } },
  );

  assert.equal(tap, null);
});

test("TapDetector requires dwell time before arming a finger", () => {
  const detector = new TapDetector({
    triggerSpeed: 0.012,
    dwellMs: 80,
    cooldownMs: 80,
  });

  detector.update("index", { x: 0.5, y: 0.5, z: 0 }, 0);
  assert.equal(
    detector.update("index", { x: 0.5, y: 0.5, z: 0.03 }, 32),
    null,
  );
  detector.update("index", { x: 0.5, y: 0.5, z: 0.03 }, 96);
  const tap = detector.update("index", { x: 0.5, y: 0.5, z: 0.06 }, 112);

  assert.ok(tap);
});

test("TapDetector waits for release before allowing another tap", () => {
  const detector = new TapDetector({
    triggerSpeed: 0.012,
    releaseSpeed: 0.004,
    cooldownMs: 20,
  });

  detector.update("index", { x: 0.5, y: 0.5, z: 0 }, 0);
  assert.ok(detector.update("index", { x: 0.5, y: 0.5, z: 0.03 }, 16));
  detector.update("index", { x: 0.5, y: 0.5, z: 0.06 }, 48);
  assert.equal(detector.update("index", { x: 0.5, y: 0.5, z: 0.09 }, 80), null);
  detector.update("index", { x: 0.5, y: 0.5, z: 0.091 }, 112);
  assert.ok(detector.update("index", { x: 0.5, y: 0.5, z: 0.13 }, 144));
});
