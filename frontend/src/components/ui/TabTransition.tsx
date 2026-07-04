'use client';

import { ReactNode } from 'react';

interface TabTransitionProps {
  children: ReactNode;
  activeTab: string | number;
  className?: string;
}

export default function TabTransition({ children, activeTab, className = '' }: TabTransitionProps) {
  // NO ANIMATIONS - INSTANT RENDERING ONLY
  return (
    <div className={`tab-content-wrapper ${className}`}>
      <div key={activeTab} className="tab-content">
        {children}
      </div>
    </div>
  );
}

