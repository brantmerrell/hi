import type { SentenceWord } from "../types";

interface Props {
  words: SentenceWord[];
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
          <th style={{ padding: "0.3rem 0.75rem 0.3rem 0", fontWeight: "normal" }}>Hindi</th>
          <th style={{ padding: "0.3rem 0.75rem", fontWeight: "normal" }}>Transliteration</th>
          <th style={{ padding: "0.3rem 0 0.3rem 0.75rem", fontWeight: "normal" }}>Gloss</th>
        </tr>
      </thead>
      <tbody>
        {words.map((word) => (
          <tr key={word.id} style={{ borderTop: "1px solid #333" }}>
            <td style={{ padding: "0.3rem 0.75rem 0.3rem 0", fontFamily: "serif", fontSize: "1.1rem" }}>
              {word.surface_devanagari}
            </td>
            <td style={{ padding: "0.3rem 0.75rem", fontStyle: "italic", color: "#ccc" }}>
              {word.surface_romanized}
            </td>
            <td style={{ padding: "0.3rem 0 0.3rem 0.75rem", color: "#aaa" }}>
              {word.english_gloss || "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
