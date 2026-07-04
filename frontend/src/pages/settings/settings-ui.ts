/**
 * Settings card chrome — Sufra palette, same structural roles as Bazar `settings-ui`.
 */
export const settingsUi = {
  surface: 'flex flex-col overflow-hidden rounded-soft-xl border border-black/5 bg-white shadow-soft',

  surfaceHead: 'flex flex-wrap items-start justify-between gap-3 border-b border-black/5 px-6 py-4',

  surfaceHeadLicense: 'bg-gradient-to-l from-cyber-aqua/15 via-white to-cloud-soft-white',

  surfaceHeadUpdates: 'bg-gradient-to-l from-sky-100/40 via-white to-cyber-aqua/10',

  surfacePad: 'p-6',

  surfaceTitle: 'text-[20px] font-semibold text-obsidian',

  surfaceLede: 'mt-1 text-[14px] font-medium text-obsidian/70',

  label: 'text-[13px] font-medium uppercase tracking-wide text-obsidian/55',

  metaPanel:
    'rounded-soft-lg border border-black/5 bg-cloud-soft-white/80 p-4 shadow-soft',

  ctaPrimary:
    'inline-flex items-center justify-center rounded-full bg-cyber-aqua px-5 py-2.5 text-[14px] font-semibold text-charcoal-graphite shadow-soft transition-colors hover:bg-cyber-aqua/90 disabled:cursor-not-allowed disabled:opacity-50',

  ctaSecondary:
    'inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-2.5 text-[14px] font-semibold text-obsidian shadow-soft transition-colors hover:bg-cloud-soft-white disabled:cursor-not-allowed disabled:opacity-50',

  pageBanner:
    'relative overflow-hidden rounded-soft-xl border border-cyber-aqua/20 bg-gradient-to-br from-cyber-aqua/20 via-white to-cloud-soft-white px-6 py-5 shadow-soft',

  pageBannerTitle: 'text-[22px] font-semibold tracking-tight text-obsidian',

  pageBannerLede: 'mt-1 max-w-2xl text-[15px] font-medium leading-relaxed text-obsidian/75',
};
