// Shown instantly while a community page loads, so navigation never feels stuck.
export default function Loading() {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 28, width: "45%" }} />
      <div className="skeleton" style={{ height: 46 }} />
      <div className="listing-grid">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ aspectRatio: "4 / 5" }} />)}
      </div>
    </div>
  );
}
