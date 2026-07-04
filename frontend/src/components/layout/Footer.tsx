'use client';

import { memo } from 'react';

function Footer() {
  return (
    <footer className="glass-matte flex h-12 items-center border-t border-black/5 px-6 text-[13px] font-normal text-graphite leading-relaxed">
      <div className="flex w-full items-center justify-between">
        <span className="font-medium text-obsidian">© {new Date().getFullYear()} Sufra Lite</span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-cyber-aqua" />
          الإصدار 1.0.0 · يعمل بدون اتصال
        </span>
      </div>
    </footer>
  );
}

export default memo(Footer);


