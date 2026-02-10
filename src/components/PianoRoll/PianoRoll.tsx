import { useRef, useCallback, useEffect, useState } from 'react';
import { synthEngine } from '../../audio/SynthEngine';
import { noteToName, isBlackKey } from '../../types';
import './PianoRoll.css';

const MIN_NOTE = 36;  // C2
const MAX_NOTE = 96;  // C7
const NOTE_HEIGHT = 28;
const KEYBOARD_WIDTH = 64;
const GRID_CELL_WIDTH = 50;
const TOTAL_CELLS = 64; // 16 bars * 4 beats

export function PianoRoll() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const initedScroll = useRef(false);

  // Simple local note state (no store needed for now)
  const [notes, setNotes] = useState<{ pitch: number; col: number }[]>([]);

  const totalWidth = KEYBOARD_WIDTH + TOTAL_CELLS * GRID_CELL_WIDTH;
  const totalHeight = (MAX_NOTE - MIN_NOTE + 1) * NOTE_HEIGHT;

  // Resize
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

  // Center on middle C once
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc || size.h === 0 || initedScroll.current) return;
    initedScroll.current = true;
    const middleC = 60;
    sc.scrollTop = Math.max(0, (MAX_NOTE - middleC) * NOTE_HEIGHT - size.h / 2);
    setScroll({ x: sc.scrollLeft, y: sc.scrollTop });
  }, [size.h]);

  // ====== DRAW ======
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

    // === Background ===
    ctx.fillStyle = '#12121f';
    ctx.fillRect(0, 0, size.w, size.h);

    // === Grid rows (behind everything) ===
    for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
      const y = (MAX_NOTE - n) * NOTE_HEIGHT - sy;
      if (y + NOTE_HEIGHT < 0 || y > size.h) continue;

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
      const x = KEYBOARD_WIDTH + i * GRID_CELL_WIDTH - sx;
      if (x < KEYBOARD_WIDTH || x > size.w) continue;

      const isBeat4 = i % 4 === 0;
      ctx.strokeStyle = isBeat4 ? '#333348' : '#222233';
      ctx.lineWidth = isBeat4 ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size.h);
      ctx.stroke();

      // Bar number
      if (isBeat4) {
        ctx.fillStyle = '#555';
        ctx.font = '11px sans-serif';
        ctx.fillText(String(i / 4 + 1), x + 4, 14);
      }
    }

    // === Notes ===
    for (const note of notes) {
      const x = KEYBOARD_WIDTH + note.col * GRID_CELL_WIDTH - sx;
      const y = (MAX_NOTE - note.pitch) * NOTE_HEIGHT - sy;
      if (x + GRID_CELL_WIDTH < KEYBOARD_WIDTH || x > size.w) continue;
      if (y + NOTE_HEIGHT < 0 || y > size.h) continue;

      ctx.fillStyle = '#5b7fff';
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 2, GRID_CELL_WIDTH - 2, NOTE_HEIGHT - 4, 4);
      ctx.fill();

      // Label
      if (GRID_CELL_WIDTH > 30) {
        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        ctx.fillText(noteToName(note.pitch), x + 5, y + NOTE_HEIGHT / 2 + 4);
      }
    }

    // === Keyboard ===
    // Background
    ctx.fillStyle = '#0e0e18';
    ctx.fillRect(0, 0, KEYBOARD_WIDTH, size.h);

    for (let n = MIN_NOTE; n <= MAX_NOTE; n++) {
      const y = (MAX_NOTE - n) * NOTE_HEIGHT - sy;
      if (y + NOTE_HEIGHT < 0 || y > size.h) continue;

      const black = isBlackKey(n);

      if (black) {
        // Black key - dark with slight color
        ctx.fillStyle = '#1a1a28';
        ctx.fillRect(0, y, KEYBOARD_WIDTH, NOTE_HEIGHT);
        // Inner darker area to look like a real black key
        ctx.fillStyle = '#111118';
        ctx.beginPath();
        ctx.roundRect(2, y + 2, KEYBOARD_WIDTH - 12, NOTE_HEIGHT - 4, 3);
        ctx.fill();
      } else {
        // White key - lighter
        ctx.fillStyle = '#d8d8e0';
        ctx.fillRect(0, y, KEYBOARD_WIDTH, NOTE_HEIGHT);
        // Subtle 3D effect
        ctx.fillStyle = '#e8e8f0';
        ctx.fillRect(0, y, KEYBOARD_WIDTH - 8, NOTE_HEIGHT - 1);
      }

      // Key border
      ctx.strokeStyle = black ? '#222230' : '#b0b0c0';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y + NOTE_HEIGHT);
      ctx.lineTo(KEYBOARD_WIDTH, y + NOTE_HEIGHT);
      ctx.stroke();

      // Note name on every C, or on black keys
      if (n % 12 === 0) {
        // C notes - show label on white key
        ctx.fillStyle = '#444';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(noteToName(n), 4, y + NOTE_HEIGHT / 2 + 4);
      } else if (black) {
        // Black key label
        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        ctx.fillText(noteToName(n), 4, y + NOTE_HEIGHT / 2 + 3);
      }
    }

    // Divider line
    ctx.strokeStyle = '#444460';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(KEYBOARD_WIDTH, 0);
    ctx.lineTo(KEYBOARD_WIDTH, size.h);
    ctx.stroke();

  }, [size, scroll, notes]);

  // ====== CLICK ======
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const sc = scrollRef.current;
      if (!sc) return;

      const rect = sc.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const sx = scroll.x;
      const sy = scroll.y;

      // Keyboard area → play sound
      if (localX < KEYBOARD_WIDTH) {
        const pitch = MAX_NOTE - Math.floor((localY + sy) / NOTE_HEIGHT);
        if (pitch >= MIN_NOTE && pitch <= MAX_NOTE) {
          synthEngine.init().then(() => {
            synthEngine.previewNote('synth-lead', pitch, 100, 300);
          });
        }
        return;
      }

      // Grid area → add or remove note
      const col = Math.floor((localX - KEYBOARD_WIDTH + sx) / GRID_CELL_WIDTH);
      const pitch = MAX_NOTE - Math.floor((localY + sy) / NOTE_HEIGHT);

      if (pitch < MIN_NOTE || pitch > MAX_NOTE || col < 0 || col >= TOTAL_CELLS) return;

      setNotes(prev => {
        const idx = prev.findIndex(n => n.pitch === pitch && n.col === col);
        if (idx >= 0) {
          // Remove existing
          return prev.filter((_, i) => i !== idx);
        } else {
          // Add new + play sound
          synthEngine.init().then(() => {
            synthEngine.previewNote('synth-lead', pitch, 100, 200);
          });
          return [...prev, { pitch, col }];
        }
      });
    },
    [scroll],
  );

  // Scroll sync
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
        onClick={handleClick}
      >
        <div style={{ width: totalWidth, height: totalHeight }} />
      </div>
    </div>
  );
}
