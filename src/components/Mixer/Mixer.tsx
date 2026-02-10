import { useDAWStore } from '../../store/useDAWStore';
import './Mixer.css';

export function Mixer() {
  const tracks = useDAWStore((s) => s.project.tracks);
  const updateTrack = useDAWStore((s) => s.updateTrack);
  const toggleMute = useDAWStore((s) => s.toggleMute);

  return (
    <div className="mixer">
      <div className="mixer-header">
        <span>Mixer</span>
      </div>
      <div className="mixer-channels">
        {tracks.map((track) => (
          <div key={track.id} className="mixer-channel">
            <div className="mixer-fader-container">
              <input
                type="range"
                className="mixer-fader"
                min={0}
                max={1}
                step={0.01}
                value={track.volume}
                onChange={(e) =>
                  updateTrack(track.id, { volume: Number(e.target.value) })
                }
                /* vertical slider handled via CSS */
              />
            </div>
            <div className="mixer-pan-container">
              <input
                type="range"
                className="mixer-pan"
                min={-1}
                max={1}
                step={0.01}
                value={track.pan}
                onChange={(e) =>
                  updateTrack(track.id, { pan: Number(e.target.value) })
                }
              />
            </div>
            <button
              className={`mixer-mute ${track.mute ? 'active' : ''}`}
              onClick={() => toggleMute(track.id)}
            >
              M
            </button>
            <div
              className="mixer-label"
              style={{ borderTopColor: track.color }}
            >
              {track.name.slice(0, 8)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
