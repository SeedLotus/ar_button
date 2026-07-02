import * as Tone from "https://esm.sh/tone@14.9.17";
import { normalizeDrumKitSettings } from "./drumKitConfig.js";
import { nextPadChordNotes } from "./padProgression.js";

const DEFAULT_PAD_PROGRESSION = ["Cmaj7", "Am7", "Fmaj7", "G6"];

export class DrumEngine {
  constructor(settings = {}) {
    this.ready = false;
    this.lastTriggerAt = new Map();
    this.settings = normalizeDrumKitSettings(settings);
    this.samplePlayers = new Map();
    this.sampleUrls = new Map();
    this.sampleNames = new Map();
    this.onSampleStatusChange = null;
    this.padStep = 0;
    this.lastSource = "synth";
  }

  async start() {
    if (this.ready) return;
    await Tone.start();

    this.limiter = new Tone.Limiter(-1).toDestination();
    this.bus = new Tone.Gain(0.82).connect(this.limiter);
    this.parallel = new Tone.Gain(0.22).connect(this.limiter);
    this.reverb = new Tone.Reverb({ decay: 1.15, wet: 0.12 }).connect(this.parallel);
    this.softClip = new Tone.Distortion({ distortion: 0.12, wet: 0.18 }).connect(this.bus);

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.055,
      octaves: 8,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.42, sustain: 0.01, release: 0.08 },
    }).connect(this.softClip);
    this.kickClick = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.012, sustain: 0, release: 0.01 },
    }).connect(new Tone.Filter(5200, "highpass").connect(this.bus));

    this.snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 },
    }).connect(new Tone.Filter(1700, "highpass").connect(this.reverb));
    this.snareBody = new Tone.MembraneSynth({
      pitchDecay: 0.018,
      octaves: 3,
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.11, sustain: 0, release: 0.05 },
    }).connect(this.bus);

    this.hihat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.055, sustain: 0, release: 0.018 },
    }).connect(new Tone.Filter(7800, "highpass").connect(this.bus));

    this.tom = new Tone.MembraneSynth({
      pitchDecay: 0.034,
      octaves: 5,
      oscillator: { type: "triangle" },
      envelope: { attack: 0.002, decay: 0.26, sustain: 0.02, release: 0.11 },
    }).connect(this.bus);

    this.clap = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0.01, release: 0.18 },
    }).connect(this.reverb);

    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.18, decay: 0.35, sustain: 0.72, release: 1.4 },
    }).connect(new Tone.Filter(1400, "lowpass").connect(this.reverb));

    this.ready = true;
    await Promise.all(
      Array.from(this.sampleUrls.entries()).map(([instrument, url]) =>
        this.createSamplePlayer(instrument, url),
      ),
    );
  }

  setSettings(settings = {}) {
    this.settings = normalizeDrumKitSettings({
      ...this.settings,
      ...settings,
    });
    for (const [instrument, player] of this.samplePlayers.entries()) {
      const setting = this.settings[instrument];
      if (setting) player.volume.value = setting.volumeDb;
    }
  }

  async loadSample(instrument, file) {
    if (!file) return null;
    this.clearSample(instrument);
    const url = URL.createObjectURL(file);
    this.sampleUrls.set(instrument, url);
    this.sampleNames.set(instrument, file.name);

    let loaded = false;
    if (this.ready) {
      await this.createSamplePlayer(instrument, url);
      loaded = true;
    } else {
      this.notifySampleStatusChange(instrument);
    }
    return { name: file.name, url, loaded };
  }

  clearSample(instrument) {
    const player = this.samplePlayers.get(instrument);
    if (player) {
      player.dispose();
      this.samplePlayers.delete(instrument);
    }
    const url = this.sampleUrls.get(instrument);
    if (url) URL.revokeObjectURL(url);
    this.sampleUrls.delete(instrument);
    this.sampleNames.delete(instrument);
    this.notifySampleStatusChange(instrument);
  }

  sampleStatus(instrument) {
    const name = this.sampleNames.get(instrument) || "";
    const player = this.samplePlayers.get(instrument);
    return {
      name,
      hasSample: !!name,
      loaded: !!player?.loaded,
      source: name ? (player?.loaded ? "sample" : "queued") : "synth",
    };
  }

  notifySampleStatusChange(instrument) {
    if (typeof this.onSampleStatusChange === "function") {
      this.onSampleStatusChange(instrument, this.sampleStatus(instrument));
    }
  }

  async createSamplePlayer(instrument, url) {
    const setting = this.settings[instrument];
    const player = new Tone.Player({
      url,
      fadeOut: 0.012,
      onload: () => this.notifySampleStatusChange(instrument),
    }).connect(this.bus);
    player.volume.value = setting?.volumeDb ?? 0;
    this.samplePlayers.set(instrument, player);
    await waitForLoaded(player, 2500);
    this.notifySampleStatusChange(instrument);
    return player;
  }

  trigger(instrument, velocity = 0.85, options = {}) {
    if (!this.ready) return false;

    const now = performance.now();
    const lastAt = this.lastTriggerAt.get(instrument) ?? -Infinity;
    if (!options.force && now - lastAt < 35) return false;
    this.lastTriggerAt.set(instrument, now);

    const v = Math.max(0.25, Math.min(1, velocity));
    const setting = this.settings[instrument] || {};
    const samplePlayer = this.samplePlayers.get(instrument);
    if (samplePlayer?.loaded) {
      this.lastSource = "sample";
      samplePlayer.stop();
      samplePlayer.playbackRate = semitonesToRate(setting.pitch || 0);
      samplePlayer.volume.value = (setting.volumeDb || 0) + velocityToDb(v);
      samplePlayer.start(undefined, 0, setting.decay || 0.7);
      return true;
    }

    const semitoneOffset = setting.pitch || 0;
    this.lastSource = "synth";
    if (instrument === "kick") {
      this.kick.triggerAttackRelease(noteWithOffset("C1", semitoneOffset), "8n", undefined, v);
      this.kickClick.triggerAttackRelease("64n", undefined, v * 0.32);
    } else if (instrument === "snare") {
      this.snare.triggerAttackRelease(setting.decay || 0.42, undefined, v);
      this.snareBody.triggerAttackRelease(noteWithOffset("D2", semitoneOffset), "16n", undefined, v * 0.35);
    } else if (instrument === "hihat") {
      this.hihat.triggerAttackRelease(setting.decay || 0.16, undefined, v * 0.72);
    } else if (instrument === "pad") {
      const notes = nextPadChordNotes(
        { kind: "pad", progression: DEFAULT_PAD_PROGRESSION },
        this.padStep++,
        "C3",
      ).map((note) => noteWithOffset(note, semitoneOffset));
      this.pad.volume.value = setting.volumeDb || -7;
      this.pad.triggerAttackRelease(notes, setting.decay || 1.8, undefined, v * 0.46);
    } else if (instrument === "clap") {
      this.clap.triggerAttackRelease(setting.decay || 0.48, undefined, v);
    } else {
      this.tom.triggerAttackRelease(noteWithOffset("G1", semitoneOffset), "16n", undefined, v);
    }
    return true;
  }

  preview(instrument) {
    return this.trigger(instrument, 0.9, { force: true });
  }

  stop() {
    this.ready = false;
    try {
      // Dispose sample players
      for (const player of this.samplePlayers.values()) {
        try { player.dispose(); } catch {}
      }
      this.samplePlayers.clear();
      // Dispose audio nodes
      [
        this.limiter, this.bus, this.parallel, this.reverb, this.softClip,
        this.kick, this.kickClick, this.snare, this.snareBody,
        this.hihat, this.pad, this.clap, this.tom,
      ].forEach((node) => {
        if (node) { try { node.dispose(); } catch {} }
      });
      this.limiter = this.bus = this.parallel = this.reverb = this.softClip = null;
      this.kick = this.kickClick = this.snare = this.snareBody = null;
      this.hihat = this.pad = this.clap = this.tom = null;
      // Suspend Tone.js audio context
      try { Tone.getContext().rawContext?.suspend(); } catch {}
    } catch {
      // Ignore disposal errors
    }
  }
}

function waitForLoaded(player, timeoutMs) {
  if (player.loaded) return Promise.resolve(true);
  return Promise.race([
    Tone.loaded().then(() => player.loaded).catch(() => false),
    new Promise((resolve) => setTimeout(() => resolve(player.loaded), timeoutMs)),
  ]);
}

function semitonesToRate(semitones) {
  return 2 ** (semitones / 12);
}

function velocityToDb(velocity) {
  return -18 + velocity * 18;
}

function noteWithOffset(note, semitones) {
  return Tone.Frequency(note).transpose(semitones).toNote();
}
