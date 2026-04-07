import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  // If the URL contains ?token=..., verify it immediately on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) return;

    setBusy(true);
    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.detail ?? "Verification failed");
        }
        // Re-fetch the session so AuthContext is populated before redirect.
        return fetch("/api/auth/me", { credentials: "include" });
      })
      .then(async (r) => {
        if (r.ok) setUser(await r.json());
        navigate("/", { replace: true });
      })
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Verification failed");
        setBusy(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail ?? "Request failed");
      setMessage("Check your email for a login link.");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main data-page="Auth">
      <h1>Sign in</h1>
      {busy && !message ? (
        <p>Verifying...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
          <button type="submit" disabled={busy}>
            Send magic link
          </button>
        </form>
      )}
      {message && <p>{message}</p>}
    </main>
  );
}
