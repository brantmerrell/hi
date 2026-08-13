interface StatsFiltersProps {
  minReviews: number;
  maxReviews: number;
  maxReviewsDefault: number;
  isFetching: boolean;
  onMinReviewsChange: (value: number) => void;
  onMaxReviewsChange: (value: number) => void;
  onApply: () => void;
}

export default function StatsFilters({
  minReviews,
  maxReviews,
  maxReviewsDefault,
  isFetching,
  onMinReviewsChange,
  onMaxReviewsChange,
  onApply,
}: StatsFiltersProps) {
  return (
    <div
      style={{
        marginBottom: "1rem",
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
      }}
    >
      <label style={{ fontSize: "0.9rem", opacity: isFetching ? 0.5 : 1 }}>
        Reviews between{" "}
        <input
          type="number"
          min="0"
          disabled={isFetching}
          value={minReviews}
          onChange={(event) =>
            onMinReviewsChange(parseInt(event.target.value) || 0)
          }
          style={{
            width: "3rem",
            marginLeft: "0.25rem",
            marginRight: "0.25rem",
          }}
        />
        and{" "}
        <input
          type="number"
          min="0"
          disabled={isFetching}
          value={maxReviews === maxReviewsDefault ? "" : maxReviews}
          onChange={(event) =>
            onMaxReviewsChange(
              event.target.value === ""
                ? maxReviewsDefault
                : parseInt(event.target.value) || 0
            )
          }
          style={{ width: "3rem", marginLeft: "0.25rem" }}
          placeholder="∞"
        />
      </label>
      <button
        onClick={onApply}
        disabled={isFetching}
        style={{
          padding: "0.3rem 0.75rem",
          background: isFetching ? "#333" : "#555",
          border: "1px solid #666",
          color: isFetching ? "#666" : "#fff",
          cursor: isFetching ? "default" : "pointer",
          fontSize: "0.85rem",
        }}
      >
        Apply
      </button>
    </div>
  );
}
