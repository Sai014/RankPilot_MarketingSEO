import { scoreColor, scorePct } from '../../lib/dashboard';

export default function DomainAuditStrip({ domainAudit, summary }) {
  const ssl = domainAudit?.ssl;
  const headers = domainAudit?.security_headers;

  if (!domainAudit && summary?.avg_health_score == null) return null;

  const cards = [
    {
      key: 'health',
      label: 'Avg. Health Score',
      value: summary?.avg_health_score ?? '—',
      sub: summary?.pages_with_audit
        ? `${summary.pages_with_audit} pages audited`
        : 'Audits run after onboarding',
      color: scoreColor((summary?.avg_health_score ?? 0) / 100),
    },
    {
      key: 'ssl',
      label: 'SSL Score',
      value: ssl?.score ?? summary?.ssl_score ?? '—',
      sub: ssl?.tls_version ? `${ssl.tls_version}` : 'Domain certificate check',
      color: scoreColor((ssl?.score ?? summary?.ssl_score ?? 0) / 100),
    },
    {
      key: 'security',
      label: 'Security Headers',
      value: headers?.score ?? summary?.security_score ?? '—',
      sub: headers?.missing?.length
        ? `${headers.missing.length} headers missing`
        : 'HSTS, CSP, X-Frame-Options…',
      color: scoreColor((headers?.score ?? summary?.security_score ?? 0) / 100),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div key={card.key} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{card.label}</p>
          <p className={`text-3xl font-bold mt-2 tabular-nums ${card.color}`}>{card.value}</p>
          <p className="text-xs text-slate-500 mt-2">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}

export function HealthBadge({ score }) {
  const pct = typeof score === 'number' && score > 1 ? Math.round(score) : scorePct(score);
  if (pct == null) {
    return <span className="text-slate-600 text-xs">—</span>;
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800/80 text-xs font-mono font-bold ${scoreColor(pct / 100)}`}>
      {pct}
    </span>
  );
}
