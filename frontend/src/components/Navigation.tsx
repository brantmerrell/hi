interface Props {
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export default function Navigation({ onPrev, onNext, hasPrev, hasNext }: Props) {
  return (
    <div className="field is-grouped mt-5">
      <div className="control">
        <button className="button" onClick={onPrev} disabled={!hasPrev}>← Previous</button>
      </div>
      <div className="control">
        <button className="button" onClick={onNext} disabled={!hasNext}>Next →</button>
      </div>
    </div>
  );
}
