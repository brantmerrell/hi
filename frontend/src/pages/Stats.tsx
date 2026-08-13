import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "../api";
import StatsFilters from "../components/stats/StatsFilters";
import StatsPagination from "../components/stats/StatsPagination";
import StatsSummary from "../components/stats/StatsSummary";
import StatsTable from "../components/stats/StatsTable";
import type {
  SortColumn,
  SortDirection,
  StatsSummaryData,
  WordStat,
} from "../components/stats/types";
import { useAuth } from "../context/AuthContext";

const LIMIT = 10;
const MAX_REVIEWS_DEFAULT = 999999;
const EMPTY_SUMMARY: StatsSummaryData = { count: 0, mean: 0, min: 0, max: 0 };

function buildStatsUrl(
  offset: number,
  minReviews: number,
  maxReviews: number,
  sortColumn: SortColumn,
  sortDirection: SortDirection
) {
  return apiUrl(
    `/api/stats/words?limit=${LIMIT}&offset=${offset}&min_reviews=${minReviews}&max_reviews=${maxReviews}&sort_by=${sortColumn}&sort_order=${sortDirection}`
  );
}

export default function Stats() {
  const { user } = useAuth();
  const [words, setWords] = useState<WordStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>("count");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [minReviews, setMinReviews] = useState(0);
  const [maxReviews, setMaxReviews] = useState(MAX_REVIEWS_DEFAULT);
  const [appliedMinReviews, setAppliedMinReviews] = useState(0);
  const [appliedMaxReviews, setAppliedMaxReviews] = useState(MAX_REVIEWS_DEFAULT);
  const [offset, setOffset] = useState(0);
  const [summary, setSummary] = useState<StatsSummaryData>(EMPTY_SUMMARY);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  function handleSortClick(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortColumn(column);
      setSortDirection(column === "count" ? "desc" : "asc");
    }
    setOffset(0);
  }

  function handleFilterChange() {
    setAppliedMinReviews(minReviews);
    setAppliedMaxReviews(maxReviews);
    setOffset(0);
  }

  function handlePlay(word: WordStat) {
    if (!word.word_audio_path || !word.sentence_word_id) return;

    const wordId = word.sentence_word_id;
    new Audio(apiUrl(`/audio/${word.word_audio_path}`)).play();
    setHighlightedId(wordId);
    fetch(apiUrl(`/api/sentences/words/${wordId}/played`), {
      method: "POST",
      credentials: "include",
    }).then(() => {
      // Keep the row visible long enough for the user to hear the audio before
      // the updated play count can re-sort it out of view.
      setTimeout(() => {
        fetch(
          buildStatsUrl(
            offset,
            appliedMinReviews,
            appliedMaxReviews,
            sortColumn,
            sortDirection
          ),
          { credentials: "include" }
        )
          .then((response) => (response.ok ? response.json() : null))
          .then((data) => {
            if (data) {
              setWords(data.words || []);
              setSummary(data.summary || EMPTY_SUMMARY);
            }
            setHighlightedId((current) => (current === wordId ? null : current));
          });
      }, 2000);
    });
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
          buildStatsUrl(
            offset,
            appliedMinReviews,
            appliedMaxReviews,
            sortColumn,
            sortDirection
          ),
          { credentials: "include" }
        );
        const data = await wordsRes.json();
        setWords(data.words || []);
        setSummary(data.summary || EMPTY_SUMMARY);
      } catch {
        setWords([]);
        setSummary(EMPTY_SUMMARY);
      } finally {
        setIsFetching(false);
        setLoading(false);
      }
    }

    load();
  }, [
    user,
    offset,
    appliedMinReviews,
    appliedMaxReviews,
    sortColumn,
    sortDirection,
  ]);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "2rem 1rem" }}>
      <div
        style={{
          textAlign: "right",
          fontSize: "0.8rem",
          color: "#888",
          marginBottom: "0.5rem",
        }}
      >
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

      <h1 style={{ margin: 0 }}>Words</h1>
      {isFetching && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "3rem",
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
          <StatsSummary summary={summary} />
          <StatsFilters
            minReviews={minReviews}
            maxReviews={maxReviews}
            maxReviewsDefault={MAX_REVIEWS_DEFAULT}
            isFetching={isFetching}
            onMinReviewsChange={setMinReviews}
            onMaxReviewsChange={setMaxReviews}
            onApply={handleFilterChange}
          />
          <StatsTable
            words={words}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            isFetching={isFetching}
            highlightedId={highlightedId}
            onSort={handleSortClick}
            onPlay={handlePlay}
          />
          <StatsPagination
            offset={offset}
            limit={LIMIT}
            count={summary.count}
            isFetching={isFetching}
            onPrevious={() => setOffset(Math.max(0, offset - LIMIT))}
            onNext={() => setOffset(offset + LIMIT)}
          />
        </>
      )}
    </main>
  );
}
