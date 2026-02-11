import { useState, useRef, useCallback, useEffect } from 'react';
import { PianoRoll, type NoteData, type ToolType } from './components/PianoRoll/PianoRoll';
import { synthEngine } from './audio/SynthEngine';
import type { InstrumentType } from './types';
import './App.css';

const BPM_DEFAULT = 120;
const CELLS_PER_BEAT = 1;
const BEATS_PER_BAR = 4;

const PRESETS: { id: InstrumentType; label: string }[] = [
  { id: 'synth-lead', label: '리드' },
  { id: 'synth-pad', label: '패드' },
  { id: 'synth-bass', label: '베이스' },
  { id: 'synth-pluck', label: '플럭' },
  { id: 'drums', label: '드럼' },
];

function App() {
  const [tool, setTool] = useState<ToolType>('draw');
  const [instrument, setInstrument] = useState<InstrumentType>('synth-lead');
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [bpm, setBpm] = useState(BPM_DEFAULT);
  const [playing, setPlaying] = useState(false);
  const [playCol, setPlayCol] = useState(-1);

  // Refs for RAF-based playback
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const playbackRef = useRef<{
    startTime: number;
    lastTriggeredCol: number;
    maxCol: number;
    rafId: number;
  } | null>(null);

  const secPerCell = 60 / bpm / CELLS_PER_BEAT;
  const secPerCellRef = useRef(secPerCell);
  secPerCellRef.current = secPerCell;

  const stopPlayback = useCallback(() => {
    if (playbackRef.current) {
      cancelAnimationFrame(playbackRef.current.rafId);
      playbackRef.current = null;
    }
    synthEngine.stopAll();
    setPlaying(false);
  }, []);

  const handlePlay = useCallback(() => {
    if (playing) {
      stopPlayback();
      return;
    }

    synthEngine.init().then(() => {
      setPlaying(true);
      const maxCol = notesRef.current.reduce((m, n) => Math.max(m, n.col + n.len), 0);

      const state = {
        startTime: performance.now(),
        lastTriggeredCol: -1,
        maxCol: Math.max(maxCol, 1),
        rafId: 0,
      };
      playbackRef.current = state;

      const tick = (now: number) => {
        const elapsed = (now - state.startTime) / 1000;
        const currentCol = elapsed / secPerCellRef.current;

        // Trigger notes for columns we've crossed
        const intCol = Math.floor(currentCol);
        while (state.lastTriggeredCol < intCol) {
          state.lastTriggeredCol++;
          const col = state.lastTriggeredCol;
          const starting = notesRef.current.filter(n => n.col === col);
          for (const n of starting) {
            const durationMs = n.len * secPerCellRef.current * 1000;
            synthEngine.previewNote(n.instrument, n.pitch, 100, durationMs);
          }
        }

        setPlayCol(currentCol);

        if (currentCol > state.maxCol + BEATS_PER_BAR) {
          playbackRef.current = null;
          setPlaying(false);
          setPlayCol(-1);
          return;
        }

        state.rafId = requestAnimationFrame(tick);
      };

      state.rafId = requestAnimationFrame(tick);
    });
  }, [playing, stopPlayback]);

  const handleStop = useCallback(() => {
    stopPlayback();
    // Keep playCol where it is (cursor visible at stop position)
  }, [stopPlayback]);

  const handleRewind = useCallback(() => {
    stopPlayback();
    setPlayCol(-1);
  }, [stopPlayback]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlePlay();
          break;
        case 'Digit1':
          setTool('select');
          break;
        case 'Digit2':
          setTool('draw');
          break;
        case 'Digit3':
          setTool('erase');
          break;
        case 'Home':
          e.preventDefault();
          handleRewind();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePlay, handleRewind]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (playbackRef.current) cancelAnimationFrame(playbackRef.current.rafId);
    };
  }, []);

  // Position display: bar.beat
  const displayCol = Math.max(0, playCol >= 0 ? Math.floor(playCol) : 0);
  const bar = Math.floor(displayCol / BEATS_PER_BAR) + 1;
  const beat = (displayCol % BEATS_PER_BAR) + 1;

  return (
    <div className="daw-app">
      <div className="toolbar">
        {/* Left: Preset + Tools */}
        <div className="toolbar-left">
          <select
            className="preset-select"
            value={instrument}
            onChange={e => setInstrument(e.target.value as InstrumentType)}
          >
            {PRESETS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              className={`tb-btn ${tool === 'select' ? 'active' : ''}`}
              onClick={() => setTool('select')}
              title="선택 (1)"
            >
              <svg viewBox="0 0 16 16"><path d="M4 1v12l3-3h5z"/></svg>
            </button>
            <button
              className={`tb-btn ${tool === 'draw' ? 'active' : ''}`}
              onClick={() => setTool('draw')}
              title="그리기 (2)"
            >
              <svg viewBox="0 0 16 16"><path d="M11 2l3 3-8 8H3v-3z"/></svg>
            </button>
            <button
              className={`tb-btn ${tool === 'erase' ? 'active' : ''}`}
              onClick={() => setTool('erase')}
              title="지우기 (3)"
            >
              <svg viewBox="0 0 16 16"><path d="M7 3l6 6-3 3H5L2 9z"/><rect x="1" y="14" width="14" height="1.5" rx=".5"/></svg>
            </button>
          </div>
        </div>

        {/* Center: Transport */}
        <div className="toolbar-center">
          <button className="tb-btn" onClick={handleRewind} title="처음으로 (Home)">
            <svg viewBox="0 0 16 16"><rect x="2" y="3" width="2" height="10"/><path d="M6 8l7-5v10z"/></svg>
          </button>
          <button className="tb-btn" onClick={handleStop} title="정지">
            <svg viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>
          </button>
          <button
            className={`tb-btn play-btn ${playing ? 'playing' : ''}`}
            onClick={handlePlay}
            title={playing ? '일시정지 (Space)' : '재생 (Space)'}
          >
            {playing ? (
              <svg viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>
            ) : (
              <svg viewBox="0 0 16 16"><path d="M4 2v12l10-6z"/></svg>
            )}
          </button>
          <span className="toolbar-pos">{bar}.{beat}</span>
        </div>

        {/* Right: BPM */}
        <div className="toolbar-right">
          <div className="toolbar-bpm">
            <input
              type="number"
              className="bpm-input"
              value={bpm}
              min={40}
              max={300}
              onChange={e => setBpm(Math.max(40, Math.min(300, Number(e.target.value))))}
            />
            <span>BPM</span>
          </div>
        </div>
      </div>

      <PianoRoll
        tool={tool}
        instrument={instrument}
        notes={notes}
        setNotes={setNotes}
        playCol={playCol}
      />
    </div>
  );
}

export default App;
