import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AudioPlayer from "../components/AudioPlayer";
import Navigation from "../components/Navigation";
import SentenceView from "../components/SentenceView";
import WordGloss from "../components/WordGloss";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../api";
import type { Sentence, Story } from "../types";

export default function Reader() {
  const { user, setUser } = useAuth();
  const { storyNum: storyNumStr, sentenceNum: sentenceNumStr } = useParams<{ storyNum?: string; sentenceNum?: string }>();
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [index, setIndex] = useState(0);
  const [showGloss, setShowGloss] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wordCache = useRef<Map<string, Sentence>>(new Map());
  const [currentDetail, setCurrentDetail] = useState<Sentence | null>(null);
  const bookmarkLoadedRef = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const storiesRes = await fetch(apiUrl("/api/stories"));
        if (!storiesRes.ok) throw new Error("Failed to fetch stories");
        const storiesData: Story[] = await storiesRes.json();
        setStories(storiesData);

        if (storiesData.length === 0) {
          setError("No stories in the database yet.");
          setLoading(false);
          return;
        }

        const story = storiesData[0];

        const [sentencesRes, bmRes] = await Promise.all([
          fetch(apiUrl(`/api/stories/${story.id}/sentences?limit=500`)),
          fetch(apiUrl(`/api/bookmarks/${story.id}`), { credentials: "include" }),
        ]);
        if (!sentencesRes.ok) throw new Error("Failed to fetch sentences");
        const sentencesData: Sentence[] = await sentencesRes.json();
        setSentences(sentencesData);

        if (!storyNumStr || !sentenceNumStr) {
          // No URL params: redirect to bookmark or first sentence
          let targetSeqNum = sentencesData[0]?.sequence_num ?? 1;
          if (bmRes.ok) {
            const bm = await bmRes.json();
            const savedIdx = sentencesData.findIndex((s) => s.id === bm.sentence_id);
            if (savedIdx !== -1) targetSeqNum = sentencesData[savedIdx].sequence_num;
          }
          bookmarkLoadedRef.current = true;
          navigate(`/1/${targetSeqNum + 1}`, { replace: true });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync index from URL params whenever params or sentences change
  // sentenceNum in URL is 1-based; sequence_num in DB is 0-based
  useEffect(() => {
    if (!sentences.length || !sentenceNumStr) return;
    const seqNum = parseInt(sentenceNumStr) - 1;
    const idx = sentences.findIndex((s) => s.sequence_num === seqNum);
    if (idx !== -1) setIndex(idx);
  }, [sentenceNumStr, sentences]);

  async function fetchDetail(sentenceId: string) {
    if (wordCache.current.has(sentenceId)) {
      setCurrentDetail(wordCache.current.get(sentenceId)!);
      return;
    }
    const res = await fetch(apiUrl(`/api/sentences/${sentenceId}`));
    if (!res.ok) return;
    const data: Sentence = await res.json();
    wordCache.current.set(sentenceId, data);
    setCurrentDetail(data);
  }

  // Fetch word detail whenever index changes
  useEffect(() => {
    const sentence = sentences[index];
    if (!sentence) return;
    fetchDetail(sentence.id);
  }, [index, sentences]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save bookmark whenever index changes (skip the initial bookmark-driven navigation)
  useEffect(() => {
    if (bookmarkLoadedRef.current) {
      bookmarkLoadedRef.current = false;
      return;
    }
    const story = stories[0];
    const sentence = sentences[index];
    if (!user || !story || !sentence) return;

    fetch(apiUrl(`/api/bookmarks/${story.id}`), {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence_id: sentence.id }),
    });
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(newIdx: number) {
    const s = sentences[newIdx];
    if (s) navigate(`/1/${s.sequence_num + 1}`);
  }

  if (loading) return <main><p>Loading...</p></main>;
  if (error) return <main><p>Error: {error}</p></main>;

  const sentence = sentences[index] ?? null;
  const story = stories[0] ?? null;
  const detail = currentDetail?.id === sentence?.id ? currentDetail : null;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ textAlign: "right", fontSize: "0.8rem", color: "#888", marginBottom: "0.5rem" }}>
        {user ? (
          <>
            <span>{user.display_name ?? user.email}</span>
            {" · "}
            <Link to="/stats" style={{ color: "#888" }}>
              Stats
            </Link>
            {" · "}
            <button
              onClick={() =>
                fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" })
                  .then(() => setUser(null))
              }
              style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: "0.8rem", padding: 0 }}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link to="/auth">Sign in</Link>
        )}
      </div>

      {story && (
        <header style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: 0 }}>{story.title_hi}</h1>
          {story.title_en && (
            <p style={{ margin: "0.1rem 0 0", color: "#ccc", fontSize: "1rem" }}>
              {story.title_en}
            </p>
          )}
          <p style={{ margin: "0.25rem 0 0", color: "#888", fontSize: "0.9rem" }}>
            {story.author} · sentence {index + 1} of {sentences.length}
          </p>
        </header>
      )}

      {detail && !showGloss && <SentenceView sentence={detail} />}
      {sentence && !detail && !showGloss && (
        <div style={{ color: "#555", fontSize: "0.9rem" }}>Loading…</div>
      )}

      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={() => setShowGloss((v) => !v)}
          style={{ fontSize: "0.85rem", padding: "0.3rem 0.75rem" }}
        >
          {showGloss ? "Show sentence" : "Show word-by-word"}
        </button>
      </div>

      {showGloss && detail && <WordGloss words={detail.words ?? []} />}

      {sentence && <AudioPlayer audioPath={sentence.audio_path} sentenceId={sentence.id} />}

      <Navigation
        onPrev={() => goTo(Math.max(0, index - 1))}
        onNext={() => goTo(Math.min(sentences.length - 1, index + 1))}
        hasPrev={index > 0}
        hasNext={index < sentences.length - 1}
      />
    </main>
  );
}
