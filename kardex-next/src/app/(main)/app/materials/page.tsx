'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  MaterialStats,
  MaterialSummaryItem,
  MaterialSummaryResponse,
  MaterialStockStatus
} from '@/types/material';
import { MaterialKPICards } from '@/components/materials/MaterialKPICards';
import { MaterialDetailDrawer } from '@/components/materials/MaterialDetailDrawer';
import { ScanAndStoreModal } from '@/components/dashboard/ScanAndStoreModal';
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
  PackageMinus,
  Eye,
  Tag,
  ArrowUpRight,
  Filter,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function MaterialsPage() {
  const { canPick } = useAuth();

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

  // Drawer & Modal States
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPickModalOpen, setIsPickModalOpen] = useState(false);

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
          sortDirection
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

  // Initial load & dependency changes
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchMaterials(page, pageSize);
  }, [fetchMaterials, page, pageSize]);

  // Copy to clipboard helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedModel(text);
    setTimeout(() => setCopiedModel(null), 1800);
  };

  // Open detail drawer for a material
  const handleOpenDrawer = (modelNumber: string) => {
    setSelectedModel(modelNumber);
    setIsDrawerOpen(true);
  };

  // Quick Pick trigger
  const handleTriggerPick = (modelNumber: string) => {
    setSelectedModel(modelNumber);
    setIsDrawerOpen(false);
    setIsPickModalOpen(true);
  };

  // Export current material list to Excel
  const handleExportExcel = () => {
    if (!materials.length) return;
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
      'First Inbound Date': m.first_scanned_at ? new Date(m.first_scanned_at).toLocaleString() : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Materials Master');
    XLSX.writeFile(workbook, `Kardex_Materials_Master_${Date.now()}.xlsx`);
  };

  return (
    <div className="materials-container">
      <style jsx>{`
        .materials-container {
          max-width: 1600px;
          margin: 0 auto;
        }

        /* Top Page Header */
        .page-header-card {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 20px 24px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }

        .header-title {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 4px;
        }

        .header-subtitle {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 0;
        }

        /* Search & Filter Toolbar */
        .toolbar-card {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          padding: 16px 20px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
        }

        .toolbar-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
        }

        .search-box-wrapper {
          position: relative;
          min-width: 320px;
          flex: 1;
        }

        .search-icon-inside {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .search-input-field {
          width: 100%;
          padding: 9px 14px 9px 40px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          font-size: 13.5px;
          color: #0f172a;
          transition: all 0.2s;
        }

        .search-input-field:focus {
          outline: none;
          background: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }

        .filter-controls-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .select-filter {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          font-size: 13px;
          color: #334155;
          font-weight: 500;
          cursor: pointer;
        }

        .select-filter:focus {
          outline: none;
          border-color: #2563eb;
        }

        /* Modern Table Card */
        .table-card {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.02);
          overflow: hidden;
          margin-bottom: 24px;
        }

        .table-custom {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin-bottom: 0;
        }

        .table-custom thead th {
          background: #f8fafc;
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #475569;
          padding: 13px 18px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
          vertical-align: middle;
        }

        .table-custom tbody td {
          font-size: 13px;
          padding: 14px 18px;
          vertical-align: middle;
          border-bottom: 1px solid #f1f5f9;
          color: #1e293b;
        }

        .table-custom tbody tr {
          transition: background-color 0.15s ease;
        }

        .table-custom tbody tr:hover {
          background-color: #f8fafc;
        }

        /* Model Number Cell */
        .model-cell-inner {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .model-name-text {
          font-family: monospace;
          font-weight: 700;
          font-size: 14px;
          color: #0f172a;
          cursor: pointer;
          transition: color 0.15s;
        }

        .model-name-text:hover {
          color: #2563eb;
          text-decoration: underline;
        }

        .btn-copy-small {
          background: transparent;
          border: none;
          color: #94a3b8;
          padding: 3px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: all 0.15s;
        }

        .btn-copy-small:hover {
          color: #2563eb;
          background: #eff6ff;
        }

        /* Status Badges */
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 16px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }

        .pill-in-stock {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .pill-low-stock {
          background: #fffbeb;
          color: #d97706;
          border: 1px solid #fde68a;
        }

        .pill-out-of-stock {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        /* Bin Pills */
        .bin-tag-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          color: #2563eb;
          font-weight: 600;
          font-size: 11.5px;
          padding: 2px 8px;
          border-radius: 6px;
          text-decoration: none;
          transition: all 0.15s;
          margin-right: 4px;
          margin-bottom: 2px;
        }

        .bin-tag-pill:hover {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
          transform: translateY(-1px);
        }

        /* Action Buttons */
        .btn-inspect {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          font-weight: 600;
          font-size: 12px;
          padding: 5px 12px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s;
          cursor: pointer;
        }

        .btn-inspect:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #2563eb;
        }

        .btn-quick-pick {
          background: #2563eb;
          border: 1px solid #2563eb;
          color: #ffffff;
          font-weight: 600;
          font-size: 12px;
          padding: 5px 12px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s;
          cursor: pointer;
        }

        .btn-quick-pick:hover {
          background: #1d4ed8;
          border-color: #1d4ed8;
        }
      `}</style>

      {/* Top Header Card */}
      <div className="page-header-card">
        <div>
          <h1 className="header-title">
            <Layers className="text-primary" size={26} />
            Materials Master & Inventory
          </h1>
          <p className="header-subtitle">
            Live Kardex storage counts, bin locations, and serialized part tracking by Part Number
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
            onClick={handleExportExcel}
            title="Download full inventory sheet"
          >
            <Download size={14} />
            <span>Export to Excel</span>
          </button>

          <button
            className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
            onClick={() => {
              fetchStats();
              fetchMaterials();
            }}
            title="Refresh inventory"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Real-time KPI Metric Ribbon */}
      <MaterialKPICards stats={stats} loading={statsLoading} />

      {/* Toolbar: Search, Filters, Sorters */}
      <div className="toolbar-card">
        <div className="toolbar-inner">
          {/* Search Bar */}
          <div className="search-box-wrapper">
            <Search className="search-icon-inside" size={16} />
            <input
              type="text"
              className="search-input-field"
              placeholder="Search by Material / Model # or Serial Barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters & Sorting */}
          <div className="filter-controls-group">
            {/* Stock Status Filter */}
            <select
              className="select-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Stock Statuses</option>
              <option value="IN_STOCK">In Stock (&gt; 5 units)</option>
              <option value="LOW_STOCK">Low Stock (1 - 5 units)</option>
              <option value="OUT_OF_STOCK">Out of Stock (0 units)</option>
              <option value="HOLD">Has Quality Hold</option>
            </select>

            {/* Sort Field */}
            <select
              className="select-filter"
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
              <option value="available_DESC">Stock Available (High → Low)</option>
              <option value="available_ASC">Stock Available (Low → High)</option>
              <option value="model_ASC">Model # (A → Z)</option>
              <option value="model_DESC">Model # (Z → A)</option>
              <option value="last_scanned_DESC">Recently Scanned</option>
            </select>

            {/* Page Size */}
            <select
              className="select-filter"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={15}>15 per page</option>
              <option value={30}>30 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Material Master Table */}
      <div className="table-card">
        {tableLoading ? (
          <div className="py-5 text-center">
            <Loader message="Fetching materials inventory from Kardex database..." />
          </div>
        ) : materials.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-custom">
              <thead>
                <tr>
                  <th>Model / Part Number</th>
                  <th>Stock Status</th>
                  <th>Available Units</th>
                  <th>Quality Hold</th>
                  <th>Dispatched</th>
                  <th>Allocated Bins (HUs)</th>
                  <th>Last Inbound</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.model_number}>
                    {/* Model Number */}
                    <td>
                      <div className="model-cell-inner">
                        <Tag size={14} className="text-muted" />
                        <span
                          className="model-name-text"
                          onClick={() => handleOpenDrawer(m.model_number)}
                          title="Click to view material details & serial ledger"
                        >
                          {m.model_number}
                        </span>
                        <button
                          className="btn-copy-small"
                          onClick={() => copyToClipboard(m.model_number)}
                          title="Copy Part Number"
                        >
                          {copiedModel === m.model_number ? (
                            <Check size={12} className="text-success" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Stock Status Badge */}
                    <td>
                      {m.status === 'IN_STOCK' ? (
                        <span className="status-pill pill-in-stock">
                          <CheckCircle2 size={12} /> In Stock
                        </span>
                      ) : m.status === 'LOW_STOCK' ? (
                        <span className="status-pill pill-low-stock">
                          <AlertTriangle size={12} /> Low Stock
                        </span>
                      ) : (
                        <span className="status-pill pill-out-of-stock">
                          <XCircle size={12} /> Depleted
                        </span>
                      )}
                    </td>

                    {/* Available Units */}
                    <td>
                      <span
                        className="fw-bold fs-6"
                        style={{
                          color: m.available_count > 0 ? '#059669' : '#94a3b8'
                        }}
                      >
                        {m.available_count.toLocaleString()}
                      </span>
                    </td>

                    {/* On Hold */}
                    <td>
                      {m.hold_count > 0 ? (
                        <span className="badge bg-warning text-dark border">
                          {m.hold_count} hold
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>

                    {/* Picked / Dispatched */}
                    <td>
                      <span className="text-muted fw-semibold">
                        {m.picked_count.toLocaleString()}
                      </span>
                    </td>

                    {/* Allocated Bins */}
                    <td>
                      {m.handling_units && m.handling_units.length > 0 ? (
                        <div className="d-flex flex-wrap align-items-center">
                          {m.handling_units.slice(0, 4).map((huId) => (
                            <Link
                              key={huId}
                              href={`/app/bins/${encodeURIComponent(huId)}`}
                              className="bin-tag-pill"
                              title={`View ${huId} compartment layout`}
                            >
                              <Boxes size={11} />
                              {huId}
                            </Link>
                          ))}
                          {m.handling_units.length > 4 && (
                            <span
                              className="badge bg-light text-muted border"
                              style={{ fontSize: '10.5px' }}
                            >
                              +{m.handling_units.length - 4} more
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
                          ? new Date(m.last_scanned_at).toLocaleDateString()
                          : 'N/A'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="text-end">
                      <div className="d-inline-flex align-items-center gap-2">
                        <button
                          className="btn-inspect"
                          onClick={() => handleOpenDrawer(m.model_number)}
                          title="Inspect serial numbers & bin allocations"
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>

                        {canPick && m.available_count > 0 && (
                          <button
                            className="btn-quick-pick"
                            onClick={() => handleTriggerPick(m.model_number)}
                            title="Generate pick order for this material"
                          >
                            <PackageMinus size={13} />
                            <span>Pick</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
      <div className="mb-5">
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

      {/* Slide-over Detail Drawer */}
      <MaterialDetailDrawer
        modelNumber={selectedModel}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onInitiatePick={handleTriggerPick}
      />

      {/* Pick / Scan Modal Integration */}
      <ScanAndStoreModal
        isOpen={isPickModalOpen}
        onClose={() => setIsPickModalOpen(false)}
        onSuccess={() => {
          fetchStats();
          fetchMaterials(1);
        }}
      />
    </div>
  );
}

