import type { MediaTitle } from '../data/curatedCatalog';
export function allowedForProfile(item: MediaTitle, maxRating?: string, kids?: boolean): boolean {
  const max = kids ? 10 : maxRating === 'L' ? 0 : Number(maxRating || 18);
  if (max >= 18) return true;
  const rating = String(item.ageRating || '').trim().toUpperCase();
  if (rating === 'L' || rating === 'LIVRE') return true;
  const match = rating.match(/\d+/);
  return !!match && Number(match[0]) <= max;
}
