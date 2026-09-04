/**
 * Home dashboard visual tokens — Sufra mint/teal identity, POS density.
 */
export const homeUi = {
  page: 'mx-auto max-w-7xl space-y-4',

  surface:
    'rounded-xl border border-black/[0.06] bg-white shadow-soft',

  surfacePad: 'p-4 md:p-5',

  sectionTitle:
    'text-[15px] font-semibold tracking-tight text-obsidian',

  sectionMeta:
    'text-[12px] font-medium text-obsidian/45',

  chip:
    'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold',

  chipOk:
    'border-cyber-aqua/25 bg-cyber-aqua/10 text-charcoal-graphite',

  chipMuted:
    'border-black/5 bg-cloud-soft-white text-obsidian/55',

  chipDanger:
    'border-red-200 bg-red-50 text-red-700',

  iconWell:
    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-cyber-aqua/12 text-cyber-aqua',

  emptyState:
    'flex flex-col items-center justify-center gap-1 py-10 text-center',

  emptyTitle: 'text-[13px] font-medium text-obsidian/50',

  rowHover: 'hover:bg-[#F7F9FC]',

  statusPending: 'border-amber-200/80 bg-amber-50 text-amber-800',
  statusPrinted: 'border-cyber-aqua/25 bg-cyber-aqua/10 text-charcoal-graphite',
  statusCompleted: 'border-emerald-200/80 bg-emerald-50 text-emerald-800',
  statusCancelled: 'border-red-200/80 bg-red-50 text-red-700',
} as const;
