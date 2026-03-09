import { useRef, useCallback } from 'react';

// Beep type configurations
const BEEP_TYPES = {
  beep1: { freq: 800, duration: 200, interval: 300, label: 'Fast Beep (Most Annoying)' },
  beep2: { freq: 600, duration: 300, interval: 500, label: 'Medium Beep' },
  beep3: { freq: 400, duration: 400, interval: 700, label: 'Slow Beep' },
  beep4: { freq: 1000, duration: 100, interval: 200, label: 'Very Fast Beep' },
};

export { BEEP_TYPES };

export function useAudio() {
  const audioCtxRef = useRef(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.error('Web Audio API not supported:', e);
        return null;
      }
    }
    return audioCtxRef.current;
  }, []);

  const createBeep = useCallback((type = 'beep1') => {
    const ctx = getAudioContext();
    if (!ctx) return null;

    const settings = BEEP_TYPES[type] || BEEP_TYPES.beep1;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = 'square';
    oscillator.frequency.value = settings.freq;
    gainNode.gain.value = 0.3;

    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      gainNode.disconnect();
    }, settings.duration);

    return settings;
  }, [getAudioContext]);

  const startRepeatingBeep = useCallback((type = 'beep1') => {
    const settings = createBeep(type);
    if (!settings) return null;

    const interval = setInterval(() => createBeep(type), settings.interval);
    return interval;
  }, [createBeep]);

  const stopBeep = useCallback((interval) => {
    if (interval) clearInterval(interval);
  }, []);

  return { createBeep, startRepeatingBeep, stopBeep };
}
