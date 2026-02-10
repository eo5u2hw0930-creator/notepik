import { useDAWStore } from '../../store/useDAWStore';
import type { InstrumentType } from '../../types';
import './TrackList.css';

const INSTRUMENTS: { id: InstrumentType; label: string }[] = [
  { id: 'synth-lead', label: 'Lead' },
  { id: 'synth-pad', label: 'Pad' },
  { id: 'synth-bass', label: 'Bass' },
  { id: 'synth-pluck', label: 'Pluck' },
  { id: 'drums', label: 'Drums' },
];

export function TrackList() {
  const tracks = useDAWStore((s) => s.project.tracks);
  const selectedTrackId = useDAWStore((s) => s.selectedTrackId);
  const selectTrack = useDAWStore((s) => s.selectTrack);
  const addTrack = useDAWStore((s) => s.addTrack);
  const removeTrack = useDAWStore((s) => s.removeTrack);
  const toggleMute = useDAWStore((s) => s.toggleMute);
  const toggleSolo = useDAWStore((s) => s.toggleSolo);
  const updateTrack = useDAWStore((s) => s.updateTrack);

  return (
    <div className="track-list">
      <div className="track-list-header">
        <span className="track-list-title">Tracks</span>
        <div className="add-track-dropdown">
          <button className="add-track-btn" title="Add Track">+</button>
          <div className="add-track-menu">
            {INSTRUMENTS.map((inst) => (
              <button
                key={inst.id}
                className="add-track-option"
                onClick={() => addTrack(inst.id)}
              >
                {inst.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="track-items">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`track-item ${selectedTrackId === track.id ? 'selected' : ''}`}
            onClick={() => selectTrack(track.id)}
          >
            <div
              className="track-color-bar"
              style={{ background: track.color }}
            />
            <div className="track-info">
              <input
                className="track-name-input"
                value={track.name}
                onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                spellCheck={false}
              />
              <select
                className="track-instrument-select"
                value={track.instrument}
                onChange={(e) => {
                  updateTrack(track.id, {
                    instrument: e.target.value as InstrumentType,
                  });
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {INSTRUMENTS.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="track-controls">
              <button
                className={`track-ctrl-btn mute-btn ${track.mute ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
                title="Mute"
              >
                M
              </button>
              <button
                className={`track-ctrl-btn solo-btn ${track.solo ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleSolo(track.id); }}
                title="Solo"
              >
                S
              </button>
              <input
                type="range"
                className="track-volume"
                min={0}
                max={1}
                step={0.01}
                value={track.volume}
                onChange={(e) => {
                  updateTrack(track.id, { volume: Number(e.target.value) });
                }}
                onClick={(e) => e.stopPropagation()}
                title={`Volume: ${Math.round(track.volume * 100)}%`}
              />
              {tracks.length > 1 && (
                <button
                  className="track-delete-btn"
                  onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
                  title="Delete Track"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
