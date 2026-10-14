import type { SortColumn, SortDirection, WordStat } from "../types";
import GlossCell from "./GlossCell";

interface Props {
  words: WordStat[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  disabled: boolean;
  highlightedId: string | null;
  onSort: (column: SortColumn) => void;
  onPlay: (word: WordStat) => void;
}

const COLUMNS: { column: SortColumn; label: string; className?: string }[] = [
  { column: "devanagari", label: "Devanagari" },
  { column: "romanized", label: "Romanized" },
  { column: "english", label: "Original" },
  { column: "override", label: "Override" },
  { column: "count", label: "Reviews", className: "has-text-right" },
];

export default function WordsTable({
  words,
  sortColumn,
  sortDirection,
  disabled,
  highlightedId,
  onSort,
  onPlay,
}: Props) {
  function sortIndicator(column: SortColumn) {
    if (sortColumn !== column) return null;
    return sortDirection === "desc" ? " ↓" : " ↑";
  }

  return (
    <div className="table-container">
      <table className="table is-fullwidth is-hoverable" style={{ minWidth: 640, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "10%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "26%" }} />
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr>
            <th aria-label="Play" />
            {COLUMNS.map(({ column, label, className }) => (
              <th key={column} className={className}>
                <button
                  className={`button is-text is-small p-0 ${sortColumn === column ? "has-text-link" : "has-text-grey"}`}
                  onClick={() => onSort(column)}
                  disabled={disabled}
                  style={{ opacity: disabled ? 0.5 : 1 }}
                >
                  {label}
                  {sortIndicator(column)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {words.map((word, idx) => (
            <tr
              key={idx}
              style={{
                backgroundColor: highlightedId === word.sentence_word_id ? "rgba(30, 144, 255, 0.22)" : undefined,
                transition: "background-color 0.2s ease-out",
              }}
            >
              <td className="has-text-centered">
                {word.word_audio_path && word.sentence_word_id && (
                  <button className="button is-small" onClick={() => onPlay(word)} title="Play audio">
                    ▶
                  </button>
                )}
              </td>
              <td className="devanagari" style={{ fontSize: "1.2rem" }}>{word.surface_devanagari}</td>
              <td className="has-text-grey is-size-7">{word.surface_romanized}</td>
              <td className="has-text-grey is-size-7">
                {word.word_sense_definition ?? word.english_gloss}
              </td>
              <td className="is-size-7">
                <GlossCell
                  word_sense_id={word.word_sense_id}
                  word_sense_definition={word.word_sense_definition}
                  english_gloss={word.english_gloss}
                  note={word.note}
                  showFallback={false}
                />
              </td>
              <td className="has-text-right has-text-weight-bold">{word.play_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
