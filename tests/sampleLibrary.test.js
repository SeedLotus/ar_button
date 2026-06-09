import assert from "node:assert/strict";
import test from "node:test";

import {
  createSampleLibrary,
  inferSampleInstrument,
  samplesForInstrument,
} from "../src/audio/sampleLibrary.js";

function file(name, type = "audio/wav") {
  return { name, type };
}

test("inferSampleInstrument recognizes common drum sample names", () => {
  assert.equal(inferSampleInstrument("bd_punch_01.wav"), "kick");
  assert.equal(inferSampleInstrument("tight-snare.aif"), "snare");
  assert.equal(inferSampleInstrument("closed_hh_909.wav"), "hihat");
  assert.equal(inferSampleInstrument("warm-pad-chord.wav"), "pad");
  assert.equal(inferSampleInstrument("hand clap 02.mp3"), "clap");
  assert.equal(inferSampleInstrument("floor-tom.wav"), "tom");
});

test("createSampleLibrary keeps audio files and ignores non-audio files", () => {
  const library = createSampleLibrary([
    file("kick.wav"),
    file("notes.txt", "text/plain"),
    file("snare.aiff", ""),
    file("cover.png", "image/png"),
  ]);

  assert.deepEqual(
    library.map((sample) => sample.name),
    ["kick.wav", "snare.aiff"],
  );
  assert.equal(library[0].instrument, "kick");
  assert.equal(library[1].instrument, "snare");
});

test("samplesForInstrument ranks exact instrument matches before uncategorized samples", () => {
  const library = createSampleLibrary([
    file("field-recording.wav"),
    file("soft-kick.wav"),
    file("snare-room.wav"),
    file("kick-hard.wav"),
  ]);

  assert.deepEqual(
    samplesForInstrument(library, "kick").map((sample) => sample.name),
    ["soft-kick.wav", "kick-hard.wav", "field-recording.wav"],
  );
});
