import { confirmLogin } from './actions';

interface VerifyPageProps {
  searchParams: Promise<{ token?: string }>;
}

// Renders a button rather than signing in on GET, so email link scanners that
// prefetch URLs can't use up the single-use token.
export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-panel rounded-lg p-6 sm:p-8 w-full max-w-md text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-red-400 mb-4">Invalid Link</h1>
          <p className="text-sm sm:text-base text-white/80 font-light">
            That sign-in link is missing its token. Request a new one from the login page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel rounded-lg p-6 sm:p-8 w-full max-w-md text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-spotify-green mb-4">Confirm sign-in</h1>
        <p className="text-white/80 font-light mb-6 leading-relaxed">
          Click the button below to sign in to Groovement on this device.
        </p>
        <form action={confirmLogin}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full bg-spotify-green text-black font-bold py-3 sm:py-2 rounded-md hover:bg-opacity-90 transition"
          >
            Confirm sign-in
          </button>
        </form>
      </div>
    </div>
  );
}
