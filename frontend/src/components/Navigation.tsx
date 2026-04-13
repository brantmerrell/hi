interface Props {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export default function Navigation({ onPrev, onNext, hasPrev, hasNext }: Props) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
      <button onClick={onPrev} disabled={!hasPrev}>← Previous</button>
      <button onClick={onNext} disabled={!hasNext}>Next →</button>
    </div>
  );
}
