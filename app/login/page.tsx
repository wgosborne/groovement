import { LoginForm } from './login-form';

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const linkError = params.error === 'link_invalid';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-panel rounded-lg p-6 sm:p-8 w-full max-w-md">
        <h1 className="text-2xl sm:text-3xl font-bold text-spotify-green mb-2">Sign in</h1>
        <p className="text-white/70 font-light mb-6">
          Enter the email you signed up with and we&apos;ll send you a sign-in link.
        </p>

        {linkError && (
          <div className="glass-panel border-red-500/30 rounded-md px-4 py-3 bg-red-500/10 mb-4">
            <p className="text-red-300 text-sm font-light">
              That link is invalid or has expired. Request a new one below.
            </p>
          </div>
        )}

        <LoginForm />
      </div>
    </div>
  );
}
