/**
 * Framework-agnostic JWT extraction from Authorization header.
 * Used by Express LAN server and Fastify LAN server (Phase 1 migration).
 */

export type AuthHeaderActor = {
  __sufraActor: true;
  id?: number;
  username?: string;
  role?: string;
};

function parseJwtPayload(authorization: string | undefined): Record<string, unknown> | null {
  try {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return null;
    }
    const token = authorization.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export function extractUserIdFromAuthHeader(
  authorization: string | undefined,
): number | null {
  const payload = parseJwtPayload(authorization);
  return (payload?.sub as number | undefined) ?? null;
}

/** Decode role/username from Bearer JWT (same payload shape as auth.login). */
export function extractActorFromAuthHeader(
  authorization: string | undefined,
): AuthHeaderActor | null {
  const payload = parseJwtPayload(authorization);
  if (!payload) return null;
  return {
    __sufraActor: true,
    id: typeof payload.sub === 'number' ? payload.sub : Number(payload.sub) || undefined,
    username: typeof payload.username === 'string' ? payload.username : undefined,
    role: typeof payload.role === 'string' ? payload.role : undefined,
  };
}
