import type { Sentence } from "../types";
import { apiUrl } from "../api";
import GlossCell from "./GlossCell";

interface Props {
  sentence: Sentence;
}

const layer: React.CSSProperties = {
  marginBottom: "0.75rem",
};

const label: React.CSSProperties = {
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#888",
  marginBottom: "0.2rem",
};

function playWordAudio(path: string, wordId: string | null) {
  new Audio(apiUrl(`/audio/${path}`)).play();
  if (wordId) {
    fetch(apiUrl(`/api/sentences/words/${wordId}/played`), {
      method: "POST",
      credentials: "include",
    });
  }
}

export default function SentenceView({ sentence }: Props) {
  return (
    <div style={{ lineHeight: 1.6 }}>
      <div style={layer}>
        <div style={label}>Word-for-word</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem 1rem" }}>
          {(sentence.words ?? []).map((w) => (
            <div key={w.id} style={{ textAlign: "center", minWidth: "2rem" }}>
              <div style={{ fontFamily: "serif", fontSize: "1.1rem" }}>
                {w.surface_devanagari}
              </div>
              <div style={{ fontSize: "0.75rem", fontStyle: "italic", color: "#aaa" }}>
                {w.surface_romanized}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#777" }}>
                <GlossCell
                  word_sense_id={w.word_sense_id}
                  word_sense_definition={w.word_sense_definition}
                  english_gloss={w.english_gloss}
                  note={w.note}
                />
              </div>
              {w.word_audio_path && (
                <button
                  onClick={() => playWordAudio(w.word_audio_path!, w.id)}
                  title="Pronounce"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.5rem",
                    fontSize: "1.2rem",
                    color: "#aaa",
                    lineHeight: 1,
                    minWidth: "2.5rem",
                    minHeight: "2.5rem",
                  }}
                >
                  ▶
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={layer}>
        <div style={label}>English</div>
        <div style={{ fontSize: "1.1rem" }}>{sentence.english}</div>
      </div>
    </div>
  );
}
