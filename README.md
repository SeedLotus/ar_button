# Object Drum Studio

Object Drum Studio turns everyday objects or colored blobs into playable drum zones. It runs in the browser with a webcam, MediaPipe hand tracking, color/object region tracking, Tone.js synthesis, and optional local sample uploads.

Live demo: https://electro-dig.github.io/object-drum-studio-public/

## What This Public Version Includes

- Webcam-based object/color region detection
- MediaPipe hand tracking
- Tap and touch trigger modes
- Stabilized pad tracking and gesture gates
- Built-in Tone.js drum sounds
- Local sample folder import and per-instrument sample assignment
- Pure browser runtime with no account or server setup

## Privacy

This public version is intentionally local-first:

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

1. Click `启动` and allow camera access.
2. Use `Setup` to select a camera, mirror the view if needed, and optionally limit the region of interest.
3. Use `Objects` to tune the color rules for Kick, Snare, Clap, Tom, Pad, and Hi-hat.
4. Use `Gesture` to tune the tap threshold, noise floor, smoothing, dwell, release, and cooldown.
5. Use `Sound` to preview built-in sounds or import a local sample folder.
6. Enter performance mode when the detected zones are stable.

## Tech Stack

- MediaPipe Tasks Vision HandLandmarker
- Tone.js
- Canvas 2D
- HSV color segmentation
- Connected-component region extraction
- Region tracking with smoothing and missing-frame tolerance
- Browser `localStorage` for local color and sound settings

## Development Notes

The original research prototype explored remote sound generation. This repository removes that private/experimental layer so the public demo is safer to share, easier to remix, and suitable for community testing.
