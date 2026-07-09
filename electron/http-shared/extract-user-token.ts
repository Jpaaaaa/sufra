/**
 * Framework-agnostic JWT user-id extraction from Authorization header.
 * Used by Express LAN server and Fastify LAN server (Phase 1 migration).
 */
export function extractUserIdFromAuthHeader(
  authorization: string | undefined,
): number | null {
  try {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return null;
    }
    const token = authorization.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}
