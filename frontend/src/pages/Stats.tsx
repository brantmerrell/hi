import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../api";

interface WordStat {
  surface_devanagari: string;
  surface_romanized: string;
  english_gloss: string;
  play_count: number;
  word_audio_path: string | null;
  sentence_word_id: string | null;
}

type SortColumn = "devanagari" | "romanized" | "english" | "count";
type SortDirection = "asc" | "desc";

export default function Stats() {
  const { user } = useAuth();
  const [words, setWords] = useState<WordStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>("count");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [minReviews, setMinReviews] = useState(0);
  const [maxReviews, setMaxReviews] = useState(999999);
  const [appliedMinReviews, setAppliedMinReviews] = useState(0);
  const [appliedMaxReviews, setAppliedMaxReviews] = useState(999999);
  const [offset, setOffset] = useState(0);
  const [summary, setSummary] = useState({ count: 0, mean: 0, min: 0, max: 0 });
  const LIMIT = 10;
  const MAX_REVIEWS_DEFAULT = 999999;

  function handleSortClick(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "count" ? "desc" : "asc");
    }
    setOffset(0); // Reset to first page when sorting changes
  }

  function handleFilterChange() {
    setAppliedMinReviews(minReviews);
    setAppliedMaxReviews(maxReviews);
    setOffset(0); // Reset to first page when filters change
  }

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function load() {
      setIsFetching(true);
      try {
        const wordsRes = await fetch(
          apiUrl(`/api/stats/words?limit=${LIMIT}&offset=${offset}&min_reviews=${appliedMinReviews}&max_reviews=${appliedMaxReviews}&sort_by=${sortColumn}&sort_order=${sortDirection}`),
          {
            credentials: "include",
          }
        );
        const data = await wordsRes.json();
        setWords(data.words || []);
        setSummary(data.summary || { count: 0, mean: 0, min: 0, max: 0 });
      } catch (e) {
        setWords([]);
        setSummary({ count: 0, mean: 0, min: 0, max: 0 });
      } finally {
        setIsFetching(false);
        setLoading(false);
      }
    }

    load();
  }, [user, offset, appliedMinReviews, appliedMaxReviews, sortColumn, sortDirection]);


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

      <h1 style={{ margin: 0 }}>Word Review Stats</h1>
      {isFetching && (
        <div style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "3rem",
          animation: "spin 1s linear infinite",
          pointerEvents: "none",
        }}>
          ⟳
        </div>
      )}
      <style>{`
        @keyframes spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>

      {!user ? (
        <p>Sign in to see your word review statistics.</p>
      ) : loading ? (
        <p>Loading...</p>
      ) : words.length === 0 ? (
        <p>No words reviewed yet. Play some audio to start tracking.</p>
      ) : (
        <>
          {summary.count > 0 && (
            <div
              style={{
                marginBottom: "1.5rem",
                padding: "1rem",
                backgroundColor: "#1a1a1a",
                borderRadius: "0.25rem",
                fontSize: "0.9rem",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
                <div>
                  <div style={{ color: "#888", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                    Count
                  </div>
                  <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>
                    {summary.count}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#888", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                    Mean
                  </div>
                  <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>
                    {summary.mean.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#888", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                    Min
                  </div>
                  <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>
                    {summary.min}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#888", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                    Max
                  </div>
                  <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>
                    {summary.max}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ fontSize: "0.9rem", opacity: isFetching ? 0.5 : 1 }}>
              Reviews between{" "}
              <input
                type="number"
                min="0"
                disabled={isFetching}
                value={minReviews}
                onChange={(e) => setMinReviews(parseInt(e.target.value) || 0)}
                style={{ width: "3rem", marginLeft: "0.25rem", marginRight: "0.25rem" }}
              />
              and{" "}
              <input
                type="number"
                min="0"
                disabled={isFetching}
                value={maxReviews === MAX_REVIEWS_DEFAULT ? "" : maxReviews}
                onChange={(e) => setMaxReviews(e.target.value === "" ? MAX_REVIEWS_DEFAULT : parseInt(e.target.value) || 0)}
                style={{ width: "3rem", marginLeft: "0.25rem" }}
                placeholder="∞"
              />
            </label>
            <button
              onClick={handleFilterChange}
              disabled={isFetching}
              style={{
                padding: "0.3rem 0.75rem",
                background: isFetching ? "#333" : "#555",
                border: "1px solid #666",
                color: isFetching ? "#666" : "#fff",
                cursor: isFetching ? "default" : "pointer",
                fontSize: "0.85rem",
              }}
            >
              Apply
            </button>
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
                <th style={{ textAlign: "left", padding: "0.5rem 0" }}>
                  <button
                    onClick={() => handleSortClick("devanagari")}
                    disabled={isFetching}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: isFetching ? "default" : "pointer",
                      color: sortColumn === "devanagari" ? "#fff" : "#aaa",
                      fontSize: "0.9rem",
                      padding: 0,
                      opacity: isFetching ? 0.5 : 1,
                    }}
                  >
                    Devanagari {sortColumn === "devanagari" && (sortDirection === "desc" ? "↓" : "↑")}
                  </button>
                </th>
                <th style={{ textAlign: "left", padding: "0.5rem 0" }}>
                  <button
                    onClick={() => handleSortClick("romanized")}
                    disabled={isFetching}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: isFetching ? "default" : "pointer",
                      color: sortColumn === "romanized" ? "#fff" : "#aaa",
                      fontSize: "0.9rem",
                      padding: 0,
                      opacity: isFetching ? 0.5 : 1,
                    }}
                  >
                    Romanized {sortColumn === "romanized" && (sortDirection === "desc" ? "↓" : "↑")}
                  </button>
                </th>
                <th style={{ textAlign: "left", padding: "0.5rem 0" }}>
                  <button
                    onClick={() => handleSortClick("english")}
                    disabled={isFetching}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: isFetching ? "default" : "pointer",
                      color: sortColumn === "english" ? "#fff" : "#aaa",
                      fontSize: "0.9rem",
                      padding: 0,
                      opacity: isFetching ? 0.5 : 1,
                    }}
                  >
                    English {sortColumn === "english" && (sortDirection === "desc" ? "↓" : "↑")}
                  </button>
                </th>
                <th style={{ textAlign: "right", padding: "0.5rem 0" }}>
                  <button
                    onClick={() => handleSortClick("count")}
                    disabled={isFetching}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: isFetching ? "default" : "pointer",
                      color: sortColumn === "count" ? "#fff" : "#aaa",
                      fontSize: "0.9rem",
                      padding: 0,
                      opacity: isFetching ? 0.5 : 1,
                    }}
                  >
                    Reviews {sortColumn === "count" && (sortDirection === "desc" ? "↓" : "↑")}
                  </button>
                </th>
                <th style={{ textAlign: "center", padding: "0.5rem 0" }}></th>
              </tr>
            </thead>
            <tbody>
              {words.map((word, idx) => (
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
                          new Audio(apiUrl(`/audio/${word.word_audio_path}`)).play();
                          fetch(apiUrl(`/api/sentences/words/${word.sentence_word_id}/played`), {
                            method: "POST",
                            credentials: "include",
                          }).then(() => {
                            // Refresh stats to show updated count
                            fetch(apiUrl(`/api/stats/words?limit=${LIMIT}&offset=${offset}&min_reviews=${appliedMinReviews}&max_reviews=${appliedMaxReviews}&sort_by=${sortColumn}&sort_order=${sortDirection}`), { credentials: "include" })
                              .then((r) => (r.ok ? r.json() : null))
                              .then((data) => {
                                if (data) {
                                  setWords(data.words || []);
                                  setSummary(data.summary || { count: 0, mean: 0, min: 0, max: 0 });
                                }
                              });
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

          <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem" }}>
            <div style={{ color: "#888" }}>
              {summary.count > 0 && `Showing ${offset + 1}–${Math.min(offset + LIMIT, summary.count)} of ${summary.count}`}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                disabled={offset === 0 || isFetching}
                style={{
                  padding: "0.3rem 0.75rem",
                  background: offset === 0 || isFetching ? "#333" : "#555",
                  border: "1px solid #666",
                  color: offset === 0 || isFetching ? "#666" : "#fff",
                  cursor: offset === 0 || isFetching ? "default" : "pointer",
                  fontSize: "0.85rem",
                }}
              >
                ← Previous
              </button>
              <button
                onClick={() => setOffset(offset + LIMIT)}
                disabled={offset + LIMIT >= summary.count || isFetching}
                style={{
                  padding: "0.3rem 0.75rem",
                  background: offset + LIMIT >= summary.count || isFetching ? "#333" : "#555",
                  border: "1px solid #666",
                  color: offset + LIMIT >= summary.count || isFetching ? "#666" : "#fff",
                  cursor: offset + LIMIT >= summary.count || isFetching ? "default" : "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
