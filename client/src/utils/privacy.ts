/** Masks an email as "ar***@domain.com", keeping only the first two characters of the local part. */
export function maskEmail(email?: string): string {
  if (!email || !email.includes('@')) {
    return 'us***@intellmeet.com';
  }

  const [username, domain] = email.split('@');
  if (username.length <= 2) {
    return `${username}***@${domain}`;
  }

  const visiblePrefix = username.substring(0, 2);
  return `${visiblePrefix}***@${domain}`;
}
