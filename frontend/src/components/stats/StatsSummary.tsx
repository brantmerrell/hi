import type { StatsSummaryData } from "./types";

interface StatsSummaryProps {
  summary: StatsSummaryData;
}

export default function StatsSummary({ summary }: StatsSummaryProps) {
  if (summary.count === 0) return null;

  const items = [
    { label: "Count", value: String(summary.count) },
    { label: "Mean", value: summary.mean.toFixed(1) },
    { label: "Min", value: String(summary.min) },
    { label: "Max", value: String(summary.max) },
  ];

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        padding: "1rem",
        backgroundColor: "#1a1a1a",
        borderRadius: "0.25rem",
        fontSize: "0.9rem",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1rem",
        }}
      >
        {items.map((item) => (
          <div key={item.label}>
            <div
              style={{
                color: "#888",
                fontSize: "0.8rem",
                marginBottom: "0.25rem",
              }}
            >
              {item.label}
            </div>
            <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
