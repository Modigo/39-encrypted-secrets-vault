// Card-wrapped data table (mockups 01 and 03).
// columns: [{ key, label, width, className }]
export function Table({ columns, children, className = '', label }) {
  return (
    <div className={`table-scroll ${className}`}>
      <table className="table" aria-label={label}>
        <colgroup>
          {columns.map((c) => (
            <col key={c.key} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.className}>
                {c.label ? c.label : <span className="sr-only">{c.srLabel || c.key}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// Placeholder rows while the first load is in flight.
export function SkeletonRows({ columns, rows = 6 }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} className="skeleton-row" aria-hidden>
      {columns.map((c, i) => (
        <td key={c.key}>
          {c.label || i === 0 ? <span className="skeleton" style={{ width: `${45 + ((r * 13 + i * 17) % 45)}%` }} /> : null}
        </td>
      ))}
    </tr>
  ));
}

// A single full-width row (empty/error states inside the table).
export function TableMessageRow({ colSpan, children }) {
  return (
    <tr className="table-message-row">
      <td colSpan={colSpan}>{children}</td>
    </tr>
  );
}
