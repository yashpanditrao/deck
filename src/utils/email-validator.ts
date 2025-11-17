export function isEmailAllowed(
  email: string,
  allowedDomains: string[] = [],
  allowedEmails: string[] = []
): boolean {
  if (!email) return false;

  // Check against allowed emails (case-insensitive)
  if (allowedEmails.some(e => e.toLowerCase() === email.toLowerCase())) {
    return true;
  }

  // Check against allowed domains (case-insensitive)
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain) {
    return allowedDomains.some(d => 
      domain === d.toLowerCase() || 
      domain.endsWith(`.${d.toLowerCase()}`)
    );
  }

  return false;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
