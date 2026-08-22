import { useState } from 'react';
import { NeuCard, NeuCircle } from './NeuCard';
import { ThreadLine } from './ThreadLine';

interface ArchiveProps {
  entries?: Array<{
    id: string;
    title: string;
    type: string;
    created_at: string;
  }>;
  onEntryClick?: (id: string) => void;
  onAddEntry?: () => void;
}

const typeConfig: Record<string, { color: string; icon: string }> = {
  log: { color: '#D4C5F0', icon: 'M9 12h6m-6 4h6m-6-8h6M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z' },
  evidence: { color: '#C5E8F0', icon: 'M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z' },
  note: { color: '#C8D9F0', icon: 'M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  voice: { color: '#D0DBF0', icon: 'M19 11a7 7 0 0 1-7 7m0 0a7 7 0 0 1-7-7m7 7v4m0 0H8m4 0h4M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z' },
};

const filterChips = ['All', 'Logs', 'Evidence', 'Notes', 'Voice'];

export function ArchiveScreen({ entries = [], onEntryClick, onAddEntry }: ArchiveProps) {
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered = activeFilter === 'All'
    ? entries
    : entries.filter(e => {
        const map: Record<string, string> = { Logs: 'log', Evidence: 'evidence', Notes: 'note', Voice: 'voice' };
        return e.type === map[activeFilter];
      });

  return (
    <div style={{ padding: '32px 16px 100px', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Archive</h1>
        <NeuCircle size={36} style={{ background: '#D4C5F0' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M4 6h16M7 12h10m-7 6h4" />
          </svg>
        </NeuCircle>
      </div>

      {/* Filter Chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '4px' }}>
        {filterChips.map((chip) => (
          <button
            key={chip}
            onClick={() => setActiveFilter(chip)}
            className={activeFilter === chip ? 'neu-small-inset' : 'neu-small-raised'}
            style={{
              border: 'none',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              color: activeFilter === chip ? 'white' : 'var(--text-tertiary)',
              background: activeFilter === chip ? '#D4C5F0' : 'var(--surface)',
              whiteSpace: 'nowrap',
              transition: 'box-shadow 200ms ease-out',
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Entry List with Thread */}
      <div style={{ position: 'relative' }}>
        <ThreadLine portal="survivor" height="100%" style={{ left: '24px', top: '0' }} />
        {filtered.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
            {filtered.map((entry) => {
              const config = typeConfig[entry.type] || typeConfig.log;
              return (
                <NeuCard
                  key={entry.id}
                  onClick={() => onEntryClick?.(entry.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <NeuCircle size={40} style={{ background: config.color, flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={config.icon} />
                    </svg>
                  </NeuCircle>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>{entry.title}</p>
                    <p style={{ fontSize: '12px', fontWeight: 300, color: 'var(--text-muted)', margin: 0 }}>
                      {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {entry.type}
                    </p>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </NeuCard>
              );
            })}
          </div>
        ) : (
          <NeuCard className="flex flex-col items-center" style={{ padding: '40px 16px', textAlign: 'center' }}>
            <NeuCircle size={48} style={{ marginBottom: '16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
                <path d="M9 12h6m-6 4h6m-6-8h6M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
              </svg>
            </NeuCircle>
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-tertiary)', margin: 0 }}>No Marks yet</p>
            <p style={{ fontSize: '13px', fontWeight: 300, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Tap + to document your first entry
            </p>
          </NeuCard>
        )}
      </div>

      {/* Floating Add Button */}
      <button
        onClick={onAddEntry}
        className="neu-circle"
        style={{
          position: 'fixed',
          bottom: '96px',
          right: '16px',
          width: '56px',
          height: '56px',
          border: 'none',
          cursor: 'pointer',
          background: '#D4C5F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          boxShadow: '4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light)',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
