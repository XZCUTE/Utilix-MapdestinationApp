import { useState, useEffect } from 'react';
import { getCookie, setCookie } from './utils/cookies';
import CookieConsent from './components/CookieConsent';
import MapApp from './components/MapApp';
import './index.css';

export default function App() {
  const [consented, setConsented] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const alreadyConsented = getCookie('utilixMapConsent') === 'accepted';
    setConsented(alreadyConsented);
    setChecking(false);
  }, []);

  const handleAccept = () => {
    setCookie('utilixMapConsent', 'accepted', 365);
    setConsented(true);
  };

  if (checking) return null;

  return (
    <>
      {!consented && <CookieConsent onAccept={handleAccept} />}
      {consented && <MapApp />}
    </>
  );
}
