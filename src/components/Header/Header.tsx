import { useDAWStore } from '../../store/useDAWStore';
import type { Tool } from '../../types';
import './Header.css';

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '⊹' },
  { id: 'draw', label: 'Draw', icon: '✎' },
  { id: 'erase', label: 'Erase', icon: '✕' },
];

const GRID_OPTIONS = [
  { label: '1/1', value: 1920 },
  { label: '1/2', value: 960 },
  { label: '1/4', value: 480 },
  { label: '1/8', value: 240 },
  { label: '1/16', value: 120 },
  { label: '1/32', value: 60 },
];

export function Header() {
  const projectName = useDAWStore((s) => s.project.name);
  const currentTool = useDAWStore((s) => s.currentTool);
  const setTool = useDAWStore((s) => s.setTool);
  const snapToGrid = useDAWStore((s) => s.snapToGrid);
  const setSnapToGrid = useDAWStore((s) => s.setSnapToGrid);
  const gridSubdivision = useDAWStore((s) => s.gridSubdivision);
  const setGridSubdivision = useDAWStore((s) => s.setGridSubdivision);
  const setProjectName = useDAWStore((s) => s.setProjectName);

  return (
    <header className="daw-header">
      <div className="header-left">
        <span className="logo">notepik</span>
        <input
          className="project-name-input"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="header-center">
        <div className="tool-group">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              className={`tool-btn ${currentTool === tool.id ? 'active' : ''}`}
              onClick={() => setTool(tool.id)}
              title={tool.label}
            >
              <span className="tool-icon">{tool.icon}</span>
              <span className="tool-label">{tool.label}</span>
            </button>
          ))}
        </div>

        <div className="grid-controls">
          <button
            className={`snap-btn ${snapToGrid ? 'active' : ''}`}
            onClick={() => setSnapToGrid(!snapToGrid)}
            title="Snap to Grid"
          >
            Grid
          </button>
          <select
            className="grid-select"
            value={gridSubdivision}
            onChange={(e) => setGridSubdivision(Number(e.target.value))}
          >
            {GRID_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="header-right">
        <span className="header-hint">Tablet DAW</span>
      </div>
    </header>
  );
}
