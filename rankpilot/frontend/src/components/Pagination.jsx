const PAGE_SIZES = [15, 25, 50];

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = PAGE_SIZES,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function goTo(p) {
    onPageChange(Math.min(Math.max(1, p), totalPages));
  }

  const pages = [];
  const windowSize = 5;
  let startPage = Math.max(1, page - Math.floor(windowSize / 2));
  let endPage = Math.min(totalPages, startPage + windowSize - 1);
  startPage = Math.max(1, endPage - windowSize + 1);

  for (let i = startPage; i <= endPage; i += 1) {
    pages.push(i);
  }

  const btnClass =
    'px-2.5 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-3 border-t border-slate-800">
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>
          {total === 0 ? 'No results' : `${start}–${end} of ${total}`}
        </span>
        <label className="flex items-center gap-2">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-white text-xs"
          >
            {pageSizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={btnClass} disabled={page <= 1} onClick={() => goTo(1)}>
            First
          </button>
          <button type="button" className={btnClass} disabled={page <= 1} onClick={() => goTo(page - 1)}>
            Prev
          </button>
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              className={`min-w-[2rem] px-2.5 py-1.5 text-xs rounded-lg border ${
                p === page
                  ? 'bg-brand-600/20 border-brand-500/50 text-brand-300'
                  : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              {p}
            </button>
          ))}
          <button type="button" className={btnClass} disabled={page >= totalPages} onClick={() => goTo(page + 1)}>
            Next
          </button>
          <button type="button" className={btnClass} disabled={page >= totalPages} onClick={() => goTo(totalPages)}>
            Last
          </button>
        </div>
      )}
    </div>
  );
}

export { PAGE_SIZES };
