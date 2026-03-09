import './FloatingControls.css';

export default function FloatingControls({ onCenterLocation }) {
  return (
    <div className="floating-controls">
      {/* My Location Button */}
      <button
        className="fab fab-location"
        onClick={onCenterLocation}
        title="Go to my location"
        aria-label="Center map on my location"
      >
        <span className="fab-ripple" />
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"/>
        </svg>
      </button>
    </div>
  );
}
