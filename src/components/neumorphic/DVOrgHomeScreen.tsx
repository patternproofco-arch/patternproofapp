import { NeuCard, NeuCircle } from './NeuCard';
import { ThreadLine } from './ThreadLine';

/**
 * DV Organization Portal Home Screen
 * Font: Nunito (same as survivor — warm, approachable)
 * Sage tint throughout all shadows and surfaces
 */

interface DVOrgHomeProps {
  orgName?: string;
  onNavigate?: (tab: string) => void;
  activities?: Array<{
    id: string;
    title: string;
    subtitle: string;
    color: string;
  }>;
}

const gridCards = [
  { id: 'clients', label: 'Clients', color: '#A8C4A8', icon: 'M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m6-1.13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { id: 'resources', label: 'Resources', color: '#8BB8A0', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4M12 16h.01' },
  { id: 'reports', label: 'Reports', color: '#C4D4B8', icon: 'M3 3v18h18M7 16l4-4 4 4 6-6' },
  { id: 'advocates', label: 'Advocates', color: '#9BB890', icon: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' },
];

const defaultActivities = [
  { id: '1', title: 'New client intake — Sarah K.', subtitle: '2 hours ago', color: '#A8C4A8' },
  { id: '2', title: 'Safety plan updated — Maria L.', subtitle: 'Yesterday', color: '#8BB8A0' },
];

export function DVOrgHomeScreen({ orgName = 'DV Org Portal', onNavigate, activities = defaultActivities }: DVOrgHomeProps) {
  return (
    <div data-portal="dvorg" style={{ padding: '32px 16px 100px', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{orgName}</p>
          <p style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary)', margin: '4px 0 0' }}>NJCEDV</p>
        </div>
        <NeuCircle size={36} style={{ background: '#A8C4A8' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </NeuCircle>
      </div>

      {/* 2x2 Card Grid */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <ThreadLine portal="dvorg" height="100%" style={{ left: '50%', top: '0' }} />
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
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-tertiary)' }}>{card.label}</span>
            </NeuCard>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ position: 'relative' }}>
        <ThreadLine portal="dvorg" height="60px" style={{ left: '50%', top: '-20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>Recent Activity</h2>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--link)' }}>
            view all
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
          {activities.map((activity) => (
            <NeuCard key={activity.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <NeuCircle size={40} style={{ background: activity.color, flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m6-1.13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' />
                </svg>
              </NeuCircle>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>{activity.title}</p>
                <p style={{ fontSize: '12px', fontWeight: 300, color: 'var(--text-muted)', margin: 0 }}>{activity.subtitle}</p>
              </div>
            </NeuCard>
          ))}
        </div>
      </div>
    </div>
  );
}
