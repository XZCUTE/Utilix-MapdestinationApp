import './CookieConsent.css';

export default function CookieConsent({ onAccept }) {
  return (
    <div className="consent-overlay">
      <div className="consent-card">
        {/* Icon */}
        <div className="consent-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
        </div>

        {/* Logo */}
        <div className="consent-logo">
          <span className="logo-u">U</span>TILIX MAP
        </div>

        <h1 className="consent-title">Location Access Required</h1>
        <p className="consent-desc">
          Utilix Map needs access to your location and cookies to provide real-time navigation, destination alerts, and save your custom pins across sessions.
        </p>

        <div className="consent-features">
          <div className="consent-feature">
            <span className="feature-dot dot-blue"></span>
            <span>Real-time GPS tracking</span>
          </div>
          <div className="consent-feature">
            <span className="feature-dot dot-green"></span>
            <span>Smart proximity alerts</span>
          </div>
          <div className="consent-feature">
            <span className="feature-dot dot-purple"></span>
            <span>Saved pins & routes</span>
          </div>
        </div>

        <button className="consent-btn" onClick={onAccept}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          Accept & Continue
        </button>

        <p className="consent-legal">
          By continuing, you agree to the use of cookies and location services.
        </p>
      </div>
    </div>
  );
}
