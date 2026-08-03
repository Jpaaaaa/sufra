import { authGetMe } from '../init/backend-loader';
import { extractUserIdFromAuthHeader } from '../http-shared/extract-user-token';

export async function assertAdminAccessToken(accessToken: string): Promise<void> {
  if (!accessToken?.trim()) {
    throw new Error('AUTH_REQUIRED');
  }
  const userId = extractUserIdFromAuthHeader(`Bearer ${accessToken.trim()}`);
  if (!userId) {
    throw new Error('INVALID_TOKEN');
  }
  const me = await authGetMe(userId);
  if (me?.role !== 'admin') {
    throw new Error('ADMIN_REQUIRED');
  }
}
