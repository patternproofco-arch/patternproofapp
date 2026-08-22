import { useState } from 'react';

interface PinLockProps {
  onUnlock: () => void;
  disguised?: boolean;
}

export function PinLock({ onUnlock, disguised = false }: PinLockProps) {
  const [pin, setPin] = useState<string[]>([]);
  const [error, setError] = useState(false);

  const appName = disguised ? 'Daily Planner' : 'PatternProof';
  const accentColor = disguised ? '#C0C0C8' : 'var(--accent-1)';

  const handlePress = (num: string) => {
    if (pin.length >= 4) return;
    const newPin = [...pin, num];
    setPin(newPin);
    setError(false);

    if (newPin.length === 4) {
      // Verify PIN — replace with Supabase auth check
      setTimeout(() => {
        // For now, any 4-digit PIN unlocks. Replace with actual verification.
        onUnlock();
      }, 200);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        padding: '32px',
      }}
    >
      {/* Lock Icon */}
      <div
        className="neu-circle flex items-center justify-center"
        style={{
          width: '60px',
          height: '60px',
          marginBottom: '24px',
        }}
      >
        {disguised ? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
      </div>

      {/* App Name */}
      <h1
        style={{
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: '32px',
        }}
      >
        {appName}
      </h1>

      {/* PIN Dots */}
      <div className="flex gap-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="neu-small-inset"
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: pin.length > i ? accentColor : 'var(--surface)',
              transition: 'background 200ms ease-out',
            }}
          />
        ))}
      </div>

      {/* Number Pad */}
      <div className="grid grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            onClick={() => handlePress(num)}
            className="neu-circle flex items-center justify-center"
            style={{
              width: '60px',
              height: '60px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              background: 'var(--surface)',
              transition: 'box-shadow 150ms ease-out',
            }}
          >
            {num}
          </button>
        ))}
        <div style={{ width: '60px', height: '60px' }} />
        <button
          onClick={() => handlePress('0')}
          className="neu-circle flex items-center justify-center"
          style={{
            width: '60px',
            height: '60px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            background: 'var(--surface)',
          }}
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="neu-circle flex items-center justify-center"
          style={{
            width: '60px',
            height: '60px',
            border: 'none',
            cursor: 'pointer',
            background: 'var(--surface)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
            <line x1="18" y1="9" x2="12" y2="15" />
            <line x1="12" y1="9" x2="18" y2="15" />
          </svg>
        </button>
      </div>

      {/* Face ID / Biometric */}
      <button
        style={{
          marginTop: '32px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          color: 'var(--link)',
        }}
      >
        Use Face ID
      </button>
    </div>
  );
}
