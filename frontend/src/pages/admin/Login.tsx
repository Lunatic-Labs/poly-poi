import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function Login() {
  const { signIn, signUp, session } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "signup" | "verify">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // When session becomes available (either after sign-in or after the user
  // clicks the confirmation link and Supabase sets the session), navigate forward.
  useEffect(() => {
    if (session) navigate("/admin/dashboard");
  }, [session, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setMode("verify");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    setError(null);
    setPending(true);
    try {
      await signUp(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  if (mode === "verify") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-2xl">
            ✉️
          </div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Check your email</h1>
          <p className="mb-1 text-sm text-gray-500">
            We sent a confirmation link to
          </p>
          <p className="mb-6 text-sm font-medium text-gray-800">{email}</p>
          <p className="text-sm text-gray-500">
            Click the link in that email to finish creating your account. You'll be signed in automatically.
          </p>
          <p className="mt-6 text-xs text-gray-400">
            Didn't get it?{" "}
            <button
              onClick={handleResend}
              disabled={pending}
              className="text-blue-600 hover:underline disabled:opacity-50"
            >
              Resend confirmation email
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Low-Key Landmarks</h1>
        <p className="mb-6 text-sm text-gray-500">
          {mode === "login" ? "Sign in to your admin portal" : "Create your admin account"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          {mode === "login" ? (
            <>
              New here?{" "}
              <button onClick={() => setMode("signup")} className="text-blue-600 hover:underline">
                Create account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => setMode("login")} className="text-blue-600 hover:underline">
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
