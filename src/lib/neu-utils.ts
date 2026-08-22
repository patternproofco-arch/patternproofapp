/**
 * Utility — conditional class names
 * Lightweight cn() helper (no external dep needed)
 */
export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
