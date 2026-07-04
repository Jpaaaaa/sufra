'use client';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  className?: string;
}

export default function Input({
  label,
  error,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-[14px] font-medium text-obsidian leading-normal">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-white border border-black/5 rounded-[10px] px-4 py-3 text-[15px] text-obsidian focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/10 leading-normal ${error ? 'border-red-300' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-[13px] text-red-600 leading-relaxed">{error}</p>
      )}
    </div>
  );
}

