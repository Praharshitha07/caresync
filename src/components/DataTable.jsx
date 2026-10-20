import React from 'react';

export default function DataTable({
  columns = [],
  data = [],
  keyField = 'id',
  emptyMessage = 'No records found',
  className = '',
}) {
  return (
    <div className={`overflow-x-auto rounded-md border border-brand-border bg-white ${className}`}>
      <table className="min-w-full divide-y divide-brand-border text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-brand-muted uppercase tracking-wider">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key || col.header}
                scope="col"
                className={`px-4 py-3 ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border bg-white">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-brand-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={row[keyField] || index}
                className="hover:bg-slate-50/80 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col.key || col.header}
                    className={`px-4 py-3.5 text-brand-text whitespace-nowrap ${col.className || ''}`}
                  >
                    {col.render ? col.render(row, index) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
