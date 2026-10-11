import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../api";
import LoadingSpinner from "../components/LoadingSpinner";
import WordsSummary from "../components/WordsSummary";
import ReviewFilter from "../components/ReviewFilter";
import WordsTable from "../components/WordsTable";
import Pagination from "../components/Pagination";
import type { SortColumn, SortDirection, WordStat, WordsSummary as Summary } from "../types";

const LIMIT = 10;
const MAX_REVIEWS_DEFAULT = 999999;
const EMPTY_SUMMARY: Summary = { count: 0, mean: 0, min: 0, max: 0 };

export default function Words() {
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
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const statsUrl = apiUrl(`/api/stats/words?limit=${LIMIT}&offset=${offset}&min_reviews=${appliedMinReviews}&max_reviews=${appliedMaxReviews}&sort_by=${sortColumn}&sort_order=${sortDirection}`);

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
        const wordsRes = await fetch(statsUrl, { credentials: "include" });
        const data = await wordsRes.json();
        setWords(data.words || []);
        setSummary(data.summary || EMPTY_SUMMARY);
      } catch (e) {
        setWords([]);
        setSummary(EMPTY_SUMMARY);
      } finally {
        setIsFetching(false);
        setLoading(false);
      }
    }

    load();
  }, [user, statsUrl]);

  function handlePlay(word: WordStat) {
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
        fetch(statsUrl, { credentials: "include" })
          .then((r) => (r.ok ? r.json() : null))
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
      {isFetching && <LoadingSpinner />}

      {!user ? (
        <p>Sign in to see your word review statistics.</p>
      ) : loading ? (
        <p>Loading...</p>
      ) : words.length === 0 ? (
        <p>No words reviewed yet. Play some audio to start tracking.</p>
      ) : (
        <>
          {summary.count > 0 && <WordsSummary summary={summary} />}

          <ReviewFilter
            minReviews={minReviews}
            maxReviews={maxReviews}
            maxDefault={MAX_REVIEWS_DEFAULT}
            disabled={isFetching}
            onMinChange={setMinReviews}
            onMaxChange={setMaxReviews}
            onApply={handleFilterChange}
          />

          <WordsTable
            words={words}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            disabled={isFetching}
            highlightedId={highlightedId}
            onSort={handleSortClick}
            onPlay={handlePlay}
          />

          <Pagination
            offset={offset}
            limit={LIMIT}
            total={summary.count}
            disabled={isFetching}
            onOffsetChange={setOffset}
          />
        </>
      )}
    </main>
  );
}
