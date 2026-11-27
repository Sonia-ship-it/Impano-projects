import crypto from "crypto";

/**
 * Temporary password every new member starts with. They are forced to replace it on first sign-in,
 * and sign-in also requires a code sent to their own inbox, so knowing it alone is not enough.
 */
export const DEFAULT_USER_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "test@impanoent";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 200) return "Password is too long.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password must include at least one letter and one number.";
  if (password === DEFAULT_USER_PASSWORD) return "Choose a password different from the temporary one.";
  return null;
}
