/**
 * Offers mutate RBAC helpers for Electron IPC / HTTP layers.
 * Lives under shared/ so it compiles into dist (not backend/src).
 */

export type SufraActor = {
  __sufraActor?: true;
  id?: number;
  username?: string;
  role?: string;
};

class OffersUnauthorizedError extends Error {
  readonly status = 401;

  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedException';
  }
}

export function stripActorArgs<T extends unknown[]>(args: T): {
  clean: unknown[];
  actor: SufraActor | null;
} {
  if (!args.length) return { clean: [], actor: null };
  const last = args[args.length - 1] as SufraActor;
  if (last && typeof last === 'object' && last.__sufraActor === true) {
    return { clean: args.slice(0, -1), actor: last };
  }
  return { clean: [...args], actor: null };
}

export function requireOffersManager(actor: SufraActor | null | undefined): SufraActor {
  const role = actor?.role;
  if (role === 'admin' || role === 'manager') {
    return actor!;
  }
  throw new OffersUnauthorizedError('Only admin or manager can modify offers');
}

export function isOffersManager(actor: SufraActor | null | undefined): boolean {
  return actor?.role === 'admin' || actor?.role === 'manager';
}
