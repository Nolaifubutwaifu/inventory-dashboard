export const SESSION_COOKIE = "brisbins_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

const SESSION_PAYLOAD = "brisbins-dashboard-v1";

const OPEN_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/inventory/update",
  "/api/sales/update",
  "/api/history/update",
]);

export function isOpenPath(pathname: string): boolean {
  return OPEN_PATHS.has(pathname);
}

export function safeNextPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}

export function passwordsMatch(provided: string, expected: string): boolean {
  return timingSafeEqualString(provided, expected);
}

export async function signSession(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(SESSION_PAYLOAD),
  );
  return bufferToHex(signature);
}

export async function sessionMatches(
  cookie: string | undefined,
  password: string,
): Promise<boolean> {
  if (!cookie || !password) return false;
  const expected = await signSession(password);
  return timingSafeEqualString(cookie, expected);
}

function timingSafeEqualString(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
