/** Attach the logged-in POS user so reports can attribute orders to staff. */
export function withOrderCreator<T extends Record<string, unknown>>(
  payload: T,
  user?: { id?: number } | null,
): T & { userId?: number } {
  if (user?.id != null) {
    return { ...payload, userId: user.id };
  }
  return payload;
}
