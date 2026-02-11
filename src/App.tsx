import { useState, useRef, useCallback, useEffect } from 'react';
import { PianoRoll, type NoteData, type ToolType } from './components/PianoRoll/PianoRoll';
import { synthEngine } from './audio/SynthEngine';
import './App.css';

const BPM_DEFAULT = 120;
const CELLS_PER_BEAT = 1;
const BEATS_PER_BAR = 4;

function App() {
  const [tool, setTool] = useState<ToolType>('draw');
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [bpm, setBpm] = useState(BPM_DEFAULT);
  const [playing, setPlaying] = useState(false);
  const [playCol, setPlayCol] = useState(0);
  const playRef = useRef<{ timer: number; col: number } | null>(null);

  // Seconds per cell
  const secPerCell = 60 / bpm / CELLS_PER_BEAT;

  const handlePlay = useCallback(() => {
    if (playing) {
      // Stop
      if (playRef.current) {
        clearInterval(playRef.current.timer);
        playRef.current = null;
      }
      synthEngine.stopAll();
      setPlaying(false);
      return;
    }

    synthEngine.init().then(() => {
      setPlaying(true);
      let col = 0;
      setPlayCol(0);

      const tick = () => {
        // Find notes at this column
        const current = notes.filter(n => n.col <= col && col < n.col + n.len);
        // Only trigger notes that START at this col
        const starting = notes.filter(n => n.col === col);
        void current; // we use starting for sound

        for (const n of starting) {
          const durationMs = n.len * secPerCell * 1000;
          synthEngine.previewNote('synth-lead', n.pitch, 100, durationMs);
        }

        setPlayCol(col);
        col++;

        // Find the last note end
        const maxCol = notes.reduce((m, n) => Math.max(m, n.col + n.len), 0);
        if (col > maxCol + BEATS_PER_BAR) {
          // Stop at end
          clearInterval(playRef.current!.timer);
          playRef.current = null;
          setPlaying(false);
          setPlayCol(0);
        }
      };

      tick(); // Play first immediately
      const timer = window.setInterval(tick, secPerCell * 1000);
      playRef.current = { timer, col: 0 };
    });
  }, [playing, notes, secPerCell]);

  const handleStop = useCallback(() => {
    if (playRef.current) {
      clearInterval(playRef.current.timer);
      playRef.current = null;
    }
    synthEngine.stopAll();
    setPlaying(false);
    setPlayCol(0);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (playRef.current) clearInterval(playRef.current.timer);
    };
  }, []);

  // Position display: bar.beat
  const bar = Math.floor(playCol / BEATS_PER_BAR) + 1;
  const beat = (playCol % BEATS_PER_BAR) + 1;

  return (
    <div className="daw-app">
      {/* Toolbar */}
      <div className="toolbar">
        {/* Transport */}
        <div className="toolbar-group">
          <button className="tb-btn" onClick={handleStop} title="정지">
            <svg viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>
          </button>
          <button
            className={`tb-btn play-btn ${playing ? 'playing' : ''}`}
            onClick={handlePlay}
            title={playing ? '일시정지' : '재생'}
          >
            {playing ? (
              <svg viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>
            ) : (
              <svg viewBox="0 0 16 16"><path d="M4 2v12l10-6z"/></svg>
            )}
          </button>
        </div>

        {/* Position */}
        <span className="toolbar-pos">{bar}.{beat}</span>

        <div className="toolbar-divider" />

        {/* BPM */}
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

        <div className="toolbar-divider" />

        {/* Tools */}
        <div className="toolbar-group">
          <button
            className={`tb-btn ${tool === 'select' ? 'active' : ''}`}
            onClick={() => setTool('select')}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2l4 12 2-5 5-2z"/></svg>
            선택
          </button>
          <button
            className={`tb-btn ${tool === 'draw' ? 'active' : ''}`}
            onClick={() => setTool('draw')}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 14l3-1L13 5l-2-2L3 11z"/><path d="M11 3l2 2"/></svg>
            그리기
          </button>
          <button
            className={`tb-btn ${tool === 'erase' ? 'active' : ''}`}
            onClick={() => setTool('erase')}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 14h12M5 11l6-6 2 2-6 6H5v-2z"/></svg>
            지우기
          </button>
        </div>
      </div>

      {/* Piano Roll */}
      <PianoRoll
        tool={tool}
        notes={notes}
        setNotes={setNotes}
        playCol={playing ? playCol : -1}
      />
    </div>
  );
}

export default App;
