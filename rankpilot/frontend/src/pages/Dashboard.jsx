import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import CoveragePanel from '../components/dashboard/CoveragePanel';
import KeywordRankingsTable from '../components/dashboard/KeywordRankingsTable';
import KpiStrip from '../components/dashboard/KpiStrip';
import RankDistributionChart from '../components/dashboard/RankDistributionChart';
import DomainSelector, { useSelectedDomain } from '../components/DomainSelector';
import NoDomainPrompt from '../components/NoDomainPrompt';

function Dashboard() {
  const { domainId, setDomainId, loading: domainsLoading, hasDomains, domains } = useSelectedDomain();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const selectedDomain = domains.find((d) => d.id === domainId);

  useEffect(() => {
    if (!domainId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .getDashboard(domainId)
      .then((res) => setData(res.data))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [domainId]);

  useEffect(() => {
    if (!domainId || selectedDomain?.status !== 'syncing' || (selectedDomain?.page_count ?? 0) > 0) {
      return undefined;
    }
    const interval = setInterval(() => {
      api.getDashboard(domainId).then((res) => setData(res.data)).catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, [domainId, selectedDomain?.status]);

  return (
    <div className="min-h-full">
      {/* Hero header with gradient mesh */}
      <div className="relative border-b border-slate-800 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/30 via-slate-950 to-violet-950/20" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-brand-400/80 mb-2">
                Performance Overview
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Dashboard</h1>
              <p className="text-slate-400 mt-2 max-w-lg">
                Track keyword rankings, organic signals, and page health for{' '}
                <span className="text-slate-300">
                  {selectedDomain?.display_name || selectedDomain?.domain || 'your site'}
                </span>
              </p>
            </div>
            {hasDomains && (
              <div className="shrink-0 w-full sm:w-auto">
                <p className="text-xs text-slate-500 mb-1.5 sm:text-right">Active domain</p>
                <DomainSelector value={domainId} onChange={setDomainId} className="w-full sm:w-auto" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {error && (
          <div className="p-4 bg-red-950/50 border border-red-800 rounded-xl text-red-300 text-sm">{error}</div>
        )}

        {domainsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : !hasDomains ? (
          <NoDomainPrompt />
        ) : loading ? (
          <p className="text-slate-500">Loading dashboard…</p>
        ) : (
          <>
            <KpiStrip summary={data?.summary} gscLinked={!!data?.domain?.gsc_linked} />

            {selectedDomain?.status === 'syncing' && (selectedDomain?.page_count ?? 0) === 0 && (
              <div className="rounded-xl border border-brand-500/20 bg-brand-950/20 px-5 py-4">
                <p className="text-sm font-medium text-brand-200">Crawl in progress</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Discovering pages from your sitemap. PageSpeed scores will populate in the background once crawling finishes.
                </p>
              </div>
            )}

            {/* Charts bento grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
                <RankDistributionChart data={data?.charts?.rank_distribution} />
              </div>
              <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
                <CoveragePanel
                  coverage={data?.charts?.coverage}
                  topRanked={data?.charts?.top_ranked}
                />
              </div>
            </div>

            {/* Quick insight strip when no SERP data */}
            {data?.summary?.pages_with_serp === 0 && (
              <div className="rounded-xl border border-brand-500/20 bg-brand-950/20 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-brand-200">No SERP data yet</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Track keywords in SERP Tracker to populate positions and rank charts.
                  </p>
                </div>
                <Link
                  to="/serp"
                  className="text-xs font-medium text-brand-300 hover:text-brand-200 px-3 py-1.5 rounded-lg border border-brand-500/30 hover:bg-brand-500/10 shrink-0"
                >
                  Open SERP Tracker →
                </Link>
              </div>
            )}

            <KeywordRankingsTable pages={data?.pages || []} />
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
