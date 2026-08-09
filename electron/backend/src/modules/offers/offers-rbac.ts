import { UnauthorizedException } from '../../utils/exceptions';

export type SufraActor = {
  __sufraActor?: true;
  id?: number;
  username?: string;
  role?: string;
};

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
  throw new UnauthorizedException('Only admin or manager can modify offers');
}

export function isOffersManager(actor: SufraActor | null | undefined): boolean {
  return actor?.role === 'admin' || actor?.role === 'manager';
}
