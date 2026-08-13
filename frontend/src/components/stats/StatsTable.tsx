import GlossCell from "../GlossCell";
import type { SortColumn, SortDirection, WordStat } from "./types";

interface StatsTableProps {
  words: WordStat[];
  sortColumn: SortColumn;
  sortDirection: SortDirection;
  isFetching: boolean;
  highlightedId: string | null;
  onSort: (column: SortColumn) => void;
  onPlay: (word: WordStat) => void;
}

interface SortHeaderProps {
  label: string;
  column: SortColumn;
  activeColumn: SortColumn;
  direction: SortDirection;
  isFetching: boolean;
  align?: "left" | "right";
  onSort: (column: SortColumn) => void;
}

function SortHeader({
  label,
  column,
  activeColumn,
  direction,
  isFetching,
  align = "left",
  onSort,
}: SortHeaderProps) {
  const isActive = activeColumn === column;

  return (
    <th style={{ textAlign: align, padding: "0.5rem 0.75rem" }}>
      <button
        onClick={() => onSort(column)}
        disabled={isFetching}
        style={{
          background: "none",
          border: "none",
          cursor: isFetching ? "default" : "pointer",
          color: isActive ? "#fff" : "#aaa",
          fontSize: "0.9rem",
          padding: 0,
          opacity: isFetching ? 0.5 : 1,
        }}
      >
        {label} {isActive && (direction === "desc" ? "↓" : "↑")}
      </button>
    </th>
  );
}

export default function StatsTable({
  words,
  sortColumn,
  sortDirection,
  isFetching,
  highlightedId,
  onSort,
  onPlay,
}: StatsTableProps) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          minWidth: 640,
          borderCollapse: "collapse",
          fontSize: "0.9rem",
          tableLayout: "fixed",
        }}
      >
        <colgroup>
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "26%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "12%" }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: "1px solid #ccc" }}>
            <SortHeader
              label="Devanagari"
              column="devanagari"
              activeColumn={sortColumn}
              direction={sortDirection}
              isFetching={isFetching}
              onSort={onSort}
            />
            <SortHeader
              label="Romanized"
              column="romanized"
              activeColumn={sortColumn}
              direction={sortDirection}
              isFetching={isFetching}
              onSort={onSort}
            />
            <SortHeader
              label="Original"
              column="english"
              activeColumn={sortColumn}
              direction={sortDirection}
              isFetching={isFetching}
              onSort={onSort}
            />
            <SortHeader
              label="Override"
              column="override"
              activeColumn={sortColumn}
              direction={sortDirection}
              isFetching={isFetching}
              onSort={onSort}
            />
            <SortHeader
              label="Reviews"
              column="count"
              activeColumn={sortColumn}
              direction={sortDirection}
              isFetching={isFetching}
              align="right"
              onSort={onSort}
            />
            <th style={{ textAlign: "center", padding: "0.5rem 0.75rem" }} />
          </tr>
        </thead>
        <tbody>
          {words.map((word, index) => (
            <tr
              key={index}
              style={{
                borderBottom: "1px solid #eee",
                backgroundColor:
                  highlightedId === word.sentence_word_id
                    ? "rgba(30, 144, 255, 0.22)"
                    : undefined,
                transition: "background-color 0.2s ease-out",
              }}
            >
              <td
                style={{
                  padding: "0.5rem 0.75rem",
                  fontFamily: "serif",
                  fontSize: "1.3rem",
                }}
              >
                {word.surface_devanagari}
              </td>
              <td
                style={{
                  padding: "0.5rem 0.75rem",
                  color: "#666",
                  fontSize: "0.85rem",
                }}
              >
                {word.surface_romanized}
              </td>
              <td
                style={{
                  padding: "0.5rem 0.75rem",
                  color: "#666",
                  fontSize: "0.85rem",
                }}
              >
                {word.word_sense_definition ?? word.english_gloss}
              </td>
              <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}>
                <GlossCell
                  word_sense_id={word.word_sense_id}
                  word_sense_definition={word.word_sense_definition}
                  english_gloss={word.english_gloss}
                  note={word.note}
                  showFallback={false}
                />
              </td>
              <td
                style={{
                  padding: "0.5rem 0.75rem",
                  textAlign: "right",
                  fontWeight: "bold",
                }}
              >
                {word.play_count}
              </td>
              <td style={{ padding: "0.25rem 0.5rem", textAlign: "center" }}>
                {word.word_audio_path && word.sentence_word_id && (
                  <button
                    onClick={() => onPlay(word)}
                    title="Play audio"
                    style={{
                      width: "2.25rem",
                      height: "2.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#333",
                      border: "1px solid #555",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: "1rem",
                      color: "#eee",
                      lineHeight: 1,
                    }}
                  >
                    ▶
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
