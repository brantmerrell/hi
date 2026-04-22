import type { SentenceWord } from "../types";
import { apiUrl } from "../api";
import GlossCell from "./GlossCell";

interface Props {
  words: SentenceWord[];
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

export default function WordGloss({ words }: Props) {
  return (
    <table
      style={{
        marginTop: "1rem",
        borderCollapse: "collapse",
        fontSize: "0.9rem",
        width: "100%",
      }}
    >
      <thead>
        <tr style={{ color: "#888", textAlign: "left" }}>
          <th style={{ padding: "0.3rem 0.75rem 0.3rem 0", fontWeight: "normal" }}></th>
          <th style={{ padding: "0.3rem 0.75rem", fontWeight: "normal" }}>Hindi</th>
          <th style={{ padding: "0.3rem 0.75rem", fontWeight: "normal" }}>Transliteration</th>
          <th style={{ padding: "0.3rem 0 0.3rem 0.75rem", fontWeight: "normal" }}>Gloss</th>
        </tr>
      </thead>
      <tbody>
        {words.map((word) => (
          <tr key={word.id} style={{ borderTop: "1px solid #333" }}>
            <td style={{ padding: "0.3rem 0.75rem 0.3rem 0" }}>
              {word.word_audio_path && (
                <button
                  onClick={() => playWordAudio(word.word_audio_path!, word.id)}
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
            </td>
            <td style={{ padding: "0.3rem 0.75rem", fontFamily: "serif", fontSize: "1.1rem" }}>
              {word.surface_devanagari}
            </td>
            <td style={{ padding: "0.3rem 0.75rem", fontStyle: "italic", color: "#ccc" }}>
              {word.surface_romanized}
            </td>
            <td style={{ padding: "0.3rem 0 0.3rem 0.75rem", color: "#aaa" }}>
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
