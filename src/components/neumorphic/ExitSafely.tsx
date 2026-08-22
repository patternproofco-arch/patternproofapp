import { useEffect } from 'react';

/**
 * Exit Safely Button
 * CRITICAL SAFETY FEATURE — NEVER modify without highest review.
 * Instantly redirects to a neutral site. No delay, no confirmation.
 * Works even if page is mid-load. Positioned at App root level.
 */

export function ExitSafely() {
  const handleExit = () => {
    // Instant redirect — no transition, no animation, no delay
    window.location.replace('https://weather.com');
  };

  useEffect(() => {
    // Double-tap Escape also triggers exit
    let lastEscape = 0;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const now = Date.now();
        if (now - lastEscape < 500) {
          handleExit();
        }
        lastEscape = now;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <button
      className="exit-safely neu-circle flex items-center justify-center"
      onClick={handleExit}
      aria-label="Exit"
      style={{
        width: '40px',
        height: '40px',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--text-tertiary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  );
}
