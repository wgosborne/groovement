'use client';

import { useState } from 'react';

export default function Home() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    referralSource: '',
    requestReason: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 409) {
          setError('This email is already registered. Check your inbox for an approval link.');
        } else {
          setError(errorData.error || 'Something went wrong. Please try again.');
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
      setFormData({ name: '', email: '', referralSource: '', requestReason: '' });
    } catch (err) {
      setError('Failed to submit. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel rounded-lg p-8 w-full max-w-md text-center">
          <h2 className="text-3xl font-bold text-spotify-green mb-4">Thanks!</h2>
          <p className="text-white/80 font-light mb-6 leading-relaxed">
            You're on the list — I'll email you once you're approved. Keep an eye on your inbox!
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="text-spotify-green hover:opacity-80 font-light underline"
          >
            Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center p-4 pt-20">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Find the songs of your <span className="text-spotify-green">fastest efforts</span>
          </h1>
          <p className="text-xl text-white/70 font-light mb-12 leading-relaxed">
            Connect Strava + Spotify. Groovement finds the songs playing during your top 4 fastest splits, calls out your fastest one specifically, and automatically updates your Strava description. Every run, no extra work.
          </p>

          {/* Before/After Example */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* Before */}
            <div className="glass-panel rounded-lg p-6 text-left">
              <p className="text-xs font-light text-white/60 uppercase tracking-wider mb-3">Before</p>
              <div className="bg-black/30 rounded p-4 border border-white/10 font-mono text-xs">
                <p className="text-white/80 leading-relaxed">
                  Tempo run this morning, felt great! Strong pace throughout. <br/>
                  <br/>
                  5.2 mi | 38:14
                </p>
              </div>
            </div>

            {/* After */}
            <div className="glass-panel rounded-lg p-6 text-left border-l-4 border-spotify-green">
              <p className="text-xs font-light text-spotify-green uppercase tracking-wider mb-3">After (with Groovement)</p>
              <div className="bg-black/30 rounded p-4 border border-spotify-green/20 space-y-4 font-mono text-xs">
                <p className="text-white/80 leading-relaxed">
                  Tempo run this morning, felt great! Strong pace throughout. <br/>
                  <br/>
                  5.2 mi | 38:14
                </p>
                <p className="text-white/90 leading-relaxed">
                  Fastest split (6:46/mi): "Put On" by Jeezy<br/>
                  SOTD: "Pop That", "Sexy Can I", "Midnight Sun"<br/>
                  AOTD: French Montana, Ray J, Zara Larsson
                </p>
              </div>
            </div>
          </div>

          <a
            href="#signup"
            className="inline-block bg-spotify-green text-black px-8 py-3 rounded-lg font-bold hover:bg-opacity-90 transition"
          >
            Get Started
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-spotify-green mb-12 text-center">How it works</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="glass-panel rounded-lg p-6">
              <div className="w-10 h-10 rounded-full bg-spotify-green/20 flex items-center justify-center mb-4 border border-spotify-green/30">
                <span className="text-spotify-green font-bold">1</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Connect Strava</h3>
              <p className="text-white/70 font-light text-sm">Authorize access to your activities and splits.</p>
            </div>

            {/* Step 2 */}
            <div className="glass-panel rounded-lg p-6">
              <div className="w-10 h-10 rounded-full bg-spotify-green/20 flex items-center justify-center mb-4 border border-spotify-green/30">
                <span className="text-spotify-green font-bold">2</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Connect Spotify</h3>
              <p className="text-white/70 font-light text-sm">Authorize access to your listening history.</p>
            </div>

            {/* Step 3 */}
            <div className="glass-panel rounded-lg p-6">
              <div className="w-10 h-10 rounded-full bg-spotify-green/20 flex items-center justify-center mb-4 border border-spotify-green/30">
                <span className="text-spotify-green font-bold">3</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Go for a run</h3>
              <p className="text-white/70 font-light text-sm">Run with music. Groovement does the rest.</p>
            </div>

            {/* Step 4 */}
            <div className="glass-panel rounded-lg p-6">
              <div className="w-10 h-10 rounded-full bg-spotify-green/20 flex items-center justify-center mb-4 border border-spotify-green/30">
                <span className="text-spotify-green font-bold">4</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Automatic</h3>
              <p className="text-white/70 font-light text-sm">Check Strava. Your song is already there.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How the Matching Works */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-spotify-green mb-12 text-center">How the matching works</h2>

          <div className="glass-panel rounded-lg p-8">
            <p className="text-white/80 font-light mb-6 leading-relaxed">
              Once you finish a run, Strava breaks the activity into 1 km splits and calculates your average pace for each one. When Groovement receives that activity (via a Strava webhook the moment you finish), it pulls the full list of splits and identifies your top 4 fastest.
            </p>
            <p className="text-white/80 font-light mb-6 leading-relaxed">
              At the same time, it polls your Spotify listening history for the exact window your run covered — from when you started to when you finished, with a 2-minute buffer added on both ends to account for delays in how Spotify reports what's playing. That gives a list of every track that was playing during your run, with timestamps.
            </p>
            <p className="text-white/80 font-light mb-6 leading-relaxed">
              Groovement then cross-references each of your 4 fastest splits against that listening history, matching each split's time window to whatever track was playing during it. Your single fastest split gets called out specifically; the other 3 are listed as your 'songs of the day.'
            </p>
            <p className="text-white/80 font-light leading-relaxed">
              Finally, it appends the results to your existing Strava activity description — it never overwrites what you've already written, just adds the song info below it. All of this happens automatically in the background within moments of you finishing your run; you'll just see the songs already there next time you check Strava.
            </p>
          </div>
        </div>
      </section>

      {/* Security & Privacy Section */}
      <section className="py-20 px-4 bg-black/20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-spotify-green mb-12 text-center">Security & Privacy</h2>

          <div className="space-y-6">
            <div className="glass-panel rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-2">Refresh tokens are encrypted</h3>
              <p className="text-white/70 font-light">
                To update your Strava descriptions without you having to log in every time, I store refresh tokens (the credentials that let Groovement act on your behalf). These tokens are encrypted at rest using AES-256, not stored in plain text. Access tokens are never persisted — they're generated on demand and immediately discarded.
              </p>
            </div>

            <div className="glass-panel rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-2">What I can see</h3>
              <p className="text-white/70 font-light">
                As the developer, I can access your activity and listening data for debugging purposes only — to figure out why a match failed or why an update didn't go through. That data is never sold, shared with anyone else, or analyzed for insights into your listening habits or running patterns.
              </p>
            </div>

            <div className="glass-panel rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-2">Data is automatically deleted</h3>
              <p className="text-white/70 font-light">
                Your split/pace data and Spotify listening history are automatically deleted after 30 days. Activity metadata (the run itself — date, distance, duration) is kept indefinitely for reference, but the detailed data that informed the song matches doesn't stick around.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Signup Form Section */}
      <section id="signup" className="py-20 px-4">
        <div className="max-w-md mx-auto">
          <div className="glass-panel rounded-lg p-8">
            <h2 className="text-3xl font-bold text-spotify-green mb-2">Join the waitlist</h2>
            <p className="text-white/70 font-light mb-6">
              I'll review your request and send you a connect link within a few days.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs font-light text-white/60 uppercase tracking-wider block mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-spotify-green focus:ring-1 focus:ring-spotify-green"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-light text-white/60 uppercase tracking-wider block mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-spotify-green focus:ring-1 focus:ring-spotify-green"
                />
              </div>

              {/* How'd you hear */}
              <div>
                <label className="text-xs font-light text-white/60 uppercase tracking-wider block mb-2">
                  How'd you hear about Groovement?
                </label>
                <input
                  type="text"
                  name="referralSource"
                  placeholder="Twitter, friend, Strava description, etc."
                  value={formData.referralSource}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-spotify-green focus:ring-1 focus:ring-spotify-green"
                />
              </div>

              {/* Tell us about yourself */}
              <div>
                <label className="text-xs font-light text-white/60 uppercase tracking-wider block mb-2">
                  Tell us a bit about yourself
                </label>
                <textarea
                  name="requestReason"
                  placeholder="What brings you here? How do you run? Anything we should know?"
                  value={formData.requestReason}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:border-spotify-green focus:ring-1 focus:ring-spotify-green resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="glass-panel border-red-500/30 rounded-md px-4 py-3 bg-red-500/10">
                  <p className="text-red-300 text-sm font-light">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-spotify-green text-black font-bold py-2 rounded-md hover:bg-opacity-90 disabled:opacity-50 transition"
              >
                {loading ? 'Submitting...' : 'Request Access'}
              </button>

              <p className="text-xs text-white/50 font-light text-center mt-4">
                * Required fields
              </p>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
