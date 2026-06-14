import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import PageSpeedPanel from '../components/PageSpeedPanel';
import TechnicalAuditPanel from '../components/TechnicalAuditPanel';
import { formatCompact, rankBadgeClass } from '../lib/dashboard';

function PageDetail() {
  const { pageId } = useParams();
  const location = useLocation();
  const backPath = location.state?.from || '/dashboard';
  const backLabel = backPath === '/dashboard' ? 'Dashboard' : 'Pages';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDashboard = useCallback(() => {
    if (!pageId) return Promise.resolve();
    setLoading(true);
    setError(null);
    return api
      .getPageDashboard(pageId)
      .then((res) => setData(res.data))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load page');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [pageId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const page = data?.page;
  const serp = data?.serp;
  const gsc = data?.gsc;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-7xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <Link
          to={backPath}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {backLabel}
        </Link>

        {loading ? (
          <p className="text-slate-500">Loading page dashboard…</p>
        ) : error ? (
          <div className="p-4 bg-red-950/50 border border-red-800 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        ) : page ? (
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-brand-400/80 mb-2">
                Page Dashboard
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-white break-words">{page.keyword}</h1>
              <p className="text-slate-400 mt-2 font-mono text-sm">{page.path || '/'}</p>
              <a
                href={page.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-sm text-brand-400 hover:underline"
              >
                {page.url}
              </a>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/50">
                <p className="text-xs text-slate-500">Country</p>
                <p className="text-white mt-1">{page.country || '—'}</p>
              </div>
              {serp?.rank && (
                <div className="px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/50">
                  <p className="text-xs text-slate-500">SERP Position</p>
                  <p className={`mt-1 text-xl font-bold ${rankBadgeClass(serp.rank).split(' ').slice(1).join(' ')}`}>
                    #{serp.rank}
                  </p>
                </div>
              )}
              {gsc?.clicks != null && (
                <div className="px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/50">
                  <p className="text-xs text-slate-500">Clicks</p>
                  <p className="text-white mt-1 tabular-nums">{formatCompact(gsc.clicks)}</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {!loading && !error && page && (
        <div className="space-y-6">
          <PageSpeedPanel
            pageId={page.id}
            domainId={page.domain_id}
            url={page.url}
            pagespeed={data.pagespeed}
            onUpdated={loadDashboard}
          />

          <TechnicalAuditPanel
            audit={data.audit}
            domainAudit={data.domain_audit}
            pagespeed={data.pagespeed}
          />

          {(serp || gsc) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {serp && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">SERP Tracking</h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Keyword</dt>
                      <dd className="text-white text-right">{serp.keyword || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Position</dt>
                      <dd className="text-white tabular-nums">{serp.rank ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Location</dt>
                      <dd className="text-white text-right">{serp.location || '—'}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {gsc && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Search Metrics</h3>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Clicks</dt>
                      <dd className="text-white tabular-nums">{gsc.clicks ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Impressions</dt>
                      <dd className="text-white tabular-nums">
                        {gsc.impressions != null ? formatCompact(gsc.impressions) : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">CTR</dt>
                      <dd className="text-white tabular-nums">
                        {gsc.ctr != null ? `${(gsc.ctr * 100).toFixed(1)}%` : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Leads</dt>
                      <dd className="text-white tabular-nums">{gsc.leads ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PageDetail;
