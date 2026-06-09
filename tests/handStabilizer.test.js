import assert from "node:assert/strict";
import test from "node:test";

import { HandStabilizer } from "../src/detection/handStabilizer.js";

function makeHand(x = 0.4, y = 0.4, z = 0) {
  return Array.from({ length: 21 }, (_, index) => ({
    x: x + (index % 5) * 0.004,
    y: y + Math.floor(index / 5) * 0.004,
    z,
  }));
}

test("HandStabilizer keeps tiny landmark jitter inside the dead zone", () => {
  const stabilizer = new HandStabilizer({
    smoothing: 0.5,
    anchorSmoothing: 0.5,
    deadZonePx: 3,
    relativeDeadZonePx: 3,
  });
  const viewport = { width: 1000, height: 1000 };

  const first = stabilizer.update([makeHand(0.4, 0.4)], 0, viewport)[0].landmarks;
  const jittered = stabilizer.update([makeHand(0.401, 0.399)], 16, viewport)[0].landmarks;

  assert.equal(jittered[8].x, first[8].x);
  assert.equal(jittered[8].y, first[8].y);
});

test("HandStabilizer follows deliberate motion without jumping to the raw point", () => {
  const stabilizer = new HandStabilizer({
    smoothing: 0.5,
    anchorSmoothing: 0.5,
    deadZonePx: 2,
    relativeDeadZonePx: 2,
  });
  const viewport = { width: 1000, height: 1000 };

  const first = stabilizer.update([makeHand(0.4, 0.4)], 0, viewport)[0].landmarks;
  const moved = stabilizer.update([makeHand(0.43, 0.4)], 16, viewport)[0].landmarks;
  const raw = makeHand(0.43, 0.4);

  assert.ok(moved[8].x > first[8].x);
  assert.ok(moved[8].x < raw[8].x);
});

test("HandStabilizer briefly holds the last hand when tracking drops", () => {
  const stabilizer = new HandStabilizer({ holdTtlMs: 120 });
  const viewport = { width: 1000, height: 1000 };

  const first = stabilizer.update([makeHand(0.4, 0.4)], 0, viewport)[0];
  const held = stabilizer.update([], 80, viewport);
  const expired = stabilizer.update([], 180, viewport);

  assert.equal(held.length, 1);
  assert.equal(held[0].held, true);
  assert.deepEqual(held[0].landmarks, first.landmarks);
  assert.equal(expired.length, 0);
});
