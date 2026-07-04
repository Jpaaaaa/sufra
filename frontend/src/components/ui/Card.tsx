'use client';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'stats' | 'feature';
  hover?: boolean;
}

export default function Card({
  children,
  className = '',
  variant = 'default',
  hover = false,
}: CardProps) {
  const baseClasses = 'rounded-soft-lg border border-black/5 bg-white shadow-soft';
  
  const variantClasses = {
    default: '',
    stats: 'relative overflow-hidden stats-card',
    feature: 'p-6',
  };

  const hoverClasses = hover ? 'hover:shadow-soft' : '';

  const classes = `${baseClasses} ${variantClasses[variant]} ${hoverClasses} ${className}`;

  return <div className={classes}>{children}</div>;
}

