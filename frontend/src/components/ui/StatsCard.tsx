'use client';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export default function StatsCard({
  title,
  value,
  icon,
  trend,
  className = '',
}: StatsCardProps) {
  return (
    <div className={`stats-card p-6 ${className}`}>
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] font-light text-obsidian/60 mb-1 leading-relaxed">{title}</p>
          <p className="text-[28px] font-bold text-obsidian mb-2 leading-tight">{value}</p>
          {trend && (
            <p className={`text-[13px] font-medium leading-relaxed ${
              trend.isPositive ? 'text-cyber-aqua' : 'text-red-600'
            }`}>
              {trend.isPositive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex items-center justify-center w-12 h-12 rounded-soft-lg bg-cyber-aqua/10 text-cyber-aqua">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

