'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PartScanLogsModal } from '@/components/dashboard/PartScanLogsModal';
import { ScanModal } from '@/components/dashboard/ScanModal';
import { ScanAndStoreModal } from '@/components/dashboard/ScanAndStoreModal';
import { HUPutModal } from '@/components/dashboard/HUPutModal';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { Pagination } from '@/components/shared/Pagination';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import { apiPost, apiDownloadFile, downloadBlob } from '@/lib/api';
import { copyToClipboard } from '@/lib/clipboard';
import { useAuth } from '@/context/AuthContext';
import { DashboardCounts, Put, PaginatedResponse } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Calendar,
  Search,
  FileText,
  Download,
  PackagePlus,
  PackageMinus,
  PackageSearch,
  Copy,
  Check,
  Scan,
  Package,
  CheckCircle2,
  Layers,
  Box,
  X,
  Loader2,
} from 'lucide-react';

function formatFileName(name?: string, maxLen = 22): string {
  if (!name) return '-';
  if (name.length <= maxLen) return name;
  const extIndex = name.lastIndexOf('.');
  const ext = extIndex !== -1 ? name.slice(extIndex) : '';
  const base = extIndex !== -1 ? name.slice(0, extIndex) : name;
  const charsToShow = maxLen - ext.length - 3;
  if (charsToShow <= 3) return name.slice(0, Math.max(1, maxLen - 3)) + '...';
  const front = Math.ceil(charsToShow / 2);
  const back = Math.floor(charsToShow / 2);
  return `${base.slice(0, front)}...${base.slice(-back)}${ext}`;
}

function renderProcessStatusBadge(status?: string | null) {
  if (!status) return <span className="text-muted">-</span>;
  const s = status.toUpperCase().replace('_', '-');

  if (s.includes('IN')) {
    return (
      <span
        className="badge"
        style={{
          backgroundColor: '#e0f2fe',
          color: '#0369a1',
          border: '1px solid #7dd3fc',
          fontWeight: 700,
          fontSize: '11px',
          letterSpacing: '0.4px',
          padding: '4px 8px',
        }}
      >
        {status}
      </span>
    );
  }

  if (s.includes('OUT')) {
    return (
      <span
        className="badge"
        style={{
          backgroundColor: '#f3e8ff',
          color: '#7e22ce',
          border: '1px solid #c084fc',
          fontWeight: 700,
          fontSize: '11px',
          letterSpacing: '0.4px',
          padding: '4px 8px',
        }}
      >
        {status}
      </span>
    );
  }

  if (s.includes('RTN')) {
    return (
      <span
        className="badge"
        style={{
          backgroundColor: '#fef3c7',
          color: '#b45309',
          border: '1px solid #fcd34d',
          fontWeight: 700,
          fontSize: '11px',
          letterSpacing: '0.4px',
          padding: '4px 8px',
        }}
      >
        {status}
      </span>
    );
  }

  return (
    <span className="badge bg-secondary" style={{ fontSize: '11px', padding: '4px 8px' }}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { canPut, canPick } = useAuth();
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);

  const [puts, setPuts] = useState<Put[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const reqSeqRef = React.useRef(0);
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);
  const [copiedPo, setCopiedPo] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Debounce search input by 300ms to prevent lag and race conditions
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Modals
  const [isHUPutModalOpen, setIsHUPutModalOpen] = useState(false);
  const [isPutModalOpen, setIsPutModalOpen] = useState(false);
  const [isPickModalOpen, setIsPickModalOpen] = useState(false);
  const [partLogSerial, setPartLogSerial] = useState<string | undefined>(undefined);
  const [isPartLogModalOpen, setIsPartLogModalOpen] = useState(false);

  // Fetch Counts
  const fetchCounts = useCallback(async () => {
    try {
      setCountsLoading(true);
      const res = await apiPost<DashboardCounts>('/dashboard/get-all-counts', {
        startDate: startDate ? startDate.toISOString() : undefined,
        endDate: endDate ? endDate.toISOString() : undefined,
      });
      setCounts(res);
    } catch {
      setCounts(null);
    } finally {
      setCountsLoading(false);
    }
  }, [startDate, endDate]);

  // Fetch Puts
  const fetchPuts = useCallback(
    async (pageNum = 1, currentSize = pageSize, query = debouncedSearch) => {
      const seq = ++reqSeqRef.current;
      try {
        setTableLoading(true);
        const res = await apiPost<PaginatedResponse<Put>>('/put/search-all', {
          search: query,
          page: pageNum,
          size: currentSize,
          sort: ['id', 'DESC'],
          startDate: startDate ? startDate.toISOString() : undefined,
          endDate: endDate ? endDate.toISOString() : undefined,
        });
        if (seq === reqSeqRef.current) {
          setPuts(res.data || []);
          setTotalPages(res.totalPages || 1);
          setTotalItems(res.totalItems || 0);
          setPage(pageNum);
        }
      } catch {
        if (seq === reqSeqRef.current) {
          setPuts([]);
        }
      } finally {
        if (seq === reqSeqRef.current) {
          setTableLoading(false);
        }
      }
    },
    [debouncedSearch, startDate, endDate, pageSize]
  );

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    fetchPuts(1);
  }, [fetchPuts]);

  const handleClearSearch = () => {
    setSearch('');
    setDebouncedSearch('');
    fetchPuts(1, pageSize, '');
    searchInputRef.current?.focus();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = search.trim();
      setDebouncedSearch(trimmed);
      fetchPuts(1, pageSize, trimmed);
    }
  };

  const handleDownloadPutFile = async (putId: number) => {
    try {
      const { blob, fileName } = await apiDownloadFile('/put/download-text-file', { id: putId });
      downloadBlob(blob, fileName);
      fetchPuts(page);
    } catch (err: any) {
      alert(err.message || 'Error downloading PUT file');
    }
  };

  const handleDownloadPickFile = async (pickId: number) => {
    try {
      const { blob, fileName } = await apiDownloadFile('/pick/download-text-file', { id: pickId });
      downloadBlob(blob, fileName);
      fetchPuts(page);
    } catch (err: any) {
      alert(err.message || 'Error downloading PICK file');
    }
  };

  const handleDownloadPoFile = async (poFileId: number) => {
    try {
      const { blob, fileName } = await apiDownloadFile('/file/download', { id: poFileId });
      downloadBlob(blob, fileName);
    } catch (err: any) {
      alert(err.message || 'Error downloading PO file');
    }
  };

  const totalPartsCount = counts
    ? (counts.totalPartsCount && counts.totalPartsCount === ((counts.availablePartsCount || 0) + (counts.pickedPartsCount || 0) + (counts.holdPartsCount || 0))
      ? counts.totalPartsCount
      : ((counts.availablePartsCount || 0) + (counts.pickedPartsCount || 0) + (counts.holdPartsCount || 0)))
    : 0;

  const validScans = counts?.validScanCount || 0;
  const invalidScans = counts?.invalidScanCount || 0;
  const totalScans = validScans + invalidScans;
  const passRate = totalScans > 0 ? Math.round((validScans / totalScans) * 100) : 100;

  const pickedParts = counts?.pickedPartsCount || 0;
  const availableParts = counts?.availablePartsCount || 0;
  const holdParts = counts?.holdPartsCount || 0;
  const totalInventory = totalPartsCount || (pickedParts + availableParts + holdParts);
  const pickedPct = totalInventory > 0 ? Math.round((pickedParts / totalInventory) * 100) : 0;
  const availPct = totalInventory > 0 ? Math.round((availableParts / totalInventory) * 100) : 0;
  const holdPct = totalInventory > 0 ? Math.round((holdParts / totalInventory) * 100) : 0;

  const pieData = [
    { name: 'Valid Scans', value: validScans, color: '#16a34a' },
    { name: 'Invalid Scans', value: invalidScans, color: '#ef4444' },
  ];

  return (
    <div className="dashboard-wrapper">
      <style jsx>{`
        .stat-metric-card {
          background-color: #fff;
          border-radius: 8px;
          border: 1.5px solid #d0d5dd;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 3px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.03);
          min-height: 102px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .stat-metric-card:hover {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08), 0 6px 16px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
          transform: translateY(-1px);
        }
        .stat-metric-card small {
          font-weight: 600;
          color: #64748b;
          font-size: 13px;
        }
        .stat-icon-pill {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .bg-sky-light {
          background-color: #e0f2fe;
          color: #0284c7;
        }
        .bg-emerald-light {
          background-color: #ecfdf5;
          color: #059669;
        }
        .bg-amber-light {
          background-color: #fef3c7;
          color: #d97706;
        }
        .bg-blue-light {
          background-color: #dbeafe;
          color: #2563eb;
        }
        .bg-slate-light {
          background-color: #f1f5f9;
          color: #64748b;
        }
        .bg-green-dark-light {
          background-color: #dcfce7;
          color: #15803d;
        }
        .map-card {
          background-image: url('/assets/images/dashboard-matched-map.jpg');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          border-radius: 8px;
          background-color: #ffffff;
        }
        .bottom-stat {
          border-top: 1px solid #e9ecef;
          padding-top: 10px;
        }
        .border-r {
          border-right: 1px solid #e9ecef;
        }
        .scan-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 6px 14px 6px 8px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          color: #ffffff;
          user-select: none;
        }
        .scan-action-btn:active {
          transform: scale(0.98);
        }
        .scan-btn-put {
          background: linear-gradient(135deg, #091e3a 0%, #0f172a 100%);
          border: 1px solid rgba(56, 189, 248, 0.28);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(56, 189, 248, 0.08);
        }
        .scan-btn-put:hover {
          background: linear-gradient(135deg, #0c274c 0%, #172554 100%);
          border-color: rgba(56, 189, 248, 0.55);
          box-shadow: 0 4px 14px -1px rgba(56, 189, 248, 0.28);
          transform: translateY(-1px);
        }
        .scan-btn-pick {
          background: linear-gradient(135deg, #241804 0%, #0f172a 100%);
          border: 1px solid rgba(245, 158, 11, 0.28);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(245, 158, 11, 0.08);
        }
        .scan-btn-pick:hover {
          background: linear-gradient(135deg, #382404 0%, #1e1b15 100%);
          border-color: rgba(245, 158, 11, 0.55);
          box-shadow: 0 4px 14px -1px rgba(245, 158, 11, 0.28);
          transform: translateY(-1px);
        }
        .scan-icon-pill {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .put-pill {
          background: rgba(56, 189, 248, 0.16);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.25);
        }
        .pick-pill {
          background: rgba(245, 158, 11, 0.16);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }
        .scan-btn-title {
          color: #f8fafc;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .scan-type-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 9999px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
        }
        .put-badge {
          background: rgba(56, 189, 248, 0.18);
          color: #7dd3fc;
          border: 1px solid rgba(56, 189, 248, 0.35);
        }
        .pick-badge {
          background: rgba(245, 158, 11, 0.18);
          color: #fcd34d;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }
        .table-card {
          background: #ffffff;
          border-radius: 8px;
          border: 1.5px solid #d0d5dd;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 3px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.03);
          padding: 20px;
        }
        .table th {
          font-size: 13px;
          font-weight: 600;
          color: #495057;
          background-color: #f8f9fa;
          border-color: #d0d5dd;
        }
        .table td {
          font-size: 13px;
          vertical-align: middle;
          border-color: #d0d5dd;
        }
        .table {
          border-color: #d0d5dd;
        }
        .table-bordered {
          border: 1.5px solid #d0d5dd;
        }
        .table-bordered th,
        .table-bordered td {
          border: 1px solid #d0d5dd;
        }
        .btn-link-custom {
          color: #0d6efd;
          text-decoration: underline;
          cursor: pointer;
          font-weight: 600;
        }
        .hu-section-title {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 10px;
          border-bottom: 1.5px solid #e2e8f0;
          margin-bottom: 0;
        }
        .all-metrics-one-line {
          display: grid;
          grid-template-columns: repeat(8, minmax(0, 1fr));
          gap: 10px;
          margin-top: 4px;
          margin-bottom: 18px;
        }
        @media (max-width: 1279px) {
          .all-metrics-one-line {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .all-metrics-one-line {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-bottom: 14px;
          }
          .table-card {
            padding: 12px !important;
          }
          .scan-action-btn {
            flex: 1 1 auto;
            min-width: 140px;
            padding: 7px 10px;
          }
          .scan-btn-title {
            font-size: 12px !important;
          }
        }
        @media (max-width: 380px) {
          .all-metrics-one-line {
            grid-template-columns: 1fr;
          }
        }
        .hu-stat-card {
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 10px rgba(15, 23, 42, 0.03);
          padding: 12px 13px 11px;
          min-height: 98px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.18s ease, border-color 0.18s ease;
          min-width: 0;
          position: relative;
          overflow: hidden;
        }
        .hu-stat-card:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 10px 20px -6px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.05);
        }
        .hu-stat-accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          opacity: 0.9;
        }
        .hu-stat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }
        .hu-stat-label {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
          letter-spacing: 0.1px;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .hu-stat-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid rgba(15, 23, 42, 0.05);
        }
        .hu-stat-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-top: 8px;
        }
        .hu-stat-value {
          font-size: 24px;
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.5px;
          font-variant-numeric: tabular-nums;
        }
        .hu-stat-sub {
          font-size: 10.5px;
          font-weight: 600;
          color: #94a3b8;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>

      {/* Top Action Header */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-3">
        <DateRangePicker
          initialStartDate={startDate}
          initialEndDate={endDate}
          onApply={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
          onClear={() => {
            setStartDate(null);
            setEndDate(null);
          }}
        />

        <div className="d-flex align-items-center gap-2 flex-wrap">
          {canPut && (
            <button
              type="button"
              className="scan-action-btn scan-btn-put"
              onClick={() => setIsHUPutModalOpen(true)}
              title="Handling Unit PUT: Select floor bin to scan parts or send to Kardex"
            >
              <div className="scan-icon-pill put-pill">
                <PackagePlus size={16} />
              </div>
              <span className="scan-btn-title">Handling Unit PUT</span>
              <span className="scan-type-badge put-badge">PUT</span>
            </button>
          )}

          {canPick && (
            <button
              type="button"
              className="scan-action-btn scan-btn-pick"
              onClick={() => router.push('/app/pick')}
              title="Open Pick Workstation: Pick specific serials or batch allocate orders"
            >
              <div className="scan-icon-pill pick-pill">
                <PackageMinus size={16} />
              </div>
              <span className="scan-btn-title">Pick Workstation</span>
              <span className="scan-type-badge pick-badge">PICK</span>
            </button>
          )}
        </div>
      </div>

      {/* All Analytics + Handling Unit Overview Cards in One Line */}
      <div className="all-metrics-one-line">
        {[
          {
            label: 'Serial Scans',
            value: countsLoading ? '...' : counts?.validScanCount || 0,
            sub: 'verified scans',
            color: '#0f172a',
            accent: 'linear-gradient(90deg, #0284c7, #38bdf8)',
            iconBg: '#e0f2fe',
            iconColor: '#0284c7',
            icon: <Scan size={14} />,
          },
          {
            label: 'Total Parts',
            value: countsLoading ? '...' : totalPartsCount,
            sub: 'tracked units',
            color: '#0f172a',
            accent: 'linear-gradient(90deg, #059669, #34d399)',
            iconBg: '#ecfdf5',
            iconColor: '#059669',
            icon: <Package size={14} />,
          },
          {
            label: 'Total Bins',
            value: countsLoading ? '—' : counts?.totalHUs ?? 0,
            sub: 'registered',
            color: '#0f172a',
            accent: 'linear-gradient(90deg, #334155, #64748b)',
            iconBg: '#f1f5f9',
            iconColor: '#334155',
            icon: <Layers size={14} />,
          },
          {
            label: 'Draft',
            value: countsLoading ? '—' : counts?.draftHUs ?? 0,
            sub: 'on shop floor',
            color: '#475569',
            accent: 'linear-gradient(90deg, #64748b, #94a3b8)',
            iconBg: '#f1f5f9',
            iconColor: '#64748b',
            icon: <FileText size={14} />,
          },
          {
            label: 'Empty',
            value: countsLoading ? '—' : counts?.emptyHUs ?? 0,
            sub: '0% loaded',
            color: '#16a34a',
            accent: 'linear-gradient(90deg, #16a34a, #4ade80)',
            iconBg: '#dcfce7',
            iconColor: '#16a34a',
            icon: <Box size={14} />,
          },
          {
            label: 'Partial',
            value: countsLoading ? '—' : counts?.partialHUs ?? 0,
            sub: 'partially filled',
            color: '#d97706',
            accent: 'linear-gradient(90deg, #d97706, #fbbf24)',
            iconBg: '#fef3c7',
            iconColor: '#d97706',
            icon: <PackageSearch size={14} />,
          },
          {
            label: 'Full',
            value: countsLoading ? '—' : counts?.fullHUs ?? 0,
            sub: '100% capacity',
            color: '#059669',
            accent: 'linear-gradient(90deg, #059669, #10b981)',
            iconBg: '#d1fae5',
            iconColor: '#059669',
            icon: <CheckCircle2 size={14} />,
          },
          {
            label: 'Date Range',
            value: startDate ? startDate.toLocaleDateString() : 'All Time',
            sub: endDate ? `to ${endDate.toLocaleDateString()}` : 'to Now',
            isDate: true,
            color: '#0f172a',
            accent: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
            iconBg: '#fef3c7',
            iconColor: '#d97706',
            icon: <Calendar size={14} />,
          },
        ].map((card) => (
          <div key={card.label} className="hu-stat-card">
            <div className="hu-stat-accent-bar" style={{ background: card.accent }} />
            <div className="hu-stat-header">
              <div className="hu-stat-label" title={card.label}>
                {card.label}
              </div>
              <div
                className="hu-stat-icon"
                style={{ backgroundColor: card.iconBg, color: card.iconColor }}
              >
                {card.icon}
              </div>
            </div>
            <div className="hu-stat-body">
              <div
                className="hu-stat-value"
                style={{
                  color: card.color,
                  fontSize: card.isDate ? '16px' : '24px',
                  lineHeight: card.isDate ? '1.35' : '1.05',
                }}
                title={String(card.value)}
              >
                {card.value}
              </div>
              <div className="hu-stat-sub">{card.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Visual Analytics Row */}
      <div className="row mb-4 g-3">
        {/* Left Column: Part Scan Status */}
        <div className="col-lg-5 col-md-6 col-12">
          <div
            className="card shadow-sm p-3 h-100 d-flex flex-column justify-content-between"
            style={{ minHeight: '235px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1.5px solid #d0d5dd', boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 3px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03)' }}
          >
            {/* Header matching other cards */}
            <div className="d-flex justify-content-between align-items-center mb-1">
              <small className="text-muted fw-semibold" style={{ fontSize: '13px' }}>
                Part Scan Status
              </small>
              <div className="stat-icon-pill bg-emerald-light">
                <CheckCircle2 size={16} />
              </div>
            </div>

            {/* Middle: Centered Donut Chart with Center Number */}
            <div className="position-relative d-flex align-items-center justify-content-center my-auto" style={{ height: '115px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={totalScans === 0 ? [{ name: 'No Scans', value: 1, color: '#e2e8f0' }] : pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={52}
                    paddingAngle={totalScans > 0 ? 3 : 0}
                    dataKey="value"
                  >
                    {(totalScans === 0 ? [{ name: 'No Scans', value: 1, color: '#e2e8f0' }] : pieData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  {totalScans > 0 && <Tooltip />}
                </PieChart>
              </ResponsiveContainer>
              {/* Center text */}
              <div className="position-absolute text-center" style={{ pointerEvents: 'none' }}>
                <div className="fw-bold text-dark" style={{ fontSize: '18px', lineHeight: 1 }}>
                  {countsLoading ? '...' : totalScans}
                </div>
                <div className="text-muted" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Scans
                </div>
              </div>
            </div>

            {/* Bottom Stat Row */}
            <div className="row bottom-stat pt-2">
              <div className="col-6 border-r text-center">
                <h4 className="text-dark mb-0" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Valid Scans
                </h4>
                <h3 className="text-success fw-bold mb-0">
                  {countsLoading ? '...' : validScans}
                </h3>
              </div>

              <div className="col-6 text-center">
                <h4 className="text-dark mb-0" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Invalid Scans
                </h4>
                <h3 className={`fw-bold mb-0 ${invalidScans > 0 ? 'text-danger' : 'text-muted'}`}>
                  {countsLoading ? '...' : invalidScans}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Picked Parts Map Card */}
        <div className="col-lg-7 col-md-6 col-12">
          <div className="card shadow-sm map-card p-3 h-100 d-flex flex-column justify-content-between" style={{ minHeight: '235px', borderRadius: '8px', border: '1.5px solid #d0d5dd', boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 3px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03)' }}>
            {/* Header matching other cards */}
            <div className="d-flex justify-content-between align-items-center mb-1">
              <small className="text-muted fw-semibold" style={{ fontSize: '13px' }}>
                Picked Parts
              </small>
              <div className="stat-icon-pill bg-sky-light">
                <PackageMinus size={16} />
              </div>
            </div>

            {/* Middle: Big Blue Count over the Map */}
            <div className="text-center my-auto">
              <h3 className="text-primary fw-bold mb-0" style={{ fontSize: '36px', lineHeight: 1.1 }}>
                {countsLoading ? '...' : counts?.pickedPartsCount || 0}
              </h3>
            </div>

            {/* Bottom Stat Row */}
            <div className="row bottom-stat pt-2">
              <div className="col-6 border-r text-center">
                <h4 className="text-dark mb-0" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Hold
                </h4>
                <h3 className="text-warning fw-bold mb-0">
                  {countsLoading ? '...' : counts?.holdPartsCount || 0}
                </h3>
              </div>

              <div className="col-6 text-center">
                <h4 className="text-dark mb-0" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Available
                </h4>
                <h3 className="text-success fw-bold mb-0">
                  {countsLoading ? '...' : counts?.availablePartsCount || 0}
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Serial Numbers Data Table Card */}
      <div className="card table-card">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h5 className="fw-bold mb-0">Serial Numbers</h5>
            {debouncedSearch && (
              <span className="badge bg-light text-secondary border d-inline-flex align-items-center gap-1.5" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                <span>Searching: &ldquo;{debouncedSearch}&rdquo;</span>
                <span className="text-primary fw-bold">({totalItems})</span>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="btn btn-link p-0 text-muted ms-1"
                  style={{ lineHeight: 1 }}
                  title="Clear search filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap" style={{ width: 'auto' }}>
            <div className="position-relative" style={{ width: '300px', maxWidth: '100%' }}>
              <Search
                size={14}
                className="position-absolute text-muted"
                style={{ left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
              <input
                ref={searchInputRef}
                type="text"
                className="form-control form-control-sm"
                placeholder="Search serial, model, bin, PO, user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                style={{ paddingLeft: '32px', paddingRight: search ? '30px' : '10px' }}
              />
              {tableLoading && (
                <Loader2
                  size={13}
                  className="position-absolute text-primary spin-animation"
                  style={{ right: search ? '28px' : '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                />
              )}
              {search && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="btn btn-link p-0 text-muted position-absolute"
                  style={{ right: '8px', top: '50%', transform: 'translateY(-50%)' }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          {tableLoading ? (
            <Loader message="Loading inventory..." />
          ) : puts.length === 0 ? (
            <EmptyState
              title={debouncedSearch ? "No matching records found" : "No records found"}
              description={
                debouncedSearch
                  ? `No serial records matched "${debouncedSearch}". Try a different serial, model, or bin.`
                  : "No scan records available."
              }
              action={
                debouncedSearch ? (
                  <button className="btn btn-outline-secondary btn-sm mt-2" onClick={handleClearSearch}>
                    Clear Search
                  </button>
                ) : undefined
              }
            />
          ) : (
            <table className="table table-hover table-bordered align-middle" style={{ minWidth: '860px' }}>
              <thead>
                <tr>
                  <th>Serial Number</th>
                  <th>PV Status</th>
                  <th>Process Status</th>
                  <th>PO File</th>
                  <th>Model Number</th>
                  <th>Scanned By</th>
                  <th>PUT File</th>
                  <th>Pick Status</th>
                  <th>Pick File</th>
                </tr>
              </thead>
              <tbody>
                {puts.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="d-flex align-items-center justify-content-between gap-1">
                        <Link
                          href={`/app/logs/${encodeURIComponent(row.serial_number)}?putId=${row.id}`}
                          className="btn-link-custom text-decoration-none fw-semibold"
                          title="Click to view complete PUT & PICK process page"
                        >
                          {row.serial_number}
                        </Link>

                        <button
                          className="btn btn-sm p-1 border-0 text-muted ms-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (row.serial_number) {
                              copyToClipboard(row.serial_number);
                              setCopiedSerial(row.serial_number);
                              setTimeout(() => setCopiedSerial(null), 1500);
                            }
                          }}
                          title={copiedSerial === row.serial_number ? 'Copied!' : 'Copy Serial Number'}
                          style={{ lineHeight: 1 }}
                        >
                          {copiedSerial === row.serial_number ? (
                            <Check size={14} className="text-success" />
                          ) : (
                            <Copy size={13} className="text-secondary" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge ${row.pv_status === 'PASS'
                          ? 'bg-success'
                          : row.pv_status === 'FAIL'
                            ? 'bg-danger'
                            : 'bg-secondary'
                          }`}
                      >
                        {row.pv_status || '-'}
                      </span>
                    </td>
                    <td className="text-center">{renderProcessStatusBadge(row.process_status)}</td>
                    <td>
                      {row.put_po_file?.name ? (
                        <div className="d-flex align-items-center justify-content-between gap-1" style={{ maxWidth: '175px' }}>
                          {row.po_file_id || row.put_po_file.id ? (
                            <button
                              className="btn btn-link p-0 text-dark fw-semibold d-inline-flex align-items-center text-decoration-none text-start text-truncate"
                              style={{ fontSize: '13px' }}
                              onClick={() => handleDownloadPoFile((row.po_file_id || row.put_po_file?.id)!)}
                              title={`Click to download: ${row.put_po_file.name}`}
                            >
                              <FileText size={14} className="me-1 flex-shrink-0 text-secondary" />
                              <span className="text-truncate">{formatFileName(row.put_po_file.name, 18)}</span>
                            </button>
                          ) : (
                            <span
                              className="d-inline-flex align-items-center text-dark fw-semibold text-truncate"
                              style={{ fontSize: '13px' }}
                              title={row.put_po_file.name}
                            >
                              <FileText size={14} className="me-1 flex-shrink-0 text-secondary" />
                              <span className="text-truncate">{formatFileName(row.put_po_file.name, 18)}</span>
                            </span>
                          )}

                          <button
                            type="button"
                            className="btn btn-sm p-1 border-0 text-muted flex-shrink-0 ms-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (row.put_po_file?.name) {
                                copyToClipboard(row.put_po_file.name);
                                setCopiedPo(row.put_po_file.name);
                                setTimeout(() => setCopiedPo(null), 1500);
                              }
                            }}
                            title={copiedPo === row.put_po_file.name ? 'Copied PO!' : 'Copy full PO name'}
                            style={{ lineHeight: 1 }}
                          >
                            {copiedPo === row.put_po_file.name ? (
                              <Check size={14} className="text-success" />
                            ) : (
                              <Copy size={13} className="text-secondary" />
                            )}
                          </button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{row.model_number}</td>
                    <td>
                      {row.user_first_name
                        ? `${row.user_first_name} ${row.user_last_name || ''}`
                        : row.scanned_by}
                    </td>
                    <td>
                      {row.put_text_file?.name ? (
                        <button
                          className="btn btn-link p-0 text-primary fw-bold d-inline-flex align-items-center text-decoration-none"
                          style={{ fontSize: '13px', whiteSpace: 'nowrap' }}
                          onClick={() => handleDownloadPutFile(row.id)}
                          title={`Download: ${row.put_text_file.name}`}
                        >
                          <FileText size={14} className="me-1 flex-shrink-0" />
                          <span>{formatFileName(row.put_text_file.name, 22)}</span>
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge ${row.pick_status === 'AVAILABLE'
                          ? 'bg-success'
                          : row.pick_status === 'PICKED'
                            ? 'bg-warning'
                            : 'bg-danger'
                          }`}
                      >
                        {row.pick_status}
                      </span>
                    </td>
                    <td>
                      {row.pick?.pick_text_file?.name ? (
                        <button
                          className="btn btn-link p-0 text-info fw-bold d-inline-flex align-items-center text-decoration-none"
                          style={{ fontSize: '13px', whiteSpace: 'nowrap' }}
                          onClick={() => row.pick_id && handleDownloadPickFile(row.pick_id)}
                          title={`Download: ${row.pick.pick_text_file.name}`}
                        >
                          <FileText size={14} className="me-1 flex-shrink-0" />
                          <span>{formatFileName(row.pick.pick_text_file.name, 22)}</span>
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-3">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              setPage(p);
              fetchPuts(p, pageSize);
            }}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
              fetchPuts(1, newSize);
            }}
            pageSizeOptions={[20, 50, 100, 200]}
          />
        </div>
      </div>

      {/* Modals */}
      <HUPutModal
        isOpen={isHUPutModalOpen}
        onClose={() => setIsHUPutModalOpen(false)}
        onSuccess={() => {
          fetchCounts();
          fetchPuts(1);
        }}
      />

      <ScanModal
        isOpen={isPutModalOpen}
        onClose={() => setIsPutModalOpen(false)}
        onSuccess={() => {
          fetchCounts();
          fetchPuts(1);
        }}
      />

      <ScanAndStoreModal
        isOpen={isPickModalOpen}
        onClose={() => setIsPickModalOpen(false)}
        onSuccess={() => {
          fetchCounts();
          fetchPuts(1);
        }}
      />

      <PartScanLogsModal
        isOpen={isPartLogModalOpen}
        onClose={() => setIsPartLogModalOpen(false)}
        serialNumber={partLogSerial}
      />
    </div>
  );
}
