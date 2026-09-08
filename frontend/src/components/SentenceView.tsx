import type { Sentence } from "../types";
import { apiUrl } from "../api";
import GlossCell from "./GlossCell";

interface Props {
  sentence: Sentence;
}

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
    <div>
      <div className="mb-4">
        <p className="is-size-7 has-text-grey has-text-weight-semibold mb-2" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Word-for-word
        </p>
        <div className="is-flex is-flex-wrap-wrap" style={{ gap: "0.25rem 1rem" }}>
          {(sentence.words ?? []).map((w) => (
            <div key={w.id} className="has-text-centered" style={{ minWidth: "2rem" }}>
              <div className="devanagari" style={{ fontSize: "1.1rem" }}>
                {w.surface_devanagari}
              </div>
              <p className="is-size-7 is-italic has-text-grey">
                {w.surface_romanized}
              </p>
              <p className="is-size-7 has-text-grey-light">
                <GlossCell
                  word_sense_id={w.word_sense_id}
                  word_sense_definition={w.word_sense_definition}
                  english_gloss={w.english_gloss}
                  note={w.note}
                />
              </p>
              {w.word_audio_path && (
                <button
                  className="button is-text is-small"
                  onClick={() => playWordAudio(w.word_audio_path!, w.id)}
                  title="Pronounce"
                >
                  ▶
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <p className="is-size-7 has-text-grey has-text-weight-semibold mb-2" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
          English
        </p>
        <p className="is-size-5">{sentence.english}</p>
      </div>
    </div>
  );
}
