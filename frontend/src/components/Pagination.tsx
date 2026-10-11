interface Props {
  offset: number;
  limit: number;
  total: number;
  disabled: boolean;
  onOffsetChange: (offset: number) => void;
}

export default function Pagination({ offset, limit, total, disabled, onOffsetChange }: Props) {
  return (
    <div className="level mt-5">
      <div className="level-left">
        <p className="is-size-7 has-text-grey">
          {total > 0 && `Showing ${offset + 1}–${Math.min(offset + limit, total)} of ${total}`}
        </p>
      </div>
      <div className="level-right">
        <div className="field is-grouped">
          <div className="control">
            <button
              className="button is-small"
              onClick={() => onOffsetChange(Math.max(0, offset - limit))}
              disabled={offset === 0 || disabled}
            >
              ← Previous
            </button>
          </div>
          <div className="control">
            <button
              className="button is-small"
              onClick={() => onOffsetChange(offset + limit)}
              disabled={offset + limit >= total || disabled}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
