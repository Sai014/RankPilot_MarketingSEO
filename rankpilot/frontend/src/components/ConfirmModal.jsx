export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  submitting = false,
  icon = null,
  children = null,
}) {
  if (!open) return null;

  async function handleConfirm() {
    await onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
        <div className="p-6">
          <div className="flex items-start gap-4">
            {icon && (
              <div className="w-10 h-10 rounded-lg bg-brand-600/15 text-brand-400 flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{message}</p>
              {children && <div className="mt-4">{children}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="p-1 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 disabled:opacity-50 min-w-[120px]"
            >
              {submitting ? 'Refreshing…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
