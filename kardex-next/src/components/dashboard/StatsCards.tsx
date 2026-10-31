'use client';

import React from 'react';
import { DashboardCounts } from '@/types';
import { CheckCircle, AlertTriangle, Layers, PackageCheck, PackageX, PauseCircle } from 'lucide-react';

interface StatsCardsProps {
  counts: DashboardCounts | null;
  loading?: boolean;
  onCardClick?: (type: string) => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ counts, loading, onCardClick }) => {
  const cards = [
    {
      key: 'valid',
      title: 'Valid Scans',
      count: counts?.validScanCount ?? 0,
      icon: <CheckCircle size={24} />,
      color: '#10b981',
      bgColor: '#ecfdf5',
    },
    {
      key: 'invalid',
      title: 'Invalid Scans',
      count: counts?.invalidScanCount ?? 0,
      icon: <AlertTriangle size={24} />,
      color: '#ef4444',
      bgColor: '#fef2f2',
    },
    {
      key: 'total',
      title: 'Total Parts',
      count: counts?.totalPartsCount ?? 0,
      icon: <Layers size={24} />,
      color: '#3b82f6',
      bgColor: '#eff6ff',
    },
    {
      key: 'available',
      title: 'Available Parts',
      count: counts?.availablePartsCount ?? 0,
      icon: <PackageCheck size={24} />,
      color: '#06b6d4',
      bgColor: '#ecfeff',
    },
    {
      key: 'picked',
      title: 'Picked Parts',
      count: counts?.pickedPartsCount ?? 0,
      icon: <PackageX size={24} />,
      color: '#8b5cf6',
      bgColor: '#f5f3ff',
    },
    {
      key: 'hold',
      title: 'Hold Parts',
      count: counts?.holdPartsCount ?? 0,
      icon: <PauseCircle size={24} />,
      color: '#f59e0b',
      bgColor: '#fffbeb',
    },
  ];

  return (
    <div className="stats-grid">
      <style jsx>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .stat-card {
          background: #ffffff;
          border-radius: 12px;
          padding: 1.25rem;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          display: flex;
          align-items: center;
          gap: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .icon-box {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .details {
          display: flex;
          flex-direction: column;
        }

        .title {
          font-size: 0.8rem;
          font-weight: 500;
          color: #64748b;
          margin-bottom: 0.2rem;
        }

        .value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1;
        }
      `}</style>

      {cards.map((card) => (
        <div
          key={card.key}
          className="stat-card"
          onClick={() => onCardClick && onCardClick(card.key)}
        >
          <div
            className="icon-box"
            style={{ backgroundColor: card.bgColor, color: card.color }}
          >
            {card.icon}
          </div>
          <div className="details">
            <span className="title">{card.title}</span>
            <span className="value">
              {loading ? '...' : card.count.toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
