'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { HandlingUnit, StorageStatus, HUStatus, HUListResponse, HUStats } from '@/types/hu';
import { RegisterBinModal } from '@/components/bins/RegisterBinModal';
import { SendToKardexModal } from '@/components/bins/SendToKardexModal';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import {
  Package,
  PackagePlus,
  Eye,
  Send,
  CheckCircle2,
  Boxes,
  Search,
  RefreshCw,
  Copy,
  Check,
  X,
  Layers,
  Barcode,
  Clock,
  Zap,
  ChevronRight,
  CornerDownLeft,
  Activity,
  Cpu,
} from 'lucide-react';

const DEFAULT_PAGE_SIZE = 100;

export default function HUPutPage() {
  const router = useRouter();
  const { canPut, isLoading: authLoading } = useAuth();
  const [hus, setHus] = useState<HandlingUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHuId, setCopiedHuId] = useState<string | null>(null);

  // Banner message for actions
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<HUStats>({
    total: 0,
    inKardex: 0,
    draft: 0,
    outsideKardex: 0,
    empty: 0,
    partial: 0,
    full: 0,
  });

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [dispatchModalHU, setDispatchModalHU] = useState<HandlingUnit | null>(null);

  const fetchHUs = useCallback(
    async (
      pageNum = page,
      limit = pageSize,
      search = searchQuery
    ) => {
      try {
        setLoading(true);
        const body: Record<string, unknown> = {
          page: pageNum,
          size: limit,
        };

        if (search.trim()) {
          body.search = search.trim();
        }

        const res = await apiPost<HUListResponse>('/hu/list', body);
        setHus(res.data || []);
        setTotalPages(res.totalPages || 1);
        setTotalItems(res.totalItems || 0);
        setPage(res.page || 1);

        if (res.stats) {
          setStats(res.stats);
        }
      } catch {
        setHus([]);
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, searchQuery]
  );

  useEffect(() => {
    if (!authLoading && !canPut) {
      router.replace('/error/403');
      return;
    }
    fetchHUs(1, pageSize, searchQuery);
  }, [authLoading, canPut, router]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHUs(1, pageSize, searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, pageSize]);

  const handleCopyId = (huId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(huId);
    setCopiedHuId(huId);
    setTimeout(() => setCopiedHuId(null), 2000);
  };

  const handleRefresh = () => {
    fetchHUs(page, pageSize, searchQuery);
  };

  const handleSuccessRegister = () => {
    setSuccessBanner('New handling unit registered successfully and ready for Put operations.');
    fetchHUs(page, pageSize, searchQuery);
  };

  // Immediate jump to bin layout on scan/submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // Check if there is an exact or matching bin in currently loaded list
    const exactMatch = hus.find((h) => h.hu_id.toLowerCase() === query.toLowerCase());
    if (exactMatch) {
      router.push(`/app/bins/${encodeURIComponent(exactMatch.hu_id)}`);
    } else {
      // Direct jump to bin layout
      router.push(`/app/bins/${encodeURIComponent(query)}`);
    }
  };

  // Natural numeric sorting for Handling Unit IDs (e.g., BIN1, BIN2, BIN10)
  const sortedHUs = useMemo(() => {
    return [...hus].sort((a, b) =>
      a.hu_id.localeCompare(b.hu_id, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [hus]);

  const getTransactionBadge = (status: string | null) => {
    if (!status) return null;
    const map: Record<string, { bg: string; text: string; border: string; dot: string }> = {
      PENDING: { bg: '#fffbeb', text: '#b45309', border: '#fde68a', dot: '#f59e0b' },
      SUCCESSFUL: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#16a34a' },
      FAILED: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', dot: '#dc2626' },
    };
    const style = map[status] || { bg: '#f8fafc', text: '#475569', border: '#e2e8f0', dot: '#94a3b8' };
    return (
      <span
        style={{
          background: style.bg,
          color: style.text,
          border: `1px solid ${style.border}`,
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 700,
          padding: '2.5px 8px',
          letterSpacing: '0.2px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: style.dot,
            display: 'inline-block',
          }}
        />
        {status}
      </span>
    );
  };

  const getLastTxBadge = (tx: string | null) => {
    if (!tx) return <span className="text-muted" style={{ fontSize: '12px' }}>—</span>;
    const map: Record<string, { bg: string; text: string; border: string }> = {
      PUT: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
      MATERIAL_PICK: { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
      HU_PICK: { bg: '#fefce8', text: '#a16207', border: '#fef08a' },
    };
    const style = map[tx] || { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };
    return (
      <span
        style={{
          background: style.bg,
          color: style.text,
          border: `1px solid ${style.border}`,
          padding: '2.5px 9px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 800,
          display: 'inline-block',
          whiteSpace: 'nowrap',
          letterSpacing: '0.3px',
        }}
      >
        {tx.replace('_', ' ')}
      </span>
    );
  };

  const getHUStatusPill = (status: HUStatus) => {
    switch (status) {
      case 'FULL':
        return (
          <span className="status-pill full">
            <CheckCircle2 size={12} className="text-emerald-600" />
            <span>Full (100%)</span>
          </span>
        );
      case 'PARTIALLY_FILLED':
        return (
          <span className="status-pill partial">
            <span className="pulse-indicator amber" />
            <span>Partial</span>
          </span>
        );
      case 'EMPTY':
      default:
        return (
          <span className="status-pill empty">
            <span className="pulse-indicator slate" />
            <span>Empty (0%)</span>
          </span>
        );
    }
  };

  return (
    <div className="hu-put-container">
      <style jsx>{`
        .hu-put-container {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          width: 100%;
          max-width: 100%;
        }

        /* Top Header Card */
        .page-header-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.35rem 1.65rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header-title-wrap {
          display: flex;
          align-items: center;
          gap: 1.15rem;
        }

        .header-icon-box {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
          flex-shrink: 0;
        }

        .page-title {
          font-size: 23px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.4px;
          margin: 0;
          line-height: 1.2;
        }

        .page-subtitle {
          font-size: 13px;
          color: #64748b;
          margin-top: 3px;
          margin-bottom: 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn-reload {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          padding: 8px 15px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-reload:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }


        .btn-register-primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          color: #ffffff;
          padding: 8px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
        }

        .btn-register-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
        }

        /* Banner Notification */
        .notification-banner {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          padding: 10px 16px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(16, 185, 129, 0.1);
        }

        .notification-banner-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .notification-close-btn {
          background: transparent;
          border: none;
          color: #059669;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
        }

        /* 4 Clean Summary KPI Cards */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.85rem;
          width: 100%;
        }

        @media (max-width: 900px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.05rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        .stat-meta {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #64748b;
          margin-bottom: 3px;
        }

        .stat-value {
          font-size: 26px;
          font-weight: 800;
          line-height: 1.1;
        }

        .stat-subtext {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
          margin-top: 3px;
        }

        .stat-icon-well {
          width: 44px;
          height: 44px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Main Table Container Card */
        .table-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.35rem 1.65rem;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.04);
          width: 100%;
        }

        /* Improved High-Visibility Search Toolbar */
        .search-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding-bottom: 1.15rem;
          border-bottom: 1.5px solid #f1f5f9;
        }

        .search-form-full {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 280px;
          max-width: 680px;
        }

        .search-box-input-group {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .search-input-elevated {
          width: 100%;
          height: 44px;
          padding: 0 40px 0 42px;
          font-size: 14px;
          font-weight: 500;
          border-radius: 10px;
          border: 1.5px solid #cbd5e1;
          background: #f8fafc;
          color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
        }

        .search-input-elevated:focus {
          background: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }

        .search-icon-left {
          position: absolute;
          left: 14px;
          color: #64748b;
          pointer-events: none;
        }

        .search-clear-button {
          position: absolute;
          right: 12px;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 4px;
        }

        .search-clear-button:hover {
          color: #0f172a;
          background: #e2e8f0;
        }

        .btn-search-jump {
          height: 44px;
          padding: 0 20px;
          border-radius: 10px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          border: none;
          font-size: 13.5px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.28);
        }

        .btn-search-jump:hover {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.38);
        }

        .search-meta-cluster {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .bins-counter-badge {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 7px 16px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
          color: #334155;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          white-space: nowrap;
        }

        /* High-End Enterprise Elevated Table (Zero Side Scroll) */
        .table-responsive {
          width: 100%;
          overflow-x: hidden;
          border-radius: 11px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }

        .hu-singleline-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13.5px;
          background: #ffffff;
          table-layout: auto;
        }

        /* Sleek Gradient Header */
        .hu-singleline-table th {
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          color: #334155;
          font-weight: 800;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          padding: 13px 16px;
          border-bottom: 2px solid #e2e8f0;
          white-space: nowrap;
          text-align: left;
          user-select: none;
        }

        .hu-singleline-table td {
          padding: 13px 16px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          white-space: nowrap;
          color: #1e293b;
          height: 56px;
          transition: background 0.15s ease;
        }

        /* Subtle Alternating Zebra Striping for 100 Bins Scanning */
        .hu-singleline-table tr.table-row-item:nth-child(even) td {
          background-color: #fafbfc;
        }

        /* Interactive Row Hover with Accent Bar */
        .hu-singleline-table tr.table-row-item:hover td {
          background-color: #f0f7ff !important;
        }

        .hu-singleline-table tr.table-row-item:hover td:first-child {
          border-left: 3.5px solid #2563eb;
        }

        .hu-singleline-table tr:last-child td {
          border-bottom: none;
        }

        /* Cell 1: High-Tech Handling Unit Capsule */
        .single-line-hu {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .hu-id-capsule {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%);
          border: 1.5px solid #bfdbfe;
          padding: 5px 12px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
          transition: all 0.2s ease;
        }

        .hu-id-capsule:hover {
          border-color: #93c5fd;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
          transform: translateY(-0.5px);
        }

        .hu-id-link {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-weight: 800;
          font-size: 14.5px;
          color: #1d4ed8;
          text-decoration: none;
          letter-spacing: 0.4px;
        }

        .hu-id-link:hover {
          text-decoration: underline;
        }

        .copy-icon-btn {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.15s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .copy-icon-btn:hover {
          color: #0f172a;
          border-color: #cbd5e1;
          background: #f8fafc;
        }

        /* Cell 2: Bin Profile & PPS Dual Tag */
        .single-line-spec {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }

        .spec-icon-badge {
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: #f1f5f9;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #475569;
          flex-shrink: 0;
        }

        .spec-name {
          font-weight: 800;
          color: #0f172a;
          font-size: 13.5px;
        }

        .spec-divider {
          color: #cbd5e1;
          font-weight: 800;
        }

        .bin-name-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          padding: 3.5px 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #1e293b;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        }

        .pps-active-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #2563eb;
        }

        /* Cell 3: Telemetry Capacity Gauge */
        .single-line-load {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          white-space: nowrap;
        }

        .mini-track {
          width: 85px;
          height: 8px;
          background: #e2e8f0;
          border-radius: 9999px;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
        }

        .mini-fill {
          height: 100%;
          border-radius: 9999px;
          transition: width 0.3s ease;
        }

        .load-count-chip {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          font-size: 13px;
          font-weight: 700;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 2px 7px;
          border-radius: 5px;
        }

        .load-pct-chip {
          font-size: 11.5px;
          font-weight: 800;
          padding: 2px 7px;
          border-radius: 5px;
        }

        /* Cell 4: Visual Status Badges */
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          font-weight: 700;
          padding: 3.5px 10px;
          border-radius: 7px;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .status-pill.full {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        .status-pill.partial {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .status-pill.empty {
          background: #f8fafc;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .pulse-indicator {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
        }

        .pulse-indicator.amber {
          background: #f59e0b;
          box-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
        }

        .pulse-indicator.slate {
          background: #94a3b8;
        }

        /* Cell 5: Last Activity Terminal Badges */
        .single-line-activity {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        /* Cell 6: Operator Action Buttons */
        .single-line-actions {
          display: inline-flex;
          align-items: center;
          justify-content: flex-end;
          gap: 7px;
          white-space: nowrap;
        }

        :global(a.btn-scan-fill) {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
          border: 1px solid #1d4ed8 !important;
          color: #ffffff !important;
          padding: 7px 16px !important;
          border-radius: 8px !important;
          font-size: 12.5px !important;
          font-weight: 700 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          text-decoration: none !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.28) !important;
          white-space: nowrap !important;
          cursor: pointer !important;
        }

        :global(a.btn-scan-fill:hover) {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%) !important;
          border-color: #1e40af !important;
          color: #ffffff !important;
          text-decoration: none !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4) !important;
        }

        .btn-dispatch-kardex {
          background: #f0fdf4;
          border: 1px solid #86efac;
          color: #15803d;
          padding: 6.5px 13px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .btn-dispatch-kardex:hover {
          background: #dcfce7;
          border-color: #4ade80;
          color: #166534;
          transform: translateY(-1px);
        }

        :global(a.btn-view-layout) {
          background: #f8fafc !important;
          border: 1px solid #cbd5e1 !important;
          color: #334155 !important;
          padding: 6.5px 14px !important;
          border-radius: 8px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 5px !important;
          text-decoration: none !important;
          transition: all 0.15s ease !important;
          white-space: nowrap !important;
        }

        :global(a.btn-view-layout:hover) {
          background: #e2e8f0 !important;
          color: #0f172a !important;
          text-decoration: none !important;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        :global(.spin-animation) {
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      {/* Hero Header Card */}
      <div className="page-header-card">
        <div className="header-title-wrap">
          <div className="header-icon-box">
            <PackagePlus size={26} />
          </div>
          <div>
            <h1 className="page-title">Handling Unit (HU) Put</h1>
            <p className="page-subtitle">
              Prepare, scan adapters into compartments, and dispatch Handling Units to Kardex PPS shuttles.
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn-reload" onClick={handleRefresh} title="Sync latest status from server">
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
            Refresh
          </button>
          <button className="btn-register-primary" onClick={() => setIsRegisterOpen(true)}>
            <PackagePlus size={16} /> Register New Bin
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {successBanner && (
        <div className="notification-banner">
          <div className="notification-banner-left">
            <CheckCircle2 size={16} />
            <span>{successBanner}</span>
          </div>
          <button className="notification-close-btn" onClick={() => setSuccessBanner(null)}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* 4 Clean Summary KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-meta">
            <span className="stat-label">Total Units</span>
            <span className="stat-value" style={{ color: '#0f172a' }}>
              {stats.total || totalItems}
            </span>
            <span className="stat-subtext">All Registered Bins</span>
          </div>
          <div className="stat-icon-well" style={{ background: '#f1f5f9', color: '#475569' }}>
            <Boxes size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-meta">
            <span className="stat-label">Empty (0%)</span>
            <span className="stat-value" style={{ color: '#64748b' }}>
              {stats.empty}
            </span>
            <span className="stat-subtext">Ready for Materials</span>
          </div>
          <div className="stat-icon-well" style={{ background: '#f8fafc', color: '#64748b' }}>
            <Package size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-meta">
            <span className="stat-label">Partially Filled</span>
            <span className="stat-value" style={{ color: '#d97706' }}>
              {stats.partial}
            </span>
            <span className="stat-subtext">Put In Progress</span>
          </div>
          <div className="stat-icon-well" style={{ background: '#fffbeb', color: '#d97706' }}>
            <Clock size={20} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-meta">
            <span className="stat-label">Full (100%)</span>
            <span className="stat-value" style={{ color: '#16a34a' }}>
              {stats.full}
            </span>
            <span className="stat-subtext">100% Loaded</span>
          </div>
          <div className="stat-icon-well" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-card">
        {/* Improved Search Toolbar */}
        <div className="search-toolbar">
          <form onSubmit={handleSearchSubmit} className="search-form-full">
            <div className="search-box-input-group">
              <Search size={18} className="search-icon-left" />
              <input
                type="text"
                className="search-input-elevated"
                placeholder="Scan HU Barcode or search by Unit ID, PPS Station (e.g. BIN1)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-button"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <button
              type="submit"
              className="btn-search-jump"
              title="Scan or search and press Enter to immediately open bin layout"
            >
              <Barcode size={15} />
              <span>Open Bin</span>
              <CornerDownLeft size={13} />
            </button>
          </form>

          <div className="search-meta-cluster">
            <div className="bins-counter-badge">
              <Boxes size={15} className="text-primary" />
              <span>
                {totalItems} {totalItems === 1 ? 'bin registered' : 'bins registered'}
              </span>
            </div>
          </div>
        </div>

        {/* Table Body (Enterprise Polish, Zero Horizontal Scroll, Single Line Per Row) */}
        {loading ? (
          <Loader message="Loading handling units for Put operations..." />
        ) : sortedHUs.length === 0 ? (
          <EmptyState
            title="No Handling Units Found"
            description={
              searchQuery.trim()
                ? `No handling units match "${searchQuery}". Check the ID or scan another barcode.`
                : 'No handling units are registered yet for Put operations. Click "Register New Bin" above to initialize a physical bin.'
            }
          />
        ) : (
          <div className="table-responsive">
            <table className="hu-singleline-table">
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>
                    <div className="d-flex align-items-center gap-1.5">
                      <Barcode size={14} className="text-primary" />
                      <span>Handling Unit</span>
                    </div>
                  </th>
                  <th style={{ width: '25%' }}>
                    <div className="d-flex align-items-center gap-1.5">
                      <Layers size={14} className="text-slate-600" />
                      <span>Bin Spec & PPS</span>
                    </div>
                  </th>
                  <th style={{ width: '22%' }}>
                    <div className="d-flex align-items-center gap-1.5">
                      <Activity size={14} className="text-emerald-600" />
                      <span>Compartment Load</span>
                    </div>
                  </th>
                  <th style={{ width: '12%' }}>
                    <div className="d-flex align-items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-slate-600" />
                      <span>Fill Status</span>
                    </div>
                  </th>
                  <th style={{ width: '11%' }}>
                    <div className="d-flex align-items-center gap-1.5">
                      <Clock size={14} className="text-slate-600" />
                      <span>Last Activity</span>
                    </div>
                  </th>
                  <th style={{ width: '12%', textAlign: 'right' }}>
                    <div className="d-flex align-items-center justify-content-end gap-1.5">
                      <Zap size={14} className="text-amber-600" />
                      <span>Actions</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedHUs.map((hu) => {
                  const compartments = hu.compartments || [];
                  const total = compartments.length || hu.bin_type?.compartment_count || 30;
                  const occupied = compartments.filter((c) => c.status === 'OCCUPIED').length;
                  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;

                  const isAtStation =
                    hu.storage_status === 'DRAFT' || hu.storage_status === 'OUTSIDE_KARDEX';
                  const canSendToKardex = isAtStation && occupied > 0;
                  const isInKardex = hu.storage_status === 'IN_KARDEX';

                  // Dynamic gradient fill for progress gauge
                  const fillGradient =
                    pct === 100
                      ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                      : pct > 0
                      ? 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)'
                      : '#cbd5e1';

                  // Pill background for percentage chip
                  const pctBg =
                    pct === 100 ? '#f0fdf4' : pct > 0 ? '#eff6ff' : '#f8fafc';
                  const pctColor =
                    pct === 100 ? '#15803d' : pct > 0 ? '#1d4ed8' : '#64748b';
                  const pctBorder =
                    pct === 100 ? '#bbf7d0' : pct > 0 ? '#bfdbfe' : '#e2e8f0';

                  return (
                    <tr key={hu.id} className="table-row-item">
                      {/* Handling Unit ID - Tech Capsule */}
                      <td>
                        <div className="single-line-hu">
                          <div className="hu-id-capsule">
                            <Barcode size={15} className="text-primary flex-shrink-0" />
                            <Link
                              href={`/app/bins/${encodeURIComponent(hu.hu_id)}`}
                              className="hu-id-link"
                              title="Click to open bin layout and scan parts"
                            >
                              {hu.hu_id}
                            </Link>
                          </div>
                          <button
                            className="copy-icon-btn"
                            onClick={(e) => handleCopyId(hu.hu_id, e)}
                            title="Copy Handling Unit ID"
                          >
                            {copiedHuId === hu.hu_id ? (
                              <Check size={14} className="text-success" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Bin Specification & PPS Station - Dual Badge */}
                      <td>
                        <div className="single-line-spec">
                          <span className="spec-icon-badge">
                            <Layers size={13} />
                          </span>
                          <span className="spec-name">
                            {hu.bin_type?.name || `Type #${hu.bin_type_id}`}
                          </span>
                          <span className="spec-divider">·</span>
                          <span className="bin-name-badge">
                            <span className="pps-active-dot" />
                            PPS: {hu.bin_type?.bin_name || 'CON_BINC'}
                          </span>
                        </div>
                      </td>

                      {/* Compartment Load - High-Res Gauge */}
                      <td>
                        <div
                          className="single-line-load"
                          title={`${occupied} of ${total} compartments filled (${pct}%)`}
                        >
                          <div className="mini-track">
                            <div
                              className="mini-fill"
                              style={{ width: `${pct}%`, background: fillGradient }}
                            />
                          </div>
                          <span className="load-count-chip">
                            <strong style={{ color: occupied > 0 ? '#16a34a' : '#64748b' }}>
                              {occupied}
                            </strong>
                            <span className="text-muted">/{total}</span>
                          </span>
                          <span
                            className="load-pct-chip"
                            style={{
                              background: pctBg,
                              color: pctColor,
                              border: `1px solid ${pctBorder}`,
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                      </td>

                      {/* Fill Status */}
                      <td>{getHUStatusPill(hu.hu_status)}</td>

                      {/* Last Activity */}
                      <td>
                        <div className="single-line-activity">
                          {getLastTxBadge(hu.last_transaction)}
                          {hu.transaction_status && getTransactionBadge(hu.transaction_status)}
                        </div>
                      </td>

                      {/* Operator Actions */}
                      <td>
                        <div className="single-line-actions">
                          {/* Dispatch button if parts are loaded and bin is outside */}
                          {canSendToKardex && (
                            <button
                              type="button"
                              className="btn-dispatch-kardex"
                              onClick={() => setDispatchModalHU(hu)}
                              title="Generate Kardex transfer file and dispatch bin"
                            >
                              <Send size={12} />
                              <span>Dispatch</span>
                            </button>
                          )}

                          {/* Primary Scan / View Action */}
                          {!isInKardex ? (
                            <Link
                              href={`/app/bins/${encodeURIComponent(hu.hu_id)}`}
                              className="btn-scan-fill"
                              title="Open bin to scan parts and fill compartments"
                            >
                              <PackagePlus size={14} />
                              <span>Fill / Scan</span>
                              <ChevronRight size={13} />
                            </Link>
                          ) : (
                            <Link
                              href={`/app/bins/${encodeURIComponent(hu.hu_id)}`}
                              className="btn-view-layout"
                              title="View bin compartments and parts stored inside Kardex"
                            >
                              <Eye size={13} />
                              <span>View Bin</span>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination (100 per page limit) */}
        <div className="mt-3">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              setPage(p);
              fetchHUs(p, pageSize, searchQuery);
            }}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
              fetchHUs(1, newSize, searchQuery);
            }}
            pageSizeOptions={[50, 100, 200, 500]}
          />
        </div>
      </div>

      {/* Modals */}
      <RegisterBinModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={handleSuccessRegister}
      />

      {dispatchModalHU && (
        <SendToKardexModal
          isOpen={Boolean(dispatchModalHU)}
          onClose={() => setDispatchModalHU(null)}
          hu={dispatchModalHU}
          onSuccess={(result) => {
            const fileName = result?.fileName || result?.file_name;
            setSuccessBanner(
              fileName
                ? `Handling Unit ${dispatchModalHU.hu_id} dispatched to Kardex shuttle! Transfer order file "${fileName}" created.`
                : `Handling Unit ${dispatchModalHU.hu_id} dispatched to Kardex shuttle successfully.`
            );
            setDispatchModalHU(null);
            fetchHUs(page, pageSize, searchQuery);
          }}
        />
      )}
    </div>
  );
}
