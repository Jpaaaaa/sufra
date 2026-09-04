/** Shared chrome for orders page — compact on tablet, original density on xl+. */
export const ordersSegWrap =
  'flex w-full gap-1 overflow-x-auto scrollbar-hide rounded-soft-xl border border-cyber-aqua/25 bg-white p-1 xl:inline-flex xl:w-auto xl:flex-wrap xl:justify-center xl:border-2 xl:border-cyber-aqua/30 xl:shadow-soft';

export function ordersSegBtn(active: boolean): string {
  return `flex min-h-11 flex-shrink-0 items-center justify-center gap-1.5 rounded-soft-lg px-3 py-2.5 text-[13px] font-bold leading-normal xl:min-h-0 xl:px-6 xl:py-3 xl:text-[15px] ${
    active
      ? 'bg-cyber-aqua text-charcoal-graphite shadow-soft'
      : 'text-obsidian/70 hover:bg-cloud-soft-white hover:text-obsidian'
  }`;
}

export const ordersStickyChrome =
  'sticky top-0 z-20 -mx-3 mb-3 space-y-2 bg-cloud-soft-white/95 px-3 py-2 backdrop-blur-md xl:static xl:mx-0 xl:mb-6 xl:space-y-0 xl:bg-transparent xl:p-0 xl:backdrop-blur-none';
