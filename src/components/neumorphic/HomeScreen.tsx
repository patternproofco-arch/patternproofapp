import { NeuCard, NeuCircle } from './NeuCard';
import { ThreadLine } from './ThreadLine';
import { APP_NAME } from './AppDisguise';

interface HomeProps {
  userName?: string;
  onNavigate: (tab: string) => void;
  recentItems?: Array<{
    id: string;
    title: string;
    type: string;
    created_at: string;
  }>;
}

const typeConfig: Record<string, { color: string; icon: string }> = {
  log: { color: '#D4C5F0', icon: 'M9 12h6m-6 4h6m-6-8h6M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z' },
  evidence: { color: '#C5E8F0', icon: 'M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z' },
  note: { color: '#C8D9F0', icon: 'M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  voice: { color: '#D0DBF0', icon: 'M19 11a7 7 0 0 1-7 7m0 0a7 7 0 0 1-7-7m7 7v4m0 0H8m4 0h4M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z' },
};

const gridCards = [
  { id: 'archive', label: 'Archive', color: '#D4C5F0', icon: 'M4 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2zM4 7h16M4 7l2-3h12l2 3' },
  { id: 'recurline', label: 'Recurline', color: '#C5E8F0', icon: 'M3 3v18h18M7 16l4-4 4 4 6-6' },
  { id: 'case', label: 'Case', color: '#C8D9F0', icon: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10' },
  { id: 'resources', label: 'Resources', color: '#D0DBF0', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4M12 16h.01' },
];

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

export function HomeScreen({ userName = 'there', onNavigate, recentItems = [] }: HomeProps) {
  return (
    <div style={{ padding: '32px 16px 100px', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <p style={{ fontSize: '20px', fontWeight: 400, color: 'var(--text-tertiary)', margin: 0 }}>Hello,</p>
          <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{userName}</p>
        </div>
        <NeuCircle size={36} variant="raised" style={{ background: '#D4C5F0' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </NeuCircle>
      </div>

      {/* 2x2 Card Grid */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        {/* Thread behind cards */}
        <ThreadLine portal="survivor" height="100%" style={{ left: '50%', top: '0' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', position: 'relative', zIndex: 1 }}>
          {gridCards.map((card) => (
            <NeuCard
              key={card.id}
              onClick={() => onNavigate(card.id)}
              className="flex flex-col items-center"
              style={{ minHeight: '120px', padding: '20px 16px' }}
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

      {/* Recent Section */}
      <div style={{ position: 'relative' }}>
        <ThreadLine portal="survivor" height="60px" style={{ left: '50%', top: '-20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>Recent</h2>
          <button
            onClick={() => onNavigate('archive')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--link)' }}
          >
            view all
          </button>
        </div>

        {/* Recent Items */}
        {recentItems.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
            {recentItems.slice(0, 5).map((item) => {
              const config = typeConfig[item.type] || typeConfig.log;
              return (
                <NeuCard key={item.id} onClick={() => onNavigate('archive')} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <NeuCircle size={40} style={{ background: config.color, flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={config.icon} />
                    </svg>
                  </NeuCircle>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>{item.title}</p>
                    <p style={{ fontSize: '12px', fontWeight: 300, color: 'var(--text-muted)', margin: 0 }}>{timeAgo(item.created_at)}</p>
                  </div>
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
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-tertiary)', margin: 0 }}>No entries yet</p>
            <p style={{ fontSize: '13px', fontWeight: 300, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Your documented entries will appear here
            </p>
          </NeuCard>
        )}
      </div>
    </div>
  );
}
