import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import ConfirmModal from './ConfirmModal';

function GoogleIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function GoogleConnectButton({ onConnectionChange, compact = false }) {
  const [status, setStatus] = useState({ connected: false, email: null });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [error, setError] = useState(null);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await api.getGoogleStatus();
      setStatus(res.data || { connected: false });
      onConnectionChange?.(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to check Google connection');
    } finally {
      setLoading(false);
    }
  }, [onConnectionChange]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') !== '1') return;

    (async () => {
      setConnecting(true);
      try {
        await api.completeGoogleConnect();
        await refreshStatus();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to complete Google connection');
      } finally {
        setConnecting(false);
        params.delete('google_connected');
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
        window.history.replaceState({}, '', next);
      }
    })();
  }, [refreshStatus]);

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await api.connectGoogle();
      const url = res.data?.redirect_url;
      if (!url) throw new Error('No redirect URL returned');

      const popup = window.open(url, 'google_gsc_connect', 'width=600,height=700');
      if (!popup) {
        window.location.href = url;
        return;
      }

      const poll = setInterval(async () => {
        if (popup.closed) {
          clearInterval(poll);
          try {
            await api.completeGoogleConnect();
          } catch {
            // User may have cancelled — status check below handles it
          }
          await refreshStatus();
          setConnecting(false);
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start Google connection');
      setConnecting(false);
    }
  }

  async function confirmDisconnect() {
    setConnecting(true);
    setError(null);
    try {
      await api.disconnectGoogle();
      const disconnected = { connected: false, email: null };
      setStatus(disconnected);
      onConnectionChange?.(disconnected);
      setDisconnectOpen(false);
      await refreshStatus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to disconnect');
    } finally {
      setConnecting(false);
    }
  }

  if (loading) {
    return (
      <div className={`inline-flex items-center gap-2 text-sm text-slate-500 ${compact ? '' : 'px-4 py-2.5'}`}>
        <span className="w-4 h-4 border-2 border-slate-600 border-t-brand-500 rounded-full animate-spin" />
        Checking Google…
      </div>
    );
  }

  if (status.connected) {
    return (
      <>
        <div className="flex flex-col items-end gap-1">
          <div className={`inline-flex items-center gap-2 ${compact ? 'text-sm' : ''}`}>
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-green-950/40 border border-green-800/60 rounded-lg text-green-200 text-sm">
              <GoogleIcon />
              {status.email || 'Google connected'}
            </span>
            <button
              type="button"
              onClick={() => setDisconnectOpen(true)}
              disabled={connecting}
              className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
          {error && <p className="text-xs text-red-400 max-w-xs text-right">{error}</p>}
        </div>

        <ConfirmModal
          open={disconnectOpen}
          onClose={() => !connecting && setDisconnectOpen(false)}
          onConfirm={confirmDisconnect}
          submitting={connecting}
          submittingLabel="Disconnecting…"
          title="Disconnect Google account?"
          message={
            status.email
              ? `This will disconnect ${status.email} from Google Search Console. You won't be able to import GSC properties or sync performance data until you connect again.`
              : 'This will disconnect your Google Search Console account. You won\'t be able to import GSC properties or sync performance data until you connect again.'
          }
          confirmLabel="Disconnect"
          cancelLabel="Keep connected"
          icon={<GoogleIcon className="w-5 h-5" />}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className={`inline-flex items-center justify-center gap-2 border border-slate-700 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
          compact ? 'px-3 py-2' : 'px-4 py-2.5'
        }`}
      >
        <GoogleIcon />
        {connecting ? 'Connecting…' : 'Connect Google Account'}
      </button>
      {error && <p className="text-xs text-red-400 max-w-xs text-right">{error}</p>}
    </div>
  );
}

export { GoogleIcon };
