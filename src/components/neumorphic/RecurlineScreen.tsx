import { useState } from 'react';
import { NeuCard } from './NeuCard';
import { ThreadLine } from './ThreadLine';

/**
 * Recurline Screen — Neutral Frequency Visualization
 * SAFETY RULE: This screen NEVER labels, names, or diagnoses "patterns of abuse."
 * It shows frequency counts and neutral visual patterns only.
 * Category names are neutral: "Messages", "Calls", "In-Person", "Other".
 * No interpretive text. No "escalation" language. No risk indicators.
 * The human draws conclusions.
 */

interface RecurlineProps {
  categoryData?: Array<{ label: string; percentage: number; color: string }>;
  weeklyData?: number[];
}

const defaultCategories = [
  { label: 'Messages', percentage: 42, color: '#D4C5F0' },
  { label: 'Calls', percentage: 28, color: '#C5E8F0' },
  { label: 'In-Person', percentage: 18, color: '#C8D9F0' },
  { label: 'Other', percentage: 12, color: '#D0DBF0' },
];

const defaultWeekly = [4, 8, 6, 12, 9, 5, 3];
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function RecurlineScreen({ categoryData = defaultCategories, weeklyData = defaultWeekly }: RecurlineProps) {
  const [activeTab, setActiveTab] = useState('Week');

  const maxVal = Math.max(...weeklyData);
  const highlightedIdx = weeklyData.indexOf(maxVal);

  // Ring chart calculations
  const total = categoryData.reduce((sum, c) => sum + c.percentage, 0);
  const ringRadius = [80, 64, 48];
  const ringCircumference = ringRadius.map(r => 2 * Math.PI * r);

  return (
    <div style={{ padding: '32px 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Recurline</h1>
        <div style={{ width: '24px' }} />
      </div>

      <div style={{ position: 'relative' }}>
        <ThreadLine portal="survivor" height="100%" style={{ left: '50%', top: '0' }} />

        {/* Progress Section */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: '32px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '16px' }}>Progress</h2>

          {/* Concentric Ring Chart */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <svg width="200" height="200" viewBox="0 0 200 200">
              {categoryData.slice(0, 3).map((cat, i) => {
                const radius = ringRadius[i];
                const circumference = ringCircumference[i];
                const fillLength = (cat.percentage / total) * circumference;
                return (
                  <g key={i}>
                    {/* Background track */}
                    <circle
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="none"
                      stroke={cat.color}
                      strokeWidth="12"
                      opacity="0.15"
                    />
                    {/* Filled arc */}
                    <circle
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="none"
                      stroke={cat.color}
                      strokeWidth="12"
                      strokeDasharray={`${fillLength} ${circumference}`}
                      strokeDashoffset={circumference / 4}
                      strokeLinecap="round"
                      transform="rotate(-90 100 100)"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {categoryData.map((cat, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', margin: 0 }}>
                    {cat.label}
                  </p>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{cat.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time Management Section */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px' }}>Time management</h2>

          {/* Tab Pills */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            {['Day', 'Week', 'Month', 'Year'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 400,
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                  paddingBottom: '4px',
                  borderBottom: activeTab === tab ? '2px solid #D4C5F0' : 'none',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Line Graph */}
          <NeuCard style={{ padding: '24px 16px 16px' }}>
            <svg width="100%" height="140" viewBox="0 0 300 140" preserveAspectRatio="none">
              {/* Faint horizontal line */}
              <line x1="0" y1="120" x2="300" y2="120" stroke="var(--shadow-dark)" strokeWidth="1" opacity="0.3" />

              {/* Smooth curve path */}
              <path
                d={`M ${weeklyData.map((val, i) => {
                  const x = (i / (weeklyData.length - 1)) * 280 + 10;
                  const y = 120 - (val / maxVal) * 90;
                  return `${x},${y}`;
                }).join(' L ')}`}
                fill="none"
                stroke="#D4C5F0"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points */}
              {weeklyData.map((val, i) => {
                const x = (i / (weeklyData.length - 1)) * 280 + 10;
                const y = 120 - (val / maxVal) * 90;
                const isHighlighted = i === highlightedIdx;
                return (
                  <g key={i}>
                    {isHighlighted && (
                      <>
                        {/* Tooltip card */}
                        <rect x={x - 40} y={y - 40} width="80" height="28" rx="12" fill="white" stroke="none" />
                        <text x={x} y={y - 22} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text-primary)">
                          {val} contacts
                        </text>
                      </>
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHighlighted ? 5 : 3}
                      fill={isHighlighted ? '#D4C5F0' : 'white'}
                      stroke="#D4C5F0"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}

              {/* X-axis labels */}
              {days.map((day, i) => {
                const x = (i / (days.length - 1)) * 280 + 10;
                return (
                  <text key={i} x={x} y={138} textAnchor="middle" fontSize="11" fontWeight="300" fill="var(--text-muted)">
                    {day}
                  </text>
                );
              })}
            </svg>
          </NeuCard>
        </div>
      </div>
    </div>
  );
}
