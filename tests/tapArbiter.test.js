import assert from "node:assert/strict";
import test from "node:test";

import { TapArbiter } from "../src/detection/tapArbiter.js";

const kick = {
  id: "tracked-kick",
  instrument: "kick",
  label: "Kick",
  bounds: { x: 10, y: 10, width: 16, height: 16 },
  centroid: { x: 18, y: 18 },
};

const snare = {
  id: "tracked-snare",
  instrument: "snare",
  label: "Snare",
  bounds: { x: 30, y: 10, width: 16, height: 16 },
  centroid: { x: 38, y: 18 },
};

test("TapArbiter resolves a tap to the pad locked before the downstroke", () => {
  const arbiter = new TapArbiter({
    targetPadding: 0,
    lockTtlMs: 200,
    globalCooldownMs: 0,
  });

  arbiter.updateHover("index", { x: 18, y: 18 }, [kick, snare], 0);
  const hit = arbiter.resolveTap(
    { finger: "index", x: 38, y: 18, signal: 0.03, timeMs: 45 },
    [kick, snare],
    45,
  );

  assert.equal(hit.pad.id, "tracked-kick");
});

test("TapArbiter applies a global cooldown so one hand motion yields one hit", () => {
  const arbiter = new TapArbiter({
    targetPadding: 0,
    lockTtlMs: 200,
    globalCooldownMs: 80,
  });

  arbiter.updateHover("index", { x: 18, y: 18 }, [kick, snare], 0);
  assert.equal(
    arbiter.resolveTap(
      { finger: "index", x: 18, y: 18, signal: 0.03, timeMs: 30 },
      [kick, snare],
      30,
    ).pad.id,
    "tracked-kick",
  );

  arbiter.updateHover("middle", { x: 38, y: 18 }, [kick, snare], 40);
  assert.equal(
    arbiter.resolveTap(
      { finger: "middle", x: 38, y: 18, signal: 0.03, timeMs: 55 },
      [kick, snare],
      55,
    ),
    null,
  );
});

test("TapArbiter falls back to direct hit testing when no lock exists", () => {
  const arbiter = new TapArbiter({
    targetPadding: 0,
    globalCooldownMs: 0,
  });

  const hit = arbiter.resolveTap(
    { finger: "index", x: 38, y: 18, signal: 0.03, timeMs: 30 },
    [kick, snare],
    30,
  );

  assert.equal(hit.pad.id, "tracked-snare");
});

test("TapArbiter touch mode triggers after dwell and waits for release", () => {
  const arbiter = new TapArbiter({
    targetPadding: 0,
    touchDwellMs: 60,
    globalCooldownMs: 0,
  });

  assert.equal(arbiter.resolveTouch("index", { x: 18, y: 18 }, [kick], 0), null);
  assert.equal(arbiter.resolveTouch("index", { x: 18, y: 18 }, [kick], 40), null);

  const hit = arbiter.resolveTouch("index", { x: 18, y: 18 }, [kick], 70);
  assert.equal(hit.pad.id, "tracked-kick");
  assert.equal(hit.mode, "touch");

  assert.equal(arbiter.resolveTouch("index", { x: 18, y: 18 }, [kick], 120), null);
  arbiter.resolveTouch("index", { x: 0, y: 0 }, [kick], 140);
  assert.equal(arbiter.resolveTouch("index", { x: 18, y: 18 }, [kick], 170), null);
  assert.equal(
    arbiter.resolveTouch("index", { x: 18, y: 18 }, [kick], 235)?.pad.id,
    "tracked-kick",
  );
});

test("TapArbiter reports hover feedback for locked and touched pads", () => {
  const arbiter = new TapArbiter({
    targetPadding: 0,
    touchDwellMs: 60,
    globalCooldownMs: 0,
  });

  arbiter.updateHover("index", { x: 18, y: 18 }, [kick], 0);
  arbiter.resolveTouch("middle", { x: 38, y: 18 }, [snare], 20);

  const feedback = arbiter.getPadFeedback([kick, snare], 30);

  assert.deepEqual(
    feedback.map((item) => [item.pad.id, item.mode, item.state]),
    [
      ["tracked-kick", "tap", "locked"],
      ["tracked-snare", "touch", "hover"],
    ],
  );
});
