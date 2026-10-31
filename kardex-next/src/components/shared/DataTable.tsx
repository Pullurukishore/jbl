'use client';

import React from 'react';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';
import { Loader } from './Loader';

export interface Column<T> {
  header: string;
  accessor?: keyof T;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  totalItems?: number;
  totalPages?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T extends { id?: number | string }>({
  columns,
  data,
  loading = false,
  totalItems,
  totalPages,
  currentPage,
  onPageChange,
  emptyTitle,
  emptyDescription,
}: DataTableProps<T>) {
  return (
    <div className="table-card">
      <style jsx>{`
        .table-card {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          overflow: hidden;
        }

        .table-responsive {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.875rem;
        }

        th {
          background-color: #f8fafc;
          color: #475569;
          font-weight: 600;
          padding: 0.85rem 1rem;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        td {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid #f1f5f9;
          color: #1e293b;
          vertical-align: middle;
        }

        tbody tr:hover {
          background-color: #f8fafc;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        .pagination-wrapper {
          padding: 0.5rem 1rem;
          border-top: 1px solid #e2e8f0;
          background-color: #ffffff;
        }
      `}</style>

      <div className="table-responsive">
        {loading ? (
          <Loader message="Fetching records..." />
        ) : data.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          <table>
            <thead>
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} style={{ width: col.width }}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIdx) => (
                <tr key={row.id || rowIdx}>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx}>
                      {col.render
                        ? col.render(row)
                        : col.accessor
                        ? String(row[col.accessor] ?? '-')
                        : '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {currentPage && totalPages && onPageChange && (
        <div className="pagination-wrapper">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            totalItems={totalItems}
          />
        </div>
      )}
    </div>
  );
}
