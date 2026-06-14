import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import ConfirmModal from '../components/ConfirmModal';
import DomainModal, { GlobeIcon } from '../components/DomainModal';
import GoogleConnectButton from '../components/GoogleConnectButton';
import { useDomains } from '../components/DomainSelector';
import { domainUrl, formatDate } from '../lib/domains';

function SearchIcon() {
  return (
    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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

function RefreshIcon({ spinning = false }) {
  return (
    <svg
      className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function DomainCard({ item, onEdit, onRefresh, onDelete, refreshing, deleting }) {
  const url = item.url || domainUrl(item.domain);
  const name = item.display_name || item.domain;

  return (
    <article className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 hover:border-slate-700 transition-colors">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
          <GlobeIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white">{name}</h3>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 hover:underline mt-0.5"
          >
            {url}
            <ExternalLinkIcon />
          </a>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-slate-500">
            <span>{item.page_count ?? 0} pages tracked</span>
            <span className="text-slate-700">·</span>
            <span>{item.sitemap_count ?? (item.sitemap_source === 'sitemap' ? 1 : 0)} sitemap{(item.sitemap_count ?? 1) !== 1 ? 's' : ''}</span>
            <span className="text-slate-700">·</span>
            <span>Added {formatDate(item.created_at)}</span>
            {item.status === 'syncing' && (item.page_count ?? 0) === 0 && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-amber-400 font-medium">Crawling…</span>
              </>
            )}
            {item.status === 'error' && (item.page_count ?? 0) === 0 && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-red-400 font-medium">Onboarding failed</span>
              </>
            )}
            {item.status === 'error' && (item.page_count ?? 0) > 0 && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-amber-400 font-medium">Audits incomplete — click Refresh</span>
              </>
            )}
            {item.gsc_linked && (
              <>
                <span className="text-slate-700">·</span>
                <span className="text-green-400 font-medium">GSC linked</span>
              </>
            )}
          </div>
        </div>
        </div>

        <div className="flex items-center gap-2 border-t border-slate-800 pt-3 sm:border-0 sm:pt-0 sm:justify-end">
          <button
            type="button"
            onClick={() => onRefresh(item)}
            disabled={refreshing || deleting || (item.status === 'syncing' && (item.page_count ?? 0) === 0)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            title="Re-crawl sitemap and run PageSpeed audits"
          >
            <RefreshIcon spinning={refreshing || (item.status === 'syncing' && (item.page_count ?? 0) === 0)} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="text-sm font-medium text-slate-400 hover:text-white px-2 py-1.5"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            disabled={deleting}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg disabled:opacity-50"
            title="Delete domain"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </article>
  );
}

function Domains() {
  const { domains, loading, error, reload } = useDomains();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);
  const [refreshTarget, setRefreshTarget] = useState(null);
  const [refreshAutoSerp, setRefreshAutoSerp] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notice, setNotice] = useState(null);

  const hasSyncing = domains.some((d) => d.status === 'syncing' && (d.page_count ?? 0) === 0);

  useEffect(() => {
    if (!hasSyncing) return undefined;
    const interval = setInterval(() => reload(), 15000);
    return () => clearInterval(interval);
  }, [hasSyncing, reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return domains;
    return domains.filter(
      (d) =>
        d.domain?.toLowerCase().includes(q) ||
        d.display_name?.toLowerCase().includes(q) ||
        d.url?.toLowerCase().includes(q),
    );
  }, [domains, search]);

  function openAdd() {
    setEditing(null);
    setModalMode('add');
    setModalOpen(true);
    setActionError(null);
  }

  function openEdit(item) {
    setEditing(item);
    setModalMode('edit');
    setModalOpen(true);
    setActionError(null);
  }

  async function handleSubmit(form) {
    setSubmitting(true);
    setActionError(null);
    try {
      if (modalMode === 'edit' && editing) {
        await api.updateDomain(editing.id, {
          display_name: form.display_name,
          target_countries: form.target_countries,
        });
        setModalOpen(false);
      } else {
        const res = await api.createDomain({
          domain: form.domain,
          display_name: form.display_name,
          target_countries: form.target_countries,
          auto_serp: form.auto_serp ?? true,
          gsc_site_url: form.gsc_site_url || undefined,
        });
        setModalOpen(false);
        setNotice({
          type: 'success',
          message:
            res.data?.onboarding?.message ||
            `${form.display_name || form.domain}: onboarding started in the background.`,
        });
      }
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function openRefresh(item) {
    setActionError(null);
    setRefreshAutoSerp(true);
    setRefreshTarget(item);
  }

  async function confirmRefresh() {
    if (!refreshTarget) return;
    const item = refreshTarget;
    const autoSerp = refreshAutoSerp;
    setRefreshingId(item.id);
    setActionError(null);
    setNotice(null);
    try {
      await api.refreshDomain(item.id, { auto_serp: autoSerp });
      setRefreshTarget(null);
      setNotice({
        type: 'success',
        message: autoSerp
          ? `${item.display_name || item.domain}: sitemap crawl, SERP, and PageSpeed audits running in the background.`
          : `${item.display_name || item.domain}: sitemap crawl and PageSpeed audits running in the background.`,
      });
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to refresh domain');
    } finally {
      setRefreshingId(null);
    }
  }

  function openDelete(item) {
    setActionError(null);
    setDeleteTarget(item);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const item = deleteTarget;
    setDeletingId(item.id);
    setActionError(null);
    try {
      await api.deleteDomain(item.id);
      setDeleteTarget(null);
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to delete domain');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Domains</h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage your tracked websites and their default settings
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-end gap-3 shrink-0">
            <GoogleConnectButton />
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <span className="text-lg leading-none">+</span>
              Add Domain
            </button>
          </div>
        </header>

        {(error || actionError) && !modalOpen && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-800 rounded-lg text-red-300 text-sm">
            {actionError || error}
          </div>
        )}

        {notice && (
          <div className="mb-6 p-4 bg-green-950/40 border border-green-800 rounded-lg text-green-200 text-sm">
            {notice.message}
          </div>
        )}

        <div className="relative mb-6">
          <span className="absolute left-3 top-1/2 -translate-y-1/2">
            <SearchIcon />
          </span>
          <input
            type="search"
            placeholder="Search domains"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-xl">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-4">
              <GlobeIcon className="w-6 h-6" />
            </div>
            <p className="text-slate-300 font-medium">
              {search ? 'No domains match your search' : 'No domains yet'}
            </p>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              {search ? 'Try a different search term' : 'Add your first website to start tracking'}
            </p>
            {!search && (
              <button
                type="button"
                onClick={openAdd}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg"
              >
                + Add Domain
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((d) => (
              <DomainCard
                key={d.id}
                item={d}
                onEdit={openEdit}
                onRefresh={openRefresh}
                onDelete={openDelete}
                refreshing={refreshingId === d.id}
                deleting={deletingId === d.id}
              />
            ))}
          </div>
        )}
      </div>

      <DomainModal
        open={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        initial={editing}
        mode={modalMode}
      />

      <ConfirmModal
        open={!!refreshTarget}
        onClose={() => !refreshingId && setRefreshTarget(null)}
        onConfirm={confirmRefresh}
        submitting={!!refreshingId}
        title="Refresh domain?"
        message={
          refreshTarget
            ? `Re-crawl the sitemap for "${refreshTarget.display_name || refreshTarget.domain}" and run mobile + desktop PageSpeed audits. This may take several minutes.`
            : ''
        }
        confirmLabel="Refresh"
        cancelLabel="Cancel"
        submittingLabel="Refreshing…"
        icon={<RefreshIcon spinning={!!refreshingId} />}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={refreshAutoSerp}
            onChange={(e) => setRefreshAutoSerp(e.target.checked)}
            disabled={!!refreshingId}
            className="mt-0.5 rounded border-slate-600 bg-slate-900 text-brand-500 focus:ring-brand-500"
          />
          <span>
            <span className="block text-sm font-medium text-slate-200">Auto-check SERP rankings</span>
            <span className="block text-xs text-slate-500 mt-1">
              One ValueSERP search per page — uses API credits. Uncheck to refresh pages and PageSpeed only.
            </span>
          </span>
        </label>
      </ConfirmModal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => !deletingId && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        submitting={!!deletingId}
        title="Delete domain?"
        message={
          deleteTarget
            ? `Remove "${deleteTarget.display_name || deleteTarget.domain}" and all its tracked pages? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        submittingLabel="Deleting…"
        icon={<TrashIcon />}
      />

      {actionError && modalOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-red-600 text-white text-sm rounded-lg shadow-lg">
          {actionError}
        </div>
      )}
    </div>
  );
}

export default Domains;
