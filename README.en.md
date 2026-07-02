# Object Drum Studio

[中文](./README.md) | **English**

> This project is built on top of [object-drum-studio-public](https://github.com/Electro-Dig/object-drum-studio-public), an open-source browser demo for turning everyday objects into playable drum zones.

Object Drum Studio turns everyday objects, stickers, toys, stationery, or colored blobs into playable drum zones. Point a webcam at your desk, tune the object colors, then trigger Kick / Snare / Clap / Tom / Pad / Hi-hat with finger touches or taps. It also supports a "Virtual Pads" mode that does not rely on physical objects — place virtual pads directly on the camera feed and play them.

Live demo: <https://electro-dig.github.io/object-drum-studio-public/>

## What This Public Version Includes

- Realtime webcam input and preview with device selection, mirroring, and hot-plug auto-refresh
- MediaPipe hand tracking with skeleton and fingertip trigger indicators
- Two detection modes:
  - **Physical objects**: HSV color segmentation of real objects or colored blobs
  - **Virtual pads**: Place virtual pads on the feed, no physical color needed
- ROI selection to limit the performance area and reduce false positives
- Performance mode to lock confirmed object regions and reduce boundary jitter
- Object color rules: H / S / V thresholds, camera sampling, RGB/Hex color picker, color presets
- Virtual pads: automatic or manual desk-area detection, drag-and-drop placement, drag to move, right-click to delete
- Touch and Tap trigger modes, with Touch as the default
- Gesture Gate: tap threshold, noise floor, smoothing, dwell, release, Z weight, cooldown
- Built-in Tone.js drum kit (Kick / Snare / Hi-hat / Clap / Tom) and Pad chord sounds
- Local sample folder import and per-instrument sample assignment with preview, pitch / volume / decay controls
- Developer log panel: DEBUG / INFO / WARN / ERROR filtering, JSON export, trigger event replay
- Pure browser runtime with no account, backend, or cloud server setup
- Optional Electron desktop wrapper that launches with a double click

## Privacy

This public version is local-first:

- Camera frames stay in the browser.
- Uploaded samples stay in the browser session.
- Settings and virtual pad positions are stored in browser `localStorage`; nothing is uploaded.
- No private cloud sound service is included.
- No experimental remote sound-generation module is included.
- No account, secret, or private server configuration is required.

## Run Locally

### Browser

```powershell
git clone https://github.com/SeedLotus/ar_button.git
cd ar_button
npm.cmd test
npm.cmd run dev
```

Then open `http://localhost:5178`.

### Electron Desktop

```powershell
npm.cmd start
```

There is no build step; GitHub Pages serves the static files directly from the repository root. The Electron entry `main.cjs` starts a local HTTP server and opens a window.

## Basic Workflow

1. Start with the `Guide` panel for the recommended flow.
2. Click `Start` and allow camera access.
3. Use `Setup` to select a camera, mirror the view if needed, and limit the performance area.
4. Choose a detection mode:
   - **Physical objects**: Use `Objects` to sample colors for Kick / Snare / Clap, or open the color picker for manual RGB/Hex tuning.
   - **Virtual pads**: Use `Virtual` to detect or draw the desk area, then drag pads from the palette onto the feed.
5. Use `Gesture` to tune dwell, noise floor, cooldown, and other gates.
6. Use `Sound` to preview built-in sounds or import a local sample folder.

## Tech Stack

- MediaPipe Tasks Vision HandLandmarker
- Tone.js
- Canvas 2D
- HSV color segmentation
- Connected-component region extraction
- Region tracking with smoothing and missing-frame tolerance
- Browser `localStorage` for local color, sound, and virtual pad settings
- Electron (optional desktop wrapper)

## Development Notes

The internal research prototype explored remote sound generation. This repository removes that private/experimental layer so the public demo is safer to share, easier to remix, and suitable for community testing.
