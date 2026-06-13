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
      <img
        src="/monto_logo.svg"
        alt="Monto"
        className="splash-letter"
        style={{
          width: 200,
          height: 200,
          borderRadius: 24,
          userSelect: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 200,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}
      >
        <div className="splash-loading-bar" />
      </div>
    </div>
  );
}
