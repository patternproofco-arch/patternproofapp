import { cn } from '../lib/utils';

interface NeuCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'raised' | 'inset' | 'small-raised' | 'small-inset';
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function NeuCard({
  children,
  className = '',
  variant = 'raised',
  onClick,
  style,
}: NeuCardProps) {
  const variantClass = {
    'raised': 'neu-raised',
    'inset': 'neu-inset',
    'small-raised': 'neu-small-raised',
    'small-inset': 'neu-small-inset',
  }[variant];

  return (
    <div
      className={cn(variantClass, 'p-4', onClick && 'cursor-pointer transition-all', className)}
      onClick={onClick}
      style={{
        ...style,
        transition: onClick ? 'box-shadow 200ms ease-out' : undefined,
      }}
    >
      {children}
    </div>
  );
}

interface NeuCircleProps {
  children: React.ReactNode;
  size?: number;
  variant?: 'raised' | 'inset';
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function NeuCircle({
  children,
  size = 48,
  variant = 'raised',
  className = '',
  onClick,
  style,
}: NeuCircleProps) {
  return (
    <div
      className={cn(
        variant === 'raised' ? 'neu-circle' : 'neu-circle-inset',
        'flex items-center justify-center',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
