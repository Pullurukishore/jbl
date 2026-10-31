'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  showQuickJumper?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 10,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showQuickJumper = false,
}) => {
  const [jumpPage, setJumpPage] = useState('');

  // If there are no items and only 1 empty page, don't show
  if (totalPages === 0 && (totalItems === undefined || totalItems === 0)) {
    return null;
  }

  // Calculate start and end entry count
  const startItem = totalItems !== undefined && totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = totalItems !== undefined ? Math.min(currentPage * pageSize, totalItems) : 0;

  // Generate visible page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('prev-ellipsis');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push('next-ellipsis');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpPage('');
    }
  };

  const pages = getPageNumbers();

  return (
    <div className="pagination-wrapper-custom">
      <style jsx>{`
        .pagination-wrapper-custom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          padding: 0.85rem 0.25rem 0.25rem;
          font-family: inherit;
        }

        .pagination-info {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.6rem;
          color: #64748b;
          font-size: 0.84rem;
        }

        .pagination-info strong {
          color: #1e293b;
          font-weight: 600;
        }

        .page-size-selector {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }

        .page-size-select {
          font-size: 0.82rem;
          padding: 0.22rem 0.5rem;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background-color: #ffffff;
          color: #334155;
          font-weight: 500;
          cursor: pointer;
          outline: none;
          transition: all 0.15s ease;
        }

        .page-size-select:focus {
          border-color: #0d6efd;
          box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.15);
        }

        .pagination-nav {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }

        .nav-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          height: 32px;
          padding: 0 0.4rem;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #475569;
          font-size: 0.84rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease-in-out;
          user-select: none;
        }

        .nav-btn:hover:not(:disabled):not(.active) {
          background-color: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        .nav-btn.active {
          background-color: #0d6efd;
          border-color: #0d6efd;
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 2px 5px rgba(13, 110, 253, 0.25);
        }

        .nav-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          background-color: #f8fafc;
          border-color: #e2e8f0;
        }

        .nav-ellipsis {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 32px;
          color: #94a3b8;
          font-size: 0.85rem;
          letter-spacing: 1px;
        }

        .jump-box {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.84rem;
          color: #64748b;
          margin-left: 0.4rem;
        }

        .jump-input {
          width: 44px;
          height: 32px;
          text-align: center;
          padding: 0.15rem;
          font-size: 0.84rem;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          outline: none;
          color: #1e293b;
          font-weight: 500;
        }

        .jump-input:focus {
          border-color: #0d6efd;
          box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.15);
        }

        @media (max-width: 640px) {
          .pagination-wrapper-custom {
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
        }
      `}</style>

      {/* Left: Info Text & Page Size Selector */}
      <div className="pagination-info">
        {totalItems !== undefined ? (
          <span>
            Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of{' '}
            <strong>{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page <strong>{currentPage}</strong> of <strong>{totalPages || 1}</strong>
          </span>
        )}

        {onPageSizeChange && (
          <div className="page-size-selector">
            <span>• Show</span>
            <select
              className="page-size-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span>per page</span>
          </div>
        )}
      </div>

      {/* Right: Navigation Controls */}
      {totalPages > 1 && (
        <div className="pagination-nav">
          {/* First Page */}
          <button
            className="nav-btn"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(1)}
            title="First page"
          >
            <ChevronsLeft size={15} />
          </button>

          {/* Previous Page */}
          <button
            className="nav-btn"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            title="Previous page"
          >
            <ChevronLeft size={15} />
          </button>

          {/* Page Numbers */}
          {pages.map((p, idx) => {
            if (typeof p === 'number') {
              return (
                <button
                  key={p}
                  className={`nav-btn ${p === currentPage ? 'active' : ''}`}
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </button>
              );
            }
            return (
              <span key={`ellipsis-${idx}`} className="nav-ellipsis">
                •••
              </span>
            );
          })}

          {/* Next Page */}
          <button
            className="nav-btn"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            title="Next page"
          >
            <ChevronRight size={15} />
          </button>

          {/* Last Page */}
          <button
            className="nav-btn"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            title="Last page"
          >
            <ChevronsRight size={15} />
          </button>

          {/* Quick Jumper (when multiple pages exist) */}
          {(showQuickJumper || totalPages > 5) && (
            <form onSubmit={handleJumpSubmit} className="jump-box">
              <span>Go to</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value)}
                placeholder="#"
                className="jump-input"
              />
            </form>
          )}
        </div>
      )}
    </div>
  );
};
