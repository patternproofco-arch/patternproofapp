import { NeuCard, NeuCircle } from './NeuCard';
import { ThreadLine } from './ThreadLine';

/**
 * Attorney Portal Home Screen
 * Font: Manrope (set via data-portal="attorney" on parent)
 * Blue tint throughout all shadows and surfaces
 */

interface AttorneyHomeProps {
  firmName?: string;
  onNavigate?: (tab: string) => void;
  matters?: Array<{
    id: string;
    title: string;
    subtitle: string;
    color: string;
  }>;
}

const gridCards = [
  { id: 'cases', label: 'Cases', color: '#A8C4E0', icon: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10' },
  { id: 'clients', label: 'Clients', color: '#B8B8E0', icon: 'M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m6-1.13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { id: 'packets', label: 'Court Packets', color: '#9BB8D0', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8M16 17H8M8 9h2' },
  { id: 'evidence', label: 'Evidence', color: '#8BAFD0', icon: 'M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z' },
];

const defaultMatters = [
  { id: '1', title: 'Custody case — Burns', subtitle: 'Updated 2 hours ago', color: '#A8C4E0' },
  { id: '2', title: 'Restraining order petition', subtitle: '3 items pending', color: '#B8B8E0' },
];

export function AttorneyHomeScreen({ firmName = 'Attorney Portal', onNavigate, matters = defaultMatters }: AttorneyHomeProps) {
  return (
    <div data-portal="attorney" style={{ padding: '32px 16px 100px', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: 'Manrope, sans-serif' }}>
            {firmName}
          </p>
          <p style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary)', margin: '4px 0 0', fontFamily: 'Manrope, sans-serif' }}>
            William Kirby Law
          </p>
        </div>
        <NeuCircle size={36} style={{ background: '#A8C4E0' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </NeuCircle>
      </div>

      {/* 2x2 Card Grid */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <ThreadLine portal="attorney" height="100%" style={{ left: '50%', top: '0' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', position: 'relative', zIndex: 1 }}>
          {gridCards.map((card) => (
            <NeuCard
              key={card.id}
              onClick={() => onNavigate?.(card.id)}
              style={{ minHeight: '120px', padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <NeuCircle size={48} style={{ background: card.color, marginBottom: '12px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={card.icon} />
                </svg>
              </NeuCircle>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-tertiary)', fontFamily: 'Manrope, sans-serif' }}>{card.label}</span>
            </NeuCard>
          ))}
        </div>
      </div>

      {/* Active Matters */}
      <div style={{ position: 'relative' }}>
        <ThreadLine portal="attorney" height="60px" style={{ left: '50%', top: '-20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)', margin: 0, fontFamily: 'Manrope, sans-serif' }}>Active Matters</h2>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--link)', fontFamily: 'Manrope, sans-serif' }}>
            view all
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
          {matters.map((matter) => (
            <NeuCard key={matter.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <NeuCircle size={40} style={{ background: matter.color, flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" />
                </svg>
              </NeuCircle>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0, fontFamily: 'Manrope, sans-serif' }}>{matter.title}</p>
                <p style={{ fontSize: '12px', fontWeight: 300, color: 'var(--text-muted)', margin: 0, fontFamily: 'Manrope, sans-serif' }}>{matter.subtitle}</p>
              </div>
            </NeuCard>
          ))}
        </div>
      </div>
    </div>
  );
}
