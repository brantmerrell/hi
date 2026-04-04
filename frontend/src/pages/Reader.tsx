import { useEffect, useState } from "react";
import AudioPlayer from "../components/AudioPlayer";
import Navigation from "../components/Navigation";
import SentenceView from "../components/SentenceView";
import WordGloss from "../components/WordGloss";
import type { Sentence, Story } from "../types";

export default function Reader() {
  const [stories, setStories] = useState<Story[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [index, setIndex] = useState(0);
  const [showGloss, setShowGloss] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load stories on mount, then load sentences for the first story
  useEffect(() => {
    async function load() {
      try {
        const storiesRes = await fetch("/api/stories");
        if (!storiesRes.ok) throw new Error("Failed to fetch stories");
        const storiesData: Story[] = await storiesRes.json();
        setStories(storiesData);

        if (storiesData.length === 0) {
          setError("No stories in the database yet.");
          setLoading(false);
          return;
        }

        const story = storiesData[0];
        const sentencesRes = await fetch(
          `/api/stories/${story.id}/sentences?limit=500`
        );
        if (!sentencesRes.ok) throw new Error("Failed to fetch sentences");
        const sentencesData: Sentence[] = await sentencesRes.json();
        setSentences(sentencesData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <main><p>Loading...</p></main>;
  if (error) return <main><p>Error: {error}</p></main>;

  const sentence = sentences[index] ?? null;
  const story = stories[0] ?? null;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      {story && (
        <header style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ margin: 0 }}>{story.title_hi}</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#888", fontSize: "0.9rem" }}>
            {story.author} · sentence {index + 1} of {sentences.length}
          </p>
        </header>
      )}

      {sentence && <SentenceView sentence={sentence} />}

      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={() => setShowGloss((v) => !v)}
          style={{ fontSize: "0.85rem", padding: "0.3rem 0.75rem" }}
        >
          {showGloss ? "Hide" : "Show"} word-by-word
        </button>
      </div>

      {showGloss && sentence && <WordGloss words={sentence.words} />}

      {sentence && <AudioPlayer audioPath={sentence.audio_path} />}

      <Navigation
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => setIndex((i) => Math.min(sentences.length - 1, i + 1))}
        hasPrev={index > 0}
        hasNext={index < sentences.length - 1}
      />
    </main>
  );
}
