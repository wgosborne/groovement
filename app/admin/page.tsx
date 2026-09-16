'use client';

import { useState } from 'react';

interface PendingUser {
  id: string;
  name: string;
  email: string;
  referralSource: string | null;
  requestReason: string | null;
  requestedAt: string;
}

interface AdminPageProps {
  authenticated: boolean;
  users?: PendingUser[];
  error?: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError('Invalid password');
        setLoading(false);
        return;
      }

      setAuthenticated(true);
      setLoading(false);
      fetchPendingUsers();
    } catch (err) {
      setError('Authentication failed');
      setLoading(false);
    }
  };

  const fetchPendingUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError('Failed to load pending users');
    }
  };

  const handleApprove = async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) throw new Error('Failed to approve user');
      setUsers(users.filter((u) => u.id !== userId));
      setError('');
    } catch (err) {
      setError(`Approval failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/deny`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) throw new Error('Failed to deny user');
      setUsers(users.filter((u) => u.id !== userId));
      setError('');
    } catch (err) {
      setError(`Denial failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel rounded-lg p-6 sm:p-8 w-full max-w-md">
          <h1 className="text-2xl sm:text-3xl font-bold text-spotify-green mb-6">Groovement Admin</h1>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 sm:px-4 py-3 sm:py-2 bg-white/10 border border-white/20 rounded-md mb-4 text-white placeholder-white/50 focus:outline-none focus:border-spotify-green focus:ring-1 focus:ring-spotify-green"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-spotify-green text-black font-bold py-3 sm:py-2 rounded-md hover:bg-opacity-90 disabled:opacity-50 transition"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>
          </form>

          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-spotify-green mb-2">Pending Approvals</h1>
        <p className="text-sm sm:text-base text-white/70 font-light mb-6 sm:mb-8">Review and approve new signup requests</p>

        {error && (
          <div className="glass-panel border-red-500/30 rounded-lg px-4 py-3 mb-6 bg-red-500/10">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {users.length === 0 ? (
          <p className="text-white/60 font-light">No pending signup requests.</p>
        ) : (
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="glass-panel rounded-lg p-4 sm:p-6 border-l-4 border-spotify-green"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                  <div>
                    <p className="text-xs font-light text-white/60 uppercase tracking-wider mb-1">Name</p>
                    <p className="text-base sm:text-lg font-bold text-white">{user.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-light text-white/60 uppercase tracking-wider mb-1">Email</p>
                    <p className="text-base sm:text-lg text-white break-words">{user.email}</p>
                  </div>
                </div>

                {user.referralSource && (
                  <div className="mb-4">
                    <p className="text-xs font-light text-white/60 uppercase tracking-wider mb-1">How they heard</p>
                    <p className="text-white">{user.referralSource}</p>
                  </div>
                )}

                {user.requestReason && (
                  <div className="mb-4">
                    <p className="text-xs font-light text-white/60 uppercase tracking-wider mb-1">Request reason</p>
                    <p className="text-white whitespace-pre-wrap">{user.requestReason}</p>
                  </div>
                )}

                <p className="text-xs text-white/50 font-light mb-4">
                  Requested: {new Date(user.requestedAt).toLocaleString()}
                </p>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={() => handleApprove(user.id)}
                    disabled={loading}
                    className="flex-1 bg-spotify-green text-black font-bold py-3 sm:py-2 rounded-md hover:bg-opacity-90 disabled:opacity-50 transition"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleDeny(user.id)}
                    disabled={loading}
                    className="flex-1 border border-white/30 text-white font-bold py-3 sm:py-2 rounded-md hover:bg-white/10 disabled:opacity-50 transition"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
