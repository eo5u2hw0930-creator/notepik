import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Project, Track, Note, Tool, PlaybackState, InstrumentType } from '../types';
import { TRACK_COLORS } from '../types';

interface DAWState {
  project: Project;
  selectedTrackId: string | null;
  selectedNoteIds: Set<string>;
  currentTool: Tool;
  playback: PlaybackState;
  snapToGrid: boolean;
  gridSubdivision: number; // ticks per grid cell

  // Project actions
  setProjectName: (name: string) => void;
  setBpm: (bpm: number) => void;

  // Track actions
  addTrack: (instrument?: InstrumentType) => void;
  removeTrack: (id: string) => void;
  selectTrack: (id: string) => void;
  updateTrack: (id: string, updates: Partial<Omit<Track, 'id' | 'notes'>>) => void;
  toggleMute: (id: string) => void;
  toggleSolo: (id: string) => void;

  // Note actions
  addNote: (trackId: string, note: Omit<Note, 'id'>) => void;
  removeNote: (trackId: string, noteId: string) => void;
  updateNote: (trackId: string, noteId: string, updates: Partial<Omit<Note, 'id'>>) => void;
  selectNote: (noteId: string, multi?: boolean) => void;
  clearNoteSelection: () => void;
  removeSelectedNotes: () => void;

  // Tool actions
  setTool: (tool: Tool) => void;
  setSnapToGrid: (snap: boolean) => void;
  setGridSubdivision: (sub: number) => void;

  // Playback actions
  setPlaying: (playing: boolean) => void;
  setCurrentTick: (tick: number) => void;
  toggleLoop: () => void;
  setLoopRegion: (start: number, end: number) => void;
  stopAndReset: () => void;
}

const defaultTrackId = uuid();

const createDefaultProject = (): Project => ({
  id: uuid(),
  name: 'Untitled Project',
  bpm: 120,
  timeSignature: [4, 4],
  ticksPerBeat: 480,
  tracks: [
    {
      id: defaultTrackId,
      name: 'Synth Lead',
      instrument: 'synth-lead',
      notes: [],
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[0],
    },
  ],
});

export const useDAWStore = create<DAWState>((set, get) => ({
  project: createDefaultProject(),
  selectedTrackId: defaultTrackId,
  selectedNoteIds: new Set(),
  currentTool: 'draw',
  playback: {
    isPlaying: false,
    currentTick: 0,
    loopStart: null,
    loopEnd: null,
    isLooping: false,
  },
  snapToGrid: true,
  gridSubdivision: 480, // quarter note by default

  // Project
  setProjectName: (name) =>
    set((s) => ({ project: { ...s.project, name } })),
  setBpm: (bpm) =>
    set((s) => ({ project: { ...s.project, bpm: Math.max(20, Math.min(300, bpm)) } })),

  // Tracks
  addTrack: (instrument = 'synth-lead') => {
    const state = get();
    const colorIdx = state.project.tracks.length % TRACK_COLORS.length;
    const instrumentNames: Record<InstrumentType, string> = {
      'synth-lead': 'Synth Lead',
      'synth-pad': 'Synth Pad',
      'synth-bass': 'Synth Bass',
      'synth-pluck': 'Synth Pluck',
      'drums': 'Drums',
    };
    const newTrack: Track = {
      id: uuid(),
      name: `${instrumentNames[instrument]} ${state.project.tracks.length + 1}`,
      instrument,
      notes: [],
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      color: TRACK_COLORS[colorIdx],
    };
    set((s) => ({
      project: { ...s.project, tracks: [...s.project.tracks, newTrack] },
      selectedTrackId: newTrack.id,
    }));
  },

  removeTrack: (id) =>
    set((s) => {
      const tracks = s.project.tracks.filter((t) => t.id !== id);
      return {
        project: { ...s.project, tracks },
        selectedTrackId:
          s.selectedTrackId === id
            ? tracks[0]?.id ?? null
            : s.selectedTrackId,
      };
    }),

  selectTrack: (id) => set({ selectedTrackId: id, selectedNoteIds: new Set() }),

  updateTrack: (id, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      },
    })),

  toggleMute: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === id ? { ...t, mute: !t.mute } : t
        ),
      },
    })),

  toggleSolo: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === id ? { ...t, solo: !t.solo } : t
        ),
      },
    })),

  // Notes
  addNote: (trackId, note) => {
    const noteWithId: Note = { ...note, id: uuid() };
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === trackId ? { ...t, notes: [...t.notes, noteWithId] } : t
        ),
      },
    }));
  },

  removeNote: (trackId, noteId) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === trackId
            ? { ...t, notes: t.notes.filter((n) => n.id !== noteId) }
            : t
        ),
      },
      selectedNoteIds: (() => {
        const next = new Set(s.selectedNoteIds);
        next.delete(noteId);
        return next;
      })(),
    })),

  updateNote: (trackId, noteId, updates) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === trackId
            ? {
                ...t,
                notes: t.notes.map((n) =>
                  n.id === noteId ? { ...n, ...updates } : n
                ),
              }
            : t
        ),
      },
    })),

  selectNote: (noteId, multi = false) =>
    set((s) => {
      if (multi) {
        const next = new Set(s.selectedNoteIds);
        if (next.has(noteId)) next.delete(noteId);
        else next.add(noteId);
        return { selectedNoteIds: next };
      }
      return { selectedNoteIds: new Set([noteId]) };
    }),

  clearNoteSelection: () => set({ selectedNoteIds: new Set() }),

  removeSelectedNotes: () => {
    const state = get();
    if (!state.selectedTrackId || state.selectedNoteIds.size === 0) return;
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id === s.selectedTrackId
            ? { ...t, notes: t.notes.filter((n) => !s.selectedNoteIds.has(n.id)) }
            : t
        ),
      },
      selectedNoteIds: new Set(),
    }));
  },

  // Tools
  setTool: (tool) => set({ currentTool: tool }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setGridSubdivision: (sub) => set({ gridSubdivision: sub }),

  // Playback
  setPlaying: (playing) =>
    set((s) => ({ playback: { ...s.playback, isPlaying: playing } })),
  setCurrentTick: (tick) =>
    set((s) => ({ playback: { ...s.playback, currentTick: tick } })),
  toggleLoop: () =>
    set((s) => ({ playback: { ...s.playback, isLooping: !s.playback.isLooping } })),
  setLoopRegion: (start, end) =>
    set((s) => ({ playback: { ...s.playback, loopStart: start, loopEnd: end } })),
  stopAndReset: () =>
    set((s) => ({
      playback: { ...s.playback, isPlaying: false, currentTick: 0 },
    })),
}));
