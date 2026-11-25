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
  ShieldAlert,
  X,
  ArrowUpDown,
  Filter,
  ShieldCheck,
  Zap,
  Barcode,
  Tag,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import XLSX from 'xlsx-js-style';

export default function ReportsPage() {
  // Stats
  const [stats, setStats] = useState<AgingStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  // Table Data
  const [data, setData] = useState<SerialAgingItem[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [debouncedModel, setDebouncedModel] = useState('');
  const [pickStatus, setPickStatus] = useState<string>('ACTIVE'); // 'ACTIVE', 'AVAILABLE', 'HOLD', 'PICKED', 'ALL'
  const [processStatus, setProcessStatus] = useState<string>('ALL'); // 'ALL', 'KANBAN_ONLY', 'KANBAN-IN', 'KANBAN-RTN', 'STANDARD_PUT'
  const [ageBucket, setAgeBucket] = useState<AgeBucket>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | '7D' | '30D'>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<string>('scanned_at');
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC');

  // UI helpers
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Debounce search and model queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setDebouncedModel(modelNumber);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, modelNumber]);

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

        const res = await apiPost<SerialAgingResponse>('/report/aging/serial', {
          search: debouncedSearch,
          ageBucket,
          slaStatus: 'ALL',
          processStatus,
          pickStatus,
          modelNumber: debouncedModel,
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
      debouncedSearch,
      debouncedModel,
      ageBucket,
      processStatus,
      pickStatus,
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

  // Handle Storage Age Bucket change
  const handleAgeBucketChange = (bucket: AgeBucket) => {
    setAgeBucket(bucket);
    if (bucket !== 'ALL') {
      setStartDate('');
      setEndDate('');
      setDatePreset('ALL');
    }
    setPage(1);
  };

  // Handle Date Presets
  const applyDatePreset = (preset: 'ALL' | 'TODAY' | '7D' | '30D') => {
    setDatePreset(preset);
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else {
      setAgeBucket('ALL'); // Prevent conflict with age bucket
      if (preset === 'TODAY') {
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
    }
    setPage(1);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setModelNumber('');
    setDebouncedModel('');
    setPickStatus('ACTIVE');
    setProcessStatus('ALL');
    setAgeBucket('ALL');
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
    if (debouncedModel) count++;
    if (pickStatus !== 'ACTIVE') count++;
    if (processStatus !== 'ALL') count++;
    if (ageBucket !== 'ALL') count++;
    if (startDate || endDate) count++;
    if (sortField !== 'scanned_at' || sortDirection !== 'ASC') count++;
    return count;
  }, [
    debouncedSearch,
    debouncedModel,
    pickStatus,
    processStatus,
    ageBucket,
    startDate,
    endDate,
    sortField,
    sortDirection,
  ]);

  // Clipboard copy
  const copyToClipboard = (text: string) => {
    copyUtil(text);
    setCopiedSerial(text);
    setTimeout(() => setCopiedSerial(null), 1800);
  };

  // Excel Export: Multi-Sheet Master Workbook with Executive Summary, Full Data, and Watchlists
  const handleExportExcel = async () => {
    try {
      setExporting(true);

      const res = await apiPost<{ data: any[]; count: number }>('/report/aging/export', {
        search: debouncedSearch,
        ageBucket,
        slaStatus: 'ALL',
        processStatus,
        pickStatus,
        modelNumber: debouncedModel,
        startDate: startDate || null,
        endDate: endDate || null,
        sortField,
        sortDirection,
      });

      const records = res.data || [];
      if (records.length === 0) {
        alert('No records found to export for the active filter criteria.');
        return;
      }

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

      // Helper to compute auto column widths with generous breathing room
      const autoFitCols = (rows: Record<string, any>[]) => {
        if (!rows.length) return [];
        return Object.keys(rows[0]).map((key) => {
          const maxValLen = rows.slice(0, 200).reduce((max, r) => {
            const val = r[key];
            const strLen = val !== null && val !== undefined ? String(val).length : 0;
            return Math.max(max, strLen);
          }, key.length);
          return { wch: Math.min(Math.max(maxValLen + 5, 14), 45) };
        });
      };

      // Clean, professional inventory data table matching UI columns exactly
      const tableRows = records.map((r, index) => {
        const isKanban = r.is_kanban === 'YES' || r.is_kanban === true || String(r.process_status || '').toUpperCase().includes('KANBAN');
        const scannedDate = r.scanned_at ? new Date(r.scanned_at) : null;
        const birthDate = r.birth_date && r.birth_date !== 'N/A' ? new Date(r.birth_date) : null;
        const ageDays = typeof r.kardex_age_days === 'number' ? r.kardex_age_days : (parseInt(r.kardex_age_days, 10) || 0);
        const ageHours = typeof r.kardex_age_hours === 'number' ? r.kardex_age_hours : (parseInt(r.kardex_age_hours, 10) || 0);
        const ageMinutes = typeof r.kardex_age_minutes === 'number'
          ? r.kardex_age_minutes
          : (r.scanned_at ? Math.floor((Math.max(0, Date.now() - new Date(r.scanned_at).getTime()) % (1000 * 60 * 60)) / (1000 * 60)) : 0);
        const birthAgeDays =
          r.birth_age_days !== null &&
          r.birth_age_days !== undefined &&
          r.birth_age_days !== 'N/A' &&
          !isNaN(Number(r.birth_age_days))
            ? Number(r.birth_age_days)
            : 'N/A';
        const storageKanbanAging = isKanban ? `KANBAN-IN: ${ageDays}d ${ageHours}h ${ageMinutes}m` : `${ageDays}d ${ageHours}h ${ageMinutes}m`;

        return {
          'SL NO': index + 1,
          'SERIAL NUMBER': r.serial_number || 'N/A',
          'MODEL NUMBER': r.model_number || 'N/A',
          'CARRIER HU ID': r.hu_id || 'N/A',
          'COMPARTMENT NO': r.compartment_number !== null && r.compartment_number !== undefined ? r.compartment_number : 'N/A',
          'PROCESS FLOW': r.process_status || 'N/A',
          'PV STATUS': r.pv_status || 'PASS',
          'MES & KANBAN IN AGING': storageKanbanAging,
          'INBOUND DATE & TIME': scannedDate ? scannedDate.toLocaleString() : 'N/A',
          'SMT BIRTH AGING (IN DAYS)': birthAgeDays,
          'SMT BIRTH DATE': birthDate ? birthDate.toLocaleDateString() : 'N/A',
          'STOCK STATUS': r.pick_status || 'AVAILABLE',
        };
      });

      const workbook = XLSX.utils.book_new();
      const masterSheet = XLSX.utils.json_to_sheet(tableRows);

      // Auto-fit column widths
      masterSheet['!cols'] = autoFitCols(tableRows);

      // Freeze header row so it stays visible while scrolling
      masterSheet['!views'] = [{ state: 'frozen', ySplit: 1 }];

      // Enable Excel AutoFilter dropdowns on the header row
      if (masterSheet['!ref']) {
        masterSheet['!autofilter'] = { ref: masterSheet['!ref'] };
      }

      // Apply elegant styling, colors, zebra striping and badges
      const range = XLSX.utils.decode_range(masterSheet['!ref'] || 'A1');
      const headerKeys = Object.keys(tableRows[0] || {});

      // Header row height (30pt) + data row heights (22pt)
      const rowHeights = [{ hpt: 30 }];
      for (let r = 1; r <= tableRows.length; r++) {
        rowHeights.push({ hpt: 22 });
      }
      masterSheet['!rows'] = rowHeights;

      for (let R = range.s.r; R <= range.e.r; ++R) {
        const isHeader = R === 0;
        const rowIndex = R - 1; // 0-based for data
        const isEvenDataRow = rowIndex % 2 === 0;

        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
          if (!masterSheet[cellRef]) continue;

          const colName = headerKeys[C] || '';

          if (isHeader) {
            // Elegant Navy Blue Header Styling
            masterSheet[cellRef].s = {
              fill: { fgColor: { rgb: '1E3A8A' } }, // Deep JBL / Executive Navy
              font: {
                name: 'Calibri',
                sz: 11,
                bold: true,
                color: { rgb: 'FFFFFF' },
              },
              alignment: {
                horizontal: 'center',
                vertical: 'center',
                wrapText: false,
              },
              border: {
                top: { style: 'thin', color: { rgb: '3B82F6' } },
                bottom: { style: 'medium', color: { rgb: '0F172A' } },
                left: { style: 'thin', color: { rgb: '2563EB' } },
                right: { style: 'thin', color: { rgb: '2563EB' } },
              },
            };
          } else {
            // Data row styling
            const cellValue = String(masterSheet[cellRef].v ?? '');

            let bgColor = isEvenDataRow ? 'FFFFFF' : 'F8FAFC'; // Alternating clean zebra striping
            let fontColor = '0F172A';
            let isBold = false;
            let alignH: 'left' | 'center' | 'right' = 'left';

            // Center align for numbers, IDs, dates, and status badges
            const centerColumns = [
              'SL NO',
              'CARRIER HU ID',
              'COMPARTMENT NO',
              'PROCESS FLOW',
              'PV STATUS',
              'MES & KANBAN IN AGING',
              'INBOUND DATE & TIME',
              'SMT BIRTH AGING (IN DAYS)',
              'SMT BIRTH DATE',
              'STOCK STATUS',
            ];
            if (centerColumns.includes(colName)) {
              alignH = 'center';
            }

            // Status Badge Highlight Colors
            if (colName === 'STOCK STATUS') {
              if (cellValue === 'AVAILABLE') {
                bgColor = 'DCFCE7'; // Soft Emerald Green
                fontColor = '166534';
                isBold = true;
              } else if (cellValue === 'HOLD') {
                bgColor = 'FEF3C7'; // Soft Amber
                fontColor = '92400E';
                isBold = true;
              } else if (cellValue === 'PICKED') {
                bgColor = 'F1F5F9'; // Soft Slate
                fontColor = '475569';
                isBold = true;
              }
            } else if (colName === 'PV STATUS') {
              if (cellValue === 'PASS') {
                bgColor = 'DCFCE7';
                fontColor = '166534';
                isBold = true;
              } else if (cellValue === 'FAIL') {
                bgColor = 'FEE2E2';
                fontColor = '991B1B';
                isBold = true;
              }
            } else if (colName === 'MES & KANBAN IN AGING') {
              if (cellValue.includes('KANBAN')) {
                bgColor = 'F3E8FF'; // Soft purple for Kanban
                fontColor = '7E22CE';
                isBold = true;
              } else {
                bgColor = 'F8FAFC';
                fontColor = '334155';
              }
            } else if (colName === 'SMT BIRTH AGING (IN DAYS)') {
              if (cellValue !== 'N/A' && cellValue !== 'No Birth Date' && cellValue !== '' && !isNaN(Number(cellValue))) {
                bgColor = 'EFF6FF'; // Soft Tech Blue
                fontColor = '1D4ED8';
                isBold = true;
              }
            } else if (colName === 'PROCESS FLOW') {
              if (cellValue.includes('RTN')) {
                bgColor = 'F3E8FF'; // Soft Violet for Return
                fontColor = '7E22CE';
                isBold = true;
              } else if (cellValue.includes('OUT')) {
                bgColor = 'FFEDD5'; // Warm Amber/Orange for Kanban Out
                fontColor = 'C2410C';
                isBold = true;
              } else if (cellValue.includes('KANBAN') || cellValue.includes('IN')) {
                bgColor = 'DCFCE7'; // Fresh Mint Green for Kanban In
                fontColor = '15803D';
                isBold = true;
              } else {
                bgColor = 'EFF6FF'; // Tech Blue for Standard Put
                fontColor = '1D4ED8';
                isBold = true;
              }
            } else if (colName === 'CARRIER HU ID') {
              bgColor = 'F1F5F9'; // Cool Slate
              fontColor = '0F172A';
              isBold = true;
            } else if (colName === 'BIN TYPE') {
              bgColor = 'FEF3C7'; // Amber ESD Safe
              fontColor = '92400E';
              isBold = true;
            } else if (colName === 'COMPARTMENT NO') {
              bgColor = 'ECFDF5'; // Light Emerald
              fontColor = '047857';
              isBold = true;
            }

            masterSheet[cellRef].s = {
              fill: { fgColor: { rgb: bgColor } },
              font: {
                name: 'Calibri',
                sz: 10,
                bold: isBold,
                color: { rgb: fontColor },
              },
              alignment: {
                horizontal: alignH,
                vertical: 'center',
                wrapText: false,
              },
              border: {
                top: { style: 'thin', color: { rgb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
                left: { style: 'thin', color: { rgb: 'E2E8F0' } },
                right: { style: 'thin', color: { rgb: 'E2E8F0' } },
              },
            };
          }
        }
      }

      // Single clean sheet
      XLSX.utils.book_append_sheet(workbook, masterSheet, 'Inventory');

      // Generate timestamped file name
      const dateTag = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      const fileName = `JBL_Kardex_Inventory_${dateTag}.xlsx`;
      XLSX.writeFile(workbook, fileName);
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
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.6rem;
          margin-bottom: 0.85rem;
        }

        @media (max-width: 1100px) {
          .kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        .kpi-card {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0.55rem 0.8rem;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          user-select: none;
          position: relative;
        }

        .kpi-card:hover {
          transform: translateY(-2px);
        }

        /* 1. Total Parts - Sky Blue Theme */
        .kpi-card-blue {
          background: linear-gradient(135deg, #f0f7ff 0%, #e0effe 100%);
          border-color: #bfdbfe;
        }
        .kpi-card-blue:hover {
          border-color: #60a5fa;
          background: linear-gradient(135deg, #e8f3fe 0%, #d5e9fe 100%);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
        }
        .kpi-card-blue.active {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px #2563eb, 0 4px 12px rgba(37, 99, 235, 0.18);
        }
        .kpi-card-blue .kpi-label { color: #1e40af; }
        .kpi-card-blue .kpi-value { color: #1d4ed8; }
        .kpi-card-blue .kpi-subtext { color: #3b82f6; }
        .kpi-card-blue .kpi-icon-box {
          background: #ffffff;
          color: #2563eb;
          box-shadow: 0 2px 5px rgba(37, 99, 235, 0.15);
        }

        /* 2. Available - Fresh Mint Green Theme */
        .kpi-card-emerald {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border-color: #bbf7d0;
        }
        .kpi-card-emerald:hover {
          border-color: #4ade80;
          background: linear-gradient(135deg, #e6fced 0%, #d0f9dc 100%);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.12);
        }
        .kpi-card-emerald.active {
          border-color: #059669;
          box-shadow: 0 0 0 2px #059669, 0 4px 12px rgba(5, 150, 105, 0.18);
        }
        .kpi-card-emerald .kpi-label { color: #166534; }
        .kpi-card-emerald .kpi-value { color: #15803d; }
        .kpi-card-emerald .kpi-subtext { color: #16a34a; }
        .kpi-card-emerald .kpi-icon-box {
          background: #ffffff;
          color: #059669;
          box-shadow: 0 2px 5px rgba(16, 185, 129, 0.15);
        }

        /* 3. Hold - Warm Amber Gold Theme */
        .kpi-card-amber {
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border-color: #fde68a;
        }
        .kpi-card-amber:hover {
          border-color: #fbbf24;
          background: linear-gradient(135deg, #fef8dd 0%, #fdeebc 100%);
          box-shadow: 0 4px 12px rgba(217, 119, 6, 0.12);
        }
        .kpi-card-amber.active {
          border-color: #d97706;
          box-shadow: 0 0 0 2px #d97706, 0 4px 12px rgba(217, 119, 6, 0.18);
        }
        .kpi-card-amber .kpi-label { color: #92400e; }
        .kpi-card-amber .kpi-value { color: #b45309; }
        .kpi-card-amber .kpi-subtext { color: #d97706; }
        .kpi-card-amber .kpi-icon-box {
          background: #ffffff;
          color: #d97706;
          box-shadow: 0 2px 5px rgba(217, 119, 6, 0.15);
        }

        /* 4. Picked - Cool Slate Gray Theme */
        .kpi-card-slate {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border-color: #cbd5e1;
        }
        .kpi-card-slate:hover {
          border-color: #94a3b8;
          background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          box-shadow: 0 4px 12px rgba(71, 85, 105, 0.12);
        }
        .kpi-card-slate.active {
          border-color: #475569;
          box-shadow: 0 0 0 2px #475569, 0 4px 12px rgba(71, 85, 105, 0.18);
        }
        .kpi-card-slate .kpi-label { color: #475569; }
        .kpi-card-slate .kpi-value { color: #1e293b; }
        .kpi-card-slate .kpi-subtext { color: #64748b; }
        .kpi-card-slate .kpi-icon-box {
          background: #ffffff;
          color: #475569;
          box-shadow: 0 2px 5px rgba(71, 85, 105, 0.15);
        }

        /* 5. Returns - Royal Purple Theme */
        .kpi-card-purple {
          background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
          border-color: #e9d5ff;
        }
        .kpi-card-purple:hover {
          border-color: #c084fc;
          background: linear-gradient(135deg, #f5e8ff 0%, #ebd5ff 100%);
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.12);
        }
        .kpi-card-purple.active {
          border-color: #7c3aed;
          box-shadow: 0 0 0 2px #7c3aed, 0 4px 12px rgba(124, 58, 237, 0.18);
        }
        .kpi-card-purple .kpi-label { color: #6b21a8; }
        .kpi-card-purple .kpi-value { color: #7e22ce; }
        .kpi-card-purple .kpi-subtext { color: #9333ea; }
        .kpi-card-purple .kpi-icon-box {
          background: #ffffff;
          color: #7c3aed;
          box-shadow: 0 2px 5px rgba(124, 58, 237, 0.15);
        }

        .kpi-icon-box {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .kpi-icon-blue { background: #eff6ff; color: #2563eb; }
        .kpi-icon-amber { background: #fffbeb; color: #d97706; }
        .kpi-icon-purple { background: #faf5ff; color: #7c3aed; }
        .kpi-icon-slate { background: #f1f5f9; color: #475569; }
        .kpi-icon-rose { background: #fef2f2; color: #dc2626; }
        .kpi-icon-emerald { background: #ecfdf5; color: #059669; }

        .kpi-content {
          min-width: 0;
          flex: 1;
        }

        .kpi-label {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
          margin-bottom: 1px;
        }

        .kpi-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
          line-height: 1.15;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .kpi-subtext {
          font-size: 0.675rem;
          color: #64748b;
          margin-top: 1px;
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

        .btn-reset-filters:hover:not(:disabled) {
          background: #fee2e2;
          border-color: #fca5a5;
        }

        .btn-reset-filters:disabled,
        .btn-reset-filters.disabled {
          background: #f8fafc;
          color: #94a3b8;
          border-color: #e2e8f0;
          cursor: not-allowed;
          opacity: 0.65;
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

        /* Location Chips */
        .location-container {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 5px;
        }

        .hu-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #0f172a;
          color: #38bdf8;
          padding: 2.5px 8px;
          border-radius: 6px;
          font-size: 0.725rem;
          font-weight: 700;
          text-decoration: none;
          transition: all 0.15s ease;
          border: 1px solid #1e293b;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        }

        .hu-chip:hover {
          background: #1e293b;
          color: #7dd3fc;
          transform: translateY(-1px);
        }

        .bin-chip {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
          padding: 2px 7px;
          border-radius: 5px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .slot-chip {
          display: inline-flex;
          align-items: center;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
          padding: 2px 6px;
          border-radius: 5px;
          font-size: 0.725rem;
          font-weight: 800;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }

        .unassigned-chip {
          color: #94a3b8;
          font-style: italic;
          font-size: 0.75rem;
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

        /* Distinct Process Flow Badges */
        .badge-kanban-in {
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          color: #047857;
          border: 1px solid #6ee7b7;
        }

        .badge-kanban-out {
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          color: #c2410c;
          border: 1px solid #fdba74;
        }

        .badge-kanban-rtn {
          background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
          color: #7e22ce;
          border: 1px solid #d8b4fe;
        }

        .badge-put {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .pv-pass {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .pv-fail {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .badge-storage-age {
          background: #f8fafc;
          color: #334155;
          border: 1px solid #cbd5e1;
          font-weight: 600;
        }

        .badge-kanban-age {
          background: #faf5ff;
          color: #7c3aed;
          border: 1px solid #e9d5ff;
          font-weight: 700;
        }

        .badge-birth-age {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          font-weight: 700;
        }

        .inbound-date-subtext {
          font-size: 0.7rem;
          color: #64748b;
          margin-top: 3px;
          font-weight: 500;
        }

        .no-birth-chip {
          color: #94a3b8;
          font-size: 0.75rem;
          font-style: italic;
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
              Real-time FIFO storage duration and component birth aging
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

      {/* KPI Summary Cards */}
      <div className="kpi-grid">
        {/* 1. Total Parts */}
        <div
          className={`kpi-card kpi-card-blue ${
            pickStatus === 'ACTIVE' && processStatus === 'ALL'
              ? 'active'
              : ''
          }`}
          onClick={() => {
            setPickStatus('ACTIVE');
            setProcessStatus('ALL');
            setPage(1);
          }}
          title="Click to show all active stock in Kardex"
        >
          <div className="kpi-icon-box">
            <Package size={17} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total Parts</div>
            <div className="kpi-value">{stats?.inventory.totalActive ?? 0}</div>
            <div className="kpi-subtext">
              Oldest: {stats?.inventory.oldestUnit ? `${stats.inventory.oldestUnit.age_days}d` : '0d'} in Kardex
            </div>
          </div>
        </div>

        {/* 2. Available */}
        <div
          className={`kpi-card kpi-card-emerald ${pickStatus === 'AVAILABLE' ? 'active' : ''}`}
          onClick={() => {
            setPickStatus((prev) => (prev === 'AVAILABLE' ? 'ACTIVE' : 'AVAILABLE'));
            setPage(1);
          }}
          title="Click to filter by Available stock"
        >
          <div className="kpi-icon-box">
            <CheckCircle2 size={17} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Available</div>
            <div className="kpi-value">{stats?.inventory.totalAvailable ?? 0}</div>
            <div className="kpi-subtext">Ready for pick</div>
          </div>
        </div>

        {/* 3. Hold */}
        <div
          className={`kpi-card kpi-card-amber ${pickStatus === 'HOLD' ? 'active' : ''}`}
          onClick={() => {
            setPickStatus((prev) => (prev === 'HOLD' ? 'ACTIVE' : 'HOLD'));
            setPage(1);
          }}
          title="Click to filter by Hold / QA stock"
        >
          <div className="kpi-icon-box">
            <AlertTriangle size={17} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Hold</div>
            <div className="kpi-value">{stats?.inventory.totalHold ?? 0}</div>
            <div className="kpi-subtext">QA / Quarantined</div>
          </div>
        </div>

        {/* 4. Picked */}
        <div
          className={`kpi-card kpi-card-slate ${pickStatus === 'PICKED' ? 'active' : ''}`}
          onClick={() => {
            setPickStatus((prev) => (prev === 'PICKED' ? 'ACTIVE' : 'PICKED'));
            setPage(1);
          }}
          title="Click to filter by Picked orders"
        >
          <div className="kpi-icon-box">
            <Boxes size={17} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Picked</div>
            <div className="kpi-value">{stats?.inventory.totalPicked ?? 0}</div>
            <div className="kpi-subtext">Retrieved units</div>
          </div>
        </div>

        {/* 5. Kanban In */}
        <div
          className={`kpi-card kpi-card-purple ${
            processStatus === 'KANBAN_ONLY' || processStatus === 'KANBAN-IN' ? 'active' : ''
          }`}
          onClick={() => {
            const isKanban = processStatus === 'KANBAN_ONLY' || processStatus === 'KANBAN-IN';
            if (isKanban) {
              setProcessStatus('ALL');
              setPickStatus('ACTIVE');
            } else {
              setProcessStatus('KANBAN_ONLY');
              setPickStatus('ACTIVE');
            }
            setPage(1);
          }}
          title="Click to filter by Kanban In parts"
        >
          <div className="kpi-icon-box">
            <Boxes size={17} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Kanban In</div>
            <div className="kpi-value">{stats?.kanban.totalActive ?? 0}</div>
            <div className="kpi-subtext">
              Oldest: {stats?.kanban.oldestUnit ? `${stats.kanban.oldestUnit.age_days}d` : 'None'} | {stats?.kanban.returnsCount ?? 0} RTN
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filters Toolbar */}
      <div className="filters-container">
        {/* Row 1: Search & Core Facets */}
        <div className="filters-primary-row">
          {/* Integrated Serial Search Box */}
          <div className="search-box">
            <Search size={15} color="#64748b" style={{ flexShrink: 0 }} />
            <input
              type="text"
              className="search-input"
              placeholder="Search serial number..."
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

          {/* Model Filter with Icon & Clear */}
          <div className="search-box">
            <Tag size={14} color="#64748b" style={{ flexShrink: 0 }} />
            <input
              type="text"
              className="search-input"
              placeholder="Model Number..."
              value={modelNumber}
              onChange={(e) => setModelNumber(e.target.value)}
            />
            {modelNumber && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setModelNumber('')}
                title="Clear Model"
              >
                <X size={13} />
              </button>
            )}
          </div>

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

          {/* Storage Duration Filter */}
          <select
            className="filter-select"
            value={ageBucket}
            onChange={(e) => handleAgeBucketChange(e.target.value as AgeBucket)}
            title="Filter by Kardex storage duration"
          >
            <option value="ALL">All Storage Ages</option>
            <option value="0-7">0 - 7 Days</option>
            <option value="8-15">8 - 15 Days</option>
            <option value="16-30">16 - 30 Days</option>
            <option value="31-60">31 - 60 Days</option>
            <option value="60+">60+ Days</option>
          </select>

          {/* Process Filter */}
          <select
            className="filter-select"
            value={processStatus}
            onChange={(e) => {
              setProcessStatus(e.target.value);
              setPage(1);
            }}
            title="Filter by inbound process type"
          >
            <option value="ALL">All Inbound Processes</option>
            <option value="KANBAN-IN">KANBAN-IN</option>
            <option value="KANBAN-RTN">KANBAN-RTN (Returns)</option>
            <option value="STANDARD_PUT">Standard PUT</option>
            <option value="KANBAN_ONLY">Any Kanban</option>
          </select>

          {/* Sort Control */}
          <select
            className="filter-select"
            value={`${sortField}:${sortDirection}`}
            onChange={(e) => {
              const [f, d] = e.target.value.split(':');
              setSortField(f);
              setSortDirection(d as 'ASC' | 'DESC');
              setPage(1);
            }}
            title="Sort records"
          >
            <option value="scanned_at:ASC">FIFO Priority (Oldest Inbound First)</option>
            <option value="scanned_at:DESC">Newest Inbound First</option>
            <option value="birth_date:ASC">Oldest PCB (SMT Birth Date)</option>
            <option value="birth_date:DESC">Newest PCB (SMT Birth Date)</option>
            <option value="serial_number:ASC">Serial Number (A → Z)</option>
            <option value="serial_number:DESC">Serial Number (Z → A)</option>
            <option value="model_number:ASC">Model Number (A → Z)</option>
            <option value="model_number:DESC">Model Number (Z → A)</option>
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
                  setAgeBucket('ALL');
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
                  setAgeBucket('ALL');
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

            {/* Always-Visible Reset Filters */}
            <button
              type="button"
              className={`btn-reset-filters ${activeFiltersCount === 0 ? 'disabled' : ''}`}
              onClick={handleResetFilters}
              disabled={activeFiltersCount === 0}
              title={activeFiltersCount > 0 ? 'Clear all active filters' : 'Default filters applied'}
            >
              <RotateCcw size={12} /> Reset {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
            </button>
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
                      setPage(1);
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
                      setPage(1);
                    }}
                  >
                    Model {sortField === 'model_number' && (sortDirection === 'ASC' ? '↑' : '↓')}
                  </th>
                  <th>Location (HU / Slot)</th>
                  <th>Process Flow</th>
                  <th>PV Status</th>
                  <th
                    className="sortable-th"
                    onClick={() => {
                      if (sortField === 'scanned_at') {
                        setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
                      } else {
                        setSortField('scanned_at');
                        setSortDirection('ASC');
                      }
                      setPage(1);
                    }}
                  >
                    MES &amp; KANBAN IN Aging {sortField === 'scanned_at' && (sortDirection === 'ASC' ? '↑' : '↓')}
                  </th>
                  <th
                    className="sortable-th"
                    onClick={() => {
                      if (sortField === 'birth_date') {
                        setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC');
                      } else {
                        setSortField('birth_date');
                        setSortDirection('ASC');
                      }
                      setPage(1);
                    }}
                  >
                    SMT Birth Aging {sortField === 'birth_date' && (sortDirection === 'ASC' ? '↑' : '↓')}
                  </th>
                  <th>Stock Status</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Audit</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => {
                  const rowIdx = (page - 1) * pageSize + index + 1;
                  const isCopied = copiedSerial === row.serial_number;

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
                          <div className="location-container">
                            <Link href={`/app/bins/${row.hu_id}`} className="hu-chip" title="View Handling Unit Details">
                              <Box size={12} />
                              <span>{row.hu_id}</span>
                            </Link>
                            {row.compartment_number !== null && row.compartment_number !== undefined && (
                              <span className="slot-chip" title="Compartment Socket">
                                #{String(row.compartment_number).padStart(2, '0')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="unassigned-chip">Unassigned</span>
                        )}
                      </td>

                      {/* Process Flow Badge */}
                      <td>
                        {(() => {
                          const p = (row.process_status || '').toUpperCase();
                          if (p.includes('RTN')) {
                            return (
                              <span className="badge badge-kanban-rtn" title="Kanban Return Flow">
                                <RotateCcw size={11} /> KANBAN-RTN
                              </span>
                            );
                          } else if (p.includes('OUT')) {
                            return (
                              <span className="badge badge-kanban-out" title="Kanban Outbound Flow">
                                <ArrowUpRight size={11} /> KANBAN-OUT
                              </span>
                            );
                          } else if (p.includes('KANBAN') || p.includes('IN')) {
                            return (
                              <span className="badge badge-kanban-in" title="Kanban Inbound Flow">
                                <ArrowDownRight size={11} /> KANBAN-IN
                              </span>
                            );
                          } else {
                            return (
                              <span className="badge badge-put" title="Standard Put Flow">
                                <Package size={11} /> {row.process_status || 'PUT'}
                              </span>
                            );
                          }
                        })()}
                      </td>

                      {/* PV Validation Status */}
                      <td>
                        <span className={`badge ${row.pv_status === 'FAIL' ? 'pv-fail' : 'pv-pass'}`}>
                          {row.pv_status === 'FAIL' ? (
                            <ShieldAlert size={12} />
                          ) : (
                            <ShieldCheck size={12} />
                          )}
                          {row.pv_status || 'PASS'}
                        </span>
                      </td>

                      {/* MES & Kanban In Aging */}
                      <td>
                        {(() => {
                          const mins = typeof row.kardex_age_minutes === 'number'
                            ? row.kardex_age_minutes
                            : (row.scanned_at ? Math.floor((Math.max(0, Date.now() - new Date(row.scanned_at).getTime()) % (1000 * 60 * 60)) / (1000 * 60)) : 0);

                          return row.is_kanban ? (
                            <span className="badge badge-kanban-age" title="Kanban Inbound Storage Aging">
                              <Zap size={11} /> KANBAN-IN: {row.kardex_age_days}d {row.kardex_age_hours}h {mins}m
                            </span>
                          ) : (
                            <span className="badge badge-storage-age" title="Standard Storage Aging">
                              <Clock size={11} style={{ color: '#64748b' }} />
                              {row.kardex_age_days}d {row.kardex_age_hours}h {mins}m
                            </span>
                          );
                        })()}
                        {row.scanned_at && (
                          <div className="inbound-date-subtext">
                            Inbound:{' '}
                            {new Date(row.scanned_at).toLocaleDateString([], {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        )}
                      </td>

                      {/* SMT Birth Aging */}
                      <td>
                        {row.birth_date && row.birth_date !== 'N/A' && row.birth_age_days !== null && row.birth_age_days !== undefined ? (
                          <div>
                            <span className="badge badge-birth-age" title="Board Lifespan since SMT Birth">
                              <Calendar size={11} /> {row.birth_age_days} Days Old
                            </span>
                            <div className="inbound-date-subtext">
                              Mfg:{' '}
                              {new Date(row.birth_date).toLocaleDateString([], {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </div>
                          </div>
                        ) : (
                          <span className="no-birth-chip">No Birth Date</span>
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
        pageSizeOptions={[25, 50, 100, 200]}
      />
    </div>
  );
}
