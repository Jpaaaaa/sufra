export function serializeOptionsJson(options: unknown): string | null {
  if (options == null) return null;
  if (typeof options === 'string') return options;
  if (Array.isArray(options) && options.length === 0) return null;
  return JSON.stringify(options);
}

export function parseOptionsJsonField(raw: string | null | undefined): unknown[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function mapOrderItemRow<T extends Record<string, unknown>>(row: T) {
  return {
    ...row,
    options_json: parseOptionsJsonField(row.options_json as string | undefined),
  };
}
