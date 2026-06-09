import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DRUM_KIT,
  INSTRUMENTS,
  normalizeDrumKitSettings,
  serializeDrumKitSettings,
} from "../src/audio/drumKitConfig.js";

test("DEFAULT_DRUM_KIT exposes one setting object per instrument", () => {
  assert.deepEqual(
    Object.keys(DEFAULT_DRUM_KIT).sort(),
    INSTRUMENTS.map((instrument) => instrument.id).sort(),
  );
  assert.ok(INSTRUMENTS.some((instrument) => instrument.id === "pad"));
  assert.equal(DEFAULT_DRUM_KIT.pad.decay, 1.8);
});

test("normalizeDrumKitSettings clamps controls and keeps defaults", () => {
  const settings = normalizeDrumKitSettings({
    kick: { volumeDb: 99, pitch: -99, decay: 9 },
    snare: { volumeDb: -4 },
  });

  assert.equal(settings.kick.volumeDb, 6);
  assert.equal(settings.kick.pitch, -24);
  assert.equal(settings.kick.decay, 2.5);
  assert.equal(settings.snare.volumeDb, -4);
  assert.equal(settings.clap.pitch, DEFAULT_DRUM_KIT.clap.pitch);
});

test("serializeDrumKitSettings stores tweakable values but not local file urls", () => {
  const serialized = serializeDrumKitSettings({
    clap: {
      volumeDb: -3,
      pitch: 2,
      decay: 0.8,
      sampleName: "clap.wav",
      sampleUrl: "blob:http://localhost/sample",
    },
  });

  assert.equal(serialized.clap.volumeDb, -3);
  assert.equal(serialized.clap.sampleName, undefined);
  assert.equal(serialized.clap.sampleUrl, undefined);
});
