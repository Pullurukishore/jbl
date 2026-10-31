'use client';

import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records found',
  description = 'There are no items matching your criteria at this moment.',
  action,
}) => {
  return (
    <div className="empty-state">
      <style jsx>{`
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1.5rem;
          text-align: center;
          background: #ffffff;
          border-radius: 8px;
          border: 1px dashed #cbd5e1;
          margin: 1rem 0;
        }

        .icon-box {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #f1f5f9;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .title {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 0.35rem;
        }

        .description {
          font-size: 0.85rem;
          color: #64748b;
          max-width: 360px;
          margin-bottom: 1.25rem;
        }
      `}</style>
      <div className="icon-box">
        <Inbox size={28} />
      </div>
      <h4 className="title">{title}</h4>
      <p className="description">{description}</p>
      {action}
    </div>
  );
};
