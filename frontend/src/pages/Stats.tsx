import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface WordStat {
  surface_devanagari: string;
  surface_romanized: string;
  english_gloss: string;
  play_count: number;
  word_audio_path: string | null;
  sentence_word_id: string | null;
}

type SortBy = "count" | "alphabetical";

export default function Stats() {
  const { user } = useAuth();
  const [words, setWords] = useState<WordStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>("count");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetch("/api/stats/words", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setWords(data))
      .catch(() => setWords([]))
      .finally(() => setLoading(false));
  }, [user]);

  const sorted = [...words].sort((a, b) => {
    if (sortBy === "count") {
      return b.play_count - a.play_count;
    } else {
      return a.surface_devanagari.localeCompare(b.surface_devanagari);
    }
  });

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ textAlign: "right", fontSize: "0.8rem", color: "#888", marginBottom: "0.5rem" }}>
        {user ? (
          <>
            <span>{user.display_name ?? user.email}</span>
            {" · "}
            <Link to="/" style={{ color: "#888" }}>
              Back to reading
            </Link>
          </>
        ) : (
          <Link to="/auth">Sign in</Link>
        )}
      </div>

      <h1>Word Review Stats</h1>

      {!user ? (
        <p>Sign in to see your word review statistics.</p>
      ) : loading ? (
        <p>Loading...</p>
      ) : words.length === 0 ? (
        <p>No words reviewed yet. Play some audio to start tracking.</p>
      ) : (
        <>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.9rem" }}>
              Sort by:{" "}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                style={{ marginLeft: "0.5rem" }}
              >
                <option value="count">Review count (most first)</option>
                <option value="alphabetical">Alphabetically</option>
              </select>
            </label>
          </div>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.9rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <th style={{ textAlign: "left", padding: "0.5rem 0" }}>Devanagari</th>
                <th style={{ textAlign: "left", padding: "0.5rem 0" }}>Romanized</th>
                <th style={{ textAlign: "left", padding: "0.5rem 0" }}>English</th>
                <th style={{ textAlign: "right", padding: "0.5rem 0" }}>Reviews</th>
                <th style={{ textAlign: "center", padding: "0.5rem 0" }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((word, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.5rem 0" }}>{word.surface_devanagari}</td>
                  <td style={{ padding: "0.5rem 0", color: "#666", fontSize: "0.85rem" }}>
                    {word.surface_romanized}
                  </td>
                  <td style={{ padding: "0.5rem 0", color: "#666", fontSize: "0.85rem" }}>
                    {word.english_gloss}
                  </td>
                  <td style={{ padding: "0.5rem 0", textAlign: "right", fontWeight: "bold" }}>
                    {word.play_count}
                  </td>
                  <td style={{ padding: "0.5rem 0", textAlign: "center" }}>
                    {word.word_audio_path && word.sentence_word_id && (
                      <button
                        onClick={() => {
                          new Audio(`/audio/${word.word_audio_path}`).play();
                          fetch(`/api/sentences/words/${word.sentence_word_id}/played`, {
                            method: "POST",
                            credentials: "include",
                          }).then(() => {
                            // Refresh stats to show updated count
                            fetch("/api/stats/words", { credentials: "include" })
                              .then((r) => (r.ok ? r.json() : []))
                              .then((data) => setWords(data));
                          });
                        }}
                        title="Play audio"
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "0",
                          fontSize: "0.8rem",
                          color: "#666",
                          lineHeight: 1,
                        }}
                      >
                        ▶
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
