import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), 1700);
    const doneTimer = setTimeout(onDone, 2100);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={fadingOut ? 'splash-fade-out' : ''}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0f',
      }}
    >
      <span
        className="splash-letter"
        style={{
          fontSize: 96,
          fontWeight: 700,
          color: '#3B82F6',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        M
      </span>
    </div>
  );
}
