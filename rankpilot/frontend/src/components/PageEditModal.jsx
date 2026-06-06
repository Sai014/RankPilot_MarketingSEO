import { useEffect, useState } from 'react';
import { TARGET_COUNTRIES, keywordFromPath } from '../lib/domains';

function CountryMultiSelect({ value, onChange }) {
  function toggle(country) {
    if (value.includes(country)) {
      onChange(value.filter((c) => c !== country));
    } else {
      onChange([...value, country]);
    }
  }

  return (
    <div className="max-h-40 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg py-1">
      {TARGET_COUNTRIES.map((country) => (
        <label
          key={country}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={value.includes(country)}
            onChange={() => toggle(country)}
            className="rounded border-slate-600 bg-slate-900 text-brand-500 focus:ring-brand-500"
          />
          {country}
        </label>
      ))}
    </div>
  );
}

export default function PageEditModal({ open, onClose, onSubmit, submitting, page, domainCountries = [] }) {
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    if (open && page) {
      const override = page.target_countries;
      setCountries(override?.length ? override : domainCountries || []);
    }
  }, [open, page, domainCountries]);

  if (!open || !page) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    await onSubmit({ target_countries: countries });
  }

  const keyword = page.keyword || keywordFromPath(page.path);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-xl">
        <div className="p-6 pb-4">
          <h2 className="text-lg font-semibold text-white">Edit Page</h2>
          <p className="text-sm text-slate-400 mt-1 truncate" title={page.path}>
            {page.path || '/'}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Keyword: <span className="text-slate-300">{keyword}</span> (from URL slug)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1.5">Target Countries</label>
            <p className="text-xs text-slate-500 mb-2">
              Override domain defaults for this page. Leave empty to inherit from domain settings.
            </p>
            <CountryMultiSelect value={countries} onChange={setCountries} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-500 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
