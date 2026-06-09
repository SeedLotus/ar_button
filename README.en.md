# Object Drum Studio

[中文](./README.md) | **English**

Object Drum Studio turns everyday objects, stickers, toys, stationery, or colored blobs into playable drum zones. Point a webcam at your desk, tune the object colors, then trigger Kick / Snare / Clap / Tom / Pad / Hi-hat with finger touches or taps.

Live demo: <https://electro-dig.github.io/object-drum-studio-public/>

## What This Public Version Includes

- Realtime webcam input and preview
- MediaPipe hand tracking
- Touch and Tap trigger modes, with Touch as the default
- Object/color region detection with stabilized tracking
- H / S / V object rules, camera sampling, and an RGB/Hex color picker
- Built-in Tone.js drum and Pad sounds
- Local sample folder import and per-instrument sample assignment
- Pure browser runtime with no account, backend, or cloud server setup

## Privacy

This public version is local-first:

- Camera frames stay in the browser.
- Uploaded samples stay in the browser session.
- No private cloud sound service is included.
- No experimental remote sound-generation module is included.
- No account, secret, or private server configuration is required.

## Run Locally

```powershell
git clone https://github.com/Electro-Dig/object-drum-studio-public.git
cd object-drum-studio-public
npm.cmd test
npm.cmd start
```

Then open `http://localhost:5178`.

There is no build step; GitHub Pages serves the static files directly from the repository root.

## Basic Workflow

1. Start with the `指南` panel for the recommended flow.
2. Click `启动` and allow camera access.
3. Use `设置` to select a camera, mirror the view if needed, and limit the performance area.
4. Use `物件` to sample colors for Kick / Snare / Clap, or open the color picker for manual RGB/Hex tuning.
5. Use `Gesture` to tune dwell, noise floor, cooldown, and other gates.
6. Use `Sound` to preview built-in sounds or import a local sample folder.

## Tech Stack

- MediaPipe Tasks Vision HandLandmarker
- Tone.js
- Canvas 2D
- HSV color segmentation
- Connected-component region extraction
- Region tracking with smoothing and missing-frame tolerance
- Browser `localStorage` for local color and sound settings

## Development Notes

The internal research prototype explored remote sound generation. This repository removes that private/experimental layer so the public demo is safer to share, easier to remix, and suitable for community testing.
