'use client';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'info';
  className?: string;
}

export default function Badge({
  children,
  variant = 'default',
  className = '',
}: BadgeProps) {
  const baseClasses = 'inline-flex items-center px-3 py-1 rounded-[8px] text-[13px] font-medium leading-normal';
  
  const variantClasses = {
    default: 'bg-cloud-soft-white text-obsidian border border-black/5',
    success: 'bg-cyber-aqua/10 text-cyber-aqua border border-cyber-aqua/20',
    warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    info: 'bg-pulse-violet/10 text-pulse-violet border border-pulse-violet/20',
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${className}`;

  return <span className={classes}>{children}</span>;
}

