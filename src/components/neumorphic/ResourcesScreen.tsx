import { NeuCard, NeuCircle } from './NeuCard';
import { ThreadLine } from './ThreadLine';

/**
 * Resources Screen
 * SAFETY RULE: Must NOT contain any text telling a survivor to leave their abuser.
 * Resources are informational only. Safety planning is about preparation, not directive action.
 */

interface ResourcesProps {
  onResourceClick?: (id: string) => void;
}

const resources = [
  { id: 'courts', title: 'NJ Court Systems Guide', subtitle: 'How NJ family court works', color: '#D4C5F0', icon: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h6M9 13h6' },
  { id: 'opra', title: 'OPRA Helper', subtitle: 'Request public records in NJ', color: '#C5E8F0', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6M16 13H8M16 17H8M8 9h2' },
  { id: 'legal', title: 'Legal Documents', subtitle: 'Templates and guides', color: '#C8D9F0', icon: 'M9 12h6m-6 4h6m-6-8h6M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z' },
  { id: 'safety', title: 'Safety Planning', subtitle: 'Create a safety plan', color: '#D0DBF0', icon: 'M12 2L3 7v6c0 5 4 9 9 9s9-4 9-9V7l-9-5z M9 12l2 2 4-4' },
  { id: 'dvorgs', title: 'DV Organizations', subtitle: 'Find local support', color: '#D4C5F0', icon: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' },
  { id: 'emergency', title: 'Emergency Resources', subtitle: '24/7 hotlines', color: '#C5E8F0', icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' },
];

export function ResourcesScreen({ onResourceClick }: ResourcesProps) {
  return (
    <div style={{ padding: '32px 16px 100px' }}>
      {/* Header */}
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 20px' }}>Resources</h1>

      {/* Emergency Banner */}
      <NeuCard variant="inset" style={{ marginBottom: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          If you're in immediate danger, call 911
        </p>
        <a
          href="tel:18007997233"
          style={{ fontSize: '13px', fontWeight: 400, color: 'var(--link)', textDecoration: 'none' }}
        >
          National DV Hotline: 1-800-799-7233
        </a>
      </NeuCard>

      {/* Resource List with Thread */}
      <div style={{ position: 'relative' }}>
        <ThreadLine portal="survivor" height="100%" style={{ left: '24px', top: '0' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
          {resources.map((res) => (
            <NeuCard
              key={res.id}
              onClick={() => onResourceClick?.(res.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <NeuCircle size={40} style={{ background: res.color, flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={res.icon} />
                </svg>
              </NeuCircle>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>{res.title}</p>
                <p style={{ fontSize: '12px', fontWeight: 300, color: 'var(--text-muted)', margin: 0 }}>{res.subtitle}</p>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </NeuCard>
          ))}
        </div>
      </div>
    </div>
  );
}
