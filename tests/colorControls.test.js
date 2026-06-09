import assert from "node:assert/strict";
import test from "node:test";

import {
  cameraFilterFromControls,
  colorRulePatchFromHex,
  colorRulePreviewCss,
  hexToRgb,
} from "../src/ui/colorControls.js";

test("cameraFilterFromControls maps setup sliders to visible camera filters", () => {
  const low = cameraFilterFromControls({ saturationValue: 0.12, valueValue: 0.05 });
  const high = cameraFilterFromControls({ saturationValue: 0.9, valueValue: 0.8 });

  assert.ok(low.saturation < 1);
  assert.ok(low.brightness < 1);
  assert.ok(high.saturation > 1.8);
  assert.ok(high.brightness > 1.4);
  assert.match(high.cssFilter, /saturate\(/);
  assert.match(high.cssFilter, /brightness\(/);
});

test("colorRulePatchFromHex updates hue, saturation, and value thresholds", () => {
  const patch = colorRulePatchFromHex("#3366ff");

  assert.deepEqual(hexToRgb("#3366ff"), { r: 51, g: 102, b: 255 });
  assert.equal(patch.hueCenter, 225);
  assert.ok(patch.minSaturation > 0.65);
  assert.ok(patch.minValue > 0.75);
  assert.equal(patch.maxValue, 1);
});

test("colorRulePreviewCss reflects the rule saturation and value, not a fixed swatch", () => {
  const dull = colorRulePreviewCss({ hueCenter: 225, minSaturation: 0.1, minValue: 0.2 });
  const vivid = colorRulePreviewCss({ hueCenter: 225, minSaturation: 0.8, minValue: 0.7 });

  assert.notEqual(dull, vivid);
  assert.match(vivid, /hsl\(225/);
});
