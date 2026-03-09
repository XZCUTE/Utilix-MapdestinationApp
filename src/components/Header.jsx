import { useState } from 'react';
import './Header.css';

export default function Header({
  onSearch,
  onDestinationSearch,
  onAddDestination,
  onRemoveDestination,
  onAnotherRoute,
  onStopAlarms,
  hasRoute,
  hasAlternativeRoutes,
  searchInputRef,
  destinationInputRef,
}) {
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = () => {
    setCollapsed((prev) => !prev);
    // Trigger map resize after animation
    setTimeout(() => window.dispatchEvent(new Event('resize')), 350);
  };

  return (
    <>
      <header className={`app-header${collapsed ? ' collapsed' : ''}`}>
        {/* Logo */}
        <div className="header-logo">
          <div className="logo-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
          </div>
          <span className="logo-text"><span className="logo-accent">U</span>TILIX</span>
        </div>

        {/* Search Inputs */}
        <div className="header-search-area">
          {/* Origin */}
          <div className="search-field">
            <span className="search-field-icon origin-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              ref={searchInputRef}
              id="search-input"
              type="text"
              className="search-input"
              placeholder="Search location..."
              autoComplete="off"
            />
          </div>

          {/* Destination + Route buttons (same row) */}
          <div className="dest-row">
            <div className="search-field dest-field">
              <span className="search-field-icon dest-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
              </span>
              <input
                ref={destinationInputRef}
                id="destination-input"
                type="text"
                className="search-input"
                placeholder="Set destination..."
                autoComplete="off"
              />
            </div>
            <div className="route-btn-group">
              <button className="route-btn btn-primary" onClick={onAddDestination} title="Calculate Route">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>
                </svg>
                <span className="btn-label">Route</span>
              </button>
              {hasAlternativeRoutes && (
                <button className="route-btn btn-secondary" onClick={onAnotherRoute} title="Alternative Route">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  </svg>
                </button>
              )}
              {hasRoute && (
                <button className="route-btn btn-danger" onClick={onRemoveDestination} title="Clear Route">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stop Alarms */}
        <button className="stop-alarms-btn" onClick={onStopAlarms} title="Stop All Alarms">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
          <span className="stop-alarms-label">Stop Alarms</span>
        </button>
      </header>

      {/* Collapse Toggle */}
      <button
        className={`header-toggle${collapsed ? ' collapsed' : ''}`}
        onClick={toggleCollapse}
        title={collapsed ? 'Show header' : 'Hide header'}
        aria-label={collapsed ? 'Show header' : 'Hide header'}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    </>
  );
}
