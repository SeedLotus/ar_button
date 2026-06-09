import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_COLOR_RULES,
  createColorRuleFromSample,
  detectColorPadsFromRgba,
  hitTestPads,
  instrumentForHue,
  matchesColorRule,
  rgbToHsv,
  sampleColorRuleFromRgba,
} from "../src/detection/colorSegmentation.js";

function rgbaFrame(width, height, fill = [245, 245, 240, 255]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return data;
}

function fillRect(data, width, x, y, w, h, rgba) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      const i = (yy * width + xx) * 4;
      data[i] = rgba[0];
      data[i + 1] = rgba[1];
      data[i + 2] = rgba[2];
      data[i + 3] = rgba[3];
    }
  }
}

test("rgbToHsv returns expected hue families", () => {
  assert.equal(Math.round(rgbToHsv(255, 0, 0).h), 0);
  assert.equal(Math.round(rgbToHsv(0, 255, 0).h), 120);
  assert.equal(Math.round(rgbToHsv(0, 0, 255).h), 240);
});

test("detectColorPadsFromRgba detects saturated blobs and ignores neutral paper", () => {
  const width = 16;
  const height = 12;
  const data = rgbaFrame(width, height);
  fillRect(data, width, 2, 2, 4, 3, [245, 30, 35, 255]);
  fillRect(data, width, 10, 6, 3, 3, [20, 220, 90, 255]);

  const pads = detectColorPadsFromRgba(data, width, height, {
    minArea: 4,
    minSaturation: 0.45,
    minValue: 0.25,
  });

  assert.equal(pads.length, 2);
  assert.deepEqual(
    pads.map((pad) => pad.area).sort((a, b) => a - b),
    [9, 12],
  );
  assert.equal(hitTestPads(pads, 3, 3)?.instrument, "kick");
  assert.equal(hitTestPads(pads, 11, 7)?.instrument, "hihat");
  assert.equal(hitTestPads(pads, 0, 0), null);
});

test("detectColorPadsFromRgba respects region of interest", () => {
  const width = 20;
  const height = 10;
  const data = rgbaFrame(width, height);
  fillRect(data, width, 1, 1, 4, 4, [250, 20, 20, 255]);
  fillRect(data, width, 14, 1, 4, 4, [40, 80, 255, 255]);

  const pads = detectColorPadsFromRgba(data, width, height, {
    minArea: 4,
    roi: { x: 10, y: 0, width: 10, height: 10 },
  });

  assert.equal(pads.length, 1);
  assert.equal(pads[0].instrument, "clap");
});

test("instrumentForHue maps hue ranges to drum voices", () => {
  assert.equal(instrumentForHue(2), "kick");
  assert.equal(instrumentForHue(45), "snare");
  assert.equal(instrumentForHue(135), "hihat");
  assert.equal(instrumentForHue(185), "pad");
  assert.equal(instrumentForHue(225), "clap");
  assert.equal(instrumentForHue(300), "tom");
});

test("DEFAULT_COLOR_RULES exposes a Pad object rule", () => {
  const padRule = DEFAULT_COLOR_RULES.find((rule) => rule.instrument === "pad");

  assert.equal(padRule.label, "Pad");
  assert.equal(matchesColorRule(rgbToHsv(70, 215, 205), padRule), true);
});

test("detectColorPadsFromRgba uses color rules as a whitelist", () => {
  const width = 20;
  const height = 10;
  const data = rgbaFrame(width, height);
  fillRect(data, width, 1, 1, 4, 4, [90, 95, 105, 255]);
  fillRect(data, width, 10, 1, 4, 4, [35, 75, 240, 255]);

  const pads = detectColorPadsFromRgba(data, width, height, {
    minArea: 4,
    colorRules: DEFAULT_COLOR_RULES,
  });

  assert.equal(pads.length, 1);
  assert.equal(pads[0].instrument, "clap");
  assert.ok(pads[0].color.b > pads[0].color.r);
});

test("detectColorPadsFromRgba lets sampled low-saturation rules override global saturation", () => {
  const width = 20;
  const height = 10;
  const data = rgbaFrame(width, height);
  fillRect(data, width, 5, 2, 8, 5, [198, 228, 178, 255]);

  const rules = [{
    id: "soft-green",
    instrument: "snare",
    label: "Snare",
    enabled: true,
    hueCenter: 95,
    hueRange: 32,
    minSaturation: 0.12,
    minValue: 0.52,
    maxValue: 1,
  }];
  const pads = detectColorPadsFromRgba(data, width, height, {
    minArea: 4,
    minSaturation: 0.42,
    minValue: 0.18,
    colorRules: rules,
  });

  assert.equal(pads.length, 1);
  assert.equal(pads[0].instrument, "snare");
});

test("detectColorPadsFromRgba ignores disabled color rules", () => {
  const width = 12;
  const height = 8;
  const data = rgbaFrame(width, height);
  fillRect(data, width, 2, 2, 5, 3, [240, 35, 45, 255]);

  const rules = DEFAULT_COLOR_RULES.map((rule) =>
    rule.instrument === "kick" ? { ...rule, enabled: false } : rule,
  );
  const pads = detectColorPadsFromRgba(data, width, height, {
    minArea: 4,
    colorRules: rules,
  });

  assert.equal(pads.length, 0);
});

test("detectColorPadsFromRgba ignores pixels inside excluded rectangles", () => {
  const width = 24;
  const height = 10;
  const data = rgbaFrame(width, height);
  fillRect(data, width, 2, 2, 5, 4, [240, 35, 45, 255]);
  fillRect(data, width, 15, 2, 5, 4, [240, 35, 45, 255]);

  const pads = detectColorPadsFromRgba(data, width, height, {
    minArea: 4,
    colorRules: DEFAULT_COLOR_RULES,
    excludeRects: [{ x: 0, y: 0, width: 10, height: 10 }],
  });

  assert.equal(pads.length, 1);
  assert.deepEqual(pads[0].bounds, { x: 15, y: 2, width: 5, height: 4 });
});

test("matchesColorRule supports hue ranges crossing zero", () => {
  const kickRule = DEFAULT_COLOR_RULES.find((rule) => rule.instrument === "kick");

  assert.equal(matchesColorRule({ h: 355, s: 0.8, v: 0.8 }, kickRule), true);
  assert.equal(matchesColorRule({ h: 8, s: 0.8, v: 0.8 }, kickRule), true);
  assert.equal(matchesColorRule({ h: 45, s: 0.8, v: 0.8 }, kickRule), false);
});

test("createColorRuleFromSample creates a stricter sampled rule", () => {
  const sample = rgbToHsv(40, 90, 235);
  const rule = createColorRuleFromSample("clap", sample, {
    hueRange: 14,
    saturationSlack: 0.12,
    valueSlack: 0.18,
  });

  assert.equal(rule.instrument, "clap");
  assert.equal(rule.hueCenter, Math.round(sample.h));
  assert.equal(matchesColorRule(sample, rule), true);
  assert.equal(matchesColorRule(rgbToHsv(90, 95, 105), rule), false);
});

test("sampleColorRuleFromRgba samples a local area and prefers bright object pixels over shadows", () => {
  const width = 24;
  const height = 18;
  const data = rgbaFrame(width, height, [50, 54, 58, 255]);
  fillRect(data, width, 7, 5, 10, 8, [188, 224, 166, 255]);
  fillRect(data, width, 7, 11, 10, 2, [92, 110, 82, 255]);

  const sample = sampleColorRuleFromRgba(data, width, height, 12, 9, {
    instrument: "snare",
    label: "Snare",
    radius: 5,
  });

  assert.equal(sample.rule.instrument, "snare");
  assert.ok(sample.count > 24);
  assert.ok(sample.hsv.v > 0.7);
  assert.ok(sample.rule.minSaturation <= 0.18);
  assert.equal(matchesColorRule(rgbToHsv(188, 224, 166), sample.rule), true);
  assert.equal(matchesColorRule(rgbToHsv(50, 54, 58), sample.rule), false);
});
