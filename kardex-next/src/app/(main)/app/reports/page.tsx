'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api';
import {
  AgingStats,
  SerialAgingItem,
  SerialAgingResponse,
  AgeBucket,
} from '@/types/report';
import { Pagination } from '@/components/shared/Pagination';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  FileBarChart,
  Search,
  RefreshCw,
  Download,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Calendar,
  Box,
  ExternalLink,
  Package,
  Boxes,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  // Stats
  const [stats, setStats] = useState<AgingStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Table Data
  const [data, setData] = useState<SerialAgingItem[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [pickStatus, setPickStatus] = useState<string>('ACTIVE'); // 'ACTIVE', 'AVAILABLE', 'HOLD', 'PICKED', 'ALL'
  const [processStatus, setProcessStatus] = useState<string>('ALL'); // 'ALL', 'KANBAN_ONLY', 'KANBAN-IN', 'KANBAN-RTN', 'STANDARD_PUT'
  const [ageBucket, setAgeBucket] = useState<AgeBucket>('ALL');
  const [kanbanFilter, setKanbanFilter] = useState<'ALL' | 'KANBAN_ONLY' | 'KANBAN_RTN'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // UI helpers
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await apiGet<AgingStats>('/report/aging/stats');
      setStats(res);
    } catch (err) {
      console.error('Failed to fetch aging stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Table Data
  const fetchAgingData = useCallback(
    async (currentPage = page, currentSize = pageSize) => {
      try {
        setTableLoading(true);
        let activeProcess = processStatus;
        if (kanbanFilter === 'KANBAN_ONLY') activeProcess = 'KANBAN_ONLY';
        else if (kanbanFilter === 'KANBAN_RTN') activeProcess = 'KANBAN-RTN';

        const res = await apiPost<SerialAgingResponse>('/report/aging/serial', {
          search: debouncedSearch,
          ageBucket,
          slaStatus: 'ALL',
          processStatus: activeProcess,
          pickStatus,
          modelNumber,
          startDate: startDate || null,
          endDate: endDate || null,
          page: currentPage,
          size: currentSize,
          sortField: 'scanned_at',
          sortDirection: 'ASC', // Oldest first (FIFO)
        });
        setData(res.data || []);
        setTotalPages(res.totalPages || 1);
        setTotalItems(res.totalItems || 0);
        setPage(res.page || 1);
      } catch (err) {
        console.error('Failed to fetch aging report data:', err);
        setData([]);
      } finally {
        setTableLoading(false);
      }
    },
    [debouncedSearch, ageBucket, kanbanFilter, processStatus, pickStatus, modelNumber, startDate, endDate, page, pageSize]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchAgingData(page, pageSize);
  }, [fetchAgingData, page, pageSize]);

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setModelNumber('');
    setPickStatus('ACTIVE');
    setProcessStatus('ALL');
    setAgeBucket('ALL');
    setKanbanFilter('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  // Clipboard copy
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSerial(text);
    setTimeout(() => setCopiedSerial(null), 1800);
  };

  // Excel Export
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      let activeProcess = processStatus;
      if (kanbanFilter === 'KANBAN_ONLY') activeProcess = 'KANBAN_ONLY';
      else if (kanbanFilter === 'KANBAN_RTN') activeProcess = 'KANBAN-RTN';

      const res = await apiPost<{ data: any[]; count: number }>('/report/aging/export', {
        search: debouncedSearch,
        ageBucket,
        slaStatus: 'ALL',
        processStatus: activeProcess,
        pickStatus,
        modelNumber,
        startDate: startDate || null,
        endDate: endDate || null,
      });

      const records = res.data || [];
      if (records.length === 0) {
        alert('No records found to export.');
        return;
      }

      const rows = records.map((r, index) => ({
        '#': index + 1,
        'Serial Number': r.serial_number,
        'Model Number': r.model_number,
        'Location (HU)': r.hu_id,
        'Compartment #': r.compartment_number,
        'Process': r.process_status,
        'Status': r.pick_status,
        'Storage Age (Days)': r.kardex_age_days,
        'Storage Age (Detail)': `${r.kardex_age_days}d ${r.kardex_age_hours}h`,
        'Kanban Age (Hours)': r.kanban_dwell_hours !== 'N/A' ? `${r.kanban_dwell_hours} hrs` : '—',
        'Birth Date': r.birth_date && r.birth_date !== 'N/A' ? new Date(r.birth_date).toLocaleDateString() : 'N/A',
        'Board Age (Days)': r.birth_age_days,
        'Put Scanned At': r.scanned_at ? new Date(r.scanned_at).toLocaleString() : 'N/A',
        'Scanned By': r.scanned_by,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Auto-fit column widths
      worksheet['!cols'] = Object.keys(rows[0] || {}).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...rows.slice(0, 50).map((row) => String((row as any)[key] || '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 2, 11), 32) };
      });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Aging Report');
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Kardex_Aging_Report_${today}.xlsx`);
    } catch (err) {
      console.error('Excel Export Failed:', err);
      alert('Failed to export Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="reports-container">
      <style jsx>{`
        .reports-container {
          padding-bottom: 2rem;
          color: #0f172a;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        /* Header */
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .header-title-box {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .header-icon-pill {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #eff6ff;
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .page-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.2;
        }

        .page-subtitle {
          font-size: 0.8rem;
          color: #64748b;
          margin: 2px 0 0 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        /* KPI Cards */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .kpi-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0.85rem 1rem;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .kpi-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.3rem;
        }

        .kpi-label {
          font-size: 0.725rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #64748b;
        }

        .kpi-value {
          font-size: 1.4rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.1;
        }

        .kpi-subtext {
          font-size: 0.725rem;
          color: #64748b;
          margin-top: 0.25rem;
        }

        /* Filter Section */
        .filters-container {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0.85rem 1rem;
          margin-bottom: 1rem;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        /* Quick Pills */
        .quick-pills-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .pills-group-title {
          font-size: 0.725rem;
          font-weight: 700;
          color: #475569;
          margin-right: 0.25rem;
        }

        .pill-btn {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 3px 10px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
        }

        .pill-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .pill-btn.active {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
        }

        .pill-count {
          background: rgba(0, 0, 0, 0.07);
          padding: 0 5px;
          border-radius: 8px;
          font-size: 0.675rem;
        }

        .pill-btn.active .pill-count {
          background: rgba(255, 255, 255, 0.25);
          color: #ffffff;
        }

        /* Input Controls Row */
        .filter-controls-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .search-box {
          position: relative;
          flex: 1 1 200px;
          min-width: 180px;
        }

        .search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
        }

        .search-input {
          width: 100%;
          padding: 6px 10px 6px 32px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.8rem;
          outline: none;
        }

        .search-input:focus {
          border-color: #2563eb;
        }

        .filter-select,
        .filter-input {
          padding: 6px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.8rem;
          background: #ffffff;
          color: #334155;
          outline: none;
        }

        .filter-select:focus,
        .filter-input:focus {
          border-color: #2563eb;
        }

        .date-input-group {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 0.775rem;
          color: #64748b;
        }

        .date-input {
          border: none;
          outline: none;
          font-size: 0.775rem;
          color: #334155;
          background: transparent;
        }

        /* Action Buttons */
        .btn-brand-solid {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .btn-brand-solid:hover:not(:disabled) {
          background: #1d4ed8;
        }

        .btn-brand-solid:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .btn-outline-action {
          background: #ffffff;
          color: #475569;
          border: 1px solid #cbd5e1;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          cursor: pointer;
        }

        .btn-outline-action:hover {
          background: #f8fafc;
          color: #0f172a;
        }

        /* Clean Table - Fits Screen Without Side Scroll */
        .table-wrapper {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          margin-bottom: 1rem;
          width: 100%;
        }

        .clean-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
          text-align: left;
          table-layout: auto;
        }

        .clean-table th {
          background: #f8fafc;
          color: #475569;
          font-weight: 700;
          font-size: 0.725rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 10px 10px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .clean-table td {
          padding: 9px 10px;
          border-bottom: 1px solid #f1f5f9;
          color: #1e293b;
          vertical-align: middle;
        }

        .clean-table tbody tr:hover {
          background: #f8fafc;
        }

        /* Serial Pill */
        .serial-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 2px 7px;
          border-radius: 5px;
          font-family: monospace;
          font-size: 0.8rem;
          font-weight: 600;
          color: #0f172a;
          cursor: pointer;
        }

        .serial-pill:hover {
          background: #e2e8f0;
        }

        /* Badges */
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 0.725rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .badge-available { background: #dcfce7; color: #15803d; }
        .badge-hold { background: #fee2e2; color: #b91c1c; }
        .badge-picked { background: #f1f5f9; color: #64748b; }

        .badge-kanban { background: #eff6ff; color: #1d4ed8; }
        .badge-rtn { background: #fdf4ff; color: #a21caf; }
        .badge-put { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }

        .age-fresh { background: #ecfdf5; color: #047857; }
        .age-normal { background: #eff6ff; color: #1d4ed8; }
        .age-aging { background: #fffbeb; color: #b45309; }
        .age-high { background: #fff7ed; color: #c2410c; }
        .age-critical { background: #fef2f2; color: #b91c1c; font-weight: 700; }

        .kanban-overdue {
          background: #fef2f2;
          color: #dc2626;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .location-link {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          color: #2563eb;
          text-decoration: none;
          font-weight: 600;
        }

        .location-link:hover {
          text-decoration: underline;
        }

        .audit-link {
          color: #64748b;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          font-size: 0.75rem;
        }

        .audit-link:hover {
          color: #2563eb;
          text-decoration: underline;
        }
      `}</style>

      {/* Page Header */}
      <div className="page-header">
        <div className="header-title-box">
          <div className="header-icon-pill">
            <FileBarChart size={22} />
          </div>
          <div>
            <h1 className="page-title">Inventory Aging Report</h1>
            <p className="page-subtitle">
              Monitor both Serial Number Storage Aging and Kanban In Aging side-by-side
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn-outline-action"
            onClick={() => {
              fetchStats();
              fetchAgingData(page, pageSize);
            }}
            title="Refresh Table"
          >
            <RefreshCw size={13} className={tableLoading ? 'spin' : ''} /> Refresh
          </button>

          <button
            className="btn-brand-solid"
            onClick={handleExportExcel}
            disabled={exporting || tableLoading}
            title="Download Excel"
          >
            <Download size={13} />
            {exporting ? 'Exporting...' : 'Export Excel (.xlsx)'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Total In Stock</span>
            <Package size={16} color="#2563eb" />
          </div>
          <p className="kpi-value">{stats?.inventory.totalActive ?? 0}</p>
          <p className="kpi-subtext">
            {stats?.inventory.totalAvailable ?? 0} Available | {stats?.inventory.totalHold ?? 0} Hold
          </p>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Oldest in Kardex</span>
            <Clock size={16} color="#ea580c" />
          </div>
          <p className="kpi-value" style={{ fontSize: '1.25rem' }}>
            {stats?.inventory.oldestUnit ? `${stats.inventory.oldestUnit.age_days} Days Old` : 'N/A'}
          </p>
          <p className="kpi-subtext" style={{ fontFamily: 'monospace' }}>
            {stats?.inventory.oldestUnit?.serial_number || 'None'}
          </p>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-label">Kanban Parts</span>
            <Boxes size={16} color="#2563eb" />
          </div>
          <p className="kpi-value">{stats?.kanban.totalActive ?? 0}</p>
          <p className="kpi-subtext">{stats?.kanban.returnsCount ?? 0} Returns (KANBAN-RTN)</p>
        </div>
      </div>

      {/* Filter Section */}
      <div className="filters-container">
        {/* Quick Filter: Storage Aging */}
        <div className="quick-pills-row">
          <span className="pills-group-title">Storage Age:</span>
          <button
            className={`pill-btn ${ageBucket === 'ALL' ? 'active' : ''}`}
            onClick={() => setAgeBucket('ALL')}
          >
            All
          </button>
          <button
            className={`pill-btn ${ageBucket === '0-7' ? 'active' : ''}`}
            onClick={() => setAgeBucket(ageBucket === '0-7' ? 'ALL' : '0-7')}
          >
            0-7 Days <span className="pill-count">{stats?.inventory.buckets['0-7'] ?? 0}</span>
          </button>
          <button
            className={`pill-btn ${ageBucket === '8-15' ? 'active' : ''}`}
            onClick={() => setAgeBucket(ageBucket === '8-15' ? 'ALL' : '8-15')}
          >
            8-15 Days <span className="pill-count">{stats?.inventory.buckets['8-15'] ?? 0}</span>
          </button>
          <button
            className={`pill-btn ${ageBucket === '16-30' ? 'active' : ''}`}
            onClick={() => setAgeBucket(ageBucket === '16-30' ? 'ALL' : '16-30')}
          >
            16-30 Days <span className="pill-count">{stats?.inventory.buckets['16-30'] ?? 0}</span>
          </button>
          <button
            className={`pill-btn ${ageBucket === '31-60' ? 'active' : ''}`}
            onClick={() => setAgeBucket(ageBucket === '31-60' ? 'ALL' : '31-60')}
          >
            31-60 Days <span className="pill-count">{stats?.inventory.buckets['31-60'] ?? 0}</span>
          </button>
          <button
            className={`pill-btn ${ageBucket === '60+' ? 'active' : ''}`}
            onClick={() => setAgeBucket(ageBucket === '60+' ? 'ALL' : '60+')}
          >
            60+ Days <span className="pill-count">{stats?.inventory.buckets['60+'] ?? 0}</span>
          </button>

          <span className="pills-group-title" style={{ marginLeft: '0.75rem' }}>Kanban:</span>
          <button
            className={`pill-btn ${kanbanFilter === 'KANBAN_ONLY' ? 'active' : ''}`}
            onClick={() => setKanbanFilter(kanbanFilter === 'KANBAN_ONLY' ? 'ALL' : 'KANBAN_ONLY')}
          >
            Kanban Only ({stats?.kanban.totalActive ?? 0})
          </button>
          <button
            className={`pill-btn ${kanbanFilter === 'KANBAN_RTN' ? 'active' : ''}`}
            onClick={() => setKanbanFilter(kanbanFilter === 'KANBAN_RTN' ? 'ALL' : 'KANBAN_RTN')}
          >
            Returns Only ({stats?.kanban.returnsCount ?? 0})
          </button>
        </div>

        {/* Input Controls */}
        <div className="filter-controls-row">
          <div className="search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search serial or model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <input
            type="text"
            className="filter-input"
            placeholder="Model #"
            style={{ width: '110px' }}
            value={modelNumber}
            onChange={(e) => {
              setModelNumber(e.target.value);
              setPage(1);
            }}
          />

          <select
            className="filter-select"
            value={pickStatus}
            onChange={(e) => {
              setPickStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="ACTIVE">In Stock (Available + Hold)</option>
            <option value="AVAILABLE">Available Only</option>
            <option value="HOLD">Hold Only</option>
            <option value="PICKED">Picked Only</option>
            <option value="ALL">All Statuses</option>
          </select>

          <select
            className="filter-select"
            value={processStatus}
            onChange={(e) => {
              setProcessStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">All Processes</option>
            <option value="KANBAN-IN">KANBAN-IN</option>
            <option value="KANBAN-RTN">KANBAN-RTN (Returns)</option>
            <option value="STANDARD_PUT">Standard PUT</option>
          </select>

          <div className="date-input-group">
            <Calendar size={13} />
            <input
              type="date"
              className="date-input"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              title="From Date"
            />
            <span>-</span>
            <input
              type="date"
              className="date-input"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              title="To Date"
            />
          </div>

          <button
            className="btn-outline-action"
            onClick={handleResetFilters}
            title="Reset Filters"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      {/* Main Table - Compact & No Side Scroll */}
      <div className="table-wrapper">
        {tableLoading ? (
          <div style={{ padding: '2.5rem 0' }}>
            <Loader message="Loading aging records..." />
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            title="No records found"
            description="No items match your active filters. Try clicking 'All' or clearing search."
          />
        ) : (
          <table className="clean-table">
            <thead>
              <tr>
                <th style={{ width: '35px' }}>#</th>
                <th>Serial Number</th>
                <th>Model</th>
                <th>Location</th>
                <th>Process</th>
                <th>Storage Age</th>
                <th>Kanban Age</th>
                <th>Birth Date</th>
                <th>Status</th>
                <th style={{ width: '50px' }}>Log</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => {
                const rowIdx = (page - 1) * pageSize + index + 1;
                const isCopied = copiedSerial === row.serial_number;

                // Storage Age Pill Style
                let ageClass = 'age-fresh';
                if (row.age_bucket === '8-15') ageClass = 'age-normal';
                else if (row.age_bucket === '16-30') ageClass = 'age-aging';
                else if (row.age_bucket === '31-60') ageClass = 'age-high';
                else if (row.age_bucket === '60+') ageClass = 'age-critical';

                return (
                  <tr key={row.id}>
                    <td style={{ color: '#94a3b8' }}>{rowIdx}</td>
                    <td>
                      <button
                        className="serial-pill"
                        onClick={() => copyToClipboard(row.serial_number)}
                        title="Click to copy"
                      >
                        <span>{row.serial_number}</span>
                        {isCopied ? <Check size={11} color="#16a34a" /> : <Copy size={11} />}
                      </button>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{row.model_number}</span>
                    </td>
                    <td>
                      {row.hu_id ? (
                        <Link href={`/app/bins/${row.hu_id}`} className="location-link">
                          <Box size={12} /> {row.hu_id}
                          {row.compartment_number !== null && (
                            <span style={{ color: '#64748b' }}>#{row.compartment_number}</span>
                          )}
                        </Link>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          row.process_status?.includes('RTN')
                            ? 'badge-rtn'
                            : row.process_status?.includes('KANBAN')
                            ? 'badge-kanban'
                            : 'badge-put'
                        }`}
                      >
                        {row.process_status || 'PUT'}
                      </span>
                    </td>
                    {/* Storage Age */}
                    <td>
                      <span className={`badge ${ageClass}`}>
                        {row.kardex_age_days}d {row.kardex_age_hours}h
                      </span>
                    </td>
                    {/* Kanban Age */}
                    <td>
                      {row.is_kanban ? (
                        <span style={{ fontWeight: 600, color: '#0f172a' }}>
                          {row.kanban_dwell_hours} hrs
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    {/* Birth Date */}
                    <td>
                      {row.birth_date ? (
                        <span>
                          {new Date(row.birth_date).toLocaleDateString()}
                          {row.birth_age_days !== null && (
                            <span style={{ color: '#64748b', fontSize: '0.725rem', marginLeft: '4px' }}>
                              ({row.birth_age_days}d)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>N/A</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          row.pick_status === 'AVAILABLE'
                            ? 'badge-available'
                            : row.pick_status === 'HOLD'
                            ? 'badge-hold'
                            : 'badge-picked'
                        }`}
                      >
                        {row.pick_status}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/app/logs/${encodeURIComponent(row.serial_number)}`}
                        className="audit-link"
                        title="View Audit Log"
                      >
                        Log <ExternalLink size={11} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={(newPage) => setPage(newPage)}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        pageSizeOptions={[15, 30, 50, 100]}
      />
    </div>
  );
}
