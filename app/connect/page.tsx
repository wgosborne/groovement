import { prisma } from '@/lib/prisma';
import type { OAuthToken } from '@prisma/client';

interface ConnectPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
  const params = await searchParams;
  const token = params.token;

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
        <div className="glass-panel rounded-lg p-8 w-full max-w-md text-center">
          <h1 className="text-4xl font-bold text-spotify-green mb-4">You're all set!</h1>
          <p className="text-white/80 font-light mb-6 leading-relaxed">
            Go for a run and Groovement will handle the rest. Your activities will be updated with song matches.
          </p>
          <a
            href="https://www.strava.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-spotify-green text-black px-6 py-2 rounded-md hover:bg-opacity-90 font-bold transition"
          >
            Open Strava
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="glass-panel rounded-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome, {user.name}!</h1>
          <p className="text-white/70 font-light">Connect your accounts to get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Strava Section */}
          <div className="glass-panel rounded-lg p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Strava</h2>
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
                className="inline-block w-full bg-orange-600 text-white text-center py-2 rounded-md hover:bg-opacity-90 font-bold transition"
              >
                Connect Strava
              </a>
            )}
          </div>

          {/* Spotify Section */}
          <div className="glass-panel rounded-lg p-6 border-l-4 border-spotify-green">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Spotify</h2>
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
                className="inline-block w-full bg-spotify-green text-black text-center py-2 rounded-md hover:bg-opacity-90 font-bold transition"
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
      <div className="glass-panel rounded-lg p-8 w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-red-400 mb-4">Invalid Link</h1>
        <p className="text-white/80 font-light mb-6">{message}</p>
        <p className="text-sm text-white/60 font-light">
          Please check the email from Groovement for a valid approval link.
        </p>
      </div>
    </div>
  );
}
