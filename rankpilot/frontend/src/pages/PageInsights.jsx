import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import DomainSelector, { useSelectedDomain } from '../components/DomainSelector';
import NoDomainPrompt from '../components/NoDomainPrompt';
import PageEditModal from '../components/PageEditModal';
import Pagination from '../components/Pagination';
import { formatShortDate, keywordFromPath } from '../lib/domains';

function ExternalLinkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function PageInsights() {
  const { domainId, setDomainId, loading: domainsLoading, hasDomains } = useSelectedDomain();
  const [pages, setPages] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [editingPage, setEditingPage] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadPages = useCallback(() => {
    if (!domainId) {
      setPages([]);
      setMeta(null);
      return Promise.resolve();
    }
    setLoading(true);
    setError(null);
    return api
      .listPages(domainId)
      .then((res) => {
        setPages(res.data || []);
        setMeta(res.meta);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load pages');
        setPages([]);
      })
      .finally(() => setLoading(false));
  }, [domainId]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const filtered = pages.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const keyword = p.keyword || keywordFromPath(p.path);
    return (
      p.url?.toLowerCase().includes(q) ||
      p.path?.toLowerCase().includes(q) ||
      p.domain?.toLowerCase().includes(q) ||
      keyword.toLowerCase().includes(q) ||
      p.country?.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, pages.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  async function handleEditSubmit(form) {
    if (!editingPage) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.updatePage(editingPage.id, form);
      setEditingPage(null);
      await loadPages();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update page');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(page) {
    const keyword = page.keyword || keywordFromPath(page.path);
    if (!confirm(`Remove "${keyword}" (${page.path || '/'}) from tracking?`)) return;
    setDeletingId(page.id);
    setError(null);
    try {
      await api.deletePage(page.id);
      await loadPages();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete page');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-8 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Page Insights</h2>
          <p className="text-slate-400 mt-1">
            Tracked pages with keywords derived from URL slugs
          </p>
        </div>
        {hasDomains && <DomainSelector value={domainId} onChange={setDomainId} />}
      </header>

      {error && (
        <div className="mb-6 p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {domainsLoading ? (
        <p className="text-slate-500">Loading…</p>
      ) : !hasDomains ? (
        <NoDomainPrompt />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              placeholder="Search keywords, paths, domains…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 max-w-md px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {meta && (
              <p className="text-sm text-slate-500 self-center">
                {filtered.length} of {meta.total} pages
              </p>
            )}
          </div>

          {loading ? (
            <p className="text-slate-500">Loading pages…</p>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl">
              <p className="text-slate-400">No pages found for this domain.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="text-left text-slate-400 bg-slate-900 border-b border-slate-800">
                    <th className="py-3 px-4 font-medium">Keywords</th>
                    <th className="py-3 px-4 font-medium">Domain</th>
                    <th className="py-3 px-4 font-medium">Path</th>
                    <th className="py-3 px-4 font-medium">Country</th>
                    <th className="py-3 px-4 font-medium">Created</th>
                    <th className="py-3 px-4 font-medium">Visit</th>
                    <th className="py-3 px-4 font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((pageRow) => {
                    const keyword = pageRow.keyword || keywordFromPath(pageRow.path);
                    return (
                      <tr key={pageRow.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                        <td className="py-3 px-4 text-white max-w-[220px]">
                          <span className="line-clamp-2" title={keyword}>
                            {keyword}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                          {pageRow.domain || meta?.domain?.domain || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400 max-w-[200px] truncate" title={pageRow.path}>
                          {pageRow.path || '/'}
                        </td>
                        <td className="py-3 px-4 text-slate-300 max-w-[140px] truncate" title={pageRow.country || undefined}>
                          {pageRow.country || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {formatShortDate(pageRow.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <a
                            href={pageRow.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300 hover:underline"
                          >
                            Visit
                            <ExternalLinkIcon />
                          </a>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingPage(pageRow)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                              title="Edit page"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(pageRow)}
                              disabled={deletingId === pageRow.id}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg disabled:opacity-50"
                              title="Delete page"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
          )}
        </>
      )}

      <PageEditModal
        open={!!editingPage}
        onClose={() => !submitting && setEditingPage(null)}
        onSubmit={handleEditSubmit}
        submitting={submitting}
        page={editingPage}
        domainCountries={meta?.domain?.target_countries || []}
      />
    </div>
  );
}

export default PageInsights;
