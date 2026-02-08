import type { PropsWithChildren, ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: Array<TableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
}

export const Table = <T,>({ columns, rows, rowKey }: PropsWithChildren<TableProps<T>>) => (
  <table className="a-table">
    <thead>
      <tr>
        {columns.map((column) => (
          <th key={column.key}>{column.header}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr key={rowKey(row)}>
          {columns.map((column) => (
            <td key={column.key}>{column.cell(row)}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);
