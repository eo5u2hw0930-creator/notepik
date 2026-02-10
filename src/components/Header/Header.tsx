import { useDAWStore } from '../../store/useDAWStore';
import './Header.css';

const GRID_OPTIONS = [
  { label: '1박', value: 480 },
  { label: '1/2박', value: 240 },
  { label: '1/4박', value: 120 },
];

export function Header() {
  const projectName = useDAWStore((s) => s.project.name);
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
        <span className="grid-label">노트 길이</span>
        <div className="grid-controls">
          {GRID_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`grid-btn ${gridSubdivision === opt.value ? 'active' : ''}`}
              onClick={() => setGridSubdivision(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="header-right">
        <span className="header-hint">탭 = 추가 / 삭제</span>
      </div>
    </header>
  );
}
