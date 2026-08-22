interface ThreadLineProps {
  portal?: 'survivor' | 'attorney' | 'dvorg';
  height?: string;
  className?: string;
  style?: React.CSSProperties;
}

const gradients: Record<string, string> = {
  survivor: 'linear-gradient(180deg, #D4C5F0, #C5E8F0)',
  attorney: 'linear-gradient(180deg, #A8C4E0, #7B9FCC)',
  dvorg: 'linear-gradient(180deg, #A8C4A8, #8BB8A0)',
};

export function ThreadLine({
  portal = 'survivor',
  height = '100%',
  className = '',
  style,
}: ThreadLineProps) {
  return (
    <div
      className={`thread-line ${className}`}
      style={{
        background: gradients[portal],
        height,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}
