import type { AppMode } from '../app/mode';

interface ModeMenuBarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  hidden?: boolean;
}

const ModeMenuBar = ({ mode, onModeChange, hidden = false }: ModeMenuBarProps) => {
  if (hidden) {
    return null;
  }

  return (
    <div className="mode-menu-bar" role="group" aria-label="CIHOF mode switch">
      <button
        type="button"
        className={`mode-menu-button${mode === 'option1' ? ' mode-menu-button--active' : ''}`}
        onClick={() => onModeChange('option1')}
        aria-pressed={mode === 'option1'}
      >
        Timeline
      </button>
      <button
        type="button"
        className={`mode-menu-button${mode === 'option2' ? ' mode-menu-button--active' : ''}`}
        onClick={() => onModeChange('option2')}
        aria-pressed={mode === 'option2'}
      >
        Explore
      </button>
      <button
        type="button"
        className={`mode-menu-button${mode === 'option3' ? ' mode-menu-button--active' : ''}`}
        onClick={() => onModeChange('option3')}
        aria-pressed={mode === 'option3'}
      >
        Map
      </button>
    </div>
  );
};

export default ModeMenuBar;
