'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';
import { HandlingUnit, StorageStatus, HUStatus, HUListResponse, HUStats } from '@/types/hu';
import { HUStatusBadge } from '@/components/bins/HUStatusBadge';
import { StorageStatusBadge } from '@/components/bins/StorageStatusBadge';
import { RegisterBinModal } from '@/components/bins/RegisterBinModal';
import { SendToKardexModal } from '@/components/bins/SendToKardexModal';
import { HUPickModal } from '@/components/bins/HUPickModal';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import {
  Package,
  PackagePlus,
  Eye,
  Send,
  PackageSearch,
  Layers,
  CheckCircle2,
  Archive,
  Boxes,
  Search,
  RefreshCw,
  Copy,
  Check,
  Inbox,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const PAGE_SIZE = 20;

const STORAGE_FILTER_TABS: { label: string; value: StorageStatus | 'ALL' }[] = [
  { label: 'All Bins', value: 'ALL' },
  { label: 'In Kardex', value: 'IN_KARDEX' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Outside Kardex', value: 'OUTSIDE_KARDEX' },
];

export default function BinsPage() {
  const [hus, setHus] = useState<HandlingUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters & Search
  const [storageFilter, setStorageFilter] = useState<StorageStatus | 'ALL'>('ALL');
  const [huStatusFilter, setHuStatusFilter] = useState<HUStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedHuId, setCopiedHuId] = useState<string | null>(null);

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
  const [sendToKardexHU, setSendToKardexHU] = useState<HandlingUnit | null>(null);
  const [huPickHU, setHuPickHU] = useState<HandlingUnit | null>(null);

  const fetchHUs = useCallback(
    async (
      pageNum = page,
      storage = storageFilter,
      huStatus = huStatusFilter,
      search = searchQuery
    ) => {
      try {
        setLoading(true);
        const body: Record<string, unknown> = {
          page: pageNum,
          size: PAGE_SIZE,
        };
        if (storage !== 'ALL') body.storage_status = storage;
        if (huStatus !== 'ALL') body.hu_status = huStatus;
        if (search.trim()) body.search = search.trim();

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
    [page, storageFilter, huStatusFilter, searchQuery]
  );

  useEffect(() => {
    fetchHUs(1, storageFilter, huStatusFilter, searchQuery);
  }, [storageFilter, huStatusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHUs(1, storageFilter, huStatusFilter, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCopyId = (huId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(huId);
    setCopiedHuId(huId);
    setTimeout(() => setCopiedHuId(null), 2000);
  };

  const handleRefresh = () => {
    fetchHUs(page, storageFilter, huStatusFilter, searchQuery);
  };

  const handleSuccess = () => {
    fetchHUs(page, storageFilter, huStatusFilter, searchQuery);
  };

  const getTransactionBadge = (status: string | null) => {
    if (!status) return null;
    const map: Record<string, { bg: string; text: string; border: string }> = {
      PENDING: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
      SUCCESSFUL: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
      FAILED: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
    };
    const style = map[status] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
    return (
      <span
        style={{
          background: style.bg,
          color: style.text,
          border: `1px solid ${style.border}`,
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 700,
          padding: '2px 7px',
          letterSpacing: '0.3px',
        }}
      >
        {status}
      </span>
    );
  };

  const getLastTxBadge = (tx: string | null) => {
    if (!tx) return <span className="text-muted" style={{ fontSize: '12px' }}>—</span>;
    const map: Record<string, { bg: string; text: string }> = {
      PUT: { bg: '#eff6ff', text: '#1d4ed8' },
      MATERIAL_PICK: { bg: '#ecfeff', text: '#0e7490' },
      HU_PICK: { bg: '#fefce8', text: '#a16207' },
    };
    const style = map[tx] || { bg: '#f8fafc', text: '#475569' };
    return (
      <span
        style={{
          background: style.bg,
          color: style.text,
          padding: '3px 8px',
          borderRadius: '5px',
          fontSize: '11px',
          fontWeight: 600,
        }}
      >
        {tx.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="bins-inventory-container">
      <style jsx>{`
        .bins-inventory-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        /* Top Header Bar */
        .page-header-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.5rem 1.75rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header-title-wrap {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-icon-box {
          width: 50px;
          height: 50px;
          border-radius: 12px;
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
          flex-shrink: 0;
        }

        .page-title {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.3px;
          margin: 0;
          line-height: 1.2;
        }

        .page-subtitle {
          font-size: 13px;
          color: #64748b;
          margin-top: 3px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn-reload {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #64748b;
          padding: 8px 14px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }

        .btn-reload:hover {
          background: #f8fafc;
          color: #0f172a;
          border-color: #cbd5e1;
        }

        .btn-register-primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          border: none;
          padding: 9px 18px;
          border-radius: 9px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .btn-register-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
        }

        /* 6 Interactive Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 1rem;
          width: 100%;
        }

        .interactive-stat-card {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .interactive-stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
          border-color: #cbd5e1;
        }

        .interactive-stat-card.active-stat {
          border-color: #3b82f6;
          background: #f8fafc;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
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
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 26px;
          font-weight: 800;
          line-height: 1.1;
        }

        .stat-icon-well {
          width: 40px;
          height: 40px;
          border-radius: 10px;
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
          padding: 1.25rem 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .table-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #f1f5f9;
        }

        .toolbar-left-cluster {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .filter-tab-pill-group {
          display: inline-flex;
          background: #f1f5f9;
          border-radius: 9px;
          padding: 3px;
          gap: 3px;
        }

        .filter-tab-pill {
          border: none;
          background: transparent;
          padding: 6px 14px;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 7px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-tab-pill.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          font-weight: 700;
        }

        .status-dropdown-select {
          padding: 6px 12px;
          font-size: 12.5px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
          font-weight: 600;
          outline: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .status-dropdown-select:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .toolbar-right-cluster {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .search-box-wrapper {
          position: relative;
          min-width: 240px;
        }

        .search-input-field {
          width: 100%;
          padding: 7px 32px 7px 32px;
          font-size: 12.5px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          outline: none;
          transition: all 0.15s ease;
        }

        .search-input-field:focus {
          background: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .search-icon-affix {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .search-clear-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 2px;
        }

        .search-clear-btn:hover {
          color: #0f172a;
        }

        /* Modern Table Styles */
        .bins-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
        }

        .bins-table th {
          background: #f8fafc;
          font-size: 11.5px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 12px 14px;
          border-bottom: 1.5px solid #e2e8f0;
          border-top: none;
          white-space: nowrap;
        }

        .bins-table td {
          padding: 12px 14px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
          vertical-align: middle;
          background: #ffffff;
        }

        .bins-table tr:hover td {
          background: #f8fafc;
        }

        .bins-table tr:last-child td {
          border-bottom: none;
        }

        /* Table Specific Elements */
        .hu-id-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          text-decoration: none;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-weight: 800;
          font-size: 14px;
          color: #1e40af;
          transition: all 0.15s ease;
        }

        .hu-id-link:hover {
          color: #2563eb;
          text-decoration: underline;
        }

        .copy-icon-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 2px;
          display: inline-flex;
          align-items: center;
          transition: color 0.15s ease;
        }

        .copy-icon-btn:hover {
          color: #0f172a;
        }

        .bin-name-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 2px 7px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        /* Mini Capacity Fill Progress Bar */
        .capacity-cell-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 110px;
        }

        .capacity-numbers-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 600;
        }

        .mini-track {
          width: 100%;
          height: 6px;
          background: #f1f5f9;
          border-radius: 9999px;
          overflow: hidden;
        }

        .mini-fill {
          height: 100%;
          border-radius: 9999px;
          transition: width 0.3s ease;
        }

        /* Action Buttons */
        .btn-view-fill {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          padding: 5px 12px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .btn-view-fill:hover {
          background: #dbeafe;
          border-color: #93c5fd;
          color: #1e40af;
          transform: translateY(-1px);
        }

        .btn-action-send {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
          padding: 5px 12px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-send:hover {
          background: #dcfce7;
          border-color: #86efac;
          transform: translateY(-1px);
        }

        .btn-action-pick {
          background: #fefce8;
          border: 1px solid #fef08a;
          color: #854d0e;
          padding: 5px 12px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-action-pick:hover {
          background: #fef9c3;
          border-color: #fde047;
          transform: translateY(-1px);
        }
      `}</style>

      {/* Hero Header */}
      <div className="page-header-card">
        <div className="header-title-wrap">
          <div className="header-icon-box">
            <Layers size={24} />
          </div>
          <div>
            <h1 className="page-title">Handling Units (Bins) Inventory</h1>
            <p className="page-subtitle">
              Monitor real-time bin storage statuses, capacity allocation, and Kardex PPS shuttle operations.
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

      {/* 6 Interactive Stats Cards */}
      <div className="stats-grid">
        {/* Total Bins */}
        <div
          className={`interactive-stat-card ${storageFilter === 'ALL' && huStatusFilter === 'ALL' ? 'active-stat' : ''}`}
          onClick={() => {
            setStorageFilter('ALL');
            setHuStatusFilter('ALL');
          }}
          title="Click to show all bins"
        >
          <div className="stat-meta">
            <span className="stat-label">Total Bins</span>
            <span className="stat-value" style={{ color: '#0f172a' }}>
              {stats.total || totalItems}
            </span>
          </div>
          <div className="stat-icon-well" style={{ background: '#f1f5f9', color: '#475569' }}>
            <Boxes size={20} />
          </div>
        </div>

        {/* In Kardex */}
        <div
          className={`interactive-stat-card ${storageFilter === 'IN_KARDEX' ? 'active-stat' : ''}`}
          onClick={() => {
            setStorageFilter('IN_KARDEX');
            setHuStatusFilter('ALL');
          }}
          title="Click to filter bins currently in Kardex"
        >
          <div className="stat-meta">
            <span className="stat-label">In Kardex</span>
            <span className="stat-value" style={{ color: '#2563eb' }}>
              {stats.inKardex}
            </span>
          </div>
          <div className="stat-icon-well" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Draft Bins */}
        <div
          className={`interactive-stat-card ${storageFilter === 'DRAFT' ? 'active-stat' : ''}`}
          onClick={() => {
            setStorageFilter('DRAFT');
            setHuStatusFilter('ALL');
          }}
          title="Click to filter draft bins on shop floor"
        >
          <div className="stat-meta">
            <span className="stat-label">Draft (Floor)</span>
            <span className="stat-value" style={{ color: '#64748b' }}>
              {stats.draft}
            </span>
          </div>
          <div className="stat-icon-well" style={{ background: '#f8fafc', color: '#64748b' }}>
            <Archive size={20} />
          </div>
        </div>

        {/* Empty Bins */}
        <div
          className={`interactive-stat-card ${huStatusFilter === 'EMPTY' ? 'active-stat' : ''}`}
          onClick={() => setHuStatusFilter(huStatusFilter === 'EMPTY' ? 'ALL' : 'EMPTY')}
          title="Click to filter empty bins"
        >
          <div className="stat-meta">
            <span className="stat-label">Empty</span>
            <span className="stat-value" style={{ color: '#16a34a' }}>
              {stats.empty}
            </span>
          </div>
          <div className="stat-icon-well" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <Inbox size={20} />
          </div>
        </div>

        {/* Partial Bins */}
        <div
          className={`interactive-stat-card ${huStatusFilter === 'PARTIALLY_FILLED' ? 'active-stat' : ''}`}
          onClick={() => setHuStatusFilter(huStatusFilter === 'PARTIALLY_FILLED' ? 'ALL' : 'PARTIALLY_FILLED')}
          title="Click to filter partially filled bins"
        >
          <div className="stat-meta">
            <span className="stat-label">Partially Filled</span>
            <span className="stat-value" style={{ color: '#d97706' }}>
              {stats.partial}
            </span>
          </div>
          <div className="stat-icon-well" style={{ background: '#fffbeb', color: '#d97706' }}>
            <Package size={20} />
          </div>
        </div>

        {/* Full Bins */}
        <div
          className={`interactive-stat-card ${huStatusFilter === 'FULL' ? 'active-stat' : ''}`}
          onClick={() => setHuStatusFilter(huStatusFilter === 'FULL' ? 'ALL' : 'FULL')}
          title="Click to filter full bins"
        >
          <div className="stat-meta">
            <span className="stat-label">Full (100%)</span>
            <span className="stat-value" style={{ color: '#059669' }}>
              {stats.full}
            </span>
          </div>
          <div className="stat-icon-well" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Package size={20} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-card">
        {/* Table Toolbar */}
        <div className="table-toolbar">
          <div className="toolbar-left-cluster">
            {/* Storage Status Tabs */}
            <div className="filter-tab-pill-group">
              {STORAGE_FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  className={`filter-tab-pill ${storageFilter === tab.value ? 'active' : ''}`}
                  onClick={() => setStorageFilter(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* HU Fill Status Filter */}
            <select
              className="status-dropdown-select"
              value={huStatusFilter}
              onChange={(e) => setHuStatusFilter(e.target.value as HUStatus | 'ALL')}
            >
              <option value="ALL">All Fill Levels</option>
              <option value="EMPTY">Only Empty</option>
              <option value="PARTIALLY_FILLED">Only Partially Filled</option>
              <option value="FULL">Only 100% Full</option>
            </select>
          </div>

          <div className="toolbar-right-cluster">
            {/* Search Box */}
            <div className="search-box-wrapper">
              <Search size={14} className="search-icon-affix" />
              <input
                type="text"
                className="search-input-field"
                placeholder="Search Handling Unit ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <span className="text-muted" style={{ fontSize: '12.5px', fontWeight: 600 }}>
              {totalItems} {totalItems === 1 ? 'bin' : 'bins'} found
            </span>
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <Loader message="Loading handling units..." />
        ) : hus.length === 0 ? (
          <EmptyState
            title="No Handling Units Found"
            description={
              searchQuery || storageFilter !== 'ALL' || huStatusFilter !== 'ALL'
                ? 'No bins match your current search or filter settings. Try adjusting the filters or search term.'
                : 'No handling units are registered yet. Register your first bin to start scanning adapters.'
            }
          />
        ) : (
          <div className="table-responsive">
            <table className="bins-table">
              <thead>
                <tr>
                  <th>Handling Unit</th>
                  <th>Bin Specification</th>
                  <th>Capacity Allocation</th>
                  <th>HU Status</th>
                  <th>Storage Status</th>
                  <th>Last Transaction</th>
                  <th>Tx Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {hus.map((hu) => {
                  const compartments = hu.compartments || [];
                  const occupied = compartments.filter((c) => c.status === 'OCCUPIED').length;
                  const total = compartments.length || hu.bin_type?.compartment_count || 15;
                  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
                  const canSendToKardex =
                    (hu.storage_status === 'DRAFT' || hu.storage_status === 'OUTSIDE_KARDEX') && occupied > 0;
                  const canHUPick = hu.storage_status === 'IN_KARDEX';

                  // Progress bar color based on load
                  const fillColor =
                    pct === 100 ? '#10b981' : pct > 0 ? '#3b82f6' : '#cbd5e1';

                  return (
                    <tr key={hu.id}>
                      {/* Handling Unit ID */}
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <Link
                            href={`/app/bins/${hu.hu_id}`}
                            className="hu-id-link"
                            title="Open physical bin layout"
                          >
                            {hu.hu_id}
                          </Link>
                          <button
                            className="copy-icon-btn"
                            onClick={(e) => handleCopyId(hu.hu_id, e)}
                            title="Copy Handling Unit ID"
                          >
                            {copiedHuId === hu.hu_id ? (
                              <Check size={12} className="text-success" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Bin Specification */}
                      <td>
                        <div className="d-flex flex-column gap-1">
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>
                            {hu.bin_type?.name || `Type #${hu.bin_type_id}`}
                          </span>
                          <span className="bin-name-badge">
                            PPS: {hu.bin_type?.bin_name || 'CON_BINA'}
                          </span>
                        </div>
                      </td>

                      {/* Capacity Allocation with Mini Progress Bar */}
                      <td>
                        <div className="capacity-cell-wrap">
                          <div className="capacity-numbers-row">
                            <span>
                              <strong style={{ color: occupied > 0 ? '#16a34a' : '#64748b' }}>
                                {occupied}
                              </strong>
                              <span className="text-muted"> / {total}</span>
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                              {pct}%
                            </span>
                          </div>
                          <div className="mini-track">
                            <div
                              className="mini-fill"
                              style={{ width: `${pct}%`, background: fillColor }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* HU Status */}
                      <td>
                        <HUStatusBadge status={hu.hu_status} />
                      </td>

                      {/* Storage Status */}
                      <td>
                        <StorageStatusBadge status={hu.storage_status} />
                      </td>

                      {/* Last Transaction */}
                      <td>{getLastTxBadge(hu.last_transaction)}</td>

                      {/* Transaction Status */}
                      <td>{getTransactionBadge(hu.transaction_status)}</td>

                      {/* Actions */}
                      <td>
                        <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                          <Link href={`/app/bins/${hu.hu_id}`} className="btn-view-fill">
                            <Eye size={13} /> View / Fill
                          </Link>

                          {canSendToKardex && (
                            <button
                              className="btn-action-send"
                              onClick={() => setSendToKardexHU(hu)}
                              title="Send completed bin to Kardex PPS storage"
                            >
                              <Send size={12} /> Send to Kardex
                            </button>
                          )}

                          {canHUPick && (
                            <button
                              className="btn-action-pick"
                              onClick={() => setHuPickHU(hu)}
                              title="Request Kardex PPS retrieval for this bin"
                            >
                              <PackageSearch size={12} /> HU Pick
                            </button>
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

        {/* Pagination */}
        <div className="mt-3">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              setPage(p);
              fetchHUs(p, storageFilter, huStatusFilter, searchQuery);
            }}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageSizeChange={() => {}}
          />
        </div>
      </div>

      {/* Modals */}
      <RegisterBinModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={handleSuccess}
      />

      {sendToKardexHU && (
        <SendToKardexModal
          isOpen={!!sendToKardexHU}
          onClose={() => setSendToKardexHU(null)}
          onSuccess={() => {
            setSendToKardexHU(null);
            handleSuccess();
          }}
          hu={sendToKardexHU}
        />
      )}

      {huPickHU && (
        <HUPickModal
          isOpen={!!huPickHU}
          onClose={() => setHuPickHU(null)}
          onSuccess={() => {
            setHuPickHU(null);
            handleSuccess();
          }}
          hu={huPickHU}
        />
      )}
    </div>
  );
}
