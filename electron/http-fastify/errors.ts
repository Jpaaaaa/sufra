import type { FastifyReply } from 'fastify';

export function statusCodeFromError(error: unknown): number {
  const err = error as {
    status?: number;
    statusCode?: number;
    response?: { statusCode?: number };
  };
  return err?.status ?? err?.statusCode ?? err?.response?.statusCode ?? 500;
}

export function messageFromError(error: unknown): string {
  const err = error as { response?: { message?: string }; message?: string };
  return err?.response?.message ?? err?.message ?? 'Internal server error';
}

export function sendRouteError(
  reply: FastifyReply,
  error: unknown,
  routeLabel: string,
): void {
  console.error('[FASTIFY] ========== ROUTE ERROR ==========');
  console.error('[FASTIFY] Route:', routeLabel);
  console.error('[FASTIFY] Error:', error);
  if (error instanceof Error) {
    console.error('[FASTIFY] Stack:', error.stack);
  }
  console.error('[FASTIFY] =================================');

  if (reply.sent) {
    return;
  }

  const statusCode = statusCodeFromError(error);
  reply.status(statusCode).send({
    success: false,
    error: messageFromError(error),
    errorType: error instanceof Error ? error.constructor.name : 'Unknown',
    details:
      process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.stack
        : undefined,
  });
}
