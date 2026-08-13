interface StatsPaginationProps {
  offset: number;
  limit: number;
  count: number;
  isFetching: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export default function StatsPagination({
  offset,
  limit,
  count,
  isFetching,
  onPrevious,
  onNext,
}: StatsPaginationProps) {
  const previousDisabled = offset === 0 || isFetching;
  const nextDisabled = offset + limit >= count || isFetching;

  const buttonStyle = (disabled: boolean) => ({
    padding: "0.3rem 0.75rem",
    background: disabled ? "#333" : "#555",
    border: "1px solid #666",
    color: disabled ? "#666" : "#fff",
    cursor: disabled ? "default" : "pointer",
    fontSize: "0.85rem",
  });

  return (
    <div
      style={{
        marginTop: "1.5rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "0.9rem",
      }}
    >
      <div style={{ color: "#888" }}>
        {count > 0 &&
          `Showing ${offset + 1}–${Math.min(offset + limit, count)} of ${count}`}
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          onClick={onPrevious}
          disabled={previousDisabled}
          style={buttonStyle(previousDisabled)}
        >
          ← Previous
        </button>
        <button
          onClick={onNext}
          disabled={nextDisabled}
          style={buttonStyle(nextDisabled)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
