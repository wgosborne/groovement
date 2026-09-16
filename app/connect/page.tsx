import { prisma } from '@/lib/prisma';
import type { OAuthToken } from '@prisma/client';

interface ConnectPageProps {
  searchParams: Promise<{ token?: string; error?: string }>;
}

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
  const params = await searchParams;
  const token = params.token;
  const error = params.error;

  if (!token) {
    return <ErrorState message="No token provided. This link is invalid." />;
  }

  let user;
  let stravaConnected = false;
  let spotifyConnected = false;

  try {
    user = await prisma.user.findUnique({
      where: { connectToken: token },
      include: {
        oauthTokens: true,
      },
    });

    if (!user || user.status !== 'approved') {
      return <ErrorState message="This link is invalid or has expired." />;
    }

    stravaConnected = user.oauthTokens.some((t: OAuthToken) => t.service === 'strava');
    spotifyConnected = user.oauthTokens.some((t: OAuthToken) => t.service === 'spotify');
  } catch (error) {
    console.error('Failed to look up user:', error);
    return <ErrorState message="Something went wrong. Please try again." />;
  }

  const bothConnected = stravaConnected && spotifyConnected;

  if (bothConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel rounded-lg p-6 sm:p-8 w-full max-w-md text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-spotify-green mb-4">You're all set!</h1>
          <p className="text-white/80 font-light mb-6 leading-relaxed">
            Go for a run and Groovement will handle the rest. Your activities will be updated with song matches.
          </p>
          <a
            href="https://www.strava.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-spotify-green text-black px-6 sm:px-8 py-3 sm:py-2 rounded-md hover:bg-opacity-90 font-bold transition"
          >
            Open Strava
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="glass-panel rounded-lg p-6 sm:p-8 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Welcome, {user.name}!</h1>
          <p className="text-sm sm:text-base text-white/70 font-light">Connect your accounts to get started</p>
        </div>

        {error === 'duplicate_strava' && (
          <div className="glass-panel rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 border-l-4 border-red-500 bg-red-500/10">
            <h2 className="text-base sm:text-lg font-bold text-red-400 mb-2">Strava Account Already Connected</h2>
            <p className="text-sm sm:text-base text-white/80 font-light">
              This Strava account is already connected to a different Groovement account. If you think this is a mistake, please contact the developer.
            </p>
          </div>
        )}

        {error === 'duplicate_spotify' && (
          <div className="glass-panel rounded-lg p-4 sm:p-6 mb-6 sm:mb-8 border-l-4 border-red-500 bg-red-500/10">
            <h2 className="text-base sm:text-lg font-bold text-red-400 mb-2">Spotify Account Already Connected</h2>
            <p className="text-sm sm:text-base text-white/80 font-light">
              This Spotify account is already connected to a different Groovement account. If you think this is a mistake, please contact the developer.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Strava Section */}
          <div className="glass-panel rounded-lg p-4 sm:p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Strava</h2>
              {stravaConnected ? (
                <span className="text-spotify-green font-bold text-sm">✓ Connected</span>
              ) : null}
            </div>

            <p className="text-white/70 font-light mb-6">
              {stravaConnected
                ? 'Your Strava account is connected.'
                : 'Connect your Strava account to sync your activities.'}
            </p>

            {!stravaConnected && (
              <a
                href={`/connect/strava?token=${encodeURIComponent(token)}`}
                className="inline-block w-full bg-orange-600 text-white text-center py-3 sm:py-2 rounded-md hover:bg-opacity-90 font-bold transition"
              >
                Connect Strava
              </a>
            )}
          </div>

          {/* Spotify Section */}
          <div className="glass-panel rounded-lg p-4 sm:p-6 border-l-4 border-spotify-green">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white">Spotify</h2>
              {spotifyConnected ? (
                <span className="text-spotify-green font-bold text-sm">✓ Connected</span>
              ) : null}
            </div>

            <p className="text-white/70 font-light mb-6">
              {spotifyConnected
                ? 'Your Spotify account is connected.'
                : 'Connect your Spotify account to match songs from your activities.'}
            </p>

            {!spotifyConnected && (
              <a
                href={`/connect/spotify?token=${encodeURIComponent(token)}`}
                className="inline-block w-full bg-spotify-green text-black text-center py-3 sm:py-2 rounded-md hover:bg-opacity-90 font-bold transition"
              >
                Connect Spotify
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel rounded-lg p-6 sm:p-8 w-full max-w-md text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-red-400 mb-4">Invalid Link</h1>
        <p className="text-sm sm:text-base text-white/80 font-light mb-6">{message}</p>
        <p className="text-xs sm:text-sm text-white/60 font-light">
          Please check the email from Groovement for a valid approval link.
        </p>
      </div>
    </div>
  );
}
