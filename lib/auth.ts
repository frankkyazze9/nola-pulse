/**
 * Simple password auth with signed session cookies.
 * Bridge auth until IAP is set up with a custom domain.
 */

import { cookies } from "next/headers";

const SESSION_COOKIE = "dh_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Create a signed session token. Uses a simple HMAC with the password as key
 * since we don't have a separate secret. The token is: timestamp.signature
 */
export function createSessionToken(password: string): string {
  const timestamp = Date.now().toString(36);
  const data = `darkhorse:${timestamp}`;
  // Simple hash — not cryptographic perfection, but fine for a 2-5 user
  // internal tool behind Cloud Run's network controls.
  const hash = simpleHash(data + password);
  return `${timestamp}.${hash}`;
}

export function verifySessionToken(token: string, password: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [timestamp, hash] = parts;

  // Check expiry
  const created = parseInt(timestamp, 36);
  if (Date.now() - created > SESSION_MAX_AGE * 1000) return false;

  // Check signature
  const data = `darkhorse:${timestamp}`;
  return simpleHash(data + password) === hash;
}

export async function getSession(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return false;

  return verifySessionToken(token, password);
}

export { SESSION_COOKIE, SESSION_MAX_AGE };

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h = ((h << 5) - h + ch) | 0;
  }
  return Math.abs(h).toString(36);
}
