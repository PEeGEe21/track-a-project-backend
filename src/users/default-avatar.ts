import { createHash } from 'crypto';

const DICEBEAR_API_VERSION = '10.x';
const DEFAULT_STYLE = 'shapes';

export function buildDefaultAvatarUrl(identity: string): string {
  const seed = createHash('sha256')
    .update(`tailpoint-avatar:${identity.trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 32);
  const style = process.env.DICEBEAR_AVATAR_STYLE?.trim() || DEFAULT_STYLE;
  const baseUrl =
    process.env.DICEBEAR_API_URL?.replace(/\/$/, '') ||
    'https://api.dicebear.com';

  return `${baseUrl}/${DICEBEAR_API_VERSION}/${encodeURIComponent(
    style,
  )}/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}
