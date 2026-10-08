import { redirect } from 'next/navigation';
import type { OAuthToken } from '@prisma/client';
import { getSessionUser } from '@/lib/session';
import { disconnectSpotify, disconnectStrava } from './actions';
import { DisconnectButton } from './disconnect-button';

interface ProfilePageProps {
  searchParams: Promise<{ disconnected?: string }>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const stravaConnected = user.oauthTokens.some((t: OAuthToken) => t.service === 'strava');
  const spotifyConnected = user.oauthTokens.some((t: OAuthToken) => t.service === 'spotify');

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="glass-panel rounded-lg p-6 sm:p-8 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Your account</h1>
          <p className="text-sm sm:text-base text-white/70 font-light break-all">{user.email}</p>
        </div>

        {params.disconnected === 'strava' && (
          <div className="glass-panel rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 border-l-4 border-spotify-green">
            <p className="text-white/80 font-light">
              Strava disconnected. Groovement will no longer update your activities.
            </p>
          </div>
        )}

        {params.disconnected === 'spotify' && (
          <div className="glass-panel rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 border-l-4 border-spotify-green">
            <p className="text-white/80 font-light mb-3">
              Spotify disconnected. Groovement will no longer match songs to your runs.
            </p>
            <p className="text-white/70 font-light text-sm">
              To fully remove Groovement&apos;s access, also revoke it on Spotify&apos;s{' '}
              <a
                href="https://www.spotify.com/account/apps/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                Apps page
              </a>
              {' '}(click &quot;Revoke Access&quot;).
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="glass-panel rounded-lg p-4 sm:p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Strava</h2>
              <span className={stravaConnected ? 'text-spotify-green font-bold text-sm' : 'text-white/50 text-sm'}>
                {stravaConnected ? '✓ Connected' : 'Not connected'}
              </span>
            </div>
            {stravaConnected && (
              <DisconnectButton
                action={disconnectStrava}
                label="Disconnect Strava"
                confirmMessage="Disconnect Strava? Groovement will stop updating your activities."
              />
            )}
          </div>

          <div className="glass-panel rounded-lg p-4 sm:p-6 border-l-4 border-spotify-green">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Spotify</h2>
              <span className={spotifyConnected ? 'text-spotify-green font-bold text-sm' : 'text-white/50 text-sm'}>
                {spotifyConnected ? '✓ Connected' : 'Not connected'}
              </span>
            </div>
            {spotifyConnected && (
              <DisconnectButton
                action={disconnectSpotify}
                label="Disconnect Spotify"
                confirmMessage="Disconnect Spotify? Groovement will stop matching songs to your runs."
              />
            )}
          </div>
        </div>

        <form action="/api/logout" method="POST" className="text-center">
          <button
            type="submit"
            className="text-spotify-green hover:opacity-80 font-light underline"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
