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

type LocalApiRequest = {
  socket?: { remoteAddress?: string | null };
  headers?: { host?: string; origin?: string; 'sec-fetch-site'?: string };
};

/**
 * DNS rebinding / cross-origin browser protection for the local write API.
 * Loopback alone is not enough: hostile websites can issue browser requests
 * to 127.0.0.1. CLI calls without Origin remain supported, but only from
 * loopback and with a literal loopback Host header.
 */
export function isLocalApiRequest(req: LocalApiRequest): boolean {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) return false;
  const host = req.headers?.host;
  if (!host || !/^(?:localhost|127(?:\\.\\d{1,3}){3}|\\[::1\\]):\\d{1,5}$/i.test(host)) return false;
  const rawPort = host.slice(host.lastIndexOf(':') + 1);
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return false;
  const origin = req.headers?.origin;
  if (origin && origin !== 'http://' + host) return false;
  if (req.headers?.['sec-fetch-site'] === 'cross-site') return false;
  return true;
}
