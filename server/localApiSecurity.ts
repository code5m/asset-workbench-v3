/**
 * Security boundary for the Local Asset API.
 *
 * The Asset Runtime is intentionally local-only. Vite's host binding is not a
 * sufficient trust boundary by itself, so every /api request is independently
 * checked against the peer address before any filesystem/provider operation.
 */

export const MAX_API_BODY_BYTES = 1024 * 1024;

export function isLoopbackAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  if (address === '::1') return true;

  const normalized = address.toLowerCase();
  const ipv4 = normalized.startsWith('::ffff:') ? normalized.slice('::ffff:'.length) : normalized;
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ipv4);
  if (!match) return false;

  const octets = match.slice(1).map(Number);
  if (octets.some((value) => value < 0 || value > 255)) return false;
  return octets[0] === 127;
}

export function isLocalApiRequest(req: { socket?: { remoteAddress?: string | null } }): boolean {
  return isLoopbackAddress(req.socket?.remoteAddress);
}
