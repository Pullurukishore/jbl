'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api';
import { copyToClipboard as copyUtil } from '@/lib/clipboard';
import { formatIndianDate } from '@/lib/date';
import {
  MaterialStats,
  MaterialSummaryItem,
  MaterialSummaryResponse,
} from '@/types/material';
import { Pagination } from '@/components/shared/Pagination';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  Layers,
  Search,
  RefreshCw,
  Copy,
  Check,
  FileSpreadsheet,
  Boxes,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Tag,
  ArrowUpRight,
  Filter,
  Download,
  X,
  PackageCheck,
  Clock,
  Sparkles,
  PackageMinus,
} from 'lucide-react';
import XLSX from 'xlsx-js-style';

export default function MaterialsPage() {
  // Stats State
  const [stats, setStats] = useState<MaterialStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Materials List State
  const [materials, setMaterials] = useState<MaterialSummaryItem[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<string>('available_count');
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC');
  const [copiedModel, setCopiedModel] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await apiGet<MaterialStats>('/material/stats');
      setStats(res);
    } catch (err) {
      console.error('Failed to fetch material stats:', err);
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Materials Summary Table
  const fetchMaterials = useCallback(
    async (currentPage = page, currentSize = pageSize) => {
      try {
        setTableLoading(true);
        const res = await apiPost<MaterialSummaryResponse>('/material/summary', {
          search: debouncedSearch,
          statusFilter,
          page: currentPage,
          size: currentSize,
          sortField,
          sortDirection,
        });
        setMaterials(res.data || []);
        setTotalPages(res.totalPages || 1);
        setTotalItems(res.totalItems || 0);
        setPage(res.page || 1);
      } catch (err) {
        console.error('Failed to fetch materials summary:', err);
        setMaterials([]);
      } finally {
        setTableLoading(false);
      }
    },
    [debouncedSearch, statusFilter, sortField, sortDirection, page, pageSize]
  );

  // Initial load
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchMaterials(page, pageSize);
  }, [fetchMaterials, page, pageSize]);

  // Copy to clipboard helper
  const copyToClipboard = (text: string) => {
    copyUtil(text);
    setCopiedModel(text);
    setTimeout(() => setCopiedModel(null), 1800);
  };

  // Export current material list to Excel
  const handleExportExcel = () => {
    if (!materials.length) return;
    try {
      setExporting(true);
      const exportData = materials.map((m, idx) => ({
        '#': idx + 1,
        'Model / Part Number': m.model_number,
        'Stock Status': m.status,
        'Available Stock': m.available_count,
        'On Hold': m.hold_count,
        'Picked / Dispatched': m.picked_count,
        'Total Historical': m.total_count,
        'Active Bins': (m.handling_units || []).join(', ') || 'None',
        'Last Inbound Date': m.last_scanned_at ? new Date(m.last_scanned_at).toLocaleString() : 'N/A',
        'First Inbound Date': m.first_scanned_at ? new Date(m.first_scanned_at).toLocaleString() : 'N/A',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Materials Master');
      XLSX.writeFile(workbook, `Kardex_Materials_Master_${Date.now()}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="materials-page-container py-2 px-1 px-md-3"
      style={{
        width: '100%',
        maxWidth: '100%',
        backgroundColor: '#f8fafc',
      }}
    >
      {/* Top Header Card */}
      <div
        className="materials-hero-card mb-4 shadow-sm"
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '20px 24px',
        }}
      >
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Layers size={20} />
              </span>
              <h1 className="h4 fw-bold text-dark mb-0">Materials Master & Inventory</h1>
            </div>
            <p className="text-muted small mb-0 ms-1">
              Live Kardex storage counts, bin locations, and serialized unit tracking by Part Number
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2 rounded-pill px-3 shadow-sm bg-white"
              onClick={handleExportExcel}
              disabled={exporting || materials.length === 0}
              title="Download inventory master sheet"
            >
              <Download size={14} className="text-success" />
              <span className="fw-semibold">
                {exporting ? 'Exporting...' : 'Export to Excel'}
              </span>
            </button>

            <button
              type="button"
              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2 rounded-pill px-3 shadow-sm bg-white"
              onClick={() => {
                fetchStats();
                fetchMaterials(page, pageSize);
              }}
              title="Refresh inventory"
            >
              <RefreshCw size={14} />
              <span className="fw-semibold">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRICS RIBBON */}
      <div className="row g-3 mb-4">
        {/* KPI 1: Unique Materials */}
        <div className="col-12 col-sm-6 col-xl">
          <div
            className="card border-0 shadow-sm h-100 p-3"
            style={{ borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Layers size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Material Master
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
                  {statsLoading ? '...' : (stats?.totalMaterials ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Distinct Part Numbers</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 2: Available Stock */}
        <div className="col-12 col-sm-6 col-xl">
          <div
            className="card border-0 shadow-sm h-100 p-3"
            style={{ borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Available Stock
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#059669' }}>
                  {statsLoading ? '...' : (stats?.totalAvailable ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Ready in Kardex Storage</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Quality Hold */}
        <div className="col-12 col-sm-6 col-xl">
          <div
            className="card border-0 shadow-sm h-100 p-3"
            style={{ borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: '#fffbeb',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Quality Hold
                </div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 800,
                    color: (stats?.totalHold ?? 0) > 0 ? '#d97706' : '#0f172a',
                  }}
                >
                  {statsLoading ? '...' : (stats?.totalHold ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Quarantine / QA Review</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 4: Active Bins */}
        <div className="col-12 col-sm-6 col-xl">
          <div
            className="card border-0 shadow-sm h-100 p-3"
            style={{ borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: '#faf5ff',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Boxes size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Allocated Bins
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#7c3aed' }}>
                  {statsLoading ? '...' : (stats?.activeBinsCount ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Active Kardex Trays (HUs)</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 5: Total Dispatched */}
        <div className="col-12 col-sm-6 col-xl">
          <div
            className="card border-0 shadow-sm h-100 p-3"
            style={{ borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}
          >
            <div className="d-flex align-items-center gap-3">
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <PackageMinus size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  Dispatched Units
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#1d4ed8' }}>
                  {statsLoading ? '...' : (stats?.totalPicked ?? 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Historic Outbound Picks</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TOOLBAR: Quick Filter Tabs & Search Controls */}
      <div
        className="materials-toolbar-card mb-4 shadow-sm"
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
        }}
      >
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
          {/* Quick Status Filter Tabs */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className={`materials-filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('ALL');
                setPage(1);
              }}
            >
              <span>All Stock</span>
            </button>

            <button
              type="button"
              className={`materials-filter-pill ${statusFilter === 'IN_STOCK' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('IN_STOCK');
                setPage(1);
              }}
            >
              <CheckCircle2 size={13} className={statusFilter === 'IN_STOCK' ? 'text-white' : 'text-success'} />
              <span>In Stock (&gt; 5)</span>
            </button>

            <button
              type="button"
              className={`materials-filter-pill ${statusFilter === 'LOW_STOCK' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('LOW_STOCK');
                setPage(1);
              }}
            >
              <AlertTriangle size={13} className={statusFilter === 'LOW_STOCK' ? 'text-white' : 'text-warning'} />
              <span>Low Stock (1 - 5)</span>
            </button>

            <button
              type="button"
              className={`materials-filter-pill ${statusFilter === 'OUT_OF_STOCK' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('OUT_OF_STOCK');
                setPage(1);
              }}
            >
              <XCircle size={13} className={statusFilter === 'OUT_OF_STOCK' ? 'text-white' : 'text-danger'} />
              <span>Depleted (0)</span>
            </button>

            <button
              type="button"
              className={`materials-filter-pill ${statusFilter === 'HOLD' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('HOLD');
                setPage(1);
              }}
            >
              <AlertTriangle size={13} className={statusFilter === 'HOLD' ? 'text-white' : 'text-warning'} />
              <span>Has Quality Hold</span>
            </button>
          </div>

          {/* Right Search & Controls */}
          <div className="d-flex align-items-center gap-2 flex-wrap" style={{ flexGrow: 1, justifyContent: 'flex-end', width: 'auto' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '180px', flex: '1 1 auto' }}>
              <Search
                size={14}
                className="text-muted"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ paddingLeft: '32px', paddingRight: searchQuery ? '30px' : '12px', borderRadius: '8px' }}
                placeholder="Search by Part # or Serial Barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-sm btn-link p-0 text-muted"
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                  onClick={() => setSearchQuery('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Sorter */}
            <select
              className="form-select form-select-sm"
              style={{ borderRadius: '8px', minWidth: '140px', flex: '1 1 auto', width: 'auto' }}
              value={`${sortField}_${sortDirection}`}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'available_DESC') {
                  setSortField('available_count');
                  setSortDirection('DESC');
                } else if (val === 'available_ASC') {
                  setSortField('available_count');
                  setSortDirection('ASC');
                } else if (val === 'model_ASC') {
                  setSortField('model_number');
                  setSortDirection('ASC');
                } else if (val === 'model_DESC') {
                  setSortField('model_number');
                  setSortDirection('DESC');
                } else if (val === 'last_scanned_DESC') {
                  setSortField('last_scanned_at');
                  setSortDirection('DESC');
                }
                setPage(1);
              }}
            >
              <option value="available_DESC">Stock: High → Low</option>
              <option value="available_ASC">Stock: Low → High</option>
              <option value="model_ASC">Part #: A → Z</option>
              <option value="model_DESC">Part #: Z → A</option>
              <option value="last_scanned_DESC">Recently Scanned</option>
            </select>

            {/* Page Size */}
            <select
              className="form-select form-select-sm"
              style={{ borderRadius: '8px', minWidth: '95px', flex: '0 1 auto', width: 'auto' }}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={15}>15 / page</option>
              <option value={30}>30 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* MAIN MATERIALS MASTER TABLE */}
      <div
        className="materials-table-card shadow-sm mb-4"
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        {tableLoading ? (
          <div className="py-5 text-center">
            <Loader message="Fetching materials inventory from Kardex database..." />
          </div>
        ) : materials.length > 0 ? (
          <div className="table-responsive">
            <table className="table materials-table align-middle mb-0" style={{ minWidth: '880px' }}>
              <thead>
                <tr>
                  <th style={{ width: '260px' }}>Model / Part Number</th>
                  <th style={{ width: '150px' }}>Stock Status</th>
                  <th style={{ width: '170px' }}>Available Stock</th>
                  <th style={{ width: '130px' }}>On Hold</th>
                  <th style={{ width: '130px' }}>Dispatched</th>
                  <th style={{ width: '240px' }}>Allocated Bins (HUs)</th>
                  <th style={{ width: '160px' }}>Last Inbound</th>
                  <th style={{ width: '110px' }} className="text-end">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => {
                  const total = (m.available_count || 0) + (m.hold_count || 0) + (m.picked_count || 0) || 1;
                  const availPct = Math.round(((m.available_count || 0) / total) * 100);
                  const holdPct = Math.round(((m.hold_count || 0) / total) * 100);
                  const pickedPct = 100 - availPct - holdPct;

                  return (
                    <tr key={m.model_number}>
                      {/* Model Number */}
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <Tag size={15} className="text-muted flex-shrink-0" />
                          <Link
                            href={`/app/materials/${encodeURIComponent(m.model_number)}`}
                            className="model-code-link"
                            title="Click to view material details & serial ledger"
                          >
                            {m.model_number}
                          </Link>
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0 text-muted"
                            onClick={() => copyToClipboard(m.model_number)}
                            title="Copy Part Number"
                          >
                            {copiedModel === m.model_number ? (
                              <Check size={13} className="text-success" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Stock Status Badge */}
                      <td>
                        {m.status === 'IN_STOCK' ? (
                          <span
                            className="badge d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill"
                            style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}
                          >
                            <CheckCircle2 size={12} /> In Stock
                          </span>
                        ) : m.status === 'LOW_STOCK' ? (
                          <span
                            className="badge d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill"
                            style={{ backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}
                          >
                            <AlertTriangle size={12} /> Low Stock
                          </span>
                        ) : (
                          <span
                            className="badge d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill"
                            style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                          >
                            <XCircle size={12} /> Depleted
                          </span>
                        )}
                      </td>

                      {/* Available Stock & Mini Ratio Bar */}
                      <td>
                        <div>
                          <span
                            style={{
                              fontSize: '15px',
                              fontWeight: 800,
                              color: m.available_count > 0 ? '#059669' : '#94a3b8',
                            }}
                          >
                            {m.available_count.toLocaleString()}
                          </span>
                          <span className="text-muted ms-1" style={{ fontSize: '11px' }}>
                            units
                          </span>

                          {/* Mini Ratio Bar */}
                          <div className="stock-ratio-bar mt-1" title={`Available: ${availPct}%, Hold: ${holdPct}%, Dispatched: ${pickedPct}%`}>
                            <div className="stock-ratio-avail" style={{ width: `${availPct}%` }} />
                            <div className="stock-ratio-hold" style={{ width: `${holdPct}%` }} />
                            <div className="stock-ratio-picked" style={{ width: `${pickedPct}%` }} />
                          </div>
                        </div>
                      </td>

                      {/* Quality Hold */}
                      <td>
                        {m.hold_count > 0 ? (
                          <span
                            className="badge px-2 py-1"
                            style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                          >
                            {m.hold_count} hold
                          </span>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                      </td>

                      {/* Picked / Dispatched */}
                      <td>
                        <span className="text-muted font-monospace small fw-semibold">
                          {m.picked_count.toLocaleString()}
                        </span>
                      </td>

                      {/* Allocated Bins (HUs) */}
                      <td>
                        {m.handling_units && m.handling_units.length > 0 ? (
                          <div className="d-flex flex-wrap align-items-center gap-1">
                            {m.handling_units.slice(0, 3).map((huId) => (
                              <Link
                                key={huId}
                                href={`/app/bins/${encodeURIComponent(huId)}`}
                                className="bin-chip"
                                title={`View ${huId} compartment layout`}
                              >
                                <Boxes size={11} />
                                <span>{huId}</span>
                              </Link>
                            ))}
                            {m.handling_units.length > 3 && (
                              <span
                                className="badge bg-light text-muted border"
                                style={{ fontSize: '10.5px' }}
                              >
                                +{m.handling_units.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted small">No active bins</span>
                        )}
                      </td>

                      {/* Last Inbound */}
                      <td>
                        <span className="text-muted font-monospace small">
                          {m.last_scanned_at
                            ? formatIndianDate(m.last_scanned_at)
                            : '—'}
                        </span>
                      </td>

                      {/* Action: Inspect */}
                      <td className="text-end">
                        <Link
                          href={`/app/materials/${encodeURIComponent(m.model_number)}`}
                          className="btn btn-outline-primary btn-sm py-1 px-3 d-inline-flex align-items-center gap-1 rounded-pill"
                          style={{ fontSize: '12px', fontWeight: 600 }}
                          title="Inspect material specifications, bins & serial ledger"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No materials found"
            description="No materials match your current search criteria or stock filters."
            action={
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
              >
                Reset Filters
              </button>
            }
          />
        )}
      </div>

      {/* Pagination Controls */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-5">
        <span className="text-muted small">
          Showing {materials.length} of {totalItems} total materials
        </span>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}
