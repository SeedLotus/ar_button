import assert from "node:assert/strict";
import test from "node:test";

import {
  chordSymbolToNotes,
  nextPadChordNotes,
} from "../src/audio/padProgression.js";

test("chordSymbolToNotes expands common pad chord symbols", () => {
  assert.deepEqual(chordSymbolToNotes("C", 3), ["C3", "E3", "G3"]);
  assert.deepEqual(chordSymbolToNotes("Am", 3), ["A3", "C4", "E4"]);
  assert.deepEqual(chordSymbolToNotes("Cmaj7", 3), ["C3", "E3", "G3", "B3"]);
  assert.deepEqual(chordSymbolToNotes("G6", 3), ["G3", "B3", "D4", "E4"]);
});

test("nextPadChordNotes cycles through pad progression", () => {
  const preset = { kind: "pad", progression: ["C", "G", "Am", "F"] };

  assert.deepEqual(nextPadChordNotes(preset, 0), ["C3", "E3", "G3"]);
  assert.deepEqual(nextPadChordNotes(preset, 2), ["A3", "C4", "E4"]);
  assert.deepEqual(nextPadChordNotes(preset, 5), ["G3", "B3", "D4"]);
});

test("nextPadChordNotes falls back to a single note when no usable progression exists", () => {
  assert.deepEqual(nextPadChordNotes({ kind: "drum" }, 0, "D2"), ["D2"]);
  assert.deepEqual(nextPadChordNotes({ kind: "pad", progression: ["not-a-chord"] }, 0, "A2"), ["A2"]);
});
