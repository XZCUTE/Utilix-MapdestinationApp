import { BEEP_TYPES } from '../hooks/useAudio';
import './PinDetailsPanel.css';

const PIN_COLORS = [
  { value: 'red',    label: 'Red',    hex: '#ff4757' },
  { value: 'blue',   label: 'Blue',   hex: '#4f8eff' },
  { value: 'green',  label: 'Green',  hex: '#2ed573' },
  { value: 'purple', label: 'Purple', hex: '#a855f7' },
  { value: 'orange', label: 'Orange', hex: '#ffa502' },
  { value: 'yellow', label: 'Yellow', hex: '#ffd32a' },
];

export default function PinDetailsPanel({ pin, onSave, onDelete, onClose, onTestSound }) {
  if (!pin) return null;

  const isEditing = !pin.isNew;

  const handleSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    onSave({
      name: fd.get('name').trim(),
      color: fd.get('color'),
      alertDistance: parseInt(fd.get('alertDistance'), 10),
      alertSound: fd.get('alertSound'),
    });
  };

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <aside className="pin-panel">
        {/* Header */}
        <div className="panel-header">
          <div className="panel-title-row">
            <div className="panel-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/>
              </svg>
            </div>
            <h2 className="panel-title">{isEditing ? 'Edit Pin' : 'New Pin'}</h2>
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form className="panel-form" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="form-field">
            <label className="form-label" htmlFor="pin-name">Pin Name</label>
            <input
              id="pin-name"
              name="name"
              type="text"
              className="form-input"
              placeholder="Enter a name..."
              defaultValue={pin.name || ''}
              required
            />
          </div>

          {/* Color Chips */}
          <div className="form-field">
            <label className="form-label">Color</label>
            <div className="color-chips">
              {PIN_COLORS.map((c) => (
                <label key={c.value} className="color-chip-label" title={c.label}>
                  <input
                    type="radio"
                    name="color"
                    value={c.value}
                    defaultChecked={pin.color === c.value || (!pin.color && c.value === 'red')}
                    className="color-chip-input"
                  />
                  <span
                    className="color-chip"
                    style={{ '--chip-color': c.hex }}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Alert Distance */}
          <div className="form-field">
            <label className="form-label" htmlFor="pin-distance">
              Alert Radius
              <span className="form-label-hint">meters</span>
            </label>
            <input
              id="pin-distance"
              name="alertDistance"
              type="number"
              className="form-input"
              min="100"
              step="100"
              defaultValue={pin.alertDistance || 500}
            />
          </div>

          {/* Alert Sound */}
          <div className="form-field">
            <label className="form-label" htmlFor="pin-sound">Alert Sound</label>
            <div className="sound-row">
              <select
                id="pin-sound"
                name="alertSound"
                className="form-input form-select"
                defaultValue={pin.alertSound || 'beep1'}
              >
                {Object.entries(BEEP_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="test-sound-btn"
                onClick={onTestSound}
                title="Test sound"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="panel-actions">
            <button type="submit" className="action-btn btn-save">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              Save Pin
            </button>
            {isEditing && (
              <button type="button" className="action-btn btn-delete" onClick={onDelete}>
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
                Delete
              </button>
            )}
          </div>
        </form>
      </aside>
    </>
  );
}
