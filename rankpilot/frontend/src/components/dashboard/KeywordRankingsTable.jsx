import { useEffect, useMemo, useState } from 'react';
import { formatCompact, rankBadgeClass, scoreColor, scorePct } from '../../lib/dashboard';
import Pagination from '../Pagination';

const DEFAULT_PAGE_SIZE = 25;

function SortIcon({ active, dir }) {
  return (
    <svg className={`w-3 h-3 inline ml-1 ${active ? 'text-brand-400' : 'text-slate-600'}`} viewBox="0 0 12 12" fill="currentColor">
      {dir === 'asc' ? (
        <path d="M6 3l4 5H2l4-5z" />
      ) : (
        <path d="M6 9L2 4h8L6 9z" />
      )}
    </svg>
  );
}

function PageSpeedBadge({ score, label, icon }) {
  const pct = scorePct(score);
  if (pct == null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-600 text-xs" title={`${label}: no data`}>
        {icon}
        —
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 text-xs font-mono ${scoreColor(pct / 100)}`}
      title={`${label}: ${pct}`}
    >
      {icon}
      {pct}
    </span>
  );
}

const phoneIcon = (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
  </svg>
);

const desktopIcon = (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
  </svg>
);

export default function KeywordRankingsTable({ pages = [] }) {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('all');
  const [rankFilter, setRankFilter] = useState('all');
  const [sortKey, setSortKey] = useState('position');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const countries = useMemo(() => {
    const set = new Set();
    pages.forEach((p) => {
      if (p.country) p.country.split(',').forEach((c) => set.add(c.trim()));
    });
    return [...set].sort();
  }, [pages]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'keyword' ? 'asc' : 'asc');
    }
  }

  const filtered = useMemo(() => {
    let rows = [...pages];

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.keyword?.toLowerCase().includes(q) ||
          p.path?.toLowerCase().includes(q) ||
          p.serp?.keyword?.toLowerCase().includes(q),
      );
    }

    if (country !== 'all') {
      rows = rows.filter((p) => p.country?.includes(country));
    }

    if (rankFilter === 'ranked') {
      rows = rows.filter((p) => p.serp?.rank);
    } else if (rankFilter === 'top10') {
      rows = rows.filter((p) => p.serp?.rank && p.serp.rank <= 10);
    } else if (rankFilter === 'unranked') {
      rows = rows.filter((p) => !p.serp?.rank);
    }

    rows.sort((a, b) => {
      let av;
      let bv;
      switch (sortKey) {
        case 'keyword':
          av = a.keyword || '';
          bv = b.keyword || '';
          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        case 'clicks':
          av = a.gsc?.clicks ?? -1;
          bv = b.gsc?.clicks ?? -1;
          break;
        case 'position':
        default:
          av = a.serp?.rank ?? 9999;
          bv = b.serp?.rank ?? 9999;
          break;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });

    return rows;
  }, [pages, search, country, rankFilter, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, country, rankFilter, sortKey, sortDir, pageSize, pages.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function resetFilters() {
    setSearch('');
    setCountry('all');
    setRankFilter('all');
    setSortKey('position');
    setSortDir('asc');
    setPage(1);
  }

  const thClass = 'py-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="p-5 border-b border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Keyword Rankings</h3>
            <p className="text-sm text-slate-500 mt-0.5">Filter and explore per-page performance</p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="self-start text-xs text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset filters
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <input
            placeholder="Search keywords…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white"
          >
            <option value="all">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={rankFilter}
            onChange={(e) => setRankFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white"
          >
            <option value="all">All pages</option>
            <option value="ranked">Ranked only</option>
            <option value="top10">Top 10 only</option>
            <option value="unranked">Not ranked</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/50">
              <th className={thClass}>
                <button type="button" onClick={() => toggleSort('keyword')} className="hover:text-slate-300">
                  Keyword
                  <SortIcon active={sortKey === 'keyword'} dir={sortDir} />
                </button>
              </th>
              <th className={thClass}>Page</th>
              <th className={thClass}>Location</th>
              <th className={thClass}>
                <button type="button" onClick={() => toggleSort('position')} className="hover:text-slate-300">
                  Position
                  <SortIcon active={sortKey === 'position'} dir={sortDir} />
                </button>
              </th>
              <th className={thClass}>Change</th>
              <th className={thClass}>
                <button type="button" onClick={() => toggleSort('clicks')} className="hover:text-slate-300">
                  Clicks
                  <SortIcon active={sortKey === 'clicks'} dir={sortDir} />
                </button>
              </th>
              <th className={thClass}>Views</th>
              <th className={thClass}>Leads</th>
              <th className={thClass}>CTR</th>
              <th className={thClass}>PageSpeed</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr key={row.page_id} className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-3 max-w-[200px]">
                  <span className="text-white line-clamp-2" title={row.keyword}>
                    {row.keyword}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-brand-400 hover:underline truncate block max-w-[180px]"
                    title={row.path}
                  >
                    {row.path || '/'}
                  </a>
                </td>
                <td className="py-3 px-3 text-slate-400 text-xs max-w-[100px] truncate">
                  {row.country || row.serp?.location || '—'}
                </td>
                <td className="py-3 px-3">
                  {row.serp?.rank ? (
                    <span
                      className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-lg text-sm font-bold ${rankBadgeClass(row.serp.rank)}`}
                    >
                      {row.serp.rank}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="py-3 px-3 text-slate-600">—</td>
                <td className="py-3 px-3 tabular-nums text-slate-300">{row.gsc?.clicks ?? '—'}</td>
                <td className="py-3 px-3 tabular-nums text-slate-400">
                  {row.gsc?.impressions != null ? formatCompact(row.gsc.impressions) : '—'}
                </td>
                <td className="py-3 px-3 tabular-nums text-slate-300">{row.gsc?.leads ?? '—'}</td>
                <td className="py-3 px-3 tabular-nums text-slate-400">
                  {row.gsc?.ctr != null ? `${(row.gsc.ctr * 100).toFixed(1)}%` : '—'}
                </td>
                <td className="py-3 px-3">
                  <div className="flex gap-1.5">
                    <PageSpeedBadge score={row.pagespeed?.mobile?.performance_score} label="Mobile" icon={phoneIcon} />
                    <PageSpeedBadge score={row.pagespeed?.desktop?.performance_score} label="Desktop" icon={desktopIcon} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-slate-500 py-10 text-sm">No rows match your filters.</p>
      )}

      <Pagination
        page={safePage}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
}
