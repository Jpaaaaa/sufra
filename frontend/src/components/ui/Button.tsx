'use client';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'pos';
  children: React.ReactNode;
  className?: string;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses = 'font-medium disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-cyber-aqua text-charcoal-graphite hover:brightness-105 shadow-soft',
    secondary: 'bg-transparent text-[rgba(255,255,255,0.8)] border border-[rgba(255,255,255,0.15)] hover:border-cyber-aqua hover:text-cyber-aqua',
    ghost: 'bg-transparent text-obsidian border border-black/5 hover:bg-cloud-soft-white hover:border-cyber-aqua',
    outline: 'bg-transparent text-obsidian border border-black/10 hover:border-cyber-aqua/30 hover:bg-cyber-aqua/5',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-[13px] rounded-[8px] leading-normal',
    md: 'px-6 py-3 text-[15px] rounded-[8px] leading-normal',
    lg: 'px-8 py-4 text-[16px] rounded-[8px] leading-normal',
    pos: 'px-8 py-5 text-[18px] rounded-[8px] min-h-[80px] shadow-soft leading-normal',
  };

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

