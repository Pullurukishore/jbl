'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, connectSSE } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { HandlingUnit, StorageStatus, HUStatus, HUListResponse, HUStats, Compartment } from '@/types/hu';
import { HUStatusBadge } from '@/components/bins/HUStatusBadge';
import { StorageStatusBadge } from '@/components/bins/StorageStatusBadge';
import { RegisterBinModal } from '@/components/bins/RegisterBinModal';
import { SendToKardexModal } from '@/components/bins/SendToKardexModal';
import { CompartmentGrid } from '@/components/bins/CompartmentGrid';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import {
  Package,
  PackagePlus,
  Boxes,
  Search,
  RefreshCw,
  Copy,
  Check,
  X,
  Layers,
  Sparkles,
  Barcode,
  Clock,
  Zap,
  ChevronRight,
  Table as TableIcon,
  LayoutGrid,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Maximize2,
  Minimize2,
  ArrowRight,
  ExternalLink,
  SlidersHorizontal,
  FolderDown,
  CheckSquare,
  Square,
} from 'lucide-react';

type SortOption = 'HU_ASC' | 'HU_DESC' | 'CAPACITY_DESC' | 'CAPACITY_ASC' | 'STATUS';
type ViewMode = 'TABLE' | 'CARDS';

export default function HUPutPage() {
  const router = useRouter();
  const { canPut, isLoading: authLoading } = useAuth();
  const [hus, setHus] = useState<HandlingUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50); // Default to 50 so 40 bins show without pagination
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters, Search & View
  const [storageFilter, setStorageFilter] = useState<StorageStatus | 'ALL'>('ALL');
  const [huStatusFilter, setHuStatusFilter] = useState<HUStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('HU_ASC');
  const [viewMode, setViewMode] = useState<ViewMode>('TABLE');
  const [copiedHuId, setCopiedHuId] = useState<string | null>(null);

  // Multi-select for batch operations across 40 bins
  const [selectedBinIds, setSelectedBinIds] = useState<string[]>([]);

  // Universal Barcode Scanner (Top Bar)
  const [universalScanInput, setUniversalScanInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const universalInputRef = useRef<HTMLInputElement>(null);

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

  // Modals & Slide-over Drawer
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [sendToKardexTargetHu, setSendToKardexTargetHu] = useState<HandlingUnit | null>(null);
  const [batchSending, setBatchSending] = useState(false);
  const [batchSendResults, setBatchSendResults] = useState<{ binId: string; file?: string; status: 'OK' | 'ERR'; message: string }[]>([]);

  // Rapid Put Station Drawer State (In-Page Fast Put)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDrawerHu, setActiveDrawerHu] = useState<HandlingUnit | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerSerialInput, setDrawerSerialInput] = useState('');
  const [drawerScanning, setDrawerScanning] = useState(false);
  const [drawerScanLog, setDrawerScanLog] = useState<{ status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS'; message: string } | null>(null);
  const drawerSerialInputRef = useRef<HTMLInputElement>(null);

  const fetchHUs = useCallback(
    async (
      pageNum = page,
      size = pageSize,
      storage = storageFilter,
      huStatus = huStatusFilter,
      search = searchQuery
    ) => {
      try {
        setLoading(true);
        const body: Record<string, unknown> = {
          page: pageNum,
          size: size,
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
    [page, pageSize, storageFilter, huStatusFilter, searchQuery]
  );

  useEffect(() => {
    if (!authLoading && !canPut) {
      router.replace('/error/403');
      return;
    }
    fetchHUs(1, pageSize, storageFilter, huStatusFilter, searchQuery);
  }, [authLoading, canPut, router, storageFilter, huStatusFilter, pageSize]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHUs(1, pageSize, storageFilter, huStatusFilter, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, pageSize]);

  // Refresh active drawer bin layout
  const refreshActiveDrawerBin = useCallback(async (huId: string) => {
    try {
      setDrawerLoading(true);
      const res = await apiGet<HandlingUnit>(`/hu/${encodeURIComponent(huId)}/layout`);
      setActiveDrawerHu(res);
      // Also update in main table list
      setHus((prev) => prev.map((item) => (item.hu_id === huId ? { ...item, ...res } : item)));
    } catch (e: any) {
      console.error('Failed to reload bin layout:', e);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  // Open Rapid Put Station Drawer
  const handleOpenDrawer = (hu: HandlingUnit) => {
    setActiveDrawerHu(hu);
    setDrawerOpen(true);
    setDrawerScanLog(null);
    setDrawerSerialInput('');
    refreshActiveDrawerBin(hu.hu_id);
    setTimeout(() => {
      drawerSerialInputRef.current?.focus();
    }, 200);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setActiveDrawerHu(null);
    setDrawerScanLog(null);
    setDrawerSerialInput('');
    fetchHUs(page, pageSize, storageFilter, huStatusFilter, searchQuery);
  };

  // Continuous Hands-Free Serial Scan inside Drawer
  const handleDrawerScanSerial = (e: React.FormEvent) => {
    e.preventDefault();
    const serial = drawerSerialInput.trim();
    if (!serial || !activeDrawerHu || drawerScanning) return;

    // Check if bin is full
    const comps = activeDrawerHu.compartments || [];
    const emptyComps = comps.filter((c) => c.status === 'EMPTY');
    if (comps.length > 0 && emptyComps.length === 0) {
      setDrawerScanLog({
        status: 'FAILED',
        message: `Handling Unit ${activeDrawerHu.hu_id} is 100% full (${comps.length}/${comps.length} slots occupied).`,
      });
      return;
    }

    setDrawerScanning(true);
    setDrawerScanLog({
      status: 'IN_PROGRESS',
      message: `Verifying MES PV status & board history for ${serial}...`,
    });

    const queryParams = new URLSearchParams();
    queryParams.append('hu_id', activeDrawerHu.hu_id);

    connectSSE(
      `/put/create/${encodeURIComponent(serial)}?${queryParams.toString()}`,
      (data: any) => {
        if (data && typeof data === 'object') {
          if (data.status === 'FAILED') {
            setDrawerScanLog({
              status: 'FAILED',
              message: data.message || `Failed to put serial ${serial}.`,
            });
            setDrawerScanning(false);
          }

          if (
            (data.activity === 'CHECKING_AVAILABILITY' ||
              data.activity === 'FILE_GENERATED' ||
              data.activity === 'ALLOCATE' ||
              data.activity === 'COMPLETE' ||
              data.completed === true) &&
            data.status === 'SUCCESS'
          ) {
            setDrawerScanLog({
              status: 'SUCCESS',
              message: `✓ Serial ${serial} verified & allocated to Bin ${activeDrawerHu.hu_id}!`,
            });
            setDrawerScanning(false);
            setDrawerSerialInput('');
            // Reload bin layout to show new occupied slot immediately
            refreshActiveDrawerBin(activeDrawerHu.hu_id);
            // Re-focus scanner field for next serial immediately
            setTimeout(() => {
              drawerSerialInputRef.current?.focus();
            }, 50);
          }
        }
      },
      () => {
        setDrawerScanning(false);
      },
      () => {
        setDrawerScanning(false);
      }
    );
  };

  // Universal Barcode Scan Handler (Top Bar)
  const handleUniversalScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = universalScanInput.trim();
    if (!barcode) return;

    // 1. Check if the scanned string matches a Bin ID (e.g. BIN-001 or hu_id)
    const matchingBin = hus.find(
      (h) => h.hu_id.toLowerCase() === barcode.toLowerCase()
    );

    if (matchingBin) {
      setScanFeedback({
        type: 'success',
        text: `Bin ${matchingBin.hu_id} recognized! Opening Rapid Put Station.`,
      });
      setUniversalScanInput('');
      handleOpenDrawer(matchingBin);
      return;
    }

    // 2. If it's a material serial number, find recommended bin:
    // First priority: Partially filled bin outside Kardex with matching model or capacity
    // Second priority: Empty bin outside Kardex
    const readyBins = hus.filter(
      (h) => (h.storage_status === 'OUTSIDE_KARDEX' || h.storage_status === 'DRAFT') && h.hu_status !== 'FULL'
    );

    if (readyBins.length > 0) {
      // Pick best partial bin or first empty bin
      const recommendedBin =
        readyBins.find((h) => h.hu_status === 'PARTIALLY_FILLED') || readyBins[0];

      setScanFeedback({
        type: 'info',
        text: `Scanned Material ${barcode}. Recommended destination: Bin ${recommendedBin.hu_id}. Opening Rapid Put.`,
      });
      setUniversalScanInput('');
      handleOpenDrawer(recommendedBin);
      // Pre-fill drawer serial input and auto-trigger
      setDrawerSerialInput(barcode);
    } else {
      setScanFeedback({
        type: 'error',
        text: `No open bins available outside Kardex for serial ${barcode}. Please register or retrieve an empty bin.`,
      });
    }
  };

  const handleCopyId = (huId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(huId);
    setCopiedHuId(huId);
    setTimeout(() => setCopiedHuId(null), 2000);
  };

  const handleRefresh = () => {
    fetchHUs(page, pageSize, storageFilter, huStatusFilter, searchQuery);
  };

  // Client-side sorting
  const sortedHUs = useMemo(() => {
    const list = [...hus];
    switch (sortBy) {
      case 'HU_ASC':
        return list.sort((a, b) => a.hu_id.localeCompare(b.hu_id));
      case 'HU_DESC':
        return list.sort((a, b) => b.hu_id.localeCompare(a.hu_id));
      case 'CAPACITY_DESC':
        return list.sort((a, b) => {
          const occA = (a.compartments || []).filter((c) => c.status === 'OCCUPIED').length;
          const occB = (b.compartments || []).filter((c) => c.status === 'OCCUPIED').length;
          return occB - occA;
        });
      case 'CAPACITY_ASC':
        return list.sort((a, b) => {
          const occA = (a.compartments || []).filter((c) => c.status === 'OCCUPIED').length;
          const occB = (b.compartments || []).filter((c) => c.status === 'OCCUPIED').length;
          return occA - occB;
        });
      case 'STATUS':
        return list.sort((a, b) => a.storage_status.localeCompare(b.storage_status));
      default:
        return list;
    }
  }, [hus, sortBy]);

  // Multi-bin selection helpers
  const handleToggleSelectBin = (huId: string) => {
    setSelectedBinIds((prev) =>
      prev.includes(huId) ? prev.filter((id) => id !== huId) : [...prev, huId]
    );
  };

  const handleSelectAllReady = () => {
    const readyIds = sortedHUs
      .filter((h) => (h.storage_status === 'OUTSIDE_KARDEX' || h.storage_status === 'DRAFT') && ((h.compartments || []).filter((c) => c.status === 'OCCUPIED').length > 0))
      .map((h) => h.hu_id);
    setSelectedBinIds(readyIds);
  };

  const handleClearSelection = () => {
    setSelectedBinIds([]);
  };

  // Batch Send Selected Bins to Kardex
  const handleBatchSendToKardex = async () => {
    if (selectedBinIds.length === 0) return;
    try {
      setBatchSending(true);
      setBatchSendResults([]);
      const results: { binId: string; file?: string; status: 'OK' | 'ERR'; message: string }[] = [];

      for (const binId of selectedBinIds) {
        try {
          const res = await apiPost<{ fileName?: string; file_name?: string; message?: string }>(
            `/hu/${encodeURIComponent(binId)}/send-to-kardex`
          );
          results.push({
            binId,
            file: res.fileName || res.file_name,
            status: 'OK',
            message: res.message || 'Dispatched to Kardex PPS.',
          });
        } catch (err: any) {
          results.push({
            binId,
            status: 'ERR',
            message: err.message || 'Failed to dispatch.',
          });
        }
      }
      setBatchSendResults(results);
      setSelectedBinIds([]);
      fetchHUs(page, pageSize, storageFilter, huStatusFilter, searchQuery);
    } catch (e: any) {
      alert(e.message || 'Batch Send failed');
    } finally {
      setBatchSending(false);
    }
  };

  // Helper to extract unique models contained inside a bin
  const getBinModelChips = (hu: HandlingUnit) => {
    const comps = hu.compartments || [];
    const models = comps
      .filter((c) => c.status === 'OCCUPIED' && c.material_name)
      .map((c) => c.material_name as string);

    if (models.length === 0) return null;

    const counts: Record<string, number> = {};
    models.forEach((m) => {
      counts[m] = (counts[m] || 0) + 1;
    });

    const entries = Object.entries(counts);
    const primary = entries[0];
    const extraCount = entries.length - 1;

    return (
      <div className="d-flex align-items-center gap-1 flex-wrap">
        <span
          style={{
            background: '#e0f2fe',
            color: '#0369a1',
            border: '1px solid #bae6fd',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 700,
            padding: '1px 6px',
            fontFamily: 'monospace',
          }}
        >
          {primary[0]} ({primary[1]})
        </span>
        {extraCount > 0 && (
          <span
            style={{
              background: '#f1f5f9',
              color: '#475569',
              borderRadius: '4px',
              fontSize: '10.5px',
              fontWeight: 600,
              padding: '1px 5px',
            }}
          >
            +{extraCount} more
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="hu-put-container">
      <style jsx>{`
        .hu-put-container {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          width: 100%;
          position: relative;
        }

        /* Top Header Card */
        .page-header-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.25rem 1.5rem;
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
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.28);
          flex-shrink: 0;
        }

        .page-title {
          font-size: 21px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.3px;
          margin: 0;
          line-height: 1.2;
        }

        .page-subtitle {
          font-size: 12.5px;
          color: #64748b;
          margin-top: 3px;
          margin-bottom: 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .btn-reload {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
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
          padding: 7px 16px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
        }

        .btn-register-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
        }

        /* Universal Barcode Scanner Command Center */
        .universal-scanner-card {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 1rem 1.25rem;
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        }

        .scanner-inner-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .scanner-label-cluster {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 220px;
        }

        .scanner-pulse-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: rgba(59, 130, 246, 0.25);
          color: #60a5fa;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(96, 165, 250, 0.3);
        }

        .scanner-form-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 280px;
        }

        .scanner-input-field {
          width: 100%;
          background: #020617;
          border: 1.5px solid #3b82f6;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 14px;
          font-family: monospace;
          color: #38bdf8;
          font-weight: 700;
          outline: none;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.25);
          transition: all 0.2s ease;
        }

        .scanner-input-field:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 18px rgba(59, 130, 246, 0.45);
        }

        .scanner-submit-btn {
          background: #2563eb;
          border: none;
          color: #ffffff;
          font-weight: 700;
          font-size: 13px;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .scanner-submit-btn:hover {
          background: #1d4ed8;
        }

        /* 4 Interactive Stats Cards */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 0.75rem;
          width: 100%;
        }

        .interactive-stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0.85rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
          user-select: none;
        }

        .interactive-stat-card:hover {
          transform: translateY(-1.5px);
          border-color: #cbd5e1;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
        }

        .interactive-stat-card.active-stat {
          border-color: #2563eb;
          background: #f8faff;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2), 0 3px 8px rgba(37, 99, 235, 0.06);
        }

        .stat-label {
          font-size: 10.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          margin-bottom: 2px;
        }

        .stat-value {
          font-size: 22px;
          font-weight: 800;
          line-height: 1.1;
        }

        .stat-icon-well {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Main Workspace Card */
        .table-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.25rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        /* Toolbar */
        .table-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 1rem;
          padding-bottom: 0.85rem;
          border-bottom: 1px solid #f1f5f9;
        }

        .toolbar-left-cluster {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .select-filter-control {
          padding: 6px 10px;
          font-size: 12px;
          border-radius: 7px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
          font-weight: 600;
          outline: none;
          cursor: pointer;
        }

        .view-mode-toggle {
          display: inline-flex;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 7px;
          padding: 2px;
          gap: 2px;
        }

        .view-btn {
          border: none;
          background: transparent;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 5px;
          color: #64748b;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
        }

        .view-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
          font-weight: 700;
        }

        .toolbar-right-cluster {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .search-box-wrapper {
          position: relative;
          min-width: 220px;
        }

        .search-input-field {
          width: 100%;
          padding: 6px 30px 6px 30px;
          font-size: 12px;
          border-radius: 7px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          outline: none;
        }

        .search-input-field:focus {
          background: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
        }

        .search-icon-affix {
          position: absolute;
          left: 9px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .search-clear-btn {
          position: absolute;
          right: 7px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
        }

        /* 40 Bins High-Density Table */
        .dense-table-container {
          max-height: 580px;
          overflow-y: auto;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .hu-put-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 12.5px;
          background: #ffffff;
        }

        .hu-put-table th {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #f8fafc;
          color: #475569;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 9px 12px;
          border-bottom: 1.5px solid #cbd5e1;
          white-space: nowrap;
          text-align: left;
          user-select: none;
        }

        .hu-put-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          color: #1e293b;
        }

        .hu-put-table tr.table-row-item:hover td {
          background: #f8faff;
        }

        .hu-put-table tr.selected-row td {
          background: #eff6ff !important;
        }

        .hu-id-capsule {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #eff6ff;
          border: 1px solid #dbeafe;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .hu-id-link {
          font-family: monospace;
          font-weight: 700;
          font-size: 12.5px;
          color: #1d4ed8;
          text-decoration: none;
        }

        .hu-id-link:hover {
          text-decoration: underline;
        }

        /* Capacity Bar */
        .capacity-cell-wrap {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 130px;
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

        /* Operator Action Buttons */
        .btn-rapid-put {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          color: #ffffff;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(37, 99, 235, 0.25);
          transition: all 0.15s ease;
        }

        .btn-rapid-put:hover {
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(37, 99, 235, 0.35);
        }

        .btn-send-kardex-sm {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #166534;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-send-kardex-sm:hover {
          background: #dcfce7;
          border-color: #86efac;
        }

        /* Sticky Batch Action Bar */
        .batch-sticky-bar {
          position: sticky;
          bottom: 12px;
          z-index: 40;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #ffffff;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.25s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        /* Slide-over Drawer for Rapid Put Station */
        .drawer-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
          animation: fadeIn 0.2s ease;
        }

        .drawer-panel {
          width: 100%;
          max-width: 620px;
          height: 100%;
          background: #ffffff;
          box-shadow: -4px 0 25px rgba(0, 0, 0, 0.25);
          display: flex;
          flex-direction: column;
          animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .drawer-header {
          padding: 1.15rem 1.35rem;
          background: #0f172a;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #1e293b;
        }

        .drawer-body {
          padding: 1.25rem;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
          background: #f8fafc;
        }

        .drawer-footer {
          padding: 1rem 1.25rem;
          background: #ffffff;
          border-top: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
      `}</style>

      {/* Top Header Card */}
      <div className="page-header-card">
        <div className="header-title-wrap">
          <div className="header-icon-box">
            <PackagePlus size={24} />
          </div>
          <div>
            <h1 className="page-title">Handling Unit (HU) Put Workstation</h1>
            <p className="page-subtitle">
              Scalable multi-bin put management for 40+ bins with hands-free continuous scanning and Kardex dispatch.
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn-reload" onClick={handleRefresh} title="Sync latest status from server">
            <RefreshCw size={13} className={loading ? 'spin-animation' : ''} />
            Refresh
          </button>
          <button className="btn-register-primary" onClick={() => setIsRegisterOpen(true)}>
            <PackagePlus size={15} /> Register New Bin
          </button>
        </div>
      </div>

      {/* Universal Barcode Scanner Command Bar */}
      <div className="universal-scanner-card">
        <div className="scanner-inner-row">
          <div className="scanner-label-cluster">
            <div className="scanner-pulse-icon">
              <Barcode size={20} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
                Quick Scan Command Bar
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                Scan Bin Barcode or Board Serial Number
              </div>
            </div>
          </div>

          <form className="scanner-form-wrap" onSubmit={handleUniversalScan}>
            <input
              ref={universalInputRef}
              type="text"
              className="scanner-input-field"
              placeholder="Scan Barcode (e.g. BIN-001 or SA005157...)"
              value={universalScanInput}
              onChange={(e) => setUniversalScanInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="scanner-submit-btn">
              <Zap size={14} /> Scan & Action
            </button>
          </form>
        </div>

        {scanFeedback && (
          <div
            style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background:
                scanFeedback.type === 'success'
                  ? 'rgba(34, 197, 94, 0.2)'
                  : scanFeedback.type === 'error'
                  ? 'rgba(239, 68, 68, 0.2)'
                  : 'rgba(59, 130, 246, 0.2)',
              color:
                scanFeedback.type === 'success'
                  ? '#4ade80'
                  : scanFeedback.type === 'error'
                  ? '#f87171'
                  : '#60a5fa',
              border:
                scanFeedback.type === 'success'
                  ? '1px solid rgba(34, 197, 94, 0.4)'
                  : scanFeedback.type === 'error'
                  ? '1px solid rgba(239, 68, 68, 0.4)'
                  : '1px solid rgba(59, 130, 246, 0.4)',
            }}
          >
            {scanFeedback.type === 'success' ? (
              <CheckCircle2 size={15} />
            ) : scanFeedback.type === 'error' ? (
              <AlertCircle size={15} />
            ) : (
              <Sparkles size={15} />
            )}
            <span>{scanFeedback.text}</span>
            <button
              onClick={() => setScanFeedback(null)}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* 4 Interactive Quick Filter Stats */}
      <div className="stats-grid">
        {/* Total Bins */}
        <div
          className={`interactive-stat-card ${huStatusFilter === 'ALL' && storageFilter === 'ALL' ? 'active-stat' : ''}`}
          onClick={() => {
            setStorageFilter('ALL');
            setHuStatusFilter('ALL');
          }}
          title="Click to show all handling units"
        >
          <div>
            <div className="stat-label">Total Bins</div>
            <div className="stat-value" style={{ color: '#0f172a' }}>
              {stats.total || totalItems}
            </div>
          </div>
          <div className="stat-icon-well" style={{ background: '#f1f5f9', color: '#475569' }}>
            <Boxes size={18} />
          </div>
        </div>

        {/* Ready Outside Kardex */}
        <div
          className={`interactive-stat-card ${storageFilter === 'OUTSIDE_KARDEX' ? 'active-stat' : ''}`}
          onClick={() => setStorageFilter(storageFilter === 'OUTSIDE_KARDEX' ? 'ALL' : 'OUTSIDE_KARDEX')}
          title="Filter bins ready outside Kardex for putting materials"
        >
          <div>
            <div className="stat-label">Outside Kardex (Ready)</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>
              {stats.outsideKardex}
            </div>
          </div>
          <div className="stat-icon-well" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Zap size={18} />
          </div>
        </div>

        {/* Partially Filled */}
        <div
          className={`interactive-stat-card ${huStatusFilter === 'PARTIALLY_FILLED' ? 'active-stat' : ''}`}
          onClick={() => setHuStatusFilter(huStatusFilter === 'PARTIALLY_FILLED' ? 'ALL' : 'PARTIALLY_FILLED')}
          title="Filter partially filled bins"
        >
          <div>
            <div className="stat-label">Partially Filled</div>
            <div className="stat-value" style={{ color: '#ea580c' }}>
              {stats.partial}
            </div>
          </div>
          <div className="stat-icon-well" style={{ background: '#fff7ed', color: '#ea580c' }}>
            <Package size={18} />
          </div>
        </div>

        {/* Full (Ready to Dispatch) */}
        <div
          className={`interactive-stat-card ${huStatusFilter === 'FULL' ? 'active-stat' : ''}`}
          onClick={() => setHuStatusFilter(huStatusFilter === 'FULL' ? 'ALL' : 'FULL')}
          title="Filter 100% full bins ready for Kardex storage"
        >
          <div>
            <div className="stat-label">Full (100%)</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>
              {stats.full}
            </div>
          </div>
          <div className="stat-icon-well" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <CheckCircle2 size={18} />
          </div>
        </div>
      </div>

      {/* Main Workspace Card */}
      <div className="table-card">
        {/* Table Toolbar */}
        <div className="table-toolbar">
          <div className="toolbar-left-cluster">
            {/* Fill Level Filter */}
            <select
              className="select-filter-control"
              value={huStatusFilter}
              onChange={(e) => setHuStatusFilter(e.target.value as HUStatus | 'ALL')}
            >
              <option value="ALL">All Fill Levels</option>
              <option value="EMPTY">Only Empty (0%)</option>
              <option value="PARTIALLY_FILLED">Partially Filled</option>
              <option value="FULL">Full (100%)</option>
            </select>

            {/* Storage Location Filter */}
            <select
              className="select-filter-control"
              value={storageFilter}
              onChange={(e) => setStorageFilter(e.target.value as StorageStatus | 'ALL')}
            >
              <option value="ALL">All Storage Locations</option>
              <option value="OUTSIDE_KARDEX">Outside Kardex (On Floor)</option>
              <option value="IN_KARDEX">Inside Kardex (ASRS)</option>
              <option value="DRAFT">Draft</option>
            </select>

            {/* Sort Control */}
            <select
              className="select-filter-control"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="HU_ASC">Sort: Bin ID (A-Z)</option>
              <option value="HU_DESC">Sort: Bin ID (Z-A)</option>
              <option value="CAPACITY_DESC">Sort: Most Filled First</option>
              <option value="CAPACITY_ASC">Sort: Least Filled First</option>
            </select>

            {/* Page Size Switcher for 40 Bins */}
            <select
              className="select-filter-control"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              title="Show up to 50 or 100 bins without pagination"
            >
              <option value={20}>20 Bins/page</option>
              <option value={50}>50 Bins (All 40)</option>
              <option value={100}>100 Bins</option>
            </select>

            {/* View Mode Toggle */}
            <div className="view-mode-toggle">
              <button
                className={`view-btn ${viewMode === 'TABLE' ? 'active' : ''}`}
                onClick={() => setViewMode('TABLE')}
                title="Dense table view for 40+ bins"
              >
                <TableIcon size={13} /> Dense Table
              </button>
              <button
                className={`view-btn ${viewMode === 'CARDS' ? 'active' : ''}`}
                onClick={() => setViewMode('CARDS')}
                title="Grid cards view"
              >
                <LayoutGrid size={13} /> Cards
              </button>
            </div>
          </div>

          <div className="toolbar-right-cluster">
            {/* Quick multi-select action */}
            <button
              className="btn-reload"
              onClick={selectedBinIds.length > 0 ? handleClearSelection : handleSelectAllReady}
              style={{ fontSize: '11.5px', padding: '5px 10px' }}
            >
              {selectedBinIds.length > 0 ? 'Clear Selection' : 'Select All Ready Bins'}
            </button>

            {/* Search Box */}
            <div className="search-box-wrapper">
              <Search size={13} className="search-icon-affix" />
              <input
                type="text"
                className="search-input-field"
                placeholder="Filter by Bin ID, Model, PPS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600 }}>
              {sortedHUs.length} {sortedHUs.length === 1 ? 'bin' : 'bins'}
            </span>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <Loader message="Loading handling units for Put operations..." />
        ) : sortedHUs.length === 0 ? (
          <EmptyState
            title="No Handling Units Found"
            description={
              searchQuery || storageFilter !== 'ALL' || huStatusFilter !== 'ALL'
                ? 'No bins match your current filters. Try resetting the filters or clearing the search.'
                : 'No handling units are available for Put operations. Click "Register New Bin" to add a new physical bin.'
            }
          />
        ) : viewMode === 'TABLE' ? (
          /* High-Density Table for 40 Bins */
          <div className="dense-table-container">
            <table className="hu-put-table">
              <thead>
                <tr>
                  <th style={{ width: '36px' }}>
                    <input
                      type="checkbox"
                      checked={selectedBinIds.length === sortedHUs.length && sortedHUs.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBinIds(sortedHUs.map((h) => h.hu_id));
                        } else {
                          setSelectedBinIds([]);
                        }
                      }}
                      title="Select / Deselect all"
                    />
                  </th>
                  <th>Handling Unit ID</th>
                  <th>Type & PPS Station</th>
                  <th>Compartment Load</th>
                  <th>Models Stored</th>
                  <th>Storage Location</th>
                  <th>HU Status</th>
                  <th style={{ textAlign: 'right' }}>Operator Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedHUs.map((hu) => {
                  const compartments = hu.compartments || [];
                  const total = compartments.length || hu.bin_type?.compartment_count || 30;
                  const occupied = compartments.filter((c) => c.status === 'OCCUPIED').length;
                  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
                  const isSelected = selectedBinIds.includes(hu.hu_id);

                  const isOutsideOrDraft =
                    hu.storage_status === 'DRAFT' || hu.storage_status === 'OUTSIDE_KARDEX';
                  const canSendToKardex = isOutsideOrDraft && occupied > 0;

                  const fillColor =
                    pct === 100 ? '#10b981' : pct > 0 ? '#2563eb' : '#cbd5e1';

                  return (
                    <tr
                      key={hu.id}
                      className={`table-row-item ${isSelected ? 'selected-row' : ''}`}
                    >
                      {/* Checkbox */}
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectBin(hu.hu_id)}
                        />
                      </td>

                      {/* Bin ID Capsule */}
                      <td>
                        <div className="d-flex align-items-center gap-1.5">
                          <div className="hu-id-capsule">
                            <Barcode size={12} className="text-primary flex-shrink-0" />
                            <span className="hu-id-link">{hu.hu_id}</span>
                          </div>
                          <button
                            className="btn-reload"
                            style={{ padding: '2px 4px', border: 'none', background: 'transparent' }}
                            onClick={(e) => handleCopyId(hu.hu_id, e)}
                            title="Copy Bin ID"
                          >
                            {copiedHuId === hu.hu_id ? (
                              <Check size={12} className="text-success" />
                            ) : (
                              <Copy size={12} className="text-muted" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Spec & PPS */}
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '12px' }}>
                          {hu.bin_type?.name || `Type #${hu.bin_type_id}`}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          PPS: {hu.bin_type?.bin_name || 'CON_BINA'}
                        </div>
                      </td>

                      {/* Compartment Load with Mini Progress Meter */}
                      <td>
                        <div className="capacity-cell-wrap">
                          <div className="d-flex align-items-center justify-content-between" style={{ fontSize: '11.5px' }}>
                            <span>
                              <strong style={{ color: occupied > 0 ? '#16a34a' : '#64748b' }}>
                                {occupied}
                              </strong>
                              <span className="text-muted"> / {total} slots</span>
                            </span>
                            <span
                              style={{
                                fontWeight: 800,
                                color: pct === 100 ? '#15803d' : pct > 0 ? '#1d4ed8' : '#64748b',
                              }}
                            >
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

                      {/* Stored Models Preview */}
                      <td>{getBinModelChips(hu) || <span className="text-muted" style={{ fontSize: '11.5px' }}>Empty</span>}</td>

                      {/* Storage Status */}
                      <td>
                        <StorageStatusBadge status={hu.storage_status} />
                      </td>

                      {/* HU Status */}
                      <td>
                        <HUStatusBadge status={hu.hu_status} />
                      </td>

                      {/* Operator Actions */}
                      <td>
                        <div className="d-flex align-items-center justify-content-end gap-1.5">
                          {/* 1-Click Rapid Put (Opens In-Page Drawer) */}
                          <button
                            className="btn-rapid-put"
                            onClick={() => handleOpenDrawer(hu)}
                            title="Open hands-free rapid continuous scan station"
                          >
                            <Zap size={13} />
                            <span>Rapid Put</span>
                          </button>

                          {/* Send to Kardex direct button */}
                          {canSendToKardex && (
                            <button
                              className="btn-send-kardex-sm"
                              onClick={() => setSendToKardexTargetHu(hu)}
                              title="Generate Kardex PUT file and store bin in Kardex"
                            >
                              <Send size={12} />
                              <span>To Kardex</span>
                            </button>
                          )}

                          {/* Full Page Link */}
                          <Link
                            href={`/app/bins/${hu.hu_id}`}
                            className="btn-reload"
                            style={{ padding: '5px 8px' }}
                            title="View complete bin detail and slot history"
                          >
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Cards Grid View */
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '12px',
            }}
          >
            {sortedHUs.map((hu) => {
              const compartments = hu.compartments || [];
              const total = compartments.length || hu.bin_type?.compartment_count || 30;
              const occupied = compartments.filter((c) => c.status === 'OCCUPIED').length;
              const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
              const isSelected = selectedBinIds.includes(hu.hu_id);
              const isOutsideOrDraft =
                hu.storage_status === 'DRAFT' || hu.storage_status === 'OUTSIDE_KARDEX';
              const canSendToKardex = isOutsideOrDraft && occupied > 0;

              return (
                <div
                  key={hu.id}
                  style={{
                    background: '#ffffff',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectBin(hu.hu_id)}
                      />
                      <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#1d4ed8' }}>
                        {hu.hu_id}
                      </span>
                    </div>
                    <HUStatusBadge status={hu.hu_status} />
                  </div>

                  <div className="d-flex align-items-center justify-content-between text-muted" style={{ fontSize: '11.5px' }}>
                    <span>{hu.bin_type?.name || 'Standard Tote'}</span>
                    <StorageStatusBadge status={hu.storage_status} />
                  </div>

                  {/* Capacity Bar */}
                  <div className="capacity-cell-wrap">
                    <div className="d-flex align-items-center justify-content-between" style={{ fontSize: '11.5px' }}>
                      <span>{occupied} of {total} slots</span>
                      <strong>{pct}%</strong>
                    </div>
                    <div className="mini-track">
                      <div
                        className="mini-fill"
                        style={{
                          width: `${pct}%`,
                          background: pct === 100 ? '#10b981' : '#2563eb',
                        }}
                      />
                    </div>
                  </div>

                  {getBinModelChips(hu)}

                  <div className="d-flex align-items-center gap-2 mt-1">
                    <button
                      className="btn-rapid-put"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={() => handleOpenDrawer(hu)}
                    >
                      <Zap size={13} /> Rapid Put
                    </button>
                    {canSendToKardex && (
                      <button
                        className="btn-send-kardex-sm"
                        onClick={() => setSendToKardexTargetHu(hu)}
                        title="Send to Kardex"
                      >
                        <Send size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-3">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              setPage(p);
              fetchHUs(p, pageSize, storageFilter, huStatusFilter, searchQuery);
            }}
            totalItems={totalItems}
            pageSize={pageSize}
          />
        </div>
      </div>

      {/* Sticky Batch Action Bar (Appears when 1 or more bins are checked) */}
      {selectedBinIds.length > 0 && (
        <div className="batch-sticky-bar">
          <div className="d-flex align-items-center gap-3">
            <CheckSquare size={18} className="text-primary" />
            <div>
              <span style={{ fontWeight: 800, fontSize: '14px' }}>
                {selectedBinIds.length} {selectedBinIds.length === 1 ? 'Bin' : 'Bins'} Selected
              </span>
              <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                Batch actions across physical storage floor
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              className="btn-reload"
              onClick={handleClearSelection}
              style={{ background: '#1e293b', color: '#e2e8f0', borderColor: '#475569' }}
            >
              Clear
            </button>
            <button
              className="btn-register-primary"
              onClick={handleBatchSendToKardex}
              disabled={batchSending}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
              }}
            >
              {batchSending ? (
                <>
                  <Loader2 size={14} className="spin-animation" /> Dispatching...
                </>
              ) : (
                <>
                  <Send size={14} /> Batch Send {selectedBinIds.length} Bins to Kardex
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Slide-over Drawer: Hands-Free Rapid Put Station */}
      {drawerOpen && activeDrawerHu && (
        <div className="drawer-backdrop" onClick={handleCloseDrawer}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="drawer-header">
              <div className="d-flex align-items-center gap-2">
                <Zap size={20} className="text-warning" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px' }}>
                    Rapid Put Station — {activeDrawerHu.hu_id}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                    {activeDrawerHu.bin_type?.name || '30-Slot ESD Tote'} (PPS:{' '}
                    {activeDrawerHu.bin_type?.bin_name || 'CON_BINA'})
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                {/* 1-Click Send to Kardex from Drawer */}
                {(activeDrawerHu.compartments || []).some((c) => c.status === 'OCCUPIED') && (
                  <button
                    className="btn-send-kardex-sm"
                    style={{ background: '#10b981', color: '#ffffff', borderColor: '#059669' }}
                    onClick={() => {
                      setSendToKardexTargetHu(activeDrawerHu);
                    }}
                    title="Generate Kardex Put File"
                  >
                    <Send size={12} /> Send Bin to Kardex
                  </button>
                )}
                <button
                  onClick={handleCloseDrawer}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="drawer-body">
              {/* Hands-Free Scanner Bar */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #2563eb',
                  borderRadius: '10px',
                  padding: '1rem',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)',
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <Barcode size={18} className="text-primary" />
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                      Hands-Free Continuous Scan
                    </strong>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      padding: '2px 8px',
                      borderRadius: '5px',
                      fontWeight: 700,
                    }}
                  >
                    Auto-Slotting Active
                  </span>
                </div>

                <form onSubmit={handleDrawerScanSerial} className="d-flex gap-2">
                  <input
                    ref={drawerSerialInputRef}
                    type="text"
                    className="scanner-input-field"
                    style={{
                      background: '#ffffff',
                      color: '#0f172a',
                      border: '1.5px solid #cbd5e1',
                    }}
                    placeholder="Scan Board Serial (e.g. SA00515701...)"
                    value={drawerSerialInput}
                    onChange={(e) => setDrawerSerialInput(e.target.value)}
                    disabled={drawerScanning}
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="btn-rapid-put"
                    disabled={drawerScanning || !drawerSerialInput.trim()}
                    style={{ padding: '0 18px' }}
                  >
                    {drawerScanning ? (
                      <Loader2 size={16} className="spin-animation" />
                    ) : (
                      <Zap size={16} />
                    )}
                    <span>Put</span>
                  </button>
                </form>

                {/* Scan Status Log Notification */}
                {drawerScanLog && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background:
                        drawerScanLog.status === 'SUCCESS'
                          ? '#f0fdf4'
                          : drawerScanLog.status === 'FAILED'
                          ? '#fef2f2'
                          : '#eff6ff',
                      color:
                        drawerScanLog.status === 'SUCCESS'
                          ? '#15803d'
                          : drawerScanLog.status === 'FAILED'
                          ? '#b91c1c'
                          : '#1d4ed8',
                      border: `1px solid ${
                        drawerScanLog.status === 'SUCCESS'
                          ? '#bbf7d0'
                          : drawerScanLog.status === 'FAILED'
                          ? '#fecaca'
                          : '#bfdbfe'
                      }`,
                    }}
                  >
                    {drawerScanLog.status === 'SUCCESS' ? (
                      <CheckCircle2 size={15} />
                    ) : drawerScanLog.status === 'FAILED' ? (
                      <AlertCircle size={15} />
                    ) : (
                      <Loader2 size={15} className="spin-animation" />
                    )}
                    <span>{drawerScanLog.message}</span>
                  </div>
                )}
              </div>

              {/* Real-time 30-Slot Compartment Tote Grid */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <Layers size={16} className="text-muted" />
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                      Real-Time Compartment Matrix
                    </strong>
                  </div>
                  <span className="text-muted" style={{ fontSize: '11.5px' }}>
                    {(activeDrawerHu.compartments || []).filter((c) => c.status === 'OCCUPIED').length} of{' '}
                    {(activeDrawerHu.compartments || []).length || 30} slots occupied
                  </span>
                </div>

                {drawerLoading ? (
                  <Loader message="Refreshing tote slots..." />
                ) : (
                  <CompartmentGrid
                    compartments={activeDrawerHu.compartments || []}
                    huId={activeDrawerHu.hu_id}
                    binName={activeDrawerHu.bin_type?.bin_name}
                    binType={activeDrawerHu.bin_type?.name}
                    onSelectEmpty={(slotNum) => {
                      // Clicking an empty slot pre-selects it
                      drawerSerialInputRef.current?.focus();
                    }}
                  />
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="drawer-footer">
              <Link
                href={`/app/bins/${activeDrawerHu.hu_id}`}
                className="btn-reload"
                style={{ fontSize: '12px' }}
              >
                Open Full Detail Page <ChevronRight size={13} />
              </Link>
              <button className="btn-reload" onClick={handleCloseDrawer}>
                Done & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send to Kardex Modal */}
      {sendToKardexTargetHu && (
        <SendToKardexModal
          isOpen={!!sendToKardexTargetHu}
          hu={sendToKardexTargetHu}
          onClose={() => setSendToKardexTargetHu(null)}
          onSuccess={() => {
            setSendToKardexTargetHu(null);
            fetchHUs(page, pageSize, storageFilter, huStatusFilter, searchQuery);
            if (activeDrawerHu) {
              refreshActiveDrawerBin(activeDrawerHu.hu_id);
            }
          }}
        />
      )}

      {/* Register New Bin Modal */}
      <RegisterBinModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={() => fetchHUs(page, pageSize, storageFilter, huStatusFilter, searchQuery)}
      />
    </div>
  );
}
