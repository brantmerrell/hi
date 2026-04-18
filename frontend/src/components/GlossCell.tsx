import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../api";

export interface GlossCellProps {
  word_sense_id: string | null;
  word_sense_definition: string | null;
  english_gloss: string;
  note: string | null;
  /** When false, shows blank instead of falling back to word_sense_definition/english_gloss when no note exists. Defaults to true. */
  showFallback?: boolean;
  style?: React.CSSProperties;
}

export default function GlossCell({ word_sense_id, word_sense_definition, english_gloss, note, showFallback = true, style }: GlossCellProps) {
  const [committedNote, setCommittedNote] = useState(note);
  useEffect(() => { setCommittedNote(note); }, [note]);
  const displayed = committedNote ?? (showFallback ? (word_sense_definition ?? english_gloss ?? "—") : "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayed);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(displayed);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function save() {
    setEditing(false);
    if (!word_sense_id || draft === displayed) return;
    setCommittedNote(draft);
    fetch(apiUrl(`/api/sentences/words/senses/${word_sense_id}/note`), {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_gloss: draft }),
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        style={{
          background: "none",
          border: "none",
          borderBottom: "1px solid #666",
          color: "inherit",
          fontSize: "inherit",
          fontFamily: "inherit",
          padding: 0,
          width: "100%",
          outline: "none",
          ...style,
        }}
        autoFocus
      />
    );
  }

  return (
    <span
      onClick={word_sense_id ? startEdit : undefined}
      title={word_sense_id ? "Click to override" : undefined}
      style={{
        cursor: word_sense_id ? "text" : "default",
        ...style,
      }}
    >
      {displayed}
    </span>
  );
}
