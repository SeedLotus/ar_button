import {
  FilesetResolver,
  HandLandmarker,
} from "https://esm.sh/@mediapipe/tasks-vision@0.10.14";

import {
  DEFAULT_COLOR_RULES,
  detectColorPadsFromRgba,
  sampleColorRuleFromRgba,
} from "./detection/colorSegmentation.js";
import { PadTracker } from "./detection/padTracker.js";
import { HandStabilizer } from "./detection/handStabilizer.js";
import { TapArbiter } from "./detection/tapArbiter.js";
import { TapDetector } from "./detection/tapDetector.js";
import { DrumEngine } from "./audio/drumEngine.js";
import {
  INSTRUMENTS,
  instrumentMeta,
  normalizeDrumKitSettings,
  serializeDrumKitSettings,
} from "./audio/drumKitConfig.js";
import {
  createSampleLibrary,
  samplesForInstrument,
} from "./audio/sampleLibrary.js";
import {
  COLOR_PANEL_PRESETS,
  cameraFilterFromControls,
  colorRulePatchFromHex,
  colorRulePreviewCss,
  normalizeHexColor,
} from "./ui/colorControls.js";

const FINGER_TIPS = {
  thumb: 4,
  index: 8,
  middle: 12,
  ring: 16,
  pinky: 20,
};

const ACTIVE_FINGER_TIPS = {
  thumb: 4,
  index: 8,
  middle: 12,
};

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const COLOR_RULES_STORAGE_KEY = "object-drum-studio.colorRules.v1";
const DRUM_KIT_STORAGE_KEY = "object-drum-studio.drumKit.v1";
const TRIGGER_MODE_STORAGE_KEY = "object-drum-studio.triggerMode.v2";
const FINGER_LABELS = {
  thumb: "拇指",
  index: "食指",
  middle: "中指",
  ring: "无名指",
  pinky: "小指",
};

const els = {
  video: document.querySelector("#camera"),
  overlay: document.querySelector("#overlay"),
  process: document.querySelector("#process"),
  start: document.querySelector("#startButton"),
  cameraSelect: document.querySelector("#cameraSelect"),
  mirror: document.querySelector("#mirrorToggle"),
  roiButton: document.querySelector("#roiButton"),
  clearRoi: document.querySelector("#clearRoiButton"),
  lockPads: document.querySelector("#lockPadsButton"),
  lockStatus: document.querySelector("#lockStatus"),
  sat: document.querySelector("#sat"),
  val: document.querySelector("#val"),
  area: document.querySelector("#area"),
  tap: document.querySelector("#tap"),
  zWeight: document.querySelector("#zWeight"),
  cooldown: document.querySelector("#cooldown"),
  noiseFloor: document.querySelector("#noiseFloor"),
  smoothing: document.querySelector("#smoothing"),
  dwell: document.querySelector("#dwell"),
  release: document.querySelector("#release"),
  triggerMode: document.querySelector("#triggerMode"),
  satValue: document.querySelector("#satValue"),
  valValue: document.querySelector("#valValue"),
  areaValue: document.querySelector("#areaValue"),
  tapValue: document.querySelector("#tapValue"),
  zWeightValue: document.querySelector("#zWeightValue"),
  cooldownValue: document.querySelector("#cooldownValue"),
  noiseFloorValue: document.querySelector("#noiseFloorValue"),
  smoothingValue: document.querySelector("#smoothingValue"),
  dwellValue: document.querySelector("#dwellValue"),
  releaseValue: document.querySelector("#releaseValue"),
  gestureSignal: document.querySelector("#gestureSignal"),
  gestureMeter: document.querySelector("#gestureMeter"),
  gestureReason: document.querySelector("#gestureReason"),
  resetColorRules: document.querySelector("#resetColorRules"),
  samplingStatus: document.querySelector("#samplingStatus"),
  status: document.querySelector("#status"),
  padsCount: document.querySelector("#padsCount"),
  handsCount: document.querySelector("#handsCount"),
  signal: document.querySelector("#signal"),
  eventLog: document.querySelector("#eventLog"),
  stage: document.querySelector("#stage"),
  panelTabs: document.querySelectorAll("[data-tab]"),
  panelPages: document.querySelectorAll("[data-panel-page]"),
  padList: document.querySelector("#padList"),
  padEditor: document.querySelector("#padEditor"),
  soundList: document.querySelector("#soundList"),
  soundEditor: document.querySelector("#soundEditor"),
  sampleLibraryInput: document.querySelector("#sampleLibraryInput"),
  sampleLibraryStatus: document.querySelector("#sampleLibraryStatus"),
};

const state = {
  running: false,
  handLandmarker: null,
  stream: null,
  pads: [],
  handsRaw: [],
  hands: [],
  handStates: [],
  triggerMode: loadTriggerMode(),
  padsLocked: false,
  colorRules: loadColorRules(),
  drumKit: loadDrumKitSettings(),
  sampleNames: {},
  sampleStatuses: {},
  sampleLibrary: [],
  previewAudio: null,
  selectedRuleId: null,
  selectedSoundInstrument: "kick",
  samplingRuleId: null,
  samplingPreview: null,
  recentHits: [],
  roiNorm: null,
  roiDraft: null,
  roiMode: false,
  dragStart: null,
  lastPadScanAt: 0,
  lastFrameAt: 0,
};

const processCtx = els.process.getContext("2d", { willReadFrequently: true });
const overlayCtx = els.overlay.getContext("2d");
const padTracker = new PadTracker({
  confirmFrames: 2,
  smoothing: 0.28,
  missingTtlMs: 520,
  maxMatchDistance: 52,
});
const handStabilizer = new HandStabilizer(readHandStabilizerOptions());
const tapDetector = new TapDetector(readTapOptions());
const tapArbiter = new TapArbiter(readTapArbiterOptions());
const drumEngine = new DrumEngine(state.drumKit);
drumEngine.onSampleStatusChange = (instrument, status) => {
  if (status?.name) state.sampleNames[instrument] = status.name;
  state.sampleStatuses[instrument] = status?.loaded ? "loaded" : "queued";
  if (els.soundList.children.length) syncSoundSlotUi(instrument);
  else renderSoundKit();
};

state.selectedRuleId = state.colorRules[0]?.id || null;
renderColorRules();
renderSoundKit();
syncControlLabels();
applyCameraFilter();
syncPadLockUi();
syncTriggerModeUi();
wireEvents();
populateCameras();

function wireEvents() {
  els.start.addEventListener("click", startDemo);
  for (const tab of els.panelTabs) {
    tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
  }
  els.cameraSelect.addEventListener("change", async () => {
    if (state.running) await restartCamera();
  });
  els.roiButton.addEventListener("click", () => {
    state.roiMode = !state.roiMode;
    els.roiButton.classList.toggle("is-active", state.roiMode);
  });
  els.clearRoi.addEventListener("click", () => {
    state.roiNorm = null;
    state.roiDraft = null;
    resetPadState();
  });
  els.lockPads.addEventListener("click", () => {
    setPadLock(!state.padsLocked);
  });
  els.triggerMode.addEventListener("change", () => {
    state.triggerMode = els.triggerMode.value === "touch" ? "touch" : "tap";
    saveTriggerMode();
    syncTriggerModeUi();
    tapDetector.reset();
    tapArbiter.reset();
  });

  for (const input of [els.sat, els.val, els.area]) {
    input.addEventListener("input", () => {
      syncControlLabels();
      if (input === els.sat || input === els.val) applyCameraFilter();
    });
  }
  for (const input of [
    els.tap,
    els.zWeight,
    els.cooldown,
    els.noiseFloor,
    els.smoothing,
    els.dwell,
    els.release,
  ]) {
    input.addEventListener("input", () => {
      syncControlLabels();
      tapDetector.setOptions(readTapOptions());
      tapArbiter.setOptions(readTapArbiterOptions());
      handStabilizer.setOptions(readHandStabilizerOptions());
    });
  }
  els.mirror.addEventListener("change", () => {
    els.stage.classList.toggle("is-mirrored", els.mirror.checked);
    handStabilizer.reset();
    tapDetector.reset();
    tapArbiter.reset();
  });
  els.resetColorRules.addEventListener("click", () => {
    state.colorRules = cloneDefaultColorRules();
    state.selectedRuleId = state.colorRules[0]?.id || null;
    saveColorRules();
    renderColorRules();
    setSamplingRule(null);
    resetPadState();
  });
  els.padList.addEventListener("click", handlePadListClick);
  els.padEditor.addEventListener("input", updateColorRuleFromControl);
  els.padEditor.addEventListener("click", handleColorRuleClick);
  els.soundList.addEventListener("click", handleSoundListClick);
  els.soundEditor.addEventListener("input", updateSoundControl);
  els.soundEditor.addEventListener("change", handleSoundFileChange);
  els.soundEditor.addEventListener("click", handleSoundClick);
  els.sampleLibraryInput.addEventListener("change", handleSampleLibraryChange);

  els.overlay.addEventListener("pointerdown", beginRoiDrag);
  els.overlay.addEventListener("pointermove", updateRoiDrag);
  els.overlay.addEventListener("pointerup", endRoiDrag);
  els.overlay.addEventListener("pointercancel", cancelRoiDrag);
}

async function startDemo() {
  setStatus("启动中");
  els.start.disabled = true;
  try {
    await drumEngine.start();
    refreshSampleStatuses();
    renderSoundKit();
    await loadHandLandmarker();
    await startCamera();
    state.running = true;
    setStatus("运行中");
    els.start.textContent = "运行中";
    requestAnimationFrame(loop);
  } catch (error) {
    console.error(error);
    setStatus("错误");
    els.start.disabled = false;
    els.start.textContent = "重试";
  }
}

async function loadHandLandmarker() {
  if (state.handLandmarker) return;
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
  );
  state.handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
    minHandDetectionConfidence: 0.45,
    minHandPresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
  });
}

async function populateCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((device) => device.kind === "videoinput");
  els.cameraSelect.innerHTML = "";
  cameras.forEach((camera, index) => {
    const option = document.createElement("option");
    option.value = camera.deviceId;
    option.textContent = camera.label || `Camera ${index + 1}`;
    els.cameraSelect.append(option);
  });
}

async function startCamera() {
  stopCamera();
  const deviceId = els.cameraSelect.value;
  state.stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 60 },
    },
  });
  els.video.srcObject = state.stream;
  await new Promise((resolve) => {
    els.video.onloadedmetadata = resolve;
  });
  await els.video.play();
  await populateCameras();
  resizeProcessCanvas();
  resizeOverlay();
}

async function restartCamera() {
  setStatus("切换摄像头");
  await startCamera();
  handStabilizer.reset();
  tapDetector.reset();
  tapArbiter.reset();
  resetPadState();
  setStatus("运行中");
}

function stopCamera() {
  if (!state.stream) return;
  state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
}

function loop(now) {
  if (!state.running) return;
  if (els.video.readyState >= 2 && els.video.videoWidth > 0) {
    state.lastFrameAt = now;
    resizeProcessCanvas();
    resizeOverlay();
    drawVideoToProcessCanvas();
    detectHands(now);
    scanPads(now);
    processTaps(now);
    drawOverlay(now);
    updateStats();
  }
  requestAnimationFrame(loop);
}

function resizeProcessCanvas() {
  const videoWidth = els.video.videoWidth || 1280;
  const videoHeight = els.video.videoHeight || 720;
  const targetWidth = 480;
  const targetHeight = Math.round((videoHeight / videoWidth) * targetWidth);
  if (els.process.width !== targetWidth || els.process.height !== targetHeight) {
    els.process.width = targetWidth;
    els.process.height = targetHeight;
    els.stage.style.aspectRatio = `${videoWidth} / ${videoHeight}`;
  }
}

function resizeOverlay() {
  const rect = els.stage.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (els.overlay.width !== width || els.overlay.height !== height) {
    els.overlay.width = width;
    els.overlay.height = height;
  }
}

function drawVideoToProcessCanvas() {
  processCtx.save();
  processCtx.clearRect(0, 0, els.process.width, els.process.height);
  processCtx.filter = cameraFilterFromControls(readCameraFilterControls()).cssFilter;
  if (els.mirror.checked) {
    processCtx.translate(els.process.width, 0);
    processCtx.scale(-1, 1);
  }
  processCtx.drawImage(els.video, 0, 0, els.process.width, els.process.height);
  processCtx.restore();
}

function scanPads(now) {
  if (now - state.lastPadScanAt < 80) return;
  state.lastPadScanAt = now;
  if (state.padsLocked) {
    state.pads = padTracker.update([], now, { locked: true });
    return;
  }

  const image = processCtx.getImageData(0, 0, els.process.width, els.process.height);
  const roi = normalizedRoiToPixels(state.roiNorm, els.process.width, els.process.height);
  const rawPads = detectColorPadsFromRgba(image.data, image.width, image.height, {
    minArea: Number(els.area.value),
    minSaturation: Number(els.sat.value),
    minValue: Number(els.val.value),
    maxPads: 10,
    roi,
    excludeRects: handExclusionRects(image.width, image.height),
    colorRules: state.colorRules,
  });
  state.pads = padTracker.update(rawPads, now);
}

function detectHands(now) {
  if (!state.handLandmarker) return;
  const result = state.handLandmarker.detectForVideo(els.video, now);
  const mirror = els.mirror.checked;
  state.handsRaw = (result.landmarks || []).map((landmarks) =>
    landmarks.map((point) => ({
      x: mirror ? 1 - point.x : point.x,
      y: point.y,
      z: point.z ?? 0,
    })),
  );
  state.handStates = handStabilizer.update(state.handsRaw, now, {
    width: els.overlay.width,
    height: els.overlay.height,
  });
  state.hands = state.handStates.map((hand) => hand.landmarks);
}

function processTaps(now) {
  for (const [handIndex, hand] of state.hands.entries()) {
    if (state.handStates[handIndex]?.held) continue;
    const anchor = handAnchor(hand);
    for (const [finger, index] of Object.entries(ACTIVE_FINGER_TIPS)) {
      const point = hand[index];
      const trackKey = `${handIndex}:${finger}`;
      const pixelPoint = normalizedPointToProcess(point);

      if (state.triggerMode === "touch") {
        const resolved = tapArbiter.resolveTouch(trackKey, pixelPoint, state.pads, now);
        if (resolved) triggerResolvedHit(resolved, 0.78, finger);
        continue;
      }

      tapArbiter.updateHover(trackKey, pixelPoint, state.pads, now);
      const tap = tapDetector.update(trackKey, point, now, { anchor });
      if (!tap) continue;

      const resolved = tapArbiter.resolveTap(
        {
          ...tap,
          x: tap.x * els.process.width,
          y: tap.y * els.process.height,
        },
        state.pads,
        now,
      );
      if (!resolved) continue;

      const velocity = Math.min(1, 0.45 + resolved.signal * 14);
      triggerResolvedHit(resolved, velocity, finger);
    }
  }
}

function triggerResolvedHit(resolved, velocity, finger) {
  if (drumEngine.trigger(resolved.pad.instrument, velocity)) {
    logHit(resolved.pad, finger, resolved.signal, resolved.timeMs, drumEngine.lastSource, resolved.mode);
  }
}

function handAnchor(hand) {
  const wrist = hand[0];
  const palm = hand[9] || wrist;
  return {
    x: (wrist.x + palm.x) / 2,
    y: (wrist.y + palm.y) / 2,
    z: ((wrist.z ?? 0) + (palm.z ?? 0)) / 2,
  };
}

function normalizedPointToProcess(point) {
  return {
    x: point.x * els.process.width,
    y: point.y * els.process.height,
  };
}

function handExclusionRects(width, height) {
  const padding = Math.max(8, Math.round(Math.min(width, height) * 0.035));
  return state.hands.map((hand) => {
    const xs = hand.map((point) => point.x * width);
    const ys = hand.map((point) => point.y * height);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const x = clamp(minX - padding, 0, width - 1);
    const y = clamp(minY - padding, 0, height - 1);
    const right = clamp(maxX + padding, x + 1, width);
    const bottom = clamp(maxY + padding, y + 1, height);
    return { x, y, width: right - x, height: bottom - y };
  });
}

function drawOverlay(now) {
  const ratio = window.devicePixelRatio || 1;
  const width = els.overlay.width;
  const height = els.overlay.height;
  const feedbackByPad = padFeedbackById(tapArbiter.getPadFeedback(state.pads, now));
  overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
  overlayCtx.clearRect(0, 0, width, height);
  overlayCtx.lineCap = "round";
  overlayCtx.lineJoin = "round";

  drawRoi(width, height);
  for (const pad of state.pads) drawPad(pad, width, height, feedbackByPad.get(pad.id));
  for (const [index, hand] of state.hands.entries()) drawHand(hand, width, height, state.handStates[index]);
  drawRecentHits(now, width, height, ratio);
  drawSamplingPreview(width, height);
}

function drawPad(pad, width, height, feedback = null) {
  const sx = width / els.process.width;
  const sy = height / els.process.height;
  const color = `rgb(${pad.color.r} ${pad.color.g} ${pad.color.b})`;
  const points = pad.outline;
  const stateBoost = feedback?.state === "hit" ? 0.2 : feedback ? 0.1 : 0;
  const alpha = 0.16 + stateBoost;

  overlayCtx.beginPath();
  points.forEach((point, index) => {
    const x = point.x * sx;
    const y = point.y * sy;
    if (index === 0) overlayCtx.moveTo(x, y);
    else overlayCtx.lineTo(x, y);
  });
  overlayCtx.closePath();
  overlayCtx.fillStyle = `rgba(${pad.color.r}, ${pad.color.g}, ${pad.color.b}, ${alpha})`;
  overlayCtx.strokeStyle = color;
  overlayCtx.lineWidth = feedback ? 5 : 3;
  overlayCtx.fill();
  overlayCtx.stroke();

  const cx = pad.centroid.x * sx;
  const cy = pad.centroid.y * sy;
  overlayCtx.fillStyle = "#f8f6f0";
  overlayCtx.font =
    '700 15px "Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
  overlayCtx.textAlign = "center";
  overlayCtx.textBaseline = "middle";
  overlayCtx.fillText(pad.label || pad.instrument, cx, cy);
  overlayCtx.beginPath();
  overlayCtx.arc(cx, cy + 18, 4, 0, Math.PI * 2);
  overlayCtx.fillStyle = color;
  overlayCtx.fill();

  if (feedback) {
    const radius = 18 + feedback.progress * 12;
    overlayCtx.beginPath();
    overlayCtx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * feedback.progress);
    overlayCtx.strokeStyle = feedback.state === "hit"
      ? "rgba(255, 255, 255, 0.95)"
      : "rgba(18, 31, 51, 0.72)";
    overlayCtx.lineWidth = 3;
    overlayCtx.stroke();
    overlayCtx.font = "700 10px ui-monospace, SFMono-Regular, Consolas, monospace";
    overlayCtx.fillStyle = "rgba(248, 246, 240, 0.96)";
    overlayCtx.fillText(feedback.state.toUpperCase(), cx, cy + 33);
  }
}

function drawHand(hand, width, height, handState = null) {
  const opacity = handState?.held ? 0.34 : 0.9;
  overlayCtx.strokeStyle = `rgba(135, 217, 255, ${opacity})`;
  overlayCtx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = hand[a];
    const pb = hand[b];
    overlayCtx.beginPath();
    overlayCtx.moveTo(pa.x * width, pa.y * height);
    overlayCtx.lineTo(pb.x * width, pb.y * height);
    overlayCtx.stroke();
  }

  for (const point of hand) {
    overlayCtx.beginPath();
    overlayCtx.arc(point.x * width, point.y * height, 2.4, 0, Math.PI * 2);
    overlayCtx.fillStyle = `rgba(232, 251, 255, ${opacity})`;
    overlayCtx.fill();
  }

  for (const index of Object.values(FINGER_TIPS)) {
    const point = hand[index];
    overlayCtx.beginPath();
    overlayCtx.arc(point.x * width, point.y * height, 7, 0, Math.PI * 2);
    overlayCtx.strokeStyle = `rgba(255, 255, 255, ${handState?.held ? 0.4 : 0.85})`;
    overlayCtx.lineWidth = 2;
    overlayCtx.stroke();
  }
}

function drawRoi(width, height) {
  const roi = state.roiDraft || state.roiNorm;
  if (!roi) return;
  overlayCtx.strokeStyle = state.roiMode ? "#ffcf4a" : "rgba(255, 207, 74, 0.65)";
  overlayCtx.fillStyle = "rgba(255, 207, 74, 0.06)";
  overlayCtx.lineWidth = 2;
  const x = roi.x * width;
  const y = roi.y * height;
  const w = roi.width * width;
  const h = roi.height * height;
  overlayCtx.fillRect(x, y, w, h);
  overlayCtx.strokeRect(x, y, w, h);
}

function drawRecentHits(now, width, height) {
  state.recentHits = state.recentHits.filter((hit) => now - hit.timeMs < 420);
  for (const hit of state.recentHits) {
    const t = (now - hit.timeMs) / 420;
    const radius = 16 + t * 32;
    overlayCtx.beginPath();
    overlayCtx.arc(hit.x * width, hit.y * height, radius, 0, Math.PI * 2);
    overlayCtx.strokeStyle = `rgba(255, 255, 255, ${1 - t})`;
    overlayCtx.lineWidth = 4 * (1 - t);
    overlayCtx.stroke();
  }
}

function drawSamplingPreview(width, height) {
  const preview = state.samplingPreview;
  if (!preview?.sample) return;
  const x = preview.point.x * width;
  const y = preview.point.y * height;
  const radius = Math.max(18, preview.sample.radius * (width / Math.max(1, els.process.width)));
  const { r, g, b } = preview.sample.rgb;

  overlayCtx.save();
  overlayCtx.lineWidth = 2;
  overlayCtx.setLineDash([7, 5]);
  overlayCtx.strokeStyle = `rgb(${r} ${g} ${b})`;
  overlayCtx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.18)`;
  overlayCtx.beginPath();
  overlayCtx.arc(x, y, radius, 0, Math.PI * 2);
  overlayCtx.fill();
  overlayCtx.stroke();
  overlayCtx.setLineDash([]);

  overlayCtx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  overlayCtx.lineWidth = 1.5;
  overlayCtx.beginPath();
  overlayCtx.moveTo(x - radius - 9, y);
  overlayCtx.lineTo(x - 6, y);
  overlayCtx.moveTo(x + 6, y);
  overlayCtx.lineTo(x + radius + 9, y);
  overlayCtx.moveTo(x, y - radius - 9);
  overlayCtx.lineTo(x, y - 6);
  overlayCtx.moveTo(x, y + 6);
  overlayCtx.lineTo(x, y + radius + 9);
  overlayCtx.stroke();

  const label = `H ${Math.round(preview.sample.hsv.h)} / S ${preview.sample.hsv.s.toFixed(2)} / V ${preview.sample.hsv.v.toFixed(2)}`;
  overlayCtx.font = '700 12px ui-monospace, SFMono-Regular, Consolas, monospace';
  const textWidth = overlayCtx.measureText(label).width;
  const boxX = clamp(x + radius + 10, 8, Math.max(8, width - textWidth - 26));
  const boxY = clamp(y - 18, 8, Math.max(8, height - 42));
  overlayCtx.fillStyle = "rgba(247, 250, 250, 0.92)";
  overlayCtx.strokeStyle = "rgba(37, 48, 68, 0.34)";
  overlayCtx.lineWidth = 1;
  overlayCtx.fillRect(boxX, boxY, textWidth + 18, 34);
  overlayCtx.strokeRect(boxX, boxY, textWidth + 18, 34);
  overlayCtx.fillStyle = "#253044";
  overlayCtx.fillText(label, boxX + 9, boxY + 21);
  overlayCtx.restore();
}

function beginRoiDrag(event) {
  if (state.samplingRuleId) {
    beginColorSampling(event);
    return;
  }
  if (!state.roiMode) return;
  els.overlay.setPointerCapture(event.pointerId);
  const point = eventToNorm(event);
  state.dragStart = point;
  state.roiDraft = { x: point.x, y: point.y, width: 0.001, height: 0.001 };
}

function updateRoiDrag(event) {
  if (state.samplingRuleId) {
    updateColorSamplingPreview(event);
    return;
  }
  if (!state.dragStart || !state.roiMode) return;
  const point = eventToNorm(event);
  state.roiDraft = rectFromPoints(state.dragStart, point);
}

function endRoiDrag(event) {
  if (state.samplingRuleId) {
    commitColorSample(event);
    return;
  }
  if (!state.dragStart || !state.roiMode) return;
  const point = eventToNorm(event);
  const roi = rectFromPoints(state.dragStart, point);
  if (roi.width > 0.04 && roi.height > 0.04) {
    state.roiNorm = roi;
  }
  state.roiDraft = null;
  state.dragStart = null;
}

function cancelRoiDrag() {
  if (state.samplingRuleId) {
    state.samplingPreview = null;
    updateSamplingStatus();
    return;
  }
  state.roiDraft = null;
  state.dragStart = null;
}

function eventToNorm(event) {
  const rect = els.overlay.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}

function rectFromPoints(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(0.001, Math.abs(a.x - b.x)),
    height: Math.max(0.001, Math.abs(a.y - b.y)),
  };
}

function normalizedRoiToPixels(roi, width, height) {
  if (!roi) return null;
  return {
    x: roi.x * width,
    y: roi.y * height,
    width: roi.width * width,
    height: roi.height * height,
  };
}

function logHit(pad, finger, signal, timeMs, source = "synth", mode = "tap") {
  state.recentHits.push({
    x: pad.centroid.x / els.process.width,
    y: pad.centroid.y / els.process.height,
    timeMs,
  });

  const entry = document.createElement("li");
  entry.innerHTML = `<span>${pad.label || pad.instrument}</span><b>${source} · ${mode} · ${FINGER_LABELS[finger] || finger}</b><em>${signal.toFixed(3)}</em>`;
  els.eventLog.prepend(entry);
  while (els.eventLog.children.length > 7) els.eventLog.lastElementChild.remove();
}

function updateStats() {
  els.padsCount.textContent = String(state.pads.length);
  els.handsCount.textContent = String(state.handStates.filter((hand) => !hand.held).length);
  els.signal.textContent = tapDetector.lastSignal.toFixed(3);
  const touchFeedback = tapArbiter.getPadFeedback(state.pads, state.lastFrameAt)
    .filter((item) => item.mode === "touch");
  const touchProgress = touchFeedback.reduce((value, item) => Math.max(value, item.progress), 0);
  const displaySignal = state.triggerMode === "touch" ? touchProgress : tapDetector.lastSignal;
  if (els.gestureSignal) {
    els.gestureSignal.textContent = state.triggerMode === "touch"
      ? touchProgress.toFixed(2)
      : tapDetector.lastSignal.toFixed(3);
  }
  if (els.gestureMeter) {
    const meterMax = Number(els.gestureMeter.max);
    els.gestureMeter.value = state.triggerMode === "touch"
      ? displaySignal * meterMax
      : Math.min(meterMax, displaySignal);
  }
  if (els.gestureReason) {
    const diag = state.triggerMode === "touch"
      ? tapArbiter.lastDiagnostics
      : tapDetector.lastDiagnostics;
    els.gestureReason.textContent = diag
      ? `${state.triggerMode} · ${diag.finger} · ${diag.state} · ${diag.reason}${typeof diag.threshold === "number" ? ` · threshold ${diag.threshold.toFixed(3)}` : ""}`
      : "idle";
  }
}

function syncControlLabels() {
  const cameraFilter = cameraFilterFromControls(readCameraFilterControls());
  els.satValue.textContent = `${Number(els.sat.value).toFixed(2)} / ${cameraFilter.saturation.toFixed(2)}x`;
  els.valValue.textContent = `${Number(els.val.value).toFixed(2)} / ${cameraFilter.brightness.toFixed(2)}x`;
  els.areaValue.textContent = els.area.value;
  els.tapValue.textContent = Number(els.tap.value).toFixed(3);
  els.zWeightValue.textContent = Number(els.zWeight.value).toFixed(1);
  els.cooldownValue.textContent = els.cooldown.value;
  els.noiseFloorValue.textContent = Number(els.noiseFloor.value).toFixed(3);
  els.smoothingValue.textContent = Number(els.smoothing.value).toFixed(2);
  els.dwellValue.textContent = els.dwell.value;
  els.releaseValue.textContent = Number(els.release.value).toFixed(3);
}

function applyCameraFilter() {
  els.stage.style.setProperty("--camera-filter", cameraFilterFromControls(readCameraFilterControls()).cssFilter);
}

function readCameraFilterControls() {
  return {
    saturationValue: Number(els.sat.value),
    valueValue: Number(els.val.value),
  };
}

function renderColorRules() {
  els.padList.innerHTML = "";
  for (const rule of state.colorRules) {
    const item = document.createElement("button");
    item.className = "pad-item";
    item.dataset.ruleId = rule.id;
    item.type = "button";
    item.classList.toggle("is-active", rule.id === state.selectedRuleId);
    item.classList.toggle("is-disabled", !rule.enabled);
    item.innerHTML = `
      <span class="swatch" style="background-color: ${colorRulePreviewCss(rule)}"></span>
      <span>
        <strong>${rule.label}</strong>
        <small>${rule.zhLabel || ""}</small>
      </span>
      <b>H ${Math.round(rule.hueCenter)} / S ${Number(rule.minSaturation).toFixed(2)} / V ${Number(rule.minValue).toFixed(2)}</b>
    `;
    els.padList.append(item);
  }
  renderPadEditor();
  updateSamplingStatus();
}

function renderPadEditor() {
  const rule = findRule(state.selectedRuleId) || state.colorRules[0];
  if (!rule) {
    els.padEditor.innerHTML = "";
    return;
  }
  state.selectedRuleId = rule.id;
  els.padEditor.dataset.ruleId = rule.id;
  els.padEditor.innerHTML = `
    <div class="editor-head">
      <div>
        <span class="swatch" style="background-color: ${colorRulePreviewCss(rule)}"></span>
        <strong>${rule.label}</strong>
        <small>${rule.zhLabel || ""}</small>
      </div>
      <label class="switch-line">
        <input data-rule-prop="enabled" type="checkbox" ${rule.enabled ? "checked" : ""} />
        <span>启用</span>
      </label>
    </div>
    <div class="color-panel">
      <div class="color-panel__head">
        <span>颜色面板</span>
        <button data-open-color-panel="${rule.id}" type="button">打开色板</button>
      </div>
      <input class="native-color-input" data-rule-color="${rule.id}" type="color" value="${ruleToHex(rule)}" aria-label="${rule.label} color picker" />
      <div class="color-presets" aria-label="常用颜色">
        ${COLOR_PANEL_PRESETS.map((color) => `
          <button data-rule-preset="${color}" type="button" style="--preset-color: ${color}" aria-label="选择 ${color}"></button>
        `).join("")}
      </div>
      <small>色板选择的是 RGB/Hex，系统会自动换算成 H / S / V 识别规则。</small>
    </div>
    <button class="sample-button wide-button" data-sample-rule="${rule.id}" type="button">${state.samplingRuleId === rule.id ? "正在取色，拖到物体亮色区域" : "从画面取色并实时预览"}</button>
    <div class="color-sample-preview" data-sampling-preview>
      <span class="color-sample-preview__swatch" style="background-color: ${colorRulePreviewCss(rule)}"></span>
      <div>
        <b>等待取色</b>
        <small>按住画面拖动，松开后应用到当前乐器</small>
      </div>
    </div>
    <label class="mini-range">
      <span>H</span>
      <input data-rule-prop="hueCenter" type="range" min="0" max="359" step="1" value="${rule.hueCenter}" />
      <b data-rule-value="hueCenter">${Math.round(rule.hueCenter)}</b>
    </label>
    <label class="mini-range">
      <span>宽</span>
      <input data-rule-prop="hueRange" type="range" min="4" max="90" step="1" value="${rule.hueRange}" />
      <b data-rule-value="hueRange">±${Math.round(rule.hueRange)}</b>
    </label>
    <label class="mini-range">
      <span>S</span>
      <input data-rule-prop="minSaturation" type="range" min="0.05" max="0.95" step="0.01" value="${rule.minSaturation}" />
      <b data-rule-value="minSaturation">${Number(rule.minSaturation).toFixed(2)}</b>
    </label>
    <label class="mini-range">
      <span>V</span>
      <input data-rule-prop="minValue" type="range" min="0.04" max="0.95" step="0.01" value="${rule.minValue}" />
      <b data-rule-value="minValue">${Number(rule.minValue).toFixed(2)}</b>
    </label>
  `;
}

function updateColorRuleFromControl(event) {
  const colorInput = event.target.closest("[data-rule-color]");
  if (colorInput) {
    applyColorPanelValue(colorInput.value);
    return;
  }

  const control = event.target.closest("[data-rule-prop]");
  if (!control) return;
  const rule = findRule(els.padEditor.dataset.ruleId);
  if (!rule) return;

  const prop = control.dataset.ruleProp;
  if (prop === "enabled") rule.enabled = control.checked;
  else rule[prop] = Number(control.value);

  syncRuleEditor(rule);
  renderPadListState();
  saveColorRules();
}

function handlePadListClick(event) {
  const item = event.target.closest("[data-rule-id]");
  if (!item) return;
  state.selectedRuleId = item.dataset.ruleId;
  renderColorRules();
}

function handleColorRuleClick(event) {
  const colorButton = event.target.closest("[data-open-color-panel]");
  if (colorButton) {
    els.padEditor.querySelector("[data-rule-color]")?.click();
    return;
  }

  const preset = event.target.closest("[data-rule-preset]");
  if (preset) {
    applyColorPanelValue(preset.dataset.rulePreset);
    return;
  }

  const sampleButton = event.target.closest("[data-sample-rule]");
  if (!sampleButton) return;
  setSamplingRule(sampleButton.dataset.sampleRule);
}

function applyColorPanelValue(hex) {
  const rule = findRule(els.padEditor.dataset.ruleId);
  if (!rule) return;
  Object.assign(rule, {
    enabled: true,
    ...colorRulePatchFromHex(hex),
  });
  syncRuleEditor(rule);
  renderPadListState();
  saveColorRules();
  resetPadState();
}

function beginColorSampling(event) {
  els.overlay.setPointerCapture?.(event.pointerId);
  updateColorSamplingPreview(event);
}

function updateColorSamplingPreview(event) {
  const rule = findRule(state.samplingRuleId);
  if (!rule) return;

  drawVideoToProcessCanvas();
  const point = eventToNorm(event);
  const x = Math.max(0, Math.min(els.process.width - 1, Math.floor(point.x * els.process.width)));
  const y = Math.max(0, Math.min(els.process.height - 1, Math.floor(point.y * els.process.height)));
  const frame = processCtx.getImageData(0, 0, els.process.width, els.process.height).data;
  const sample = sampleColorRuleFromRgba(frame, els.process.width, els.process.height, x, y, {
    instrument: rule.instrument,
    label: rule.label,
    radius: 10,
    hueRange: Math.max(rule.hueRange, 26),
  });

  state.samplingPreview = { point, sample, ruleId: rule.id };
  updateSamplingStatus();
  updateSamplingPreviewUi(rule, sample);
  drawOverlay(performance.now());
}

function commitColorSample(event) {
  updateColorSamplingPreview(event);
  const rule = findRule(state.samplingRuleId);
  const sample = state.samplingPreview?.sample;
  if (!rule || !sample) return;
  const sampled = sample.rule;
  Object.assign(rule, {
    enabled: true,
    hueCenter: sampled.hueCenter,
    hueRange: sampled.hueRange,
    minSaturation: sampled.minSaturation,
    minValue: sampled.minValue,
    maxValue: 1,
  });
  saveColorRules();
  renderColorRules();
  setSamplingRule(null);
  resetPadState();
}

function syncRuleEditor(rule) {
  const swatches = [
    ...els.padEditor.querySelectorAll(".swatch"),
    ...els.padList.querySelectorAll(`[data-rule-id="${rule.id}"] .swatch`),
  ];
  for (const swatch of swatches) swatch.style.backgroundColor = colorRulePreviewCss(rule);
  const hueCenter = els.padEditor.querySelector('[data-rule-value="hueCenter"]');
  const hueRange = els.padEditor.querySelector('[data-rule-value="hueRange"]');
  const minSaturation = els.padEditor.querySelector('[data-rule-value="minSaturation"]');
  const minValue = els.padEditor.querySelector('[data-rule-value="minValue"]');
  if (hueCenter) hueCenter.textContent = Math.round(rule.hueCenter);
  if (hueRange) hueRange.textContent = `±${Math.round(rule.hueRange)}`;
  if (minSaturation) minSaturation.textContent = Number(rule.minSaturation).toFixed(2);
  if (minValue) minValue.textContent = Number(rule.minValue).toFixed(2);
  const colorInput = els.padEditor.querySelector("[data-rule-color]");
  if (colorInput) colorInput.value = ruleToHex(rule);
}

function updateSamplingPreviewUi(rule, sample) {
  const preview = els.padEditor.querySelector("[data-sampling-preview]");
  if (!preview || !sample) return;
  const { r, g, b } = sample.rgb;
  const next = sample.rule;
  preview.innerHTML = `
    <span class="color-sample-preview__swatch" style="background-color: rgb(${r} ${g} ${b})"></span>
    <div>
      <b>H ${Math.round(sample.hsv.h)} / S ${sample.hsv.s.toFixed(2)} / V ${sample.hsv.v.toFixed(2)}</b>
      <small>${sample.count} px · rule: H ${Math.round(next.hueCenter)} ±${Math.round(next.hueRange)} · S ${next.minSaturation.toFixed(2)} · V ${next.minValue.toFixed(2)}</small>
    </div>
  `;
}

function renderPadListState() {
  for (const item of els.padList.querySelectorAll("[data-rule-id]")) {
    const rule = findRule(item.dataset.ruleId);
    item.classList.toggle("is-active", rule?.id === state.selectedRuleId);
    item.classList.toggle("is-disabled", !rule?.enabled);
    const value = item.querySelector("b");
    if (value && rule) value.textContent = `H ${Math.round(rule.hueCenter)} / S ${Number(rule.minSaturation).toFixed(2)} / V ${Number(rule.minValue).toFixed(2)}`;
  }
}

function setSamplingRule(ruleId) {
  state.samplingRuleId = state.samplingRuleId === ruleId ? null : ruleId;
  state.samplingPreview = null;
  els.stage.classList.toggle("is-sampling", !!state.samplingRuleId);
  for (const item of els.padList.querySelectorAll("[data-rule-id]")) {
    item.classList.toggle("is-sampling", item.dataset.ruleId === state.samplingRuleId);
  }
  els.padEditor.classList.toggle("is-sampling", els.padEditor.dataset.ruleId === state.samplingRuleId);
  renderPadEditor();
  updateSamplingStatus();
}

function updateSamplingStatus() {
  const rule = findRule(state.samplingRuleId);
  if (!rule) {
    els.samplingStatus.textContent = "采样：选择一个乐器后按取色，拖到画面中的物体亮色区域，松开应用";
    return;
  }
  const sample = state.samplingPreview?.sample;
  els.samplingStatus.textContent = sample
    ? `正在取色 ${rule.label}：H ${Math.round(sample.hsv.h)} / S ${sample.hsv.s.toFixed(2)} / V ${sample.hsv.v.toFixed(2)}，松开应用`
    : `正在取色 ${rule.label}：按住画面拖动到物体亮色区域，松开应用`;
}

function renderSoundKit() {
  els.soundList.innerHTML = "";
  for (const instrument of INSTRUMENTS) {
    const setting = state.drumKit[instrument.id];
    const item = document.createElement("button");
    item.className = "sound-item";
    item.dataset.instrument = instrument.id;
    item.type = "button";
    item.classList.toggle("is-active", instrument.id === state.selectedSoundInstrument);
    item.innerHTML = `
      <span class="swatch" style="background:${instrument.color}"></span>
      <span>
        <strong>${instrument.label}</strong>
        <small>${soundSourceLabel(instrument.id)}</small>
      </span>
      <b>${setting.volumeDb} dB</b>
    `;
    els.soundList.append(item);
  }
  renderSoundEditor();
}

function renderSoundEditor() {
  const instrument = instrumentMeta(state.selectedSoundInstrument);
  const setting = state.drumKit[instrument.id];
  els.soundEditor.dataset.instrument = instrument.id;
  els.soundEditor.innerHTML = `
    <div class="editor-head">
      <div>
        <span class="swatch" style="background:${instrument.color}"></span>
        <strong>${instrument.label}</strong>
        <small>${instrument.zhLabel}</small>
      </div>
      <button data-sound-preview="${instrument.id}" type="button">Preview</button>
    </div>
    <div class="sample-drop">
      <input id="sampleFile-${instrument.id}" data-sound-file="${instrument.id}" type="file" accept="audio/*" />
      <label for="sampleFile-${instrument.id}">上传到 ${instrument.label}</label>
      <button data-clear-sample="${instrument.id}" type="button">清除</button>
      <span data-sound-source-description>${soundSourceDescription(instrument.id)}</span>
    </div>
    ${renderSampleCandidates(instrument.id)}
    <label class="mini-range">
      <span>Vol</span>
      <input data-sound-prop="volumeDb" type="range" min="-24" max="6" step="1" value="${setting.volumeDb}" />
      <b data-sound-value="volumeDb">${setting.volumeDb} dB</b>
    </label>
    <label class="mini-range">
      <span>Pitch</span>
      <input data-sound-prop="pitch" type="range" min="-24" max="24" step="1" value="${setting.pitch}" />
      <b data-sound-value="pitch">${formatSigned(setting.pitch)}</b>
    </label>
    <label class="mini-range">
      <span>Decay</span>
      <input data-sound-prop="decay" type="range" min="0.05" max="2.5" step="0.01" value="${setting.decay}" />
      <b data-sound-value="decay">${Number(setting.decay).toFixed(2)}s</b>
    </label>
  `;
}

function handleSoundListClick(event) {
  const item = event.target.closest("[data-instrument]");
  if (!item) return;
  state.selectedSoundInstrument = item.dataset.instrument;
  renderSoundKit();
}

function updateSoundControl(event) {
  const control = event.target.closest("[data-sound-prop]");
  if (!control) return;
  const instrument = els.soundEditor.dataset.instrument;
  state.drumKit = normalizeDrumKitSettings({
    ...state.drumKit,
    [instrument]: {
      ...state.drumKit[instrument],
      [control.dataset.soundProp]: Number(control.value),
    },
  });
  drumEngine.setSettings(state.drumKit);
  saveDrumKitSettings();
  syncSoundEditor(instrument);
  renderSoundListState();
}

async function handleSoundFileChange(event) {
  const input = event.target.closest("[data-sound-file]");
  if (!input || !input.files?.[0]) return;
  const instrument = input.dataset.soundFile;
  await assignSampleToInstrument(instrument, input.files[0]);
}

async function handleSoundClick(event) {
  const libraryPreview = event.target.closest("[data-library-preview]");
  if (libraryPreview) {
    previewLibrarySample(libraryPreview.dataset.libraryPreview);
    return;
  }

  const libraryAssign = event.target.closest("[data-library-assign]");
  if (libraryAssign) {
    const sample = findLibrarySample(libraryAssign.dataset.libraryAssign);
    if (sample) await assignSampleToInstrument(els.soundEditor.dataset.instrument, sample.file);
    return;
  }

  const preview = event.target.closest("[data-sound-preview]");
  if (preview) {
    await drumEngine.start();
    refreshSampleStatuses();
    renderSoundKit();
    drumEngine.preview(preview.dataset.soundPreview);
    return;
  }

  const clear = event.target.closest("[data-clear-sample]");
  if (clear) {
    drumEngine.clearSample(clear.dataset.clearSample);
    delete state.sampleNames[clear.dataset.clearSample];
    delete state.sampleStatuses[clear.dataset.clearSample];
    renderSoundKit();
  }
}

function handleSampleLibraryChange(event) {
  state.sampleLibrary = createSampleLibrary(event.target.files || []);
  updateSampleLibraryStatus();
  renderSoundKit();
}

async function assignSampleToInstrument(instrument, file) {
  const sample = await drumEngine.loadSample(instrument, file);
  state.sampleNames[instrument] = sample?.name || "";
  state.sampleStatuses[instrument] = sample?.loaded ? "loaded" : "queued";
  renderSoundKit();
}

function renderSampleCandidates(instrument) {
  if (!state.sampleLibrary.length) {
    return `<div class="sample-candidates is-empty">导入音色文件夹后，这里会显示适合当前音色的候选 sample。</div>`;
  }

  const candidates = samplesForInstrument(state.sampleLibrary, instrument, 8);
  if (!candidates.length) {
    return `<div class="sample-candidates is-empty">音色库里暂时没有适合 ${instrumentMeta(instrument).label} 的候选。</div>`;
  }

  return `
    <div class="sample-candidates">
      <div class="sample-candidates__head">
        <span>Library matches</span>
        <b>${candidates.length}</b>
      </div>
      ${candidates.map((sample) => `
        <div class="sample-candidate">
          <span>
            <strong>${escapeHtml(sample.name)}</strong>
            <small>${sample.instrument === instrument ? "matched" : "uncategorized"}</small>
          </span>
          <button data-library-preview="${sample.id}" type="button">试听</button>
          <button data-library-assign="${sample.id}" type="button">Assign</button>
        </div>
      `).join("")}
    </div>
  `;
}

function updateSampleLibraryStatus() {
  const count = state.sampleLibrary.length;
  const matched = state.sampleLibrary.filter((sample) => sample.instrument !== "unknown").length;
  els.sampleLibraryStatus.textContent = count
    ? `已导入 ${count} 个音频，自动匹配 ${matched} 个；可在下方分配到 Kick / Snare / Clap 等音色。`
    : "未导入音色库；也可以在下方给单个音色上传 sample。";
}

function findLibrarySample(sampleId) {
  return state.sampleLibrary.find((sample) => sample.id === sampleId);
}

function previewLibrarySample(sampleId) {
  const sample = findLibrarySample(sampleId);
  if (!sample) return;
  if (state.previewAudio) {
    state.previewAudio.pause();
    state.previewAudio.removeAttribute("src");
  }
  const url = URL.createObjectURL(sample.file);
  const audio = new Audio(url);
  state.previewAudio = audio;
  audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
  audio.addEventListener("error", () => URL.revokeObjectURL(url), { once: true });
  audio.volume = 0.82;
  audio.play().catch(() => URL.revokeObjectURL(url));
}

function syncSoundEditor(instrument) {
  const setting = state.drumKit[instrument];
  const volume = els.soundEditor.querySelector('[data-sound-value="volumeDb"]');
  const pitch = els.soundEditor.querySelector('[data-sound-value="pitch"]');
  const decay = els.soundEditor.querySelector('[data-sound-value="decay"]');
  const sourceDescription = els.soundEditor.querySelector("[data-sound-source-description]");
  if (volume) volume.textContent = `${setting.volumeDb} dB`;
  if (pitch) pitch.textContent = formatSigned(setting.pitch);
  if (decay) decay.textContent = `${Number(setting.decay).toFixed(2)}s`;
  if (sourceDescription) sourceDescription.textContent = soundSourceDescription(instrument);
}

function soundSourceLabel(instrument) {
  const status = sampleStatus(instrument);
  if (status.source === "sample") return "Sample";
  if (status.source === "queued") return "Sample queued";
  return "Synth";
}

function soundSourceDescription(instrument) {
  const status = sampleStatus(instrument);
  if (status.source === "sample") return `Loaded sample: ${status.name}`;
  if (status.source === "queued") return `Sample queued: ${status.name}，启动音频后加载`;
  return "使用改良 Tone.js 合成音色";
}

function sampleStatus(instrument) {
  const engineStatus = drumEngine.sampleStatus(instrument);
  if (engineStatus.hasSample) return engineStatus;
  const name = state.sampleNames[instrument] || "";
  if (!name) return engineStatus;
  return {
    name,
    hasSample: true,
    loaded: state.sampleStatuses[instrument] === "loaded",
    source: state.sampleStatuses[instrument] === "loaded" ? "sample" : "queued",
  };
}

function refreshSampleStatuses() {
  for (const instrument of Object.keys(state.sampleNames)) {
    const status = drumEngine.sampleStatus(instrument);
    state.sampleStatuses[instrument] = status.loaded ? "loaded" : "queued";
  }
}

function renderSoundListState() {
  for (const item of els.soundList.querySelectorAll("[data-instrument]")) {
    const instrument = item.dataset.instrument;
    const setting = state.drumKit[instrument];
    item.classList.toggle("is-active", instrument === state.selectedSoundInstrument);
    const source = item.querySelector("small");
    const value = item.querySelector("b");
    if (source) source.textContent = soundSourceLabel(instrument);
    if (value) value.textContent = `${setting.volumeDb} dB`;
  }
}

function syncSoundSlotUi(instrument) {
  renderSoundListState();
  if (els.soundEditor.dataset.instrument === instrument) {
    syncSoundEditor(instrument);
  }
}

function findRule(ruleId) {
  return state.colorRules.find((rule) => rule.id === ruleId);
}

function loadColorRules() {
  try {
    const raw = localStorage.getItem(COLOR_RULES_STORAGE_KEY);
    if (!raw) return cloneDefaultColorRules();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return cloneDefaultColorRules();
    const defaultsById = new Map(DEFAULT_COLOR_RULES.map((rule) => [rule.id, rule]));
    return DEFAULT_COLOR_RULES.map((defaultRule) => ({
      ...defaultRule,
      ...(parsed.find((rule) => rule.id === defaultRule.id) || {}),
      id: defaultRule.id,
      instrument: defaultRule.instrument,
      label: defaultRule.label,
      zhLabel: defaultRule.zhLabel,
    })).filter((rule) => defaultsById.has(rule.id));
  } catch {
    return cloneDefaultColorRules();
  }
}

function saveColorRules() {
  localStorage.setItem(COLOR_RULES_STORAGE_KEY, JSON.stringify(state.colorRules));
}

function cloneDefaultColorRules() {
  return DEFAULT_COLOR_RULES.map((rule) => ({ ...rule }));
}

function loadDrumKitSettings() {
  try {
    const raw = localStorage.getItem(DRUM_KIT_STORAGE_KEY);
    return normalizeDrumKitSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeDrumKitSettings();
  }
}

function saveDrumKitSettings() {
  localStorage.setItem(DRUM_KIT_STORAGE_KEY, JSON.stringify(serializeDrumKitSettings(state.drumKit)));
}

function setActiveTab(tabName) {
  document.body.dataset.activeTab = tabName;
  for (const tab of els.panelTabs) {
    tab.classList.toggle("is-active", tab.dataset.tab === tabName);
  }
  for (const page of els.panelPages) {
    page.classList.toggle("is-active", page.dataset.panelPage === tabName);
  }
}

function readTapOptions() {
  return {
    triggerSpeed: Number(els.tap.value),
    zWeight: Number(els.zWeight.value),
    cooldownMs: Number(els.cooldown.value),
    noiseFloor: Number(els.noiseFloor.value),
    smoothing: Number(els.smoothing.value),
    dwellMs: Number(els.dwell.value),
    releaseSpeed: Number(els.release.value),
    noiseMultiplier: 1.4,
    screenWeight: 0.12,
    downwardYWeight: 0.2,
  };
}

function readTapArbiterOptions() {
  return {
    targetPadding: state.triggerMode === "touch" ? 14 : 8,
    lockTtlMs: 230,
    globalCooldownMs: Math.max(55, Number(els.cooldown.value) * 0.55),
    touchDwellMs: Number(els.dwell.value),
  };
}

function readHandStabilizerOptions() {
  const smoothing = Number(els.smoothing.value);
  return {
    smoothing: clamp(smoothing * 0.78, 0.16, 0.58),
    anchorSmoothing: clamp(smoothing * 0.46, 0.1, 0.32),
    deadZonePx: 3,
    relativeDeadZonePx: 2.2,
    holdTtlMs: 140,
  };
}

function padFeedbackById(feedback) {
  const byId = new Map();
  for (const item of feedback) {
    const current = byId.get(item.pad.id);
    if (!current || feedbackRank(item) > feedbackRank(current)) {
      byId.set(item.pad.id, item);
    }
  }
  return byId;
}

function feedbackRank(item) {
  if (item.state === "hit") return 4;
  if (item.state === "locked") return 3;
  if (item.state === "hover") return 2;
  if (item.state === "held") return 1;
  return 0;
}

function loadTriggerMode() {
  try {
    return localStorage.getItem(TRIGGER_MODE_STORAGE_KEY) === "tap" ? "tap" : "touch";
  } catch {
    return "touch";
  }
}

function saveTriggerMode() {
  localStorage.setItem(TRIGGER_MODE_STORAGE_KEY, state.triggerMode);
}

function syncTriggerModeUi() {
  els.triggerMode.value = state.triggerMode;
  document.body.dataset.triggerMode = state.triggerMode;
  tapArbiter.setOptions(readTapArbiterOptions());
}

function setPadLock(locked) {
  state.padsLocked = locked;
  syncPadLockUi();
}

function syncPadLockUi() {
  document.body.dataset.padMode = state.padsLocked ? "play" : "setup";
  els.lockPads.textContent = state.padsLocked ? "返回调整模式" : "进入演奏模式";
  els.lockStatus.textContent = state.padsLocked
    ? "演奏模式：锁定已确认物件区域，减少区域抖动。"
    : "调整模式：持续识别并校准物件区域。";
}

function resetPadState() {
  padTracker.reset();
  tapArbiter.reset();
  state.pads = [];
  if (state.padsLocked) setPadLock(false);
}

function setStatus(value) {
  els.status.textContent = value;
  document.body.dataset.status = value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatSigned(value) {
  const number = Number(value);
  return number > 0 ? `+${number}` : String(number);
}

function ruleToHex(rule = {}) {
  const hue = (((Number(rule.hueCenter) || 0) % 360) + 360) % 360;
  const saturation = clamp(Number(rule.minSaturation || 0.5) + 0.16, 0.08, 1);
  const lightness = clamp(Number(rule.minValue || 0.55) + 0.06, 0.16, 0.74);
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const [rn, gn, bn] =
    hue < 60 ? [chroma, x, 0] :
    hue < 120 ? [x, chroma, 0] :
    hue < 180 ? [0, chroma, x] :
    hue < 240 ? [0, x, chroma] :
    hue < 300 ? [x, 0, chroma] :
    [chroma, 0, x];
  return normalizeHexColor(`#${toHexByte(rn + m)}${toHexByte(gn + m)}${toHexByte(bn + m)}`);
}

function toHexByte(value) {
  return Math.round(clamp(value, 0, 1) * 255).toString(16).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
