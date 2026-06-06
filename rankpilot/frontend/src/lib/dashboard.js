/** Format large numbers compactly: 1800 → 1.8k */
export function formatCompact(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function scorePct(score) {
  if (score == null) return null;
  return Math.round(score * 100);
}

export function scoreColor(score) {
  if (score == null) return 'text-slate-500';
  if (score >= 90) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export function rankBadgeClass(rank) {
  if (!rank) return 'bg-slate-800 text-slate-500';
  if (rank <= 3) return 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30';
  if (rank <= 10) return 'bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/30';
  if (rank <= 20) return 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30';
  return 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30';
}
