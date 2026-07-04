import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import HeaderSupportAnyDesk from './HeaderSupportAnyDesk';
import LanguageSwitcher from '../i18n/LanguageSwitcher';

interface HeaderProps {
  title: string;
  actions?: React.ReactNode;
}

function Header({ title, actions }: HeaderProps) {
  const { t } = useTranslation();
  const logoPath = './logo/logo.png';

  return (
    <header className="relative w-full z-30 flex-shrink-0 bg-[#F4F6FA] shadow-sm h-32 overflow-hidden border-b border-black/5">
      {/* 1. Creative Background: Subtle Dot Matrix Pattern */}
      <div
        className="absolute inset-0 opacity-[0.15] pointer-events-none mix-blend-multiply"
        style={{
          backgroundImage: 'radial-gradient(#4A5668 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      {/* 2. Center Spotlight Glow (Static) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-full bg-gradient-to-b from-white via-white/50 to-transparent pointer-events-none blur-xl" />

      {/* 3. Top Tech Line with accent segments */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gray-200 via-[#2EE7C9] to-gray-200 opacity-60" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[2px] bg-[#2EE7C9] shadow-[0_0_15px_rgba(46,231,201,0.6)]" />

      <div className="relative h-full px-8 flex items-center justify-between container mx-auto max-w-[1920px]">

        {/* Left: Titled & Glass Panel Effect */}
        <div className="flex flex-col gap-1 z-10 min-w-0 max-w-[30%] relative py-2 pl-2 border-r-4 border-l-0 border-transparent">
          <h1 className="text-4xl font-extrabold text-[#1A1F25] tracking-tight drop-shadow-sm leading-none">
            {title}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="block h-1.5 w-8 rounded-full bg-[#2EE7C9]" />
            <p className="text-sm font-bold text-[#4A5668] tracking-wide opacity-80">{t('appTagline')}</p>
          </div>
        </div>

        {/* Center: Hero Logo Badge */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center">
          {/* Geometric layered background specific to center */}
          <div className="absolute w-80 h-32 bg-gradient-to-b from-white to-transparent opacity-80 blur-2xl rounded-full" />

          <div className="relative w-44 h-44 flex items-center justify-center mt-4">
            {/* Static Rings */}
            <div className="absolute inset-8 border border-[#2EE7C9]/20 rounded-full" />
            <div className="absolute inset-10 border border-[#2EE7C9]/40 rounded-full border-dashed opacity-50" />

            <img
              src={logoPath}
              alt={t('layout.logoAlt')}
              className="relative w-full h-full object-contain filter drop-shadow-xl"
              style={{ transform: 'scale(1.1)' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* Right: Actions & remote support (AnyDesk) */}
        <div className="flex items-center gap-4 z-10 min-w-0 max-w-[30%] justify-end">
          <div className="flex-shrink-0">
            <LanguageSwitcher />
          </div>
          {actions && (
            <div className="flex-shrink-0 bg-white/60 backdrop-blur-md rounded-xl p-1.5 border border-white shadow-soft">
              {actions}
            </div>
          )}
          <div className="relative hidden sm:block">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#2EE7C9]/20 to-transparent blur-md rounded-lg opacity-50" />
            <div className="relative rounded-xl border border-white/80 bg-white/60 px-3 py-2 shadow-soft backdrop-blur-md">
              <HeaderSupportAnyDesk />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default memo(Header);
