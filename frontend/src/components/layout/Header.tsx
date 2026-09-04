import { memo } from 'react';
import HeaderSupportAnyDesk from './HeaderSupportAnyDesk';
import LanguageSwitcher from '../i18n/LanguageSwitcher';
import BrandMark from './BrandMark';

interface HeaderProps {
  title: string;
  actions?: React.ReactNode;
}

function Header({ title, actions }: HeaderProps) {
  return (
    <header className="relative z-30 w-full flex-shrink-0 border-b border-black/5 bg-[#F4F6FA] shadow-sm">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: 'radial-gradient(#4A5668 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-0.5 bg-[#2EE7C9]" />

      <div className="relative grid h-[4.5rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 xl:h-20 xl:gap-4 xl:px-5">
        <h1 className="min-w-0 truncate text-[17px] font-extrabold leading-none tracking-tight text-[#1A1F25] xl:text-xl">
          {title}
        </h1>

        <BrandMark className="h-12 w-12 xl:h-14 xl:w-14" />

        <div className="flex min-w-0 items-center justify-end gap-2 xl:gap-3">
          <LanguageSwitcher compact />
          {actions}
          <div className="hidden xl:block">
            <HeaderSupportAnyDesk />
          </div>
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
