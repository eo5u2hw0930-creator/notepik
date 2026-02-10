import { useDAWStore } from '../../store/useDAWStore';
import { playbackEngine } from '../../audio/PlaybackEngine';
import './Transport.css';

export function Transport() {
  const bpm = useDAWStore((s) => s.project.bpm);
  const setBpm = useDAWStore((s) => s.setBpm);
  const playback = useDAWStore((s) => s.playback);
  const stopAndReset = useDAWStore((s) => s.stopAndReset);
  const toggleLoop = useDAWStore((s) => s.toggleLoop);
  const ticksPerBeat = useDAWStore((s) => s.project.ticksPerBeat);
  const timeSignature = useDAWStore((s) => s.project.timeSignature);

  const currentBeat = Math.floor(playback.currentTick / ticksPerBeat);
  const bar = Math.floor(currentBeat / timeSignature[0]) + 1;
  const beat = (currentBeat % timeSignature[0]) + 1;

  const handlePlay = () => playbackEngine.toggle();

  const handleStop = () => {
    playbackEngine.stop();
    stopAndReset();
  };

  return (
    <div className="transport">
      <div className="transport-controls">
        <button className="transport-btn" onClick={handleStop} title="Stop">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="3" width="10" height="10" rx="1" />
          </svg>
        </button>

        <button
          className={`transport-btn play-btn ${playback.isPlaying ? 'playing' : ''}`}
          onClick={handlePlay}
          title={playback.isPlaying ? 'Pause' : 'Play'}
        >
          {playback.isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="2" width="3.5" height="12" rx="1" />
              <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2.5v11l9.5-5.5z" />
            </svg>
          )}
        </button>

        <button
          className={`transport-btn loop-btn ${playback.isLooping ? 'active' : ''}`}
          onClick={toggleLoop}
          title="Loop"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 8a4 4 0 0 1 4-4h4.5M14 8a4 4 0 0 1-4 4H5.5" />
            <path d="M11.5 2l2 2-2 2M4.5 14l-2-2 2-2" />
          </svg>
        </button>
      </div>

      <div className="transport-position">
        <span className="position-bar">{bar}</span>
        <span className="position-sep">.</span>
        <span className="position-beat">{beat}</span>
      </div>

      <div className="transport-bpm">
        <button
          className="bpm-adjust"
          onClick={() => setBpm(bpm - 1)}
          onContextMenu={(e) => { e.preventDefault(); setBpm(bpm - 10); }}
        >
          -
        </button>
        <div className="bpm-display">
          <input
            type="number"
            className="bpm-input"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            min={20}
            max={300}
          />
          <span className="bpm-label">BPM</span>
        </div>
        <button
          className="bpm-adjust"
          onClick={() => setBpm(bpm + 1)}
          onContextMenu={(e) => { e.preventDefault(); setBpm(bpm + 10); }}
        >
          +
        </button>
      </div>
    </div>
  );
}
