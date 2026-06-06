import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';

function ProfileAvatar({ avatarUrl, companyName, onUpload, uploading }) {
  const inputRef = useRef(null);
  const initial = (companyName || '?').charAt(0).toUpperCase();

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative group w-24 h-24 rounded-xl overflow-hidden bg-slate-800 border-2 border-dashed border-slate-700 hover:border-brand-500 transition-colors disabled:opacity-60"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="flex items-center justify-center w-full h-full text-3xl font-bold text-brand-300">
            {initial}
          </span>
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <span className="text-xs text-white font-medium">
            {uploading ? 'Uploading…' : 'Change logo'}
          </span>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = '';
        }}
      />
      <p className="text-xs text-slate-500">JPEG, PNG, WebP or GIF · max 2 MB</p>
    </div>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ company_name: '', phone: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    api
      .getProfile()
      .then((res) => {
        setProfile(res.data);
        setForm({
          company_name: res.data.company_name || '',
          phone: res.data.phone || '',
          address: res.data.address || '',
        });
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load profile');
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.updateProfile(form);
      setProfile(res.data);
      setSuccess('Profile saved successfully.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(file) {
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.uploadAvatar(file);
      setProfile(res.data);
      setSuccess('Logo updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-brand-400/80 mb-2">Account</p>
        <h1 className="text-3xl font-bold text-white tracking-tight">Company Profile</h1>
        <p className="text-slate-400 mt-2">Manage your company details and logo.</p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-sm">
          {success}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <ProfileAvatar
          avatarUrl={profile?.avatar_url}
          companyName={form.company_name || profile?.email}
          onUpload={handleLogoUpload}
          uploading={uploading}
        />

        <form onSubmit={handleSave} className="mt-8 space-y-5">
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-slate-300 mb-1.5">
              Company Name
            </label>
            <input
              id="company_name"
              type="text"
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              placeholder="Acme Inc."
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={profile?.email || ''}
              disabled
              className="w-full px-4 py-2.5 bg-slate-950/50 border border-slate-800 rounded-lg text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-600 mt-1">Email is managed through your login account.</p>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-1.5">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+1 (555) 000-0000"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-slate-300 mb-1.5">
              Address
            </label>
            <textarea
              id="address"
              rows={3}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="123 Main St, City, State, ZIP"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors resize-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
