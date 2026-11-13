'use client';

import React from 'react';
import { MaterialStats } from '@/types/material';
import { Layers, CheckCircle2, AlertTriangle, PackageMinus, Boxes } from 'lucide-react';

interface MaterialKPICardsProps {
  stats: MaterialStats | null;
  loading: boolean;
}

export const MaterialKPICards: React.FC<MaterialKPICardsProps> = ({ stats, loading }) => {
  return (
    <div className="row g-3 mb-4">
      <style jsx>{`
        .kpi-card {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 18px 20px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.02);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          height: 100%;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
          border-color: #cbd5e1;
        }

        .icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .icon-blue {
          background: #eff6ff;
          color: #2563eb;
        }

        .icon-emerald {
          background: #ecfdf5;
          color: #059669;
        }

        .icon-amber {
          background: #fffbeb;
          color: #d97706;
        }

        .icon-purple {
          background: #faf5ff;
          color: #9333ea;
        }

        .icon-slate {
          background: #f1f5f9;
          color: #64748b;
        }

        .kpi-title {
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .kpi-value {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.1;
          letter-spacing: -0.5px;
        }

        .kpi-subtext {
          font-size: 11.5px;
          color: #94a3b8;
          font-weight: 500;
          margin-top: 3px;
        }

        .skeleton-value {
          width: 70px;
          height: 24px;
          background: #e2e8f0;
          border-radius: 6px;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Total Unique Materials */}
      <div className="col-12 col-sm-6 col-xl">
        <div className="kpi-card">
          <div className="icon-wrapper icon-blue">
            <Layers size={22} />
          </div>
          <div>
            <div className="kpi-title">Material Master</div>
            <div className="kpi-value">
              {loading ? <div className="skeleton-value" /> : (stats?.totalMaterials ?? 0).toLocaleString()}
            </div>
            <div className="kpi-subtext">Unique Part Numbers</div>
          </div>
        </div>
      </div>

      {/* Available Ready to Pick */}
      <div className="col-12 col-sm-6 col-xl">
        <div className="kpi-card">
          <div className="icon-wrapper icon-emerald">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="kpi-title">Available Stock</div>
            <div className="kpi-value" style={{ color: '#059669' }}>
              {loading ? <div className="skeleton-value" /> : (stats?.totalAvailable ?? 0).toLocaleString()}
            </div>
            <div className="kpi-subtext">Ready for Dispatch / Pick</div>
          </div>
        </div>
      </div>

      {/* Quality Hold / Quarantine */}
      <div className="col-12 col-sm-6 col-xl">
        <div className="kpi-card">
          <div className="icon-wrapper icon-amber">
            <AlertTriangle size={22} />
          </div>
          <div>
            <div className="kpi-title">On Hold / Quarantine</div>
            <div className="kpi-value" style={{ color: (stats?.totalHold ?? 0) > 0 ? '#d97706' : '#0f172a' }}>
              {loading ? <div className="skeleton-value" /> : (stats?.totalHold ?? 0).toLocaleString()}
            </div>
            <div className="kpi-subtext">Pending QA Inspection</div>
          </div>
        </div>
      </div>

      {/* Kardex Bins Occupied */}
      <div className="col-12 col-sm-6 col-xl">
        <div className="kpi-card">
          <div className="icon-wrapper icon-purple">
            <Boxes size={22} />
          </div>
          <div>
            <div className="kpi-title">Allocated Bins</div>
            <div className="kpi-value" style={{ color: '#7c3aed' }}>
              {loading ? <div className="skeleton-value" /> : (stats?.activeBinsCount ?? 0).toLocaleString()}
            </div>
            <div className="kpi-subtext">HUs Currently Storing Stock</div>
          </div>
        </div>
      </div>

      {/* Total Picked */}
      <div className="col-12 col-sm-6 col-xl">
        <div className="kpi-card">
          <div className="icon-wrapper icon-slate">
            <PackageMinus size={22} />
          </div>
          <div>
            <div className="kpi-title">Total Dispatched</div>
            <div className="kpi-value">
              {loading ? <div className="skeleton-value" /> : (stats?.totalPicked ?? 0).toLocaleString()}
            </div>
            <div className="kpi-subtext">Historic Outbound Units</div>
          </div>
        </div>
      </div>
    </div>
  );
};

