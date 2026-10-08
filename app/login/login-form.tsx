'use client';

import { useState } from 'react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      const data = await response.json();
      setMessage(data.message);
      setEmail('');
      setLoading(false);
    } catch {
      setError('Failed to send. Please try again.');
      setLoading(false);
    }
  };

  if (message) {
    return (
      <p className="text-white/80 font-light leading-relaxed">{message}</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-xs font-light text-white/60 uppercase tracking-wider block mb-2">
          Email
        </label>
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          required
          className="w-full px-3 sm:px-4 py-3 sm:py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-spotify-green focus:ring-1 focus:ring-spotify-green"
        />
      </div>

      {error && (
        <div className="glass-panel border-red-500/30 rounded-md px-4 py-3 bg-red-500/10">
          <p className="text-red-300 text-sm font-light">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-spotify-green text-black font-bold py-3 sm:py-2 rounded-md hover:bg-opacity-90 disabled:opacity-50 transition"
      >
        {loading ? 'Sending...' : 'Send me a login link'}
      </button>
    </form>
  );
}
