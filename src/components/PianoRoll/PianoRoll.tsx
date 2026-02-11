import { useRef, useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { synthEngine } from '../../audio/SynthEngine';
import { noteToName, isBlackKey } from '../../types';
import './PianoRoll.css';

// ===== Types =====
export type ToolType = 'select' | 'draw' | 'erase';
export interface NoteData {
  id: number;
  pitch: number;
  col: number;   // start column
  len: number;   // length in columns (>=1)
}

interface Props {
  tool: ToolType;
  notes: NoteData[];
  setNotes: Dispatch<SetStateAction<NoteData[]>>;
  playCol: number; // -1 = not playing
}

// ===== Constants =====
const MIN_NOTE = 36;
const MAX_NOTE = 96;
const NOTE_HEIGHT = 28;
const KEYBOARD_WIDTH = 64;
const CELL_W = 50;
const TOTAL_CELLS = 64;
const TIMELINE_HEIGHT = 24;
const BEATS_PER_BAR = 4;

let nextId = 1;

export function PianoRoll({ tool, notes, setNotes, playCol }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const initedScroll = useRef(false);

  // Drag state
  const dragRef = useRef<{
    active: boolean;
    noteId: number;
    startCol: number;
    startPitch: number;
    mode: 'create' | 'move' | 'resize';
    origCol: number;
    origLen: number;
    origPitch: number;
  } | null>(null);

  const totalWidth = KEYBOARD_WIDTH + TOTAL_CELLS * CELL_W;
  const totalHeight = (MAX_NOTE - MIN_NOTE + 1) * NOTE_HEIGHT + TIMELINE_HEIGHT;

  // ===== Resize =====
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Center on middle C
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc || size.h === 0 || initedScroll.current) return;
    initedScroll.current = true;
    const middleC = 60;
    sc.scrollTop = Math.max(0, (MAX_NOTE - middleC) * NOTE_HEIGHT - size.h / 2 + TIMELINE_HEIGHT);
    setScroll({ x: sc.scrollLeft, y: sc.scrollTop });
  }, [size.h]);

  // ===== Helper: get col/pitch from screen coords =====
  const getGridPos = useCallback((clientX: number, clientY: number) => {
    const sc = scrollRef.current;
    if (!sc) return null;
    const rect = sc.getBoundingClientRect();
    const lx = clientX - rect.left;
    const ly = clientY - rect.top;
    const sx = scroll.x;
    const sy = scroll.y;
    const col = Math.floor((lx - KEYBOARD_WIDTH + sx) / CELL_W);
    const pitch = MAX_NOTE - Math.floor((ly + sy - TIMELINE_HEIGHT) / NOTE_HEIGHT);
    return { lx, ly, col, pitch, sx, sy };
  }, [scroll]);

  // ===== Find note at position =====
  const findNoteAt = useCallback((col: number, pitch: number): NoteData | undefined => {
    return notes.find(n => n.pitch === pitch && col >= n.col && col < n.col + n.len);
  }, [notes]);

  // ===== DRAW (Canvas) =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    const sx = scroll.x;
    const sy = scroll.y;

    ctx.fillStyle = '#12121f';
    ctx.fillRect(0, 0, size.w, size.h);

    // === Timeline bar at top ===
    ctx.fillStyle = '#181828';
    ctx.fillRect(0, 0, size.w, TIMELINE_HEIGHT);
    ctx.strokeStyle = '#2a2a45';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, TIMELINE_HEIGHT);
    ctx.lineTo(size.w, TIMELINE_HEIGHT);
    ctx.stroke();

    // Bar numbers in timeline
    for (let i = 0; i <= TOTAL_CELLS; i++) {
      const x = KEYBOARD_WIDTH + i * CELL_W - sx;
      if (x < KEYBOARD_WIDTH || x > size.w) continue;
      if (i % BEATS_PER_BAR === 0) {
        ctx.fillStyle = '#666';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(String(i / BEATS_PER_BAR + 1), x + 4, 16);
        // Tick mark
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, TIMELINE_HEIGHT - 6);
        ctx.lineTo(x, TIMELINE_HEIGHT);
        ctx.stroke();
      } else {
        // Small tick
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, TIMELINE_HEIGHT - 3);
        ctx.lineTo(x, TIMELINE_HEIGHT);
        ctx.stroke();
      }
    }

    // === Grid rows ===
    for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
      const y = (MAX_NOTE - n) * NOTE_HEIGHT - sy + TIMELINE_HEIGHT;
      if (y + NOTE_HEIGHT < TIMELINE_HEIGHT || y > size.h) continue;

      ctx.fillStyle = isBlackKey(n) ? '#151520' : '#1a1a28';
      ctx.fillRect(KEYBOARD_WIDTH, y, size.w - KEYBOARD_WIDTH, NOTE_HEIGHT);

      ctx.strokeStyle = '#222233';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(KEYBOARD_WIDTH, y + NOTE_HEIGHT);
      ctx.lineTo(size.w, y + NOTE_HEIGHT);
      ctx.stroke();
    }

    // === Grid columns ===
    for (let i = 0; i <= TOTAL_CELLS; i++) {
      const x = KEYBOARD_WIDTH + i * CELL_W - sx;
      if (x < KEYBOARD_WIDTH || x > size.w) continue;

      const isBar = i % BEATS_PER_BAR === 0;
      ctx.strokeStyle = isBar ? '#333348' : '#222233';
      ctx.lineWidth = isBar ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, TIMELINE_HEIGHT);
      ctx.lineTo(x, size.h);
      ctx.stroke();
    }

    // === Notes ===
    for (const note of notes) {
      const x = KEYBOARD_WIDTH + note.col * CELL_W - sx;
      const y = (MAX_NOTE - note.pitch) * NOTE_HEIGHT - sy + TIMELINE_HEIGHT;
      const w = note.len * CELL_W;

      if (x + w < KEYBOARD_WIDTH || x > size.w) continue;
      if (y + NOTE_HEIGHT < TIMELINE_HEIGHT || y > size.h) continue;

      // Body
      ctx.fillStyle = '#5b7fff';
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 2, w - 2, NOTE_HEIGHT - 4, 4);
      ctx.fill();

      // Label
      if (w > 30) {
        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        ctx.fillText(noteToName(note.pitch), x + 5, y + NOTE_HEIGHT / 2 + 4);
      }

      // Resize handle (right edge)
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x + w - 6, y + 4, 4, NOTE_HEIGHT - 8);
    }

    // === Playback cursor ===
    if (playCol >= 0) {
      const cx = KEYBOARD_WIDTH + playCol * CELL_W - sx;
      if (cx >= KEYBOARD_WIDTH && cx <= size.w) {
        // Timeline marker
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.moveTo(cx - 5, 0);
        ctx.lineTo(cx + 5, 0);
        ctx.lineTo(cx + 5, TIMELINE_HEIGHT - 4);
        ctx.lineTo(cx, TIMELINE_HEIGHT);
        ctx.lineTo(cx - 5, TIMELINE_HEIGHT - 4);
        ctx.closePath();
        ctx.fill();

        // Vertical line
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, TIMELINE_HEIGHT);
        ctx.lineTo(cx, size.h);
        ctx.stroke();
      }
    }

    // === Keyboard ===
    ctx.fillStyle = '#0e0e18';
    ctx.fillRect(0, 0, KEYBOARD_WIDTH, size.h);

    for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
      const y = (MAX_NOTE - n) * NOTE_HEIGHT - sy + TIMELINE_HEIGHT;
      if (y + NOTE_HEIGHT < TIMELINE_HEIGHT || y > size.h) continue;

      const black = isBlackKey(n);
      if (black) {
        ctx.fillStyle = '#1a1a28';
        ctx.fillRect(0, y, KEYBOARD_WIDTH, NOTE_HEIGHT);
        ctx.fillStyle = '#111118';
        ctx.beginPath();
        ctx.roundRect(2, y + 2, KEYBOARD_WIDTH - 12, NOTE_HEIGHT - 4, 3);
        ctx.fill();
      } else {
        ctx.fillStyle = '#d8d8e0';
        ctx.fillRect(0, y, KEYBOARD_WIDTH, NOTE_HEIGHT);
        ctx.fillStyle = '#e8e8f0';
        ctx.fillRect(0, y, KEYBOARD_WIDTH - 8, NOTE_HEIGHT - 1);
      }

      ctx.strokeStyle = black ? '#222230' : '#b0b0c0';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y + NOTE_HEIGHT);
      ctx.lineTo(KEYBOARD_WIDTH, y + NOTE_HEIGHT);
      ctx.stroke();

      if (n % 12 === 0) {
        ctx.fillStyle = '#444';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(noteToName(n), 4, y + NOTE_HEIGHT / 2 + 4);
      } else if (black) {
        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.fillText(noteToName(n), 4, y + NOTE_HEIGHT / 2 + 3);
      }
    }

    // Keyboard top-left corner (timeline x keyboard)
    ctx.fillStyle = '#0e0e18';
    ctx.fillRect(0, 0, KEYBOARD_WIDTH, TIMELINE_HEIGHT);

    // Divider
    ctx.strokeStyle = '#444460';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(KEYBOARD_WIDTH, 0);
    ctx.lineTo(KEYBOARD_WIDTH, size.h);
    ctx.stroke();

  }, [size, scroll, notes, playCol]);

  // ===== POINTER DOWN =====
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const pos = getGridPos(e.clientX, e.clientY);
    if (!pos) return;
    const { lx, col, pitch } = pos;

    // Keyboard
    if (lx < KEYBOARD_WIDTH) {
      if (pitch >= MIN_NOTE && pitch <= MAX_NOTE) {
        synthEngine.init().then(() => synthEngine.previewNote('synth-lead', pitch, 100, 300));
      }
      return;
    }

    if (col < 0 || col >= TOTAL_CELLS || pitch < MIN_NOTE || pitch > MAX_NOTE) return;

    const existing = findNoteAt(col, pitch);

    if (tool === 'erase') {
      if (existing) {
        setNotes(prev => prev.filter(n => n.id !== existing.id));
      }
      return;
    }

    if (tool === 'select') {
      if (existing) {
        // Check if clicking the resize handle (last 8px of note)
        const noteEndX = KEYBOARD_WIDTH + (existing.col + existing.len) * CELL_W - scroll.x;
        const localNoteX = e.clientX - (scrollRef.current?.getBoundingClientRect().left ?? 0);
        if (localNoteX > noteEndX - 10) {
          // Resize
          dragRef.current = {
            active: true, noteId: existing.id, startCol: col, startPitch: pitch,
            mode: 'resize', origCol: existing.col, origLen: existing.len, origPitch: existing.pitch,
          };
        } else {
          // Move
          dragRef.current = {
            active: true, noteId: existing.id, startCol: col, startPitch: pitch,
            mode: 'move', origCol: existing.col, origLen: existing.len, origPitch: existing.pitch,
          };
        }
        (e.target as Element).setPointerCapture(e.pointerId);
      }
      return;
    }

    // tool === 'draw'
    if (existing) {
      // Already a note here, do nothing (avoid overlap)
      return;
    }

    const id = nextId++;
    setNotes(prev => [...prev, { id, pitch, col, len: 1 }]);
    synthEngine.init().then(() => synthEngine.previewNote('synth-lead', pitch, 100, 200));

    // Start drag to extend length
    dragRef.current = {
      active: true, noteId: id, startCol: col, startPitch: pitch,
      mode: 'create', origCol: col, origLen: 1, origPitch: pitch,
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [tool, notes, findNoteAt, getGridPos, setNotes, scroll]);

  // ===== POINTER MOVE =====
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !drag.active) return;

    const pos = getGridPos(e.clientX, e.clientY);
    if (!pos) return;
    const { col, pitch } = pos;

    if (drag.mode === 'create' || drag.mode === 'resize') {
      // Extend / shrink note length
      const newLen = Math.max(1, col - drag.origCol + 1);
      setNotes(prev => prev.map(n => n.id === drag.noteId ? { ...n, len: newLen } : n));
    }

    if (drag.mode === 'move') {
      const dc = col - drag.startCol;
      const dp = pitch - drag.startPitch;
      const newCol = Math.max(0, Math.min(TOTAL_CELLS - drag.origLen, drag.origCol + dc));
      const newPitch = Math.max(MIN_NOTE, Math.min(MAX_NOTE, drag.origPitch + dp));
      setNotes(prev => prev.map(n => n.id === drag.noteId ? { ...n, col: newCol, pitch: newPitch } : n));
    }
  }, [getGridPos, setNotes]);

  // ===== POINTER UP =====
  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ===== SCROLL =====
  const handleScroll = useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    setScroll({ x: sc.scrollLeft, y: sc.scrollTop });
  }, []);

  return (
    <div className="piano-roll" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="piano-roll-canvas"
        style={{ width: size.w, height: size.h }}
      />
      <div
        className="piano-roll-scroll"
        ref={scrollRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: tool === 'select' || tool === 'draw' ? 'pan-y' : 'auto' }}
      >
        <div style={{ width: totalWidth, height: totalHeight }} />
      </div>
    </div>
  );
}
