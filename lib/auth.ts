import { timingSafeEqual } from "node:crypto";

export function bearerAuthorised(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(authorization ?? "");

  if (expected.length !== provided.length) {
    timingSafeEqual(expected, expected);
    return false;
  }

  return timingSafeEqual(expected, provided);
}
