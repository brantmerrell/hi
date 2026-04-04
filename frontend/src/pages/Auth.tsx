/**
 * Auth — magic link email entry page.
 *
 * On submit: POST /auth/request { email }
 * On mount with ?token=...: GET /auth/verify?token=...
 *
 * TODO: implement form, loading states, and token verification redirect.
 */
import { useState } from "react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: call POST /auth/request and display result
    setMessage("Magic link request — not yet wired up");
  }

  return (
    <main data-page="Auth">
      <h1>Sign in</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit">Send magic link</button>
      </form>
      {message && <p>{message}</p>}
    </main>
  );
}
