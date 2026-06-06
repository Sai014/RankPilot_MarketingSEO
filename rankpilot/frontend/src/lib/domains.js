export const TARGET_COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'India',
  'Germany',
  'France',
  'Netherlands',
  'Spain',
  'Italy',
  'Brazil',
  'Mexico',
  'Japan',
  'Singapore',
  'United Arab Emirates',
];

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
}

/** e.g. Jun 4, 2026 */
export function formatShortDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function keywordFromPath(path) {
  if (!path || path === '/') return 'home';
  const slug = path.replace(/^\/+|\/+$/g, '').split('/').pop();
  if (!slug) return 'home';
  return slug.replace(/[-_]/g, ' ').trim();
}

export function domainUrl(domain) {
  if (!domain) return '';
  if (domain.startsWith('http')) return domain;
  return `https://${domain}`;
}
