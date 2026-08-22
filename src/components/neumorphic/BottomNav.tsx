import { useState } from 'react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'home', label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V10' },
  { id: 'archive', label: 'Archive', icon: 'M4 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2zM4 7h16M4 7l2-3h12l2 3' },
  { id: 'recurline', label: 'Recurline', icon: 'M3 3v18h18M7 16l4-4 4 4 6-6' },
  { id: 'case', label: 'Case', icon: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10' },
  { id: 'resources', label: 'Resources', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4M12 16h.01' },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div
      className="neu-pill fixed bottom-4 left-4 right-4 flex items-center justify-around"
      style={{
        padding: '12px 16px',
        zIndex: 100,
        maxWidth: 'calc(480px - 32px)',
        margin: '0 auto',
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className="flex flex-col items-center justify-center"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
          aria-label={tab.label}
        >
          <div
            className={activeTab === tab.id ? 'neu-circle-inset' : ''}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'box-shadow 200ms ease-out',
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke={activeTab === tab.id ? 'var(--accent-1)' : 'var(--text-muted)'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={tab.icon} />
            </svg>
          </div>
          {activeTab === tab.id && (
            <div
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: 'var(--accent-1)',
                marginTop: '4px',
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
