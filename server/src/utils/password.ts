import { randomInt } from 'node:crypto';

/**
 * Same rules the change-password endpoint enforces, so a generated password can
 * always be replaced by the account holder without the two policies disagreeing.
 */
export const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const PASSWORD_POLICY_MESSAGE =
  'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number and one special character (@$!%*?&)';

export const MIN_PASSWORD_LENGTH = 8;
const GENERATED_PASSWORD_LENGTH = 16;

// Ambiguous glyphs (l/I/O/0/1) are omitted: these passwords get read aloud and retyped.
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '@$!%*?&';

/**
 * Cryptographically random initial password. There is deliberately no shared
 * fallback: a fixed default would give every provisioned account the same
 * credential, which is exactly how a tenant-wide takeover starts.
 */
export const generateTemporaryPassword = (length: number = GENERATED_PASSWORD_LENGTH): string => {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars: string[] = [
    LOWER[randomInt(LOWER.length)],
    UPPER[randomInt(UPPER.length)],
    DIGITS[randomInt(DIGITS.length)],
    SYMBOLS[randomInt(SYMBOLS.length)]
  ];

  while (chars.length < length) {
    chars.push(all[randomInt(all.length)]);
  }

  // shuffle so the guaranteed classes are not in fixed positions
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
};
