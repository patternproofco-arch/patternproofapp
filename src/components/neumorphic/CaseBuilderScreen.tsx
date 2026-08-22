import { NeuCard, NeuCircle } from './NeuCard';
import { ThreadLine } from './ThreadLine';

/**
 * Case Builder Screen — FREE and UNGATED for all survivors.
 * Never behind a paywall. Never gate with subscription.
 */

interface CaseBuilderProps {
  caseTitle?: string;
  courtDate?: string;
  progress?: number;
  sections?: Array<{
    id: string;
    title: string;
    color: string;
    count: number;
    items?: Array<{ id: string; title: string; subtitle: string }>;
  }>;
  onExport?: () => void;
  onShare?: () => void;
}

const defaultSections = [
  {
    id: 'timeline',
    title: 'Timeline Events',
    color: '#D4C5F0',
    count: 8,
    items: [
      { id: '1', title: 'Custody exchange — Aug 15', subtitle: '2pm pickup, 30 min late' },
      { id: '2', title: 'Phone call — Aug 14', subtitle: 'Aggressive tone, 12 min' },
    ],
  },
  {
    id: 'evidence',
    title: 'Evidence Files',
    color: '#C5E8F0',
    count: 5,
    items: [
      { id: '1', title: 'Screenshot_0814.png', subtitle: 'Text message evidence' },
    ],
  },
  {
    id: 'communication',
    title: 'Communication Log',
    color: '#C8D9F0',
    count: 12,
    items: [
      { id: '1', title: 'Text exchange — Aug 10', subtitle: '4 messages logged' },
    ],
  },
  {
    id: 'voice',
    title: 'Voice Notes',
    color: '#D0DBF0',
    count: 3,
    items: [
      { id: '1', title: 'Voice memo — Aug 12', subtitle: 'Transcribed, 2 min' },
    ],
  },
];

export function CaseBuilderScreen({
  caseTitle = 'Custody Case — Burns',
  courtDate,
  progress = 65,
  sections = defaultSections,
  onExport,
  onShare,
}: CaseBuilderProps) {
  return (
    <div style={{ padding: '32px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Case</h1>
        <NeuCircle size={36} style={{ background: '#C8D9F0' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
        </NeuCircle>
      </div>

      {/* Case Summary Card */}
      <NeuCard style={{ marginBottom: '24px' }}>
        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{caseTitle}</p>
        {courtDate && (
          <p style={{ fontSize: '13px', fontWeight: 300, color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Next hearing: {courtDate}
          </p>
        )}
        {/* Progress bar */}
        <div
          className="neu-small-inset"
          style={{ height: '6px', borderRadius: '3px', overflow: 'hidden', padding: 0 }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: '#D4C5F0',
              borderRadius: '3px',
              transition: 'width 300ms ease-out',
            }}
          />
        </div>
        <p style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)', margin: '4px 0 0' }}>{progress}% complete</p>
      </NeuCard>

      {/* Evidence Sections with Thread */}
      <div style={{ position: 'relative' }}>
        <ThreadLine portal="survivor" height="100%" style={{ left: '24px', top: '0' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 1 }}>
          {sections.map((section) => (
            <NeuCard key={section.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: section.color }} />
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>{section.title}</span>
                </div>
                <NeuCircle size={24} variant="inset" style={{ background: section.color }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'white' }}>{section.count}</span>
                </NeuCircle>
              </div>
              {section.items && section.items.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {section.items.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="neu-small-inset"
                      style={{ padding: '12px', borderRadius: '12px' }}
                    >
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>{item.title}</p>
                      <p style={{ fontSize: '12px', fontWeight: 300, color: 'var(--text-muted)', margin: 0 }}>{item.subtitle}</p>
                    </div>
                  ))}
                  {section.count > 3 && (
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--link)', padding: '4px 0' }}>
                      show all ({section.count})
                    </button>
                  )}
                </div>
              )}
            </NeuCard>
          ))}
        </div>
      </div>

      {/* Export + Share */}
      <div style={{ marginTop: '24px' }}>
        <button
          onClick={onExport}
          className="neu-raised"
          style={{
            width: '100%',
            padding: '16px',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '12px',
            fontSize: '15px',
            fontWeight: 600,
            color: 'white',
            background: '#D4C5F0',
            transition: 'box-shadow 200ms ease-out',
          }}
        >
          Generate Court Packet (PDF)
        </button>
        <button
          onClick={onShare}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--link)',
            padding: '12px',
          }}
        >
          Share with attorney
        </button>
      </div>
    </div>
  );
}
