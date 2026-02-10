import { useRef, useCallback, useEffect, useState } from 'react';
import { useDAWStore } from '../../store/useDAWStore';
import { synthEngine } from '../../audio/SynthEngine';
import { noteToName, isBlackKey } from '../../types';
import type { Note } from '../../types';
import './PianoRoll.css';

const TOTAL_NOTES = 88; // Piano range: A0(21) to C8(108)
const MIN_NOTE = 21;
const MAX_NOTE = 108;
const NOTE_HEIGHT = 20;
const PIXELS_PER_TICK = 0.15;
const KEYBOARD_WIDTH = 48;
const TOTAL_BARS = 32;

export function PianoRoll() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const scrollRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{
    type: 'draw' | 'move' | 'resize' | null;
    noteId?: string;
    startPitch?: number;
    startTick?: number;
    offsetX?: number;
    offsetY?: number;
    originalNote?: Note;
  }>({ type: null });

  const selectedTrackId = useDAWStore((s) => s.selectedTrackId);
  const tracks = useDAWStore((s) => s.project.tracks);
  const currentTool = useDAWStore((s) => s.currentTool);
  const snapToGrid = useDAWStore((s) => s.snapToGrid);
  const gridSubdivision = useDAWStore((s) => s.gridSubdivision);
  const ticksPerBeat = useDAWStore((s) => s.project.ticksPerBeat);
  const playbackTick = useDAWStore((s) => s.playback.currentTick);
  const selectedNoteIds = useDAWStore((s) => s.selectedNoteIds);
  const addNote = useDAWStore((s) => s.addNote);
  const removeNote = useDAWStore((s) => s.removeNote);
  const updateNote = useDAWStore((s) => s.updateNote);
  const selectNote = useDAWStore((s) => s.selectNote);
  const clearNoteSelection = useDAWStore((s) => s.clearNoteSelection);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  const totalWidth = TOTAL_BARS * ticksPerBeat * 4 * PIXELS_PER_TICK;
  const totalHeight = TOTAL_NOTES * NOTE_HEIGHT;

  const snapTick = useCallback(
    (tick: number) => {
      if (!snapToGrid) return Math.max(0, Math.round(tick));
      return Math.max(0, Math.round(tick / gridSubdivision) * gridSubdivision);
    },
    [snapToGrid, gridSubdivision],
  );

  const pixelToTick = useCallback(
    (px: number) => (px + scrollRef.current.x - KEYBOARD_WIDTH) / PIXELS_PER_TICK,
    [],
  );

  const pixelToPitch = useCallback(
    (py: number) => MAX_NOTE - Math.floor((py + scrollRef.current.y) / NOTE_HEIGHT),
    [],
  );

  const tickToPixel = useCallback(
    (tick: number) => tick * PIXELS_PER_TICK - scrollRef.current.x + KEYBOARD_WIDTH,
    [],
  );

  // pitchToPixel reserved for future use (selection rectangle, etc.)
  const _pitchToPixel = (pitch: number) => (MAX_NOTE - pitch) * NOTE_HEIGHT - scrollRef.current.y;
  void _pitchToPixel;

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      setCanvasSize({ w: rect.width, h: rect.height });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Center the view initially around middle C
  useEffect(() => {
    if (canvasSize.h > 0) {
      const middleC = 60;
      scrollRef.current.y =
        (MAX_NOTE - middleC) * NOTE_HEIGHT - canvasSize.h / 2;
    }
  }, [canvasSize.h]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.w === 0) return;

    canvas.width = canvasSize.w * devicePixelRatio;
    canvas.height = canvasSize.h * devicePixelRatio;
    canvas.style.width = `${canvasSize.w}px`;
    canvas.style.height = `${canvasSize.h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const sx = scrollRef.current.x;
    const sy = scrollRef.current.y;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    // Piano rows
    for (let note = MIN_NOTE; note <= MAX_NOTE; note++) {
      const y = (MAX_NOTE - note) * NOTE_HEIGHT - sy;
      if (y + NOTE_HEIGHT < 0 || y > canvasSize.h) continue;

      const black = isBlackKey(note);
      ctx.fillStyle = black ? '#16162a' : '#1e1e38';
      ctx.fillRect(KEYBOARD_WIDTH, y, canvasSize.w - KEYBOARD_WIDTH, NOTE_HEIGHT);

      // Row border
      ctx.strokeStyle = '#2a2a4a';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(KEYBOARD_WIDTH, y + NOTE_HEIGHT);
      ctx.lineTo(canvasSize.w, y + NOTE_HEIGHT);
      ctx.stroke();
    }

    // Vertical grid lines
    const startTick = Math.max(0, Math.floor(sx / PIXELS_PER_TICK / gridSubdivision) * gridSubdivision);
    const endTick = (sx + canvasSize.w) / PIXELS_PER_TICK;

    for (let tick = startTick; tick <= endTick; tick += gridSubdivision) {
      const x = tick * PIXELS_PER_TICK - sx + KEYBOARD_WIDTH;
      if (x < KEYBOARD_WIDTH) continue;

      const isBar = tick % (ticksPerBeat * 4) === 0;
      const isBeat = tick % ticksPerBeat === 0;

      ctx.strokeStyle = isBar ? '#3a3a5a' : isBeat ? '#2a2a4a' : '#222244';
      ctx.lineWidth = isBar ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasSize.h);
      ctx.stroke();

      // Bar numbers
      if (isBar) {
        const barNum = tick / (ticksPerBeat * 4) + 1;
        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.fillText(String(barNum), x + 3, 12);
      }
    }

    // Draw notes for ALL tracks (dimmed) then selected track
    for (const track of tracks) {
      const isSelected = track.id === selectedTrackId;
      if (!isSelected) {
        ctx.globalAlpha = 0.2;
      }
      for (const note of track.notes) {
        const x = note.startTick * PIXELS_PER_TICK - sx + KEYBOARD_WIDTH;
        const y = (MAX_NOTE - note.pitch) * NOTE_HEIGHT - sy;
        const w = note.duration * PIXELS_PER_TICK;

        if (x + w < KEYBOARD_WIDTH || x > canvasSize.w || y + NOTE_HEIGHT < 0 || y > canvasSize.h) continue;

        const isNoteSelected = isSelected && selectedNoteIds.has(note.id);
        const radius = 3;

        // Note body
        ctx.fillStyle = isNoteSelected
          ? '#fff'
          : track.color;
        ctx.beginPath();
        ctx.roundRect(x, y + 1, Math.max(w, 4), NOTE_HEIGHT - 2, radius);
        ctx.fill();

        // Note border
        if (isNoteSelected) {
          ctx.strokeStyle = track.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Velocity indicator (height of note fill)
        const velRatio = note.velocity / 127;
        ctx.fillStyle = isNoteSelected
          ? track.color
          : `${track.color}cc`;
        const velHeight = (NOTE_HEIGHT - 4) * velRatio;
        ctx.fillRect(x + 1, y + NOTE_HEIGHT - 1 - velHeight, Math.max(w - 2, 2), velHeight);

        // Note label if wide enough
        if (w > 30 && isSelected) {
          ctx.fillStyle = isNoteSelected ? '#000' : '#fff';
          ctx.font = '10px sans-serif';
          ctx.fillText(noteToName(note.pitch), x + 4, y + NOTE_HEIGHT / 2 + 3);
        }

        // Resize handle
        if (isSelected && w > 8) {
          ctx.fillStyle = isNoteSelected ? track.color : '#ffffff44';
          ctx.fillRect(x + w - 5, y + 3, 3, NOTE_HEIGHT - 6);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Playback cursor
    if (playbackTick > 0) {
      const cx = playbackTick * PIXELS_PER_TICK - sx + KEYBOARD_WIDTH;
      if (cx >= KEYBOARD_WIDTH && cx <= canvasSize.w) {
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, canvasSize.h);
        ctx.stroke();
      }
    }

    // Keyboard
    ctx.fillStyle = '#111128';
    ctx.fillRect(0, 0, KEYBOARD_WIDTH, canvasSize.h);

    for (let note = MIN_NOTE; note <= MAX_NOTE; note++) {
      const y = (MAX_NOTE - note) * NOTE_HEIGHT - sy;
      if (y + NOTE_HEIGHT < 0 || y > canvasSize.h) continue;

      const black = isBlackKey(note);
      ctx.fillStyle = black ? '#1a1a32' : '#2a2a4a';
      ctx.fillRect(0, y, KEYBOARD_WIDTH, NOTE_HEIGHT);

      ctx.strokeStyle = '#333355';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y + NOTE_HEIGHT);
      ctx.lineTo(KEYBOARD_WIDTH, y + NOTE_HEIGHT);
      ctx.stroke();

      // Note label for C notes
      if (note % 12 === 0) {
        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.fillText(noteToName(note), 4, y + NOTE_HEIGHT / 2 + 3);
      }
    }

    // Keyboard divider
    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(KEYBOARD_WIDTH, 0);
    ctx.lineTo(KEYBOARD_WIDTH, canvasSize.h);
    ctx.stroke();
  }, [
    canvasSize,
    tracks,
    selectedTrackId,
    selectedNoteIds,
    playbackTick,
    gridSubdivision,
    ticksPerBeat,
  ]);

  // Find note at position
  const findNoteAt = useCallback(
    (tick: number, pitch: number): Note | undefined => {
      if (!selectedTrack) return undefined;
      return selectedTrack.notes.find(
        (n) =>
          pitch === n.pitch &&
          tick >= n.startTick &&
          tick <= n.startTick + n.duration,
      );
    },
    [selectedTrack],
  );

  const isResizeHandle = useCallback(
    (note: Note, clientX: number) => {
      const noteEndPixel = tickToPixel(note.startTick + note.duration);
      return clientX >= noteEndPixel - 8;
    },
    [tickToPixel],
  );

  // Pointer events for touch and mouse
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!selectedTrack || !selectedTrackId) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Keyboard click: preview note
      if (x < KEYBOARD_WIDTH) {
        const pitch = pixelToPitch(y);
        if (pitch >= MIN_NOTE && pitch <= MAX_NOTE) {
          synthEngine.init().then(() => {
            synthEngine.previewNote(selectedTrack.instrument, pitch);
          });
        }
        return;
      }

      const tick = pixelToTick(x);
      const pitch = pixelToPitch(y);
      const existingNote = findNoteAt(tick, pitch);

      if (currentTool === 'erase') {
        if (existingNote) {
          removeNote(selectedTrackId, existingNote.id);
        }
        return;
      }

      if (currentTool === 'select') {
        if (existingNote) {
          if (isResizeHandle(existingNote, e.clientX)) {
            dragRef.current = {
              type: 'resize',
              noteId: existingNote.id,
              originalNote: { ...existingNote },
              startTick: tick,
            };
          } else {
            selectNote(existingNote.id);
            dragRef.current = {
              type: 'move',
              noteId: existingNote.id,
              originalNote: { ...existingNote },
              offsetX: tick - existingNote.startTick,
              offsetY: pitch - existingNote.pitch,
            };
          }
          canvas.setPointerCapture(e.pointerId);
        } else {
          clearNoteSelection();
        }
        return;
      }

      // Draw tool
      if (currentTool === 'draw') {
        if (existingNote) {
          // Click on existing note in draw mode: select for move
          selectNote(existingNote.id);
          dragRef.current = {
            type: 'move',
            noteId: existingNote.id,
            originalNote: { ...existingNote },
            offsetX: tick - existingNote.startTick,
            offsetY: pitch - existingNote.pitch,
          };
        } else {
          const snappedTick = snapTick(tick);
          if (pitch < MIN_NOTE || pitch > MAX_NOTE) return;

          addNote(selectedTrackId, {
            pitch,
            startTick: snappedTick,
            duration: gridSubdivision,
            velocity: 100,
          });

          // Preview sound
          synthEngine.init().then(() => {
            synthEngine.previewNote(selectedTrack.instrument, pitch);
          });

          // Find the newly added note and start resize drag
          const state = useDAWStore.getState();
          const track = state.project.tracks.find((t) => t.id === selectedTrackId);
          const newNote = track?.notes[track.notes.length - 1];
          if (newNote) {
            selectNote(newNote.id);
            dragRef.current = {
              type: 'resize',
              noteId: newNote.id,
              originalNote: { ...newNote },
              startTick: tick,
            };
          }
        }
        canvas.setPointerCapture(e.pointerId);
      }
    },
    [
      selectedTrack,
      selectedTrackId,
      currentTool,
      pixelToTick,
      pixelToPitch,
      findNoteAt,
      isResizeHandle,
      snapTick,
      gridSubdivision,
      addNote,
      removeNote,
      selectNote,
      clearNoteSelection,
      tickToPixel,
    ],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!selectedTrackId || dragRef.current.type === null) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const tick = pixelToTick(x);
      const pitch = pixelToPitch(y);

      const drag = dragRef.current;

      if (drag.type === 'move' && drag.noteId && drag.originalNote) {
        const newTick = snapTick(tick - (drag.offsetX ?? 0));
        const newPitch = Math.min(MAX_NOTE, Math.max(MIN_NOTE, pitch));
        updateNote(selectedTrackId, drag.noteId, {
          startTick: newTick,
          pitch: newPitch,
        });
      }

      if (drag.type === 'resize' && drag.noteId && drag.originalNote) {
        const snappedTick = snapTick(tick);
        const newDuration = Math.max(
          gridSubdivision / 4,
          snappedTick - drag.originalNote.startTick,
        );
        updateNote(selectedTrackId, drag.noteId, {
          duration: newDuration,
        });
      }

      // Erase on drag
      if (currentTool === 'erase') {
        const note = findNoteAt(tick, pitch);
        if (note) {
          removeNote(selectedTrackId, note.id);
        }
      }
    },
    [
      selectedTrackId,
      pixelToTick,
      pixelToPitch,
      snapTick,
      gridSubdivision,
      updateNote,
      currentTool,
      findNoteAt,
      removeNote,
    ],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = { type: null };
  }, []);

  // Scroll handling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    scrollRef.current.x = target.scrollLeft;
    scrollRef.current.y = target.scrollTop;
    // Trigger redraw by forcing state change
    setCanvasSize((s) => ({ ...s }));
  }, []);

  // Keyboard shortcut for delete
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useDAWStore.getState();
        if (state.selectedNoteIds.size > 0) {
          state.removeSelectedNotes();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!selectedTrack) {
    return (
      <div className="piano-roll-empty">
        <p>Select a track to edit notes</p>
      </div>
    );
  }

  return (
    <div className="piano-roll" ref={containerRef}>
      <div
        className="piano-roll-scroll"
        onScroll={handleScroll}
      >
        <div
          className="piano-roll-content"
          style={{ width: totalWidth + KEYBOARD_WIDTH, height: totalHeight }}
        >
          <canvas
            ref={canvasRef}
            className="piano-roll-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              position: 'sticky',
              left: 0,
              top: 0,
              width: canvasSize.w,
              height: canvasSize.h,
              touchAction: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}
