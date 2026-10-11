import type { WordsSummary as Summary } from "../types";

export default function WordsSummary({ summary }: { summary: Summary }) {
  const items: [string, string | number][] = [
    ["Count", summary.count],
    ["Mean", summary.mean.toFixed(1)],
    ["Min", summary.min],
    ["Max", summary.max],
  ];
  return (
    <div className="box mb-5">
      <div className="columns is-mobile has-text-centered-mobile">
        {items.map(([label, value]) => (
          <div className="column" key={label}>
            <p className="is-size-7 has-text-grey mb-1">{label}</p>
            <p className="is-size-5 has-text-weight-bold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
