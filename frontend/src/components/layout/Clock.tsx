'use client';

import { useEffect, useRef, memo } from 'react';

function Clock() {
  const timeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTime = () => {
      if (timeRef.current) {
        const now = new Date();

        // Format time in English with 12-hour format
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        const timeString = `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;

        // Format date in English with day name and numeric month/day/year
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        const dayName = days[now.getDay()];
        const month = now.getMonth() + 1; // Month is 0-indexed, so add 1
        const day = now.getDate();
        const year = now.getFullYear();

        const dateString = `${dayName}, ${month}/${day}/${year}`;

        timeRef.current.innerHTML = `
          <div class="text-[16px] leading-normal font-bold text-obsidian">${timeString}</div>
          <div class="text-[13px] leading-relaxed font-light text-obsidian/60">${dateString}</div>
        `;
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      ref={timeRef}
      className="flex flex-col items-end rounded-soft-lg border border-black/5 bg-white/60 px-4 py-2 backdrop-blur-sm shadow-soft whitespace-nowrap"
    />
  );
}

export default memo(Clock);

