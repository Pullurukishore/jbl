'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api';
import { copyToClipboard as copyUtil } from '@/lib/clipboard';
import {
  AgingStats,
  SerialAgingItem,
  SerialAgingResponse,
  AgeBucket,
  KanbanSlaStatus,
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
  AlertTriangle,
  Layers,
  ShieldAlert,
  X,
  ArrowUpDown,
  Filter,
  ShieldCheck,
  Zap,
  Barcode,
  Tag,
} from 'lucide-react';
import * as XLSX from 'xlsx';

type ReportTab = 'ALL_INVENTORY' | 'KANBAN_SLA' | 'CRITICAL_WATCHLIST';

export default function ReportsPage() {
  // Active Report Tab
  const [activeTab, setActiveTab] = useState<ReportTab>('ALL_INVENTORY');

  // Stats
  const [stats, setStats] = useState<AgingStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

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
  const [slaStatus, setSlaStatus] = useState<KanbanSlaStatus>('ALL');
  const [kanbanFilter, setKanbanFilter] = useState<'ALL' | 'KANBAN_ONLY' | 'KANBAN_RTN'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | '7D' | '30D'>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<string>('scanned_at');
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');

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

  // Handle Tab Switch
  const handleTabChange = (tab: ReportTab) => {
    setActiveTab(tab);
    setPage(1);
    if (tab === 'ALL_INVENTORY') {
      setProcessStatus('ALL');
      setKanbanFilter('ALL');
      setSlaStatus('ALL');
      setAgeBucket('ALL');
    } else if (tab === 'KANBAN_SLA') {
      setProcessStatus('KANBAN_ONLY');
      setKanbanFilter('KANBAN_ONLY');
      setAgeBucket('ALL');
      setSlaStatus('ALL');
    } else if (tab === 'CRITICAL_WATCHLIST') {
      setProcessStatus('ALL');
      setKanbanFilter('ALL');
      setAgeBucket('30+');
      setSlaStatus('ALL');
    }
  };

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await apiGet<AgingStats>('/report/aging/stats');
      setStats(res);
      const now = new Date();
      setLastRefreshed(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
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
        if (activeTab === 'KANBAN_SLA') {
          activeProcess = kanbanFilter === 'KANBAN_RTN' ? 'KANBAN-RTN' : 'KANBAN_ONLY';
        } else if (kanbanFilter === 'KANBAN_ONLY') {
          activeProcess = 'KANBAN_ONLY';
        } else if (kanbanFilter === 'KANBAN_RTN') {
          activeProcess = 'KANBAN-RTN';
        }

        const res = await apiPost<SerialAgingResponse>('/report/aging/serial', {
          search: debouncedSearch,
          ageBucket,
          slaStatus,
          processStatus: activeProcess,
          pickStatus,
          modelNumber,
          startDate: startDate || null,
          endDate: endDate || null,
          page: currentPage,
          size: currentSize,
          sortField,
          sortDirection,
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
    [
      activeTab,
      debouncedSearch,
      ageBucket,
      slaStatus,
      kanbanFilter,
      processStatus,
      pickStatus,
      modelNumber,
      startDate,
      endDate,
      sortField,
      sortDirection,
      page,
      pageSize,
    ]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchAgingData(page, pageSize);
  }, [fetchAgingData, page, pageSize]);

  // Handle Date Presets
  const applyDatePreset = (preset: 'ALL' | 'TODAY' | '7D' | '30D') => {
    setDatePreset(preset);
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'TODAY') {
      const todayStr = formatDate(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7D') {
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(formatDate(d7));
      setEndDate(formatDate(now));
    } else if (preset === '30D') {
      const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(formatDate(d30));
      setEndDate(formatDate(now));
    }
    setPage(1);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setModelNumber('');
    setPickStatus('ACTIVE');
    setProcessStatus(activeTab === 'KANBAN_SLA' ? 'KANBAN_ONLY' : 'ALL');
    setAgeBucket(activeTab === 'CRITICAL_WATCHLIST' ? '30+' : 'ALL');
    setSlaStatus('ALL');
    setKanbanFilter(activeTab === 'KANBAN_SLA' ? 'KANBAN_ONLY' : 'ALL');
    setStartDate('');
    setEndDate('');
    setDatePreset('ALL');
    setSortField('scanned_at');
    setSortDirection('ASC');
    setPage(1);
  };

  // Calculate Active Filters Count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch) count++;
    if (modelNumber) count++;
    if (pickStatus !== 'ACTIVE') count++;
    if (activeTab === 'ALL_INVENTORY' && processStatus !== 'ALL') count++;
    if (ageBucket !== 'ALL' && activeTab !== 'CRITICAL_WATCHLIST') count++;
    if (slaStatus !== 'ALL') count++;
    if (startDate || endDate) count++;
    if (sortField !== 'scanned_at' || sortDirection !== 'ASC') count++;
    return count;
  }, [
    debouncedSearch,
    modelNumber,
    pickStatus,
    processStatus,
    ageBucket,
    slaStatus,
    startDate,
    endDate,
    sortField,
    sortDirection,
    activeTab,
  ]);

  // Critical Aging Units Count (>30d)
  const criticalAgingCount = useMemo(() => {
    if (!stats) return 0;
    return (stats.inventory.buckets['31-60'] || 0) + (stats.inventory.buckets['60+'] || 0);
  }, [stats]);

  // Clipboard copy
  const copyToClipboard = (text: string) => {
    copyUtil(text);
    setCopiedSerial(text);
    setTimeout(() => setCopiedSerial(null), 1800);
  };

  // Excel Export
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      let activeProcess = processStatus;
      if (activeTab === 'KANBAN_SLA') {
        activeProcess = kanbanFilter === 'KANBAN_RTN' ? 'KANBAN-RTN' : 'KANBAN_ONLY';
      } else if (kanbanFilter === 'KANBAN_ONLY') {
        activeProcess = 'KANBAN_ONLY';
      } else if (kanbanFilter === 'KANBAN_RTN') {
        activeProcess = 'KANBAN-RTN';
      }

      const res = await apiPost<{ data: any[]; count: number }>('/report/aging/export', {
        search: debouncedSearch,
        ageBucket,
        slaStatus,
        processStatus: activeProcess,
        pickStatus,
        modelNumber,
        startDate: startDate || null,
        endDate: endDate || null,
      });

      const records = res.data || [];
      if (records.length === 0) {
        alert('No records found to export for active filter criteria.');
        return;
      }

      const rows = records.map((r, index) => ({
        '#': index + 1,
        'Serial Number': r.serial_number,
        'Model Number': r.model_number,
        'Handling Unit (HU)': r.hu_id,
        'Compartment #': r.compartment_number,
        'Storage State': r.storage_status,
        'Process Flow': r.process_status,
        'Stock Status': r.pick_status,
        'Storage Age (Days)': r.kardex_age_days,
        'Storage Detail': `${r.kardex_age_days}d ${r.kardex_age_hours}h`,
        'Age Category': r.age_bucket,
        'Is Kanban': r.is_kanban,
        'Kanban Dwell (Hours)': r.kanban_dwell_hours,
        'Kanban SLA': r.kanban_sla_status,
        'SMT Birth Date':
          r.birth_date && r.birth_date !== 'N/A'
            ? new Date(r.birth_date).toLocaleDateString()
            : 'N/A',
        'Board Age (Days)': r.birth_age_days,
        'Scanned Into Kardex': r.scanned_at ? new Date(r.scanned_at).toLocaleString() : 'N/A',
        'Scanned By User': r.scanned_by,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Auto-fit column widths
      worksheet['!cols'] = Object.keys(rows[0] || {}).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...rows.slice(0, 100).map((row) => String((row as any)[key] || '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 2, 11), 35) };
      });

      const workbook = XLSX.utils.book_new();
      const sheetName =
        activeTab === 'KANBAN_SLA'
          ? 'Kanban SLA Dwell'
          : activeTab === 'CRITICAL_WATCHLIST'
          ? 'Critical Aging'
          : 'Inventory Aging';

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      const today = new Date().toISOString().split('T')[0];
      XLSX.writeFile(
        workbook,
        `Kardex_${activeTab.toLowerCase()}_report_${today}.xlsx`
      );
    } catch (err) {
      console.error('Excel Export Failed:', err);
      alert('Failed to export Excel report. Please try again.');
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

        /* Top Header */
        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .header-title-box {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .header-icon-pill {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.12);
        }

        .page-title {
          font-size: 1.35rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.02em;
          line-height: 1.2;
        }

        .page-subtitle {
          font-size: 0.825rem;
          color: #64748b;
          margin: 3px 0 0 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .last-refreshed-text {
          font-size: 0.75rem;
          color: #94a3b8;
          margin-right: 0.25rem;
        }

        /* Tab Navigation Bar */
        .tabs-nav-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 10px;
          margin-bottom: 1.25rem;
          border: 1px solid #e2e8f0;
          overflow-x: auto;
        }

        .tab-btn {
          flex: 1;
          min-width: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.825rem;
          font-weight: 700;
          color: #64748b;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
        }

        .tab-btn:hover:not(.active) {
          color: #1e293b;
          background: rgba(255, 255, 255, 0.6);
        }

        .tab-btn.active {
          background: #ffffff;
          color: #2563eb;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
        }

        .tab-badge {
          background: #eff6ff;
          color: #2563eb;
          padding: 1px 7px;
          border-radius: 12px;
          font-size: 0.725rem;
          font-weight: 700;
        }

        .tab-badge-alert {
          background: #fef2f2;
          color: #dc2626;
        }

        /* KPI Cards Grid */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 0.85rem;
          margin-bottom: 1.25rem;
        }

        .kpi-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem 1.15rem;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03), 0 2px 6px rgba(15, 23, 42, 0.02);
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.06);
          border-color: #cbd5e1;
        }

        .kpi-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .kpi-icon-blue { background: #eff6ff; color: #2563eb; }
        .kpi-icon-amber { background: #fffbeb; color: #d97706; }
        .kpi-icon-purple { background: #faf5ff; color: #7c3aed; }
        .kpi-icon-rose { background: #fef2f2; color: #dc2626; }
        .kpi-icon-emerald { background: #ecfdf5; color: #059669; }

        .kpi-content {
          min-width: 0;
          flex: 1;
        }

        .kpi-label {
          font-size: 0.725rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
          margin-bottom: 2px;
        }

        .kpi-value {
          font-size: 1.4rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          line-height: 1.15;
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .kpi-subtext {
          font-size: 0.725rem;
          color: #64748b;
          margin-top: 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Filter Controls Box */
        .filters-container {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 0.85rem 1rem;
          margin-bottom: 1.15rem;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .filters-primary-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1.2fr 1.2fr 1.2fr 1.5fr;
          gap: 0.6rem;
          align-items: center;
        }

        @media (max-width: 1200px) {
          .filters-primary-row {
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          }
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 0 10px;
          height: 36px;
          box-sizing: border-box;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .search-box:focus-within {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }

        .search-input {
          border: none;
          outline: none;
          font-size: 0.8rem;
          width: 100%;
          background: transparent;
          color: #1e293b;
          padding: 0;
        }

        .search-clear-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .search-clear-btn:hover {
          color: #475569;
        }

        .filter-input {
          height: 36px;
          padding: 0 10px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.8rem;
          background: #ffffff;
          color: #334155;
          outline: none;
          box-sizing: border-box;
          width: 100%;
          transition: border-color 0.15s ease;
        }

        .filter-input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }

        .filter-select {
          height: 36px;
          padding: 0 10px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.8rem;
          background: #ffffff;
          color: #334155;
          outline: none;
          box-sizing: border-box;
          width: 100%;
          cursor: pointer;
          transition: border-color 0.15s ease;
        }

        .filter-select:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }

        /* Secondary Row: Dates & Actions */
        .filters-secondary-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.6rem;
          padding-top: 0.65rem;
          border-top: 1px solid #f1f5f9;
        }

        .date-section {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .filter-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .date-presets-group {
          display: flex;
          align-items: center;
          gap: 2px;
          background: #f1f5f9;
          padding: 2px;
          border-radius: 7px;
          border: 1px solid #e2e8f0;
          height: 32px;
          box-sizing: border-box;
        }

        .date-preset-btn {
          border: none;
          background: transparent;
          padding: 0 9px;
          height: 26px;
          font-size: 0.725rem;
          font-weight: 600;
          color: #64748b;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .date-preset-btn:hover:not(.active) {
          color: #1e293b;
        }

        .date-preset-btn.active {
          background: #ffffff;
          color: #2563eb;
          font-weight: 700;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
        }

        .date-inputs-wrapper {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 7px;
          padding: 0 8px;
          height: 32px;
          box-sizing: border-box;
        }

        .date-field {
          border: none;
          outline: none;
          font-size: 0.75rem;
          color: #334155;
          background: transparent;
          padding: 0;
          cursor: pointer;
        }

        .date-separator {
          color: #94a3b8;
          font-size: 0.725rem;
          font-weight: 600;
        }

        .date-clear-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
        }

        .date-clear-btn:hover {
          color: #dc2626;
        }

        .secondary-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-left: auto;
        }

        .records-count-chip {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 600;
        }

        .btn-reset-filters {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
          padding: 0 10px;
          height: 32px;
          border-radius: 7px;
          font-size: 0.75rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .btn-reset-filters:hover {
          background: #fee2e2;
          border-color: #fca5a5;
        }

        .btn-brand-solid {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 7px 15px;
          border-radius: 8px;
          font-size: 0.8rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          cursor: pointer;
          transition: all 0.18s ease;
          box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);
        }

        .btn-brand-solid:hover:not(:disabled) {
          background: #1d4ed8;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
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
          border-radius: 7px;
          font-size: 0.8rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-outline-action:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .btn-reset-filters {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
          padding: 6px 11px;
          border-radius: 7px;
          font-size: 0.775rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-reset-filters:hover {
          background: #fee2e2;
        }

        /* High-Density Modern Data Table */
        .table-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.03);
          margin-bottom: 1.25rem;
          width: 100%;
        }

        .table-responsive {
          width: 100%;
          overflow-x: auto;
        }

        .aging-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8125rem;
          text-align: left;
        }

        .aging-table thead tr {
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          border-bottom: 2px solid #cbd5e1;
        }

        .aging-table th {
          color: #334155;
          font-weight: 700;
          font-size: 0.725rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 12px 14px;
          white-space: nowrap;
          border-bottom: 2px solid #e2e8f0;
        }

        .aging-table th.sortable-th {
          cursor: pointer;
          user-select: none;
          transition: color 0.15s ease;
        }

        .aging-table th.sortable-th:hover {
          color: #2563eb;
        }

        .aging-table tbody tr {
          transition: background-color 0.15s ease, border-left-color 0.15s ease;
          border-left: 3px solid transparent;
        }

        .aging-table tbody tr:nth-child(even) {
          background-color: #fbfcfe;
        }

        .aging-table tbody tr:hover {
          background-color: #f0f7ff !important;
          border-left-color: #2563eb;
        }

        .aging-table td {
          padding: 11px 14px;
          border-bottom: 1px solid #f1f5f9;
          color: #1e293b;
          vertical-align: middle;
        }

        /* Serial Pill */
        .serial-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          padding: 4px 9px;
          border-radius: 7px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 0.825rem;
          font-weight: 700;
          color: #0f172a;
          cursor: pointer;
          transition: all 0.18s ease;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .serial-pill:hover {
          background: #f8fafc;
          border-color: #2563eb;
          color: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 2px 5px rgba(37, 99, 235, 0.12);
        }

        /* Model Badge */
        .model-chip {
          display: inline-flex;
          align-items: center;
          background: #eff6ff;
          color: #1e40af;
          border: 1px solid #bfdbfe;
          font-weight: 700;
          border-radius: 6px;
          padding: 3px 9px;
          font-size: 0.775rem;
          letter-spacing: 0.02em;
        }

        /* Location Tag */
        .location-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #2563eb;
          text-decoration: none;
          font-weight: 700;
          transition: all 0.15s ease;
        }

        .location-link:hover {
          color: #1d4ed8;
          text-decoration: none;
        }

        .slot-badge {
          background: #0f172a;
          color: #ffffff;
          padding: 2px 6px;
          border-radius: 5px;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.03em;
        }

        /* Badges */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3.5px 9px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .badge-available {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .badge-hold {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .badge-picked {
          background: #f1f5f9;
          color: #64748b;
          border: 1px solid #cbd5e1;
        }

        .badge-kanban {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .badge-rtn {
          background: linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%);
          color: #9333ea;
          border: 1px solid #f0abfc;
        }

        .badge-put {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          color: #475569;
          border: 1px solid #cbd5e1;
        }

        .age-fresh {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .age-normal {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .age-aging {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .age-high {
          background: #fff7ed;
          color: #c2410c;
          border: 1px solid #fed7aa;
        }

        .age-critical {
          background: #fef2f2;
          color: #dc2626;
          font-weight: 800;
          border: 1.5px solid #fca5a5;
          box-shadow: 0 0 6px rgba(220, 38, 38, 0.15);
        }

        .sla-normal {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .sla-attention {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .sla-warning {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .sla-overdue {
          background: #fef2f2;
          color: #dc2626;
          font-weight: 800;
          border: 1.5px solid #f87171;
          animation: pulse 2s infinite;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-dot-green { background: #10b981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }
        .status-dot-amber { background: #f59e0b; box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2); }
        .status-dot-slate { background: #94a3b8; }

        .audit-btn {
          color: #2563eb;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 7px;
          background: #ffffff;
          border: 1.5px solid #dbeafe;
          transition: all 0.18s ease;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.05);
        }

        .audit-btn:hover {
          color: #ffffff;
          background: #2563eb;
          border-color: #2563eb;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(37, 99, 235, 0.25);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }

        .location-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #2563eb;
          text-decoration: none;
          font-weight: 600;
        }

        .location-link:hover {
          text-decoration: underline;
        }

        .audit-link-btn {
          color: #475569;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 3px 7px;
          border-radius: 5px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          transition: all 0.15s ease;
        }

        .audit-link-btn:hover {
          color: #2563eb;
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Top Header */}
      <div className="page-header">
        <div className="header-title-box">
          <div className="header-icon-pill">
            <FileBarChart size={24} />
          </div>
          <div>
            <h1 className="page-title">Inventory Aging & Dwell Analytics</h1>
            <p className="page-subtitle">
              Real-time FIFO storage duration, Kanban dwell SLA tracking, and component birth aging
            </p>
          </div>
        </div>

        <div className="header-actions">
          {lastRefreshed && (
            <span className="last-refreshed-text">Updated {lastRefreshed}</span>
          )}

          <button
            className="btn-outline-action"
            onClick={() => {
              fetchStats();
              fetchAgingData(page, pageSize);
            }}
            title="Refresh statistics and records"
          >
            <RefreshCw size={13} className={tableLoading ? 'spin' : ''} /> Refresh
          </button>

          <button
            className="btn-brand-solid"
            onClick={handleExportExcel}
            disabled={exporting || tableLoading}
            title="Download detailed Excel (.xlsx) report"
          >
            <Download size={13} />
            {exporting ? 'Generating Excel...' : 'Export Excel (.xlsx)'}
          </button>
        </div>
      </div>

      {/* Report Perspectives / Mode Tabs */}
      <div className="tabs-nav-bar">
        <button
          className={`tab-btn ${activeTab === 'ALL_INVENTORY' ? 'active' : ''}`}
          onClick={() => handleTabChange('ALL_INVENTORY')}
        >
          <Layers size={15} /> All Inventory Aging
          <span className="tab-badge">{stats?.inventory.totalActive ?? 0}</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'KANBAN_SLA' ? 'active' : ''}`}
          onClick={() => handleTabChange('KANBAN_SLA')}
        >
          <Zap size={15} /> Kanban Dwell & SLA Tracking
          <span className="tab-badge">{stats?.kanban.totalActive ?? 0}</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'CRITICAL_WATCHLIST' ? 'active' : ''}`}
          onClick={() => handleTabChange('CRITICAL_WATCHLIST')}
        >
          <AlertTriangle size={15} /> Critical Aging Watchlist (&gt;30d)
          <span className={`tab-badge ${criticalAgingCount > 0 ? 'tab-badge-alert' : ''}`}>
            {criticalAgingCount}
          </span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="kpi-grid">
        {/* Total In Kardex */}
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-blue">
            <Package size={22} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Active Kardex Stock</div>
            <div className="kpi-value">{stats?.inventory.totalActive ?? 0}</div>
            <div className="kpi-subtext">
              {stats?.inventory.totalAvailable ?? 0} Available | {stats?.inventory.totalHold ?? 0} Hold
            </div>
          </div>
        </div>

        {/* Oldest Unit (FIFO priority) */}
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-amber">
            <Clock size={22} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Oldest in Kardex (FIFO)</div>
            <div className="kpi-value">
              {stats?.inventory.oldestUnit ? `${stats.inventory.oldestUnit.age_days} Days Old` : 'N/A'}
            </div>
            <div className="kpi-subtext" style={{ fontFamily: 'monospace' }}>
              {stats?.inventory.oldestUnit?.serial_number
                ? `${stats.inventory.oldestUnit.serial_number} (${stats.inventory.oldestUnit.model_number})`
                : 'None in stock'}
            </div>
          </div>
        </div>

        {/* Kanban Active Parts */}
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-icon-purple">
            <Boxes size={22} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Active Kanban Parts</div>
            <div className="kpi-value">{stats?.kanban.totalActive ?? 0}</div>
            <div className="kpi-subtext">
              {stats?.kanban.returnsCount ?? 0} Returns (KANBAN-RTN)
            </div>
          </div>
        </div>

        {/* Kanban SLA Status */}
        <div className="kpi-card">
          <div
            className={`kpi-icon-box ${
              (stats?.kanban.sla.overdue ?? 0) > 0 ? 'kpi-icon-rose' : 'kpi-icon-emerald'
            }`}
          >
            {(stats?.kanban.sla.overdue ?? 0) > 0 ? (
              <ShieldAlert size={22} />
            ) : (
              <ShieldCheck size={22} />
            )}
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Kanban SLA Health</div>
            <div
              className="kpi-value"
              style={{
                color: (stats?.kanban.sla.overdue ?? 0) > 0 ? '#dc2626' : '#059669',
              }}
            >
              {(stats?.kanban.sla.overdue ?? 0) > 0
                ? `${stats?.kanban.sla.overdue} Overdue`
                : '100% In SLA'}
            </div>
            <div className="kpi-subtext">
              {stats?.kanban.sla.normal ?? 0} Normal | {stats?.kanban.sla.attention ?? 0} Attn |{' '}
              {stats?.kanban.sla.warning ?? 0} Warn
            </div>
          </div>
        </div>

        {/* Critical Aging (>30 Days) */}
        <div className="kpi-card">
          <div
            className={`kpi-icon-box ${criticalAgingCount > 0 ? 'kpi-icon-rose' : 'kpi-icon-blue'}`}
          >
            <AlertCircle size={22} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Critical Aged (&gt;30d)</div>
            <div
              className="kpi-value"
              style={{ color: criticalAgingCount > 0 ? '#b91c1c' : '#0f172a' }}
            >
              {criticalAgingCount}
            </div>
            <div className="kpi-subtext">
              Priority stock for FIFO picking &amp; assembly
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filters Toolbar */}
      <div className="filters-container">
        {/* Row 1: Search & Core Facets */}
        <div className="filters-primary-row">
          {/* Integrated Search Box */}
          <div className="search-box">
            <Search size={15} color="#64748b" style={{ flexShrink: 0 }} />
            <input
              type="text"
              className="search-input"
              placeholder="Search serial number or model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear Search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Model Filter */}
          <input
            type="text"
            className="filter-input"
            placeholder="Model Number"
            value={modelNumber}
            onChange={(e) => {
              setModelNumber(e.target.value);
              setPage(1);
            }}
          />

          {/* Pick Status Filter */}
          <select
            className="filter-select"
            value={pickStatus}
            onChange={(e) => {
              setPickStatus(e.target.value);
              setPage(1);
            }}
            title="Filter by Kardex pick/stock status"
          >
            <option value="ACTIVE">In Stock (Available + Hold)</option>
            <option value="AVAILABLE">Available Only</option>
            <option value="HOLD">Hold Only</option>
            <option value="PICKED">Picked Only</option>
            <option value="ALL">All Statuses</option>
          </select>

          {/* Storage Age Bucket or Kanban SLA Tier */}
          {activeTab !== 'KANBAN_SLA' ? (
            <select
              className="filter-select"
              value={ageBucket}
              onChange={(e) => {
                setAgeBucket(e.target.value as AgeBucket);
                setPage(1);
              }}
              title="Filter by Kardex storage age"
            >
              <option value="ALL">All Storage Ages</option>
              <option value="0-7">0-7 Days (Fresh)</option>
              <option value="8-15">8-15 Days</option>
              <option value="16-30">16-30 Days</option>
              <option value="31-60">31-60 Days</option>
              <option value="60+">60+ Days (Critical)</option>
              <option value="30+">30+ Days (All Aged)</option>
            </select>
          ) : (
            <select
              className="filter-select"
              value={slaStatus}
              onChange={(e) => {
                setSlaStatus(e.target.value as KanbanSlaStatus);
                setPage(1);
              }}
              title="Filter by Kanban SLA tier"
            >
              <option value="ALL">All SLA Tiers</option>
              <option value="NORMAL">&lt; 24h Normal</option>
              <option value="ATTENTION">24-48h Attention</option>
              <option value="WARNING">48-72h Warning</option>
              <option value="OVERDUE">&gt; 72h Overdue</option>
            </select>
          )}

          {/* Process Filter (if in All Inventory or Watchlist) */}
          {activeTab !== 'KANBAN_SLA' ? (
            <select
              className="filter-select"
              value={processStatus}
              onChange={(e) => {
                setProcessStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Inbound Processes</option>
              <option value="KANBAN-IN">KANBAN-IN</option>
              <option value="KANBAN-RTN">KANBAN-RTN (Returns)</option>
              <option value="STANDARD_PUT">Standard PUT</option>
              <option value="KANBAN_ONLY">Any Kanban</option>
            </select>
          ) : (
            /* Kanban Specific Sub-filter */
            <select
              className="filter-select"
              value={kanbanFilter}
              onChange={(e) => {
                setKanbanFilter(e.target.value as any);
                setPage(1);
              }}
            >
              <option value="KANBAN_ONLY">All Kanban Inbound</option>
              <option value="KANBAN_RTN">Returns Only (KANBAN-RTN)</option>
            </select>
          )}

          {/* Sort Control */}
          <select
            className="filter-select"
            value={`${sortField}_${sortDirection}`}
            onChange={(e) => {
              const [f, d] = e.target.value.split('_');
              setSortField(f);
              setSortDirection(d as 'ASC' | 'DESC');
              setPage(1);
            }}
            title="Sort records"
          >
            <option value="scanned_at_ASC">FIFO Priority (Oldest Inbound First)</option>
            <option value="scanned_at_DESC">Newest Inbound First</option>
            <option value="birth_date_ASC">Oldest PCB (SMT Birth Date)</option>
            <option value="serial_number_ASC">Serial Number (A → Z)</option>
            <option value="model_number_ASC">Model Number (A → Z)</option>
          </select>
        </div>

        {/* Row 2: Timeline Filter, Active Counter & Reset */}
        <div className="filters-secondary-row">
          <div className="date-section">
            <span className="filter-label">
              <Calendar size={13} />
              <span>Inbound Date:</span>
            </span>

            {/* Quick Date Presets */}
            <div className="date-presets-group">
              <button
                type="button"
                className={`date-preset-btn ${datePreset === 'ALL' ? 'active' : ''}`}
                onClick={() => applyDatePreset('ALL')}
              >
                All Time
              </button>
              <button
                type="button"
                className={`date-preset-btn ${datePreset === 'TODAY' ? 'active' : ''}`}
                onClick={() => applyDatePreset('TODAY')}
              >
                Today
              </button>
              <button
                type="button"
                className={`date-preset-btn ${datePreset === '7D' ? 'active' : ''}`}
                onClick={() => applyDatePreset('7D')}
              >
                7 Days
              </button>
              <button
                type="button"
                className={`date-preset-btn ${datePreset === '30D' ? 'active' : ''}`}
                onClick={() => applyDatePreset('30D')}
              >
                30 Days
              </button>
            </div>

            {/* Clean Date Picker Range */}
            <div className="date-inputs-wrapper">
              <input
                type="date"
                className="date-field"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDatePreset('ALL');
                  setPage(1);
                }}
                title="Start Date"
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                className="date-field"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDatePreset('ALL');
                  setPage(1);
                }}
                title="End Date"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  className="date-clear-btn"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setDatePreset('ALL');
                    setPage(1);
                  }}
                  title="Clear dates"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="secondary-actions">
            <span className="records-count-chip">
              Showing {data.length} of {totalItems} records
            </span>

            {/* Reset Filters */}
            {activeFiltersCount > 0 && (
              <button
                type="button"
                className="btn-reset-filters"
                onClick={handleResetFilters}
                title="Reset all active filters"
              >
                <RotateCcw size={12} /> Reset ({activeFiltersCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="table-card">
        {tableLoading ? (
          <div style={{ padding: '3.5rem 0' }}>
            <Loader message="Loading aging records..." />
          </div>
        ) : data.length === 0 ? (
          <div style={{ padding: '2rem 1rem' }}>
            <EmptyState
              title="No records found"
              description="No serial numbers match the selected criteria. Try adjusting your search query, bucket, or clearing active filters."
              action={
                <button className="btn-outline-action" onClick={handleResetFilters} style={{ marginTop: '0.5rem' }}>
                  <RotateCcw size={12} /> Clear All Filters
                </button>
              }
            />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="aging-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th
                    className="sortable-th"
                    onClick={() => {
                      if (sortField === 'serial_number') {
                        setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
                      } else {
                        setSortField('serial_number');
                        setSortDirection('ASC');
                      }
                    }}
                  >
                    Serial Number {sortField === 'serial_number' && (sortDirection === 'ASC' ? '↑' : '↓')}
                  </th>
                  <th
                    className="sortable-th"
                    onClick={() => {
                      if (sortField === 'model_number') {
                        setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
                      } else {
                        setSortField('model_number');
                        setSortDirection('ASC');
                      }
                    }}
                  >
                    Model {sortField === 'model_number' && (sortDirection === 'ASC' ? '↑' : '↓')}
                  </th>
                  <th>Location (HU / Slot)</th>
                  <th>Process</th>
                  <th
                    className="sortable-th"
                    onClick={() => {
                      if (sortField === 'scanned_at') {
                        setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
                      } else {
                        setSortField('scanned_at');
                        setSortDirection('ASC');
                      }
                    }}
                  >
                    Kardex Storage Age {sortField === 'scanned_at' && (sortDirection === 'ASC' ? '↑' : '↓')}
                  </th>
                  {activeTab === 'KANBAN_SLA' && <th>Kanban SLA Dwell</th>}
                  <th
                    className="sortable-th"
                    onClick={() => {
                      if (sortField === 'birth_date') {
                        setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
                      } else {
                        setSortField('birth_date');
                        setSortDirection('ASC');
                      }
                    }}
                  >
                    SMT Birth Date {sortField === 'birth_date' && (sortDirection === 'ASC' ? '↑' : '↓')}
                  </th>
                  <th>Stock Status</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Audit</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => {
                  const rowIdx = (page - 1) * pageSize + index + 1;
                  const isCopied = copiedSerial === row.serial_number;

                  // Age bucket visual style
                  let ageClass = 'age-fresh';
                  if (row.age_bucket === '8-15') ageClass = 'age-normal';
                  else if (row.age_bucket === '16-30') ageClass = 'age-aging';
                  else if (row.age_bucket === '31-60') ageClass = 'age-high';
                  else if (row.age_bucket === '60+') ageClass = 'age-critical';

                  // Kanban SLA visual style
                  let slaBadgeClass = 'sla-normal';
                  if (row.kanban_sla_status === 'ATTENTION') slaBadgeClass = 'sla-attention';
                  else if (row.kanban_sla_status === 'WARNING') slaBadgeClass = 'sla-warning';
                  else if (row.kanban_sla_status === 'OVERDUE') slaBadgeClass = 'sla-overdue';

                  return (
                    <tr key={row.id}>
                      <td style={{ color: '#94a3b8', fontWeight: 600, fontFamily: 'monospace' }}>
                        #{String(rowIdx).padStart(2, '0')}
                      </td>

                      {/* Serial Number with Copy */}
                      <td>
                        <button
                          className="serial-pill"
                          onClick={() => copyToClipboard(row.serial_number)}
                          title="Click to copy serial number"
                        >
                          <Barcode size={13} style={{ color: '#64748b' }} />
                          <span>{row.serial_number}</span>
                          {isCopied ? (
                            <Check size={12} color="#16a34a" />
                          ) : (
                            <Copy size={11} color="#94a3b8" />
                          )}
                        </button>
                      </td>

                      {/* Model Number */}
                      <td>
                        <span className="model-chip">
                          <Tag size={11} style={{ marginRight: '4px' }} />
                          {row.model_number}
                        </span>
                      </td>

                      {/* Location (Handling Unit & Slot) */}
                      <td>
                        {row.hu_id ? (
                          <Link href={`/app/bins/${row.hu_id}`} className="location-link">
                            <Box size={14} color="#2563eb" />
                            <span>{row.hu_id}</span>
                            {row.compartment_number !== null && (
                              <span className="slot-badge">
                                Slot #{String(row.compartment_number).padStart(2, '0')}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Inbound Process */}
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
                          {row.process_status?.includes('RTN') ? (
                            <RotateCcw size={11} />
                          ) : row.process_status?.includes('KANBAN') ? (
                            <Zap size={11} />
                          ) : (
                            <Package size={11} />
                          )}
                          {row.process_status || 'PUT'}
                        </span>
                      </td>

                      {/* Kardex Storage Age */}
                      <td>
                        <span className={`badge ${ageClass}`}>
                          <Clock size={11} />
                          {row.kardex_age_days}d {row.kardex_age_hours}h
                        </span>
                        {row.scanned_at && (
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#64748b',
                              marginTop: '3px',
                              fontWeight: 500,
                            }}
                          >
                            Inbound:{' '}
                            {new Date(row.scanned_at).toLocaleDateString([], {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        )}
                      </td>

                      {/* Kanban SLA Column (Visible in Kanban SLA Tab) */}
                      {activeTab === 'KANBAN_SLA' && (
                        <td>
                          {row.kanban_sla_status ? (
                            <span className={`badge ${slaBadgeClass}`}>
                              <Zap size={11} />
                              {row.kanban_sla_status} ({row.kanban_dwell_hours}h)
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                      )}

                      {/* Birth Date / Board Age */}
                      <td>
                        {row.birth_date && row.birth_date !== 'N/A' ? (
                          <div>
                            <span style={{ fontWeight: 600, color: '#334155' }}>
                              {new Date(row.birth_date).toLocaleDateString([], {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            {row.birth_age_days !== null && (
                              <span
                                style={{
                                  color: '#475569',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  marginLeft: '6px',
                                  background: '#f1f5f9',
                                  border: '1px solid #e2e8f0',
                                  padding: '1.5px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                {row.birth_age_days}d PCB
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>N/A</span>
                        )}
                      </td>

                      {/* Inventory / Pick Status */}
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
                          <span
                            className={`status-dot ${
                              row.pick_status === 'AVAILABLE'
                                ? 'status-dot-green'
                                : row.pick_status === 'HOLD'
                                ? 'status-dot-amber'
                                : 'status-dot-slate'
                            }`}
                          />
                          {row.pick_status}
                        </span>
                      </td>

                      {/* Audit Log Link */}
                      <td style={{ textAlign: 'center' }}>
                        <Link
                          href={`/app/logs/${encodeURIComponent(row.serial_number)}`}
                          className="audit-btn"
                          title="View lifecycle audit log"
                        >
                          <span>Audit</span>
                          <ExternalLink size={11} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Bar */}
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
