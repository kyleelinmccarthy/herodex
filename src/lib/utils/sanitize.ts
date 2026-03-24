const MAX_LENGTH = 10_000;

export function sanitizeText(input: string, maxLength = MAX_LENGTH): string {
  return input
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .trim()
    .slice(0, maxLength);
}

export function sanitizeName(input: string): string {
  return sanitizeText(input, 100);
}

export function sanitizeEmail(input: string): string {
  return input.trim().toLowerCase().slice(0, 254);
}
