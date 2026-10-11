interface Props {
  minReviews: number;
  maxReviews: number;
  maxDefault: number;
  disabled: boolean;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  onApply: () => void;
}

export default function ReviewFilter({
  minReviews,
  maxReviews,
  maxDefault,
  disabled,
  onMinChange,
  onMaxChange,
  onApply,
}: Props) {
  return (
    <div className="field is-grouped is-align-items-center mb-4">
      <label className="is-size-7" style={{ opacity: disabled ? 0.5 : 1 }}>
        Reviews between{" "}
        <input
          type="number"
          min="0"
          className="input is-small"
          disabled={disabled}
          value={minReviews}
          onChange={(e) => onMinChange(parseInt(e.target.value) || 0)}
          style={{ width: "4.5rem", display: "inline-block", margin: "0 0.25rem" }}
        />
        and{" "}
        <input
          type="number"
          min="0"
          className="input is-small"
          disabled={disabled}
          value={maxReviews === maxDefault ? "" : maxReviews}
          onChange={(e) => onMaxChange(e.target.value === "" ? maxDefault : parseInt(e.target.value) || 0)}
          style={{ width: "4.5rem", display: "inline-block", marginLeft: "0.25rem" }}
          placeholder="∞"
        />
      </label>
      <div className="control">
        <button className="button is-small is-link ml-2" onClick={onApply} disabled={disabled}>
          Apply
        </button>
      </div>
    </div>
  );
}
