import type { SentenceWord } from "../types";
import { apiUrl } from "../api";
import GlossCell from "./GlossCell";

interface Props {
  words: SentenceWord[];
  activeWordId?: string | null;
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

export default function WordGloss({ words, activeWordId }: Props) {
  return (
    <table className="table is-fullwidth mt-4">
      <thead>
        <tr>
          <th></th>
          <th>Hindi</th>
          <th>Transliteration</th>
          <th>Gloss</th>
        </tr>
      </thead>
      <tbody>
        {words.map((word) => (
          <tr
            key={word.id}
            data-active={word.id === activeWordId}
            style={{ backgroundColor: word.id === activeWordId ? "rgba(30, 144, 255, 0.22)" : undefined }}
          >
            <td>
              {word.word_audio_path && (
                <button
                  className="button is-text is-small"
                  onClick={() => playWordAudio(word.word_audio_path!, word.id)}
                  title="Pronounce"
                >
                  ▶
                </button>
              )}
            </td>
            <td className="devanagari" style={{ fontSize: "1.1rem" }}>
              {word.surface_devanagari}
            </td>
            <td className="is-italic has-text-grey">
              {word.surface_romanized}
            </td>
            <td className="has-text-grey">
              <GlossCell
                word_sense_id={word.word_sense_id}
                word_sense_definition={word.word_sense_definition}
                english_gloss={word.english_gloss}
                note={word.note}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
