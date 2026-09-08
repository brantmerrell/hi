import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AudioPlayer from "../components/AudioPlayer";
import Navigation from "../components/Navigation";
import SentenceView from "../components/SentenceView";
import WordGloss from "../components/WordGloss";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../api";
import type { Sentence, Story } from "../types";

interface Bookmark {
  story_position: number | null;
  sentence_seq_num: number;
}

export default function Reader() {
  const { user, setUser } = useAuth();
  const { storyNum: storyNumStr, sentenceNum: sentenceNumStr } = useParams<{ storyNum?: string; sentenceNum?: string }>();
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [index, setIndex] = useState(0);
  const [showGloss, setShowGloss] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wordCache = useRef<Map<string, Sentence>>(new Map());
  const [currentDetail, setCurrentDetail] = useState<Sentence | null>(null);
  const skipBookmarkSave = useRef(false);

  // Load story list once
  useEffect(() => {
    async function loadStories() {
      try {
        const res = await fetch(apiUrl("/api/stories"));
        if (!res.ok) throw new Error("Failed to fetch stories");
        const data: Story[] = await res.json();
        if (data.length === 0) {
          setError("No stories in the database yet.");
          setLoading(false);
          return;
        }
        setStories(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        setLoading(false);
      }
    }
    loadStories();
  }, []);

  // Load sentences whenever stories list or storyNum param changes
  useEffect(() => {
    if (!stories.length) return;

    const storyPos = storyNumStr ? parseInt(storyNumStr) : null;
    const story = storyPos !== null ? (stories.find((s) => s.position === storyPos) ?? null) : null;

    async function loadSentences() {
      try {
        // Fetch global bookmark (best-effort; null if unauthenticated or none saved)
        const bmRes = await fetch(apiUrl("/api/bookmarks"), { credentials: "include" });
        const bm: Bookmark | null = bmRes.ok ? await bmRes.json() : null;

        // Rule: no story in URL or story position not found → redirect to bookmark or first story/sentence
        if (!storyNumStr || !story) {
          skipBookmarkSave.current = true;
          if (bm && bm.story_position !== null) {
            navigate(`/${bm.story_position}/${bm.sentence_seq_num + 1}`, { replace: true });
          } else {
            const fallback = stories[0];
            navigate(`/${fallback.position ?? 0}/1`, { replace: true });
          }
          return;
        }

        // Story exists — load its sentences
        setCurrentStory(story);
        wordCache.current = new Map();
        setCurrentDetail(null);

        const sentencesRes = await fetch(apiUrl(`/api/stories/${story.id}/sentences?limit=500`));
        if (!sentencesRes.ok) throw new Error("Failed to fetch sentences");
        const sentencesData: Sentence[] = await sentencesRes.json();
        setSentences(sentencesData);

        if (!sentenceNumStr) {
          // Rule: story exists, no sentence → use bookmark if same story, else first sentence
          skipBookmarkSave.current = true;
          const bmSeq = bm && bm.story_position === storyPos ? bm.sentence_seq_num : null;
          const targetSeqNum = bmSeq !== null ? bmSeq + 1 : 1;
          navigate(`/${storyPos}/${targetSeqNum}`, { replace: true });
          return;
        }

        // Rule: story and sentence both specified — validate sentence exists
        const seqNum = parseInt(sentenceNumStr) - 1;
        const idx = sentencesData.findIndex((s) => s.sequence_num === seqNum);
        if (idx === -1) {
          // Rule: sentence doesn't exist → redirect to first sentence of story
          skipBookmarkSave.current = true;
          navigate(`/${storyPos}/1`, { replace: true });
          return;
        }
        // Valid — index will be set by the sync effect below
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    loadSentences();
  }, [stories, storyNumStr]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Save global bookmark whenever index changes
  useEffect(() => {
    if (skipBookmarkSave.current) {
      skipBookmarkSave.current = false;
      return;
    }
    const sentence = sentences[index];
    if (!user || !sentence) return;

    fetch(apiUrl("/api/bookmarks"), {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sentence_id: sentence.id }),
    });
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(newIdx: number) {
    const s = sentences[newIdx];
    if (s) navigate(`/${currentStory?.position ?? storyNumStr ?? 0}/${s.sequence_num + 1}`);
  }

  if (loading) return <main className="container is-max-desktop py-6 px-4"><p>Loading...</p></main>;
  if (error) return <main className="container is-max-desktop py-6 px-4"><p>Error: {error}</p></main>;

  const sentence = sentences[index] ?? null;
  const detail = currentDetail?.id === sentence?.id ? currentDetail : null;

  return (
    <main className="container is-max-desktop py-6 px-4">
      <div className="has-text-right is-size-7 has-text-grey mb-2">
        {user ? (
          <>
            <span>{user.display_name ?? user.email}</span>
            {" · "}
            <Link to="/words" className="has-text-grey">
              Words
            </Link>
            {" · "}
            <button
              className="button is-text is-small has-text-grey p-0"
              onClick={() =>
                fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" })
                  .then(() => setUser(null))
              }
            >
              Sign out
            </button>
          </>
        ) : (
          <Link to="/auth">Sign in</Link>
        )}
      </div>

      {currentStory && (
        <header className="mb-5">
          <h1 className="title mb-1 devanagari">{currentStory.title_hi}</h1>
          {currentStory.title_en && (
            <p className="subtitle is-6 has-text-grey-light mb-1">
              {currentStory.title_en}
            </p>
          )}
          <p className="is-size-7 has-text-grey">
            {currentStory.author} · sentence {index + 1} of {sentences.length}
          </p>
        </header>
      )}

      {detail && !showGloss && <SentenceView sentence={detail} />}
      {sentence && !detail && !showGloss && (
        <p className="is-size-7 has-text-grey">Loading…</p>
      )}

      <div className="mt-4">
        <button
          className="button is-small"
          onClick={() => setShowGloss((v) => !v)}
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
