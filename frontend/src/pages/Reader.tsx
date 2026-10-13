import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AudioPlayer from "../components/AudioPlayer";
import Navigation from "../components/Navigation";
import StorySidebar from "../components/StorySidebar";
import SentenceView from "../components/SentenceView";
import WordGloss from "../components/WordGloss";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../api";
import type { Chapter, Sentence, Story } from "../types";

interface Bookmark {
  author_slug: string;
  story_position: number | null;
  chapter_position: number;
  sentence_seq_num: number;
}

const readerPath = (author: string, story: number, chapter: number, sentenceNum: number) =>
  `/${author}/${story}/${chapter}/${sentenceNum}`;

export default function Reader() {
  const { user, setUser } = useAuth();
  const params = useParams<{
    authorSlug?: string;
    storyNum?: string;
    chapterNum?: string;
    sentenceNum?: string;
  }>();
  // Legacy URLs were /:storyNum/:sentenceNum; a numeric first segment can't be an author slug
  const isLegacyUrl = params.authorSlug !== undefined && /^\d+$/.test(params.authorSlug);
  const authorSlug = isLegacyUrl ? undefined : params.authorSlug;
  const storyNumStr = isLegacyUrl ? params.authorSlug : params.storyNum;
  // Pre-chapter URLs were /:author/:storyNum/:sentenceNum, which now parses as a chapter
  const chapterNumStr = isLegacyUrl ? undefined : params.chapterNum;
  const sentenceNumStr = isLegacyUrl ? params.storyNum : params.sentenceNum;
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [currentStory, setCurrentStory] = useState<Story | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [index, setIndex] = useState(0);
  const [showGloss, setShowGloss] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
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
    const legacyAuthorSlug = isLegacyUrl ? stories[0].author_slug : null;
    const effectiveAuthor = authorSlug ?? legacyAuthorSlug;
    const story =
      storyPos !== null && effectiveAuthor
        ? (stories.find((s) => s.author_slug === effectiveAuthor && s.position === storyPos) ?? null)
        : null;

    async function loadSentences() {
      try {
        // Fetch global bookmark (best-effort; null if unauthenticated or none saved)
        const bmRes = await fetch(apiUrl("/api/bookmarks"), { credentials: "include" });
        const bm: Bookmark | null = bmRes.ok ? await bmRes.json() : null;

        // Rule: legacy /:storyNum[/:sentenceNum] URL → same story under the first author
        if (isLegacyUrl && story) {
          skipBookmarkSave.current = true;
          navigate(readerPath(story.author_slug, story.position ?? 0, 1, Number(sentenceNumStr ?? 1)), { replace: true });
          return;
        }

        // Rule: author only → that author's first story (bookmark's story if it belongs to them)
        if (authorSlug && !storyNumStr) {
          const authorStories = stories.filter((s) => s.author_slug === authorSlug);
          if (authorStories.length) {
            skipBookmarkSave.current = true;
            if (bm && bm.author_slug === authorSlug && bm.story_position !== null) {
              navigate(readerPath(authorSlug, bm.story_position, bm.chapter_position, bm.sentence_seq_num + 1), { replace: true });
            } else {
              navigate(`/${authorSlug}/${authorStories[0].position ?? 0}/1`, { replace: true });
            }
            return;
          }
        }

        // Rule: no story in URL or story not found → redirect to bookmark or first story
        if (!storyNumStr || !story) {
          skipBookmarkSave.current = true;
          if (bm && bm.story_position !== null) {
            navigate(readerPath(bm.author_slug, bm.story_position, bm.chapter_position, bm.sentence_seq_num + 1), { replace: true });
          } else {
            const fallback = stories[0];
            navigate(`/${fallback.author_slug}/${fallback.position ?? 0}/1`, { replace: true });
          }
          return;
        }

        // Rule: /:author/:story/:n on a single-chapter story is a pre-chapter sentence URL
        if (chapterNumStr && !sentenceNumStr && story.chapters.length === 1 && chapterNumStr !== "1") {
          skipBookmarkSave.current = true;
          navigate(readerPath(story.author_slug, storyPos!, story.chapters[0].position, Number(chapterNumStr)), { replace: true });
          return;
        }

        // Rule: no chapter in URL → bookmark's chapter if same story, else first chapter
        if (!chapterNumStr) {
          skipBookmarkSave.current = true;
          const sameStory = bm && bm.author_slug === story.author_slug && bm.story_position === storyPos;
          const target = sameStory ? bm.chapter_position : (story.chapters[0]?.position ?? 1);
          navigate(`/${story.author_slug}/${storyPos}/${target}`, { replace: true });
          return;
        }

        // Rule: chapter not found → first chapter
        const chapterPos = parseInt(chapterNumStr);
        const chapter = story.chapters.find((c) => c.position === chapterPos) ?? null;
        if (!chapter) {
          skipBookmarkSave.current = true;
          navigate(`/${story.author_slug}/${storyPos}/${story.chapters[0]?.position ?? 1}`, { replace: true });
          return;
        }

        // Story and chapter exist — load the chapter's sentences
        setCurrentStory(story);
        setCurrentChapter(chapter);
        wordCache.current = new Map();
        setCurrentDetail(null);

        const sentencesRes = await fetch(
          apiUrl(`/api/stories/${story.id}/sentences?chapter_id=${chapter.id}&limit=500`),
        );
        if (!sentencesRes.ok) throw new Error("Failed to fetch sentences");
        const sentencesData: Sentence[] = await sentencesRes.json();
        setSentences(sentencesData);
        if (!sentencesData.length) return;

        const firstSeqNum = sentencesData[0].sequence_num;

        if (!sentenceNumStr) {
          // Rule: no sentence → bookmark if in this chapter, else first sentence of the chapter
          skipBookmarkSave.current = true;
          const bmSeq =
            bm &&
            bm.author_slug === story.author_slug &&
            bm.story_position === storyPos &&
            bm.chapter_position === chapterPos
              ? bm.sentence_seq_num
              : null;
          navigate(readerPath(story.author_slug, storyPos!, chapterPos, (bmSeq ?? firstSeqNum) + 1), { replace: true });
          return;
        }

        // Rule: sentence must exist within this chapter, else redirect to the chapter's first
        const seqNum = parseInt(sentenceNumStr) - 1;
        const idx = sentencesData.findIndex((s) => s.sequence_num === seqNum);
        if (idx === -1) {
          skipBookmarkSave.current = true;
          navigate(readerPath(story.author_slug, storyPos!, chapterPos, firstSeqNum + 1), { replace: true });
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
  }, [stories, authorSlug, storyNumStr, chapterNumStr]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setActiveWordId(null);
    const s = sentences[newIdx];
    if (s && currentStory && currentChapter) {
      navigate(readerPath(currentStory.author_slug, currentStory.position ?? Number(storyNumStr ?? 0), currentChapter.position, s.sequence_num + 1));
    }
  }

  const nextChapter = currentStory?.chapters.find((c) => c.position > (currentChapter?.position ?? 0));
  function goToNextChapter() {
    if (currentStory && nextChapter) {
      setActiveWordId(null);
      navigate(`/${currentStory.author_slug}/${currentStory.position ?? Number(storyNumStr ?? 0)}/${nextChapter.position}`);
    }
  }

  if (loading) return <main className="container is-max-desktop py-6 px-4"><p>Loading...</p></main>;
  if (error) return <main className="container is-max-desktop py-6 px-4"><p>Error: {error}</p></main>;

  const sentence = sentences[index] ?? null;
  const detail = currentDetail?.id === sentence?.id ? currentDetail : null;

  return (
    <div className="container py-6 px-4">
    <div className="columns">
    <aside className="column is-3">
      <button
        className="button is-small is-hidden-tablet mb-3"
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((o) => !o)}
      >
        ☰ Stories
      </button>
      <div className={sidebarOpen ? undefined : "is-hidden-mobile"}>
        <StorySidebar stories={stories} currentStory={currentStory} currentChapterId={currentChapter?.id} />
      </div>
    </aside>
    <main className="column is-max-desktop">
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
            {currentStory.author}
            {currentStory.chapters.length > 1 && currentChapter && (
              <>
                {" · "}chapter {currentChapter.position} of {currentStory.chapters.length}
                {(currentChapter.title_hi ?? currentChapter.title_en) && (
                  <span className="devanagari"> ({currentChapter.title_hi ?? currentChapter.title_en})</span>
                )}
              </>
            )}
            {" · "}sentence {index + 1} of {sentences.length}
            {" · "}
            <a href={currentChapter?.source_url ?? currentStory.source_url} target="_blank" rel="noopener noreferrer">
              source
            </a>
          </p>
        </header>
      )}

      {detail && !showGloss && <SentenceView sentence={detail} activeWordId={activeWordId} />}
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

      {showGloss && detail && <WordGloss words={detail.words ?? []} activeWordId={activeWordId} />}

      {sentence && <AudioPlayer
          key={sentence.id}
          audioPath={sentence.audio_path}
          sentenceId={sentence.id}
          words={detail?.words}
          onActiveWordChange={setActiveWordId}
        />}

      <Navigation
        onPrev={() => goTo(Math.max(0, index - 1))}
        onNext={() =>
          index < sentences.length - 1 ? goTo(index + 1) : goToNextChapter()
        }
        hasPrev={index > 0}
        hasNext={index < sentences.length - 1 || nextChapter !== undefined}
      />
    </main>
    </div>
    </div>
  );
}
