import { useRef, useCallback, useEffect, useState } from 'react';
import { useDAWStore } from '../../store/useDAWStore';
import { synthEngine } from '../../audio/SynthEngine';
import { noteToName, isBlackKey } from '../../types';
import './PianoRoll.css';

const MIN_NOTE = 36;  // C2
const MAX_NOTE = 96;  // C7
const TOTAL_NOTES = MAX_NOTE - MIN_NOTE + 1;
const NOTE_HEIGHT = 24;
const PIXELS_PER_TICK = 0.18;
const KEYBOARD_WIDTH = 52;
const TOTAL_BARS = 32;

export function PianoRoll() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const didInitScroll = useRef(false);

  const selectedTrackId = useDAWStore((s) => s.selectedTrackId);
  const tracks = useDAWStore((s) => s.project.tracks);
  const gridSubdivision = useDAWStore((s) => s.gridSubdivision);
  const ticksPerBeat = useDAWStore((s) => s.project.ticksPerBeat);
  const playbackTick = useDAWStore((s) => s.playback.currentTick);
  const addNote = useDAWStore((s) => s.addNote);
  const removeNote = useDAWStore((s) => s.removeNote);

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);

  const totalWidth = TOTAL_BARS * ticksPerBeat * 4 * PIXELS_PER_TICK + KEYBOARD_WIDTH;
  const totalHeight = TOTAL_NOTES * NOTE_HEIGHT;

  const snapTick = useCallback(
    (tick: number) => Math.max(0, Math.round(tick / gridSubdivision) * gridSubdivision),
    [gridSubdivision],
  );

  // Resize
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

  // Center around middle C once
  useEffect(() => {
    const sc = scrollContainerRef.current;
    if (!sc || canvasSize.h === 0 || didInitScroll.current) return;
    didInitScroll.current = true;
    const middleC = 60;
    sc.scrollTop = Math.max(0, (MAX_NOTE - middleC) * NOTE_HEIGHT - canvasSize.h / 2);
    setScrollPos({ x: sc.scrollLeft, y: sc.scrollTop });
  }, [canvasSize.h]);

  // ===== Draw =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.w === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const sx = scrollPos.x;
    const sy = scrollPos.y;

    // BG
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    // Rows
    for (let note = MIN_NOTE; note <= MAX_NOTE; note++) {
      const y = (MAX_NOTE - note) * NOTE_HEIGHT - sy;
      if (y + NOTE_HEIGHT < 0 || y > canvasSize.h) continue;

      ctx.fillStyle = isBlackKey(note) ? '#16162a' : '#1e1e38';
      ctx.fillRect(KEYBOARD_WIDTH, y, canvasSize.w - KEYBOARD_WIDTH, NOTE_HEIGHT);

      ctx.strokeStyle = '#2a2a4a';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(KEYBOARD_WIDTH, y + NOTE_HEIGHT);
      ctx.lineTo(canvasSize.w, y + NOTE_HEIGHT);
      ctx.stroke();
    }

    // Grid
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

      if (isBar) {
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.fillText(String(tick / (ticksPerBeat * 4) + 1), x + 4, 14);
      }
    }

    // Notes
    for (const track of tracks) {
      const isSelected = track.id === selectedTrackId;
      ctx.globalAlpha = isSelected ? 1 : 0.15;

      for (const note of track.notes) {
        const x = note.startTick * PIXELS_PER_TICK - sx + KEYBOARD_WIDTH;
        const y = (MAX_NOTE - note.pitch) * NOTE_HEIGHT - sy;
        const w = Math.max(note.duration * PIXELS_PER_TICK, 6);

        if (x + w < KEYBOARD_WIDTH || x > canvasSize.w) continue;
        if (y + NOTE_HEIGHT < 0 || y > canvasSize.h) continue;

        ctx.fillStyle = track.color;
        ctx.beginPath();
        ctx.roundRect(x, y + 2, w, NOTE_HEIGHT - 4, 4);
        ctx.fill();

        if (w > 35 && isSelected) {
          ctx.fillStyle = '#fff';
          ctx.font = '11px sans-serif';
          ctx.fillText(noteToName(note.pitch), x + 5, y + NOTE_HEIGHT / 2 + 4);
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

      ctx.fillStyle = isBlackKey(note) ? '#1a1a32' : '#2a2a4a';
      ctx.fillRect(0, y, KEYBOARD_WIDTH, NOTE_HEIGHT);

      ctx.strokeStyle = '#333355';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y + NOTE_HEIGHT);
      ctx.lineTo(KEYBOARD_WIDTH, y + NOTE_HEIGHT);
      ctx.stroke();

      if (note % 12 === 0) {
        ctx.fillStyle = '#999';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(noteToName(note), 4, y + NOTE_HEIGHT / 2 + 4);
      }
    }

    ctx.strokeStyle = '#444466';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(KEYBOARD_WIDTH, 0);
    ctx.lineTo(KEYBOARD_WIDTH, canvasSize.h);
    ctx.stroke();
  }, [canvasSize, scrollPos, tracks, selectedTrackId, playbackTick, gridSubdivision, ticksPerBeat]);

  // ===== Tap to add/remove notes =====
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!selectedTrack || !selectedTrackId) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      const sx = scrollPos.x;
      const sy = scrollPos.y;

      // Keyboard → preview
      if (localX < KEYBOARD_WIDTH) {
        const pitch = MAX_NOTE - Math.floor((localY + sy) / NOTE_HEIGHT);
        if (pitch >= MIN_NOTE && pitch <= MAX_NOTE) {
          synthEngine.init().then(() => {
            synthEngine.previewNote(selectedTrack.instrument, pitch);
          });
        }
        return;
      }

      // Grid area
      const tick = (localX - KEYBOARD_WIDTH + sx) / PIXELS_PER_TICK;
      const pitch = MAX_NOTE - Math.floor((localY + sy) / NOTE_HEIGHT);

      if (pitch < MIN_NOTE || pitch > MAX_NOTE) return;

      // Existing note? → delete
      const existing = selectedTrack.notes.find(
        (n) => n.pitch === pitch && tick >= n.startTick && tick <= n.startTick + n.duration,
      );

      if (existing) {
        removeNote(selectedTrackId, existing.id);
      } else {
        // Empty → add note
        const snappedTick = snapTick(tick);
        addNote(selectedTrackId, {
          pitch,
          startTick: snappedTick,
          duration: gridSubdivision,
          velocity: 100,
        });
        synthEngine.init().then(() => {
          synthEngine.previewNote(selectedTrack.instrument, pitch);
        });
      }
    },
    [selectedTrack, selectedTrackId, scrollPos, snapTick, gridSubdivision, addNote, removeNote],
  );

  // Scroll sync
  const handleScroll = useCallback(() => {
    const sc = scrollContainerRef.current;
    if (!sc) return;
    setScrollPos({ x: sc.scrollLeft, y: sc.scrollTop });
  }, []);

  if (!selectedTrack) {
    return (
      <div className="piano-roll-empty">
        <p>트랙을 선택하세요</p>
      </div>
    );
  }

  return (
    <div className="piano-roll" ref={containerRef}>
      {/* Canvas behind - just renders, no interaction */}
      <canvas
        ref={canvasRef}
        className="piano-roll-canvas"
        style={{ width: canvasSize.w, height: canvasSize.h }}
      />
      {/* Scroll layer on top - handles scroll + click */}
      <div
        className="piano-roll-scroll"
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onClick={handleClick as unknown as React.MouseEventHandler<HTMLDivElement>}
      >
        <div style={{ width: totalWidth, height: totalHeight }} />
      </div>
    </div>
  );
}
