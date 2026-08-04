export function dispatchRefreshTables(hallId?: number) {
  window.dispatchEvent(
    new CustomEvent('refresh-tables', { detail: { hallId } }),
  );
}

export function dispatchHallsChanged() {
  window.dispatchEvent(new CustomEvent('structure:halls-changed'));
}
