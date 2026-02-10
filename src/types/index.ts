export type NoteValue = number; // MIDI note number 0-127

export interface Note {
  id: string;
  pitch: NoteValue;       // MIDI note 0-127
  startTick: number;      // start position in ticks
  duration: number;       // duration in ticks
  velocity: number;       // 0-127
}

export type InstrumentType =
  | 'synth-lead'
  | 'synth-pad'
  | 'synth-bass'
  | 'synth-pluck'
  | 'drums';

export interface Track {
  id: string;
  name: string;
  instrument: InstrumentType;
  notes: Note[];
  volume: number;         // 0-1
  pan: number;            // -1 to 1
  mute: boolean;
  solo: boolean;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  timeSignature: [number, number]; // [beats, subdivision]
  tracks: Track[];
  ticksPerBeat: number;
}

export type Tool = 'select' | 'draw' | 'erase';

export interface PlaybackState {
  isPlaying: boolean;
  currentTick: number;
  loopStart: number | null;
  loopEnd: number | null;
  isLooping: boolean;
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const TRACK_COLORS = [
  '#4f8cff', '#ff6b6b', '#51cf66', '#fcc419',
  '#cc5de8', '#ff922b', '#20c997', '#f06595',
  '#748ffc', '#69db7c', '#ffa94d', '#da77f2',
];

export function noteToName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  const name = NOTE_NAMES[note % 12];
  return `${name}${octave}`;
}

export function isBlackKey(note: number): boolean {
  const n = note % 12;
  return [1, 3, 6, 8, 10].includes(n);
}
