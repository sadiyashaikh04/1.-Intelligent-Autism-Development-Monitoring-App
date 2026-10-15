import type { ReactNode } from "react";

/**
 * Responsive data table: a real table from `md` up, stacked cards below,
 * so nothing scrolls sideways on a 360px phone.
 */
export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** Hide in the mobile card view (shown only in the table). */
  desktopOnly?: boolean;
  /** Span the full card width on mobile (chips, long text). */
  wide?: boolean;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  mobileTitle,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** The headline of each mobile card. */
  mobileTitle: (row: T) => ReactNode;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl bg-surface shadow-sm ring-1 ring-line md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-ink-500">
            <tr>
              {columns.map((c) => (
                <th key={c.header} scope="col" className={`px-4 py-3 ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? "cursor-pointer hover:bg-brand-50/40" : ""}
              >
                {columns.map((c) => (
                  <td key={c.header} className={`px-4 py-3 align-middle ${c.className ?? ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <div
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? (e) => e.key === "Enter" && onRowClick(row) : undefined}
              className="rounded-xl bg-surface p-4 shadow-sm ring-1 ring-line active:bg-slate-50"
            >
              <div className="font-medium text-ink-900">{mobileTitle(row)}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                {columns
                  .filter((c) => !c.desktopOnly)
                  .map((c) => (
                    <div key={c.header} className={`min-w-0 ${c.wide ? "col-span-2" : ""}`}>
                      <dt className="text-xs text-ink-500">{c.header}</dt>
                      <dd className={c.wide ? "text-ink-900" : "truncate text-ink-900"}>{c.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
