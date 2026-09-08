import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../api";
import GlossCell from "../components/GlossCell";

interface WordStat {
  surface_devanagari: string;
  surface_romanized: string;
  english_gloss: string;
  word_sense_definition: string | null;
  note: string | null;
  word_sense_id: string | null;
  play_count: number;
  word_audio_path: string | null;
  sentence_word_id: string | null;
}

type SortColumn = "devanagari" | "romanized" | "english" | "override" | "count";
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
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
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

  function sortIndicator(column: SortColumn) {
    if (sortColumn !== column) return null;
    return sortDirection === "desc" ? " ↓" : " ↑";
  }

  return (
    <main className="container py-6 px-4">
      <div className="has-text-right is-size-7 has-text-grey mb-2">
        {user ? (
          <>
            <span>{user.display_name ?? user.email}</span>
            {" · "}
            <Link to="/" className="has-text-grey">
              Back to reading
            </Link>
          </>
        ) : (
          <Link to="/auth">Sign in</Link>
        )}
      </div>

      <h1 className="title mb-4">Words</h1>
      {isFetching && (
        <div
          className="is-size-1"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            animation: "spin 1s linear infinite",
            pointerEvents: "none",
          }}
        >
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
            <div className="box mb-5">
              <div className="columns is-mobile has-text-centered-mobile">
                <div className="column">
                  <p className="is-size-7 has-text-grey mb-1">Count</p>
                  <p className="is-size-5 has-text-weight-bold">{summary.count}</p>
                </div>
                <div className="column">
                  <p className="is-size-7 has-text-grey mb-1">Mean</p>
                  <p className="is-size-5 has-text-weight-bold">{summary.mean.toFixed(1)}</p>
                </div>
                <div className="column">
                  <p className="is-size-7 has-text-grey mb-1">Min</p>
                  <p className="is-size-5 has-text-weight-bold">{summary.min}</p>
                </div>
                <div className="column">
                  <p className="is-size-7 has-text-grey mb-1">Max</p>
                  <p className="is-size-5 has-text-weight-bold">{summary.max}</p>
                </div>
              </div>
            </div>
          )}

          <div className="field is-grouped is-align-items-center mb-4">
            <label className="is-size-7" style={{ opacity: isFetching ? 0.5 : 1 }}>
              Reviews between{" "}
              <input
                type="number"
                min="0"
                className="input is-small"
                disabled={isFetching}
                value={minReviews}
                onChange={(e) => setMinReviews(parseInt(e.target.value) || 0)}
                style={{ width: "4.5rem", display: "inline-block", margin: "0 0.25rem" }}
              />
              and{" "}
              <input
                type="number"
                min="0"
                className="input is-small"
                disabled={isFetching}
                value={maxReviews === MAX_REVIEWS_DEFAULT ? "" : maxReviews}
                onChange={(e) => setMaxReviews(e.target.value === "" ? MAX_REVIEWS_DEFAULT : parseInt(e.target.value) || 0)}
                style={{ width: "4.5rem", display: "inline-block", marginLeft: "0.25rem" }}
                placeholder="∞"
              />
            </label>
            <div className="control">
              <button
                className="button is-small is-link ml-2"
                onClick={handleFilterChange}
                disabled={isFetching}
              >
                Apply
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="table is-fullwidth is-hoverable" style={{ minWidth: 640, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "28%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>
                    <button
                      className={`button is-text is-small p-0 ${sortColumn === "devanagari" ? "has-text-link" : "has-text-grey"}`}
                      onClick={() => handleSortClick("devanagari")}
                      disabled={isFetching}
                      style={{ opacity: isFetching ? 0.5 : 1 }}
                    >
                      Devanagari{sortIndicator("devanagari")}
                    </button>
                  </th>
                  <th>
                    <button
                      className={`button is-text is-small p-0 ${sortColumn === "romanized" ? "has-text-link" : "has-text-grey"}`}
                      onClick={() => handleSortClick("romanized")}
                      disabled={isFetching}
                      style={{ opacity: isFetching ? 0.5 : 1 }}
                    >
                      Romanized{sortIndicator("romanized")}
                    </button>
                  </th>
                  <th>
                    <button
                      className={`button is-text is-small p-0 ${sortColumn === "english" ? "has-text-link" : "has-text-grey"}`}
                      onClick={() => handleSortClick("english")}
                      disabled={isFetching}
                      style={{ opacity: isFetching ? 0.5 : 1 }}
                    >
                      Original{sortIndicator("english")}
                    </button>
                  </th>
                  <th>
                    <button
                      className={`button is-text is-small p-0 ${sortColumn === "override" ? "has-text-link" : "has-text-grey"}`}
                      onClick={() => handleSortClick("override")}
                      disabled={isFetching}
                      style={{ opacity: isFetching ? 0.5 : 1 }}
                    >
                      Override{sortIndicator("override")}
                    </button>
                  </th>
                  <th className="has-text-right">
                    <button
                      className={`button is-text is-small p-0 ${sortColumn === "count" ? "has-text-link" : "has-text-grey"}`}
                      onClick={() => handleSortClick("count")}
                      disabled={isFetching}
                      style={{ opacity: isFetching ? 0.5 : 1 }}
                    >
                      Reviews{sortIndicator("count")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {words.map((word, idx) => (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor: highlightedId === word.sentence_word_id ? "rgba(30, 144, 255, 0.22)" : undefined,
                      transition: "background-color 0.2s ease-out",
                    }}
                  >
                    <td className="devanagari" style={{ fontSize: "1.2rem" }}>{word.surface_devanagari}</td>
                    <td className="has-text-grey is-size-7">{word.surface_romanized}</td>
                    <td className="has-text-grey is-size-7">
                      {word.word_sense_definition ?? word.english_gloss}
                    </td>
                    <td className="is-size-7">
                      <GlossCell
                        word_sense_id={word.word_sense_id}
                        word_sense_definition={word.word_sense_definition}
                        english_gloss={word.english_gloss}
                        note={word.note}
                        showFallback={false}
                      />
                    </td>
                    <td className="has-text-right has-text-weight-bold">
                      {word.play_count}
                    </td>
                    <td className="has-text-centered">
                      {word.word_audio_path && word.sentence_word_id && (
                        <button
                          className="button is-small"
                          onClick={() => {
                            const wordId = word.sentence_word_id!;
                            new Audio(apiUrl(`/audio/${word.word_audio_path}`)).play();
                            setHighlightedId(wordId);
                            fetch(apiUrl(`/api/sentences/words/${wordId}/played`), {
                              method: "POST",
                              credentials: "include",
                            }).then(() => {
                              // Give the user a couple of seconds to hear the
                              // audio and see the highlighted row before the
                              // updated play count re-sorts it out of view.
                              // https://github.com/brantmerrell/hi/issues/9
                              setTimeout(() => {
                                fetch(apiUrl(`/api/stats/words?limit=${LIMIT}&offset=${offset}&min_reviews=${appliedMinReviews}&max_reviews=${appliedMaxReviews}&sort_by=${sortColumn}&sort_order=${sortDirection}`), { credentials: "include" })
                                  .then((r) => (r.ok ? r.json() : null))
                                  .then((data) => {
                                    if (data) {
                                      setWords(data.words || []);
                                      setSummary(data.summary || { count: 0, mean: 0, min: 0, max: 0 });
                                    }
                                    setHighlightedId((current) => (current === wordId ? null : current));
                                  });
                              }, 2000);
                            });
                          }}
                          title="Play audio"
                        >
                          ▶
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="level mt-5">
            <div className="level-left">
              <p className="is-size-7 has-text-grey">
                {summary.count > 0 && `Showing ${offset + 1}–${Math.min(offset + LIMIT, summary.count)} of ${summary.count}`}
              </p>
            </div>
            <div className="level-right">
              <div className="field is-grouped">
                <div className="control">
                  <button
                    className="button is-small"
                    onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                    disabled={offset === 0 || isFetching}
                  >
                    ← Previous
                  </button>
                </div>
                <div className="control">
                  <button
                    className="button is-small"
                    onClick={() => setOffset(offset + LIMIT)}
                    disabled={offset + LIMIT >= summary.count || isFetching}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
