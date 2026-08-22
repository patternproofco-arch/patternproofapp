import { useState, useEffect } from 'react';

/**
 * SafeReveal — Protective blur with an obvious reveal button.
 * 
 * Design intent: Survivors may be in heightened emotional states.
 * The blur acts as a buffer — content is present but softened,
 * giving the user a moment to breathe before engaging.
 * 
 * Unlike the old implementation (tiny "Show everything" button + Escape key),
 * this uses a large, centered neumorphic button that's clearly visible
 * through the frosted glass. No Escape key dependency (doesn't work on mobile).
 * 
 * The user chooses when they're ready. The app doesn't force content on them.
 */

interface SafeRevealProps {
  children: React.ReactNode;
  blurColor?: string;
  buttonText?: string;
  storageKey?: string;
}

export function SafeReveal({
  children,
  blurColor = 'var(--bg)',
  buttonText = 'Show everything',
  storageKey = 'pp_reveal_session',
}: SafeRevealProps) {
  const [revealed, setRevealed] = useState(false);

  // Reset to blurred state on each navigation (per session)
  useEffect(() => {
    setRevealed(false);
  }, [children]);

  if (revealed) {
    return <>{children}</>;
  }

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100%' }}>
      {/* Blurred content behind */}
      <div
        style={{
          filter: 'blur(8px)',
          opacity: 0.5,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {children}
      </div>

      {/* Frosted overlay with reveal button */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(180deg, ${blurColor}cc, ${blurColor}f0)`,
          zIndex: 50,
        }}
      >
        {/* Breathing icon — gentle, not startling */}
        <div
          className="neu-circle"
          style={{
            width: '64px',
            height: '64px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pp-breathe 3s ease-in-out infinite',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
            <path d="M12 8v8M8 12h8" opacity="0.5" />
          </svg>
        </div>

        <p
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: '8px',
            textAlign: 'center',
          }}
        >
          Take a moment
        </p>
        <p
          style={{
            fontSize: '13px',
            fontWeight: 300,
            color: 'var(--text-muted)',
            marginBottom: '24px',
            textAlign: 'center',
            maxWidth: '240px',
          }}
        >
          Your content is here when you're ready
        </p>

        {/* Large, obvious reveal button */}
        <button
          onClick={() => setRevealed(true)}
          className="neu-raised"
          style={{
            padding: '16px 32px',
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            background: 'var(--surface)',
            transition: 'box-shadow 200ms ease-out',
          }}
        >
          {buttonText}
        </button>
      </div>

      {/* Breathing animation keyframes */}
      <style>{`
        @keyframes pp-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.8; }
        }
        @media (prefers-reduced-motion: reduce) {
          .neu-circle { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
