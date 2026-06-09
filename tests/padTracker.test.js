import assert from "node:assert/strict";
import test from "node:test";

import { PadTracker } from "../src/detection/padTracker.js";

function pad(id, x, y, overrides = {}) {
  return {
    id,
    instrument: "kick",
    label: "Kick",
    ruleId: "kick-red",
    hue: 356,
    area: 100,
    bounds: { x, y, width: 10, height: 10 },
    centroid: { x: x + 5, y: y + 5 },
    color: { r: 240, g: 40, b: 45 },
    outline: [
      { x, y },
      { x: x + 10, y },
      { x: x + 10, y: y + 10 },
      { x, y: y + 10 },
    ],
    ...overrides,
  };
}

test("PadTracker keeps a stable id and smooths jittering detections", () => {
  const tracker = new PadTracker({
    confirmFrames: 1,
    smoothing: 0.25,
    maxMatchDistance: 40,
  });

  const first = tracker.update([pad("raw-a", 10, 10)], 0)[0];
  const second = tracker.update([pad("raw-b", 18, 10)], 80)[0];

  assert.equal(second.id, first.id);
  assert.ok(second.centroid.x > first.centroid.x);
  assert.ok(second.centroid.x < 23);
});

test("PadTracker waits for repeated observations before confirming a pad", () => {
  const tracker = new PadTracker({
    confirmFrames: 2,
    smoothing: 0.5,
    maxMatchDistance: 40,
  });

  assert.equal(tracker.update([pad("raw-a", 10, 10)], 0).length, 0);
  assert.equal(tracker.update([pad("raw-b", 11, 10)], 80).length, 1);
});

test("PadTracker holds pad geometry while locked for performance", () => {
  const tracker = new PadTracker({
    confirmFrames: 1,
    smoothing: 0.4,
    maxMatchDistance: 80,
  });

  const first = tracker.update([pad("raw-a", 10, 10)], 0)[0];
  const locked = tracker.update([pad("raw-b", 60, 10)], 80, { locked: true })[0];

  assert.equal(locked.id, first.id);
  assert.equal(locked.centroid.x, first.centroid.x);
});

test("PadTracker keeps recently missed pads briefly to avoid flicker", () => {
  const tracker = new PadTracker({
    confirmFrames: 1,
    missingTtlMs: 250,
  });

  const first = tracker.update([pad("raw-a", 10, 10)], 0)[0];
  const held = tracker.update([], 120)[0];
  const expired = tracker.update([], 320);

  assert.equal(held.id, first.id);
  assert.equal(expired.length, 0);
});
