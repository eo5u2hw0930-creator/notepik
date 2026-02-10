import type { InstrumentType, Note } from '../types';

type ActiveVoice = {
  oscillators: OscillatorNode[];
  gain: GainNode;
  noteId: string;
};

export class SynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private trackGains: Map<string, GainNode> = new Map();
  private activeVoices: Map<string, ActiveVoice> = new Map();
  private scheduledEvents: number[] = [];

  async init(): Promise<void> {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  ensureTrackGain(trackId: string, volume: number, pan: number): GainNode {
    if (!this.ctx || !this.masterGain) throw new Error('Audio not initialized');

    let gain = this.trackGains.get(trackId);
    if (!gain) {
      gain = this.ctx.createGain();
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(this.masterGain);
      this.trackGains.set(trackId, gain);
    }
    gain.gain.value = volume;
    return gain;
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private createVoice(
    instrument: InstrumentType,
    freq: number,
    velocity: number,
    destination: GainNode,
  ): ActiveVoice {
    if (!this.ctx) throw new Error('Audio not initialized');

    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(destination);

    const normalizedVel = velocity / 127;
    const oscillators: OscillatorNode[] = [];

    switch (instrument) {
      case 'synth-lead': {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start();
        oscillators.push(osc);
        // attack
        gain.gain.setTargetAtTime(normalizedVel * 0.3, this.ctx.currentTime, 0.01);
        break;
      }
      case 'synth-pad': {
        const osc1 = this.ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = freq;
        osc1.connect(gain);
        osc1.start();
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'triangle';
        osc2.frequency.value = freq * 1.002; // slight detune
        osc2.connect(gain);
        osc2.start();
        oscillators.push(osc1, osc2);
        gain.gain.setTargetAtTime(normalizedVel * 0.2, this.ctx.currentTime, 0.08);
        break;
      }
      case 'synth-bass': {
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start();
        oscillators.push(osc);
        gain.gain.setTargetAtTime(normalizedVel * 0.4, this.ctx.currentTime, 0.005);
        break;
      }
      case 'synth-pluck': {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start();
        oscillators.push(osc);
        gain.gain.setTargetAtTime(normalizedVel * 0.35, this.ctx.currentTime, 0.002);
        gain.gain.setTargetAtTime(0, this.ctx.currentTime + 0.05, 0.15);
        break;
      }
      case 'drums': {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.frequency.setTargetAtTime(freq * 0.5, this.ctx.currentTime, 0.05);
        osc.connect(gain);
        osc.start();
        oscillators.push(osc);
        gain.gain.setTargetAtTime(normalizedVel * 0.5, this.ctx.currentTime, 0.001);
        gain.gain.setTargetAtTime(0, this.ctx.currentTime + 0.01, 0.08);
        break;
      }
    }

    return { oscillators, gain, noteId: '' };
  }

  playNote(
    trackId: string,
    instrument: InstrumentType,
    note: number,
    velocity: number,
    volume: number,
    pan: number,
  ): string {
    const destination = this.ensureTrackGain(trackId, volume, pan);
    const freq = this.midiToFreq(note);
    const voice = this.createVoice(instrument, freq, velocity, destination);
    const voiceKey = `${trackId}-${note}-${Date.now()}`;
    voice.noteId = voiceKey;
    this.activeVoices.set(voiceKey, voice);
    return voiceKey;
  }

  stopNote(voiceKey: string): void {
    const voice = this.activeVoices.get(voiceKey);
    if (!voice || !this.ctx) return;

    voice.gain.gain.cancelScheduledValues(this.ctx.currentTime);
    voice.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);

    setTimeout(() => {
      voice.oscillators.forEach((o) => {
        try { o.stop(); } catch { /* already stopped */ }
      });
      voice.gain.disconnect();
      this.activeVoices.delete(voiceKey);
    }, 100);
  }

  stopAll(): void {
    this.activeVoices.forEach((_, key) => this.stopNote(key));
    this.scheduledEvents.forEach((id) => clearTimeout(id));
    this.scheduledEvents = [];
  }

  // Schedule notes for playback: returns cleanup function
  scheduleNotes(
    trackId: string,
    instrument: InstrumentType,
    notes: Note[],
    bpm: number,
    ticksPerBeat: number,
    startTick: number,
    volume: number,
    pan: number,
  ): () => void {
    const tickDuration = 60 / (bpm * ticksPerBeat); // seconds per tick
    const voiceKeys: string[] = [];

    for (const note of notes) {
      if (note.startTick + note.duration <= startTick) continue;

      const delayTicks = Math.max(0, note.startTick - startTick);
      const delaySec = delayTicks * tickDuration;
      const durationSec = note.duration * tickDuration;

      const startTimeout = window.setTimeout(() => {
        const key = this.playNote(trackId, instrument, note.pitch, note.velocity, volume, pan);
        voiceKeys.push(key);

        const stopTimeout = window.setTimeout(() => {
          this.stopNote(key);
        }, durationSec * 1000);
        this.scheduledEvents.push(stopTimeout);
      }, delaySec * 1000);

      this.scheduledEvents.push(startTimeout);
    }

    return () => {
      voiceKeys.forEach((k) => this.stopNote(k));
    };
  }

  // Preview a single note (for piano roll clicking)
  previewNote(
    instrument: InstrumentType,
    note: number,
    velocity: number = 100,
    durationMs: number = 200,
  ): void {
    const destination = this.ensureTrackGain('preview', 0.8, 0);
    const freq = this.midiToFreq(note);
    const voice = this.createVoice(instrument, freq, velocity, destination);
    const key = `preview-${note}-${Date.now()}`;
    this.activeVoices.set(key, voice);

    setTimeout(() => this.stopNote(key), durationMs);
  }

  dispose(): void {
    this.stopAll();
    this.trackGains.forEach((g) => g.disconnect());
    this.trackGains.clear();
    this.masterGain?.disconnect();
    this.ctx?.close();
    this.ctx = null;
  }
}

// Singleton
export const synthEngine = new SynthEngine();
