'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { HandlingUnit, Compartment } from '@/types/hu';
import { HUStatusBadge } from '@/components/bins/HUStatusBadge';
import { StorageStatusBadge } from '@/components/bins/StorageStatusBadge';
import { CompartmentGrid } from '@/components/bins/CompartmentGrid';
import { ScanModal } from '@/components/dashboard/ScanModal';
import { ScanPickModal } from '@/components/bins/ScanPickModal';
import { SendToKardexModal } from '@/components/bins/SendToKardexModal';
import { HUPickModal } from '@/components/bins/HUPickModal';
import { Modal } from '@/components/shared/Modal';
import { Loader } from '@/components/shared/Loader';
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  Info,
  RefreshCw,
  Copy,
  Check,
  Layers,
  Inbox,
  Boxes,
  Barcode,
  Search,
  PackagePlus,
  PackageSearch,
  PackageMinus,
} from 'lucide-react';

interface HUDetailPageProps {
  params: Promise<{ huId: string }>;
}

export default function HUDetailPage({ params }: HUDetailPageProps) {
  const { huId } = React.use(params);
  const router = useRouter();

  const [hu, setHu] = useState<HandlingUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Filters & Search for bin compartments
  const [filterMode, setFilterMode] = useState<'ALL' | 'EMPTY' | 'OCCUPIED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedCompartment, setSelectedCompartment] = useState<number | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isScanPickModalOpen, setIsScanPickModalOpen] = useState(false);
  const [selectedPickCompartment, setSelectedPickCompartment] = useState<number | null>(null);
  const [isSendToKardexOpen, setIsSendToKardexOpen] = useState(false);
  const [isHUPickOpen, setIsHUPickOpen] = useState(false);
  const [isPickAllConfirmOpen, setIsPickAllConfirmOpen] = useState(false);
  const [pickingAll, setPickingAll] = useState(false);
  const [pickCompartmentTarget, setPickCompartmentTarget] = useState<Compartment | null>(null);
  const [pickingSlot, setPickingSlot] = useState(false);
  const [sendingPick, setSendingPick] = useState(false);
  const [pickSendSuccess, setPickSendSuccess] = useState<string | null>(null);

  const handleSendPickToKardex = async () => {
    if (!hu) return;
    try {
      setSendingPick(true);
      setPickSendSuccess(null);
      const res = await apiPost<{ message: string; fileName: string; lineCount: number }>(
        `/hu/${encodeURIComponent(hu.hu_id)}/send-pick-to-kardex`
      );
      setPickSendSuccess(
        `Kardex Pick Order file "${res.fileName}" generated for ${res.lineCount} part(s)! Transmitted to Kardex PPS.`
      );
      fetchLayout();
    } catch (err: any) {
      alert(err.message || 'Failed to send pick order to Kardex');
    } finally {
      setSendingPick(false);
    }
  };

  const fetchLayout = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiGet<HandlingUnit>(`/hu/${encodeURIComponent(huId)}/layout`);
      setHu(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load bin details');
    } finally {
      setLoading(false);
    }
  }, [huId]);

  const handlePickAll = async () => {
    if (!hu) return;
    try {
      setPickingAll(true);
      await apiPost(`/hu/${encodeURIComponent(hu.hu_id)}/pick-all`);
      setIsPickAllConfirmOpen(false);
      fetchLayout();
    } catch (err: any) {
      alert(err.message || 'Failed to pick all parts');
    } finally {
      setPickingAll(false);
    }
  };

  const handlePickCompartment = async () => {
    if (!hu || !pickCompartmentTarget) return;
    try {
      setPickingSlot(true);
      await apiPost(`/hu/${encodeURIComponent(hu.hu_id)}/compartment/${pickCompartmentTarget.compartment_number}/pick`);
      setPickCompartmentTarget(null);
      fetchLayout();
    } catch (err: any) {
      alert(err.message || 'Failed to pick part from compartment');
    } finally {
      setPickingSlot(false);
    }
  };

  useEffect(() => {
    fetchLayout();
  }, [fetchLayout]);

  const handleCopyId = () => {
    if (!hu) return;
    navigator.clipboard.writeText(hu.hu_id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSelectEmpty = (compartmentNumber: number) => {
    if (!hu) return;
    if (hu.storage_status === 'IN_KARDEX') return; // locked while inside Kardex
    setSelectedCompartment(compartmentNumber);
    setIsScanModalOpen(true);
  };

  const handleQuickNextEmpty = () => {
    if (!hu || hu.storage_status === 'IN_KARDEX') return;
    const firstEmpty = (hu.compartments || []).find((c) => c.status === 'EMPTY');
    if (firstEmpty) {
      handleSelectEmpty(firstEmpty.compartment_number);
    }
  };

  const handleScanSuccess = (scannedSerial?: string) => {
    // 1. Immediately update UI state optimistically (0ms update - no reload needed)
    const currentTarget =
      selectedCompartment ||
      (hu?.compartments || []).find((c) => c.status === 'EMPTY')?.compartment_number;

    if (currentTarget) {
      setHu((prev) => {
        if (!prev) return prev;
        const updatedCompartments = (prev.compartments || []).map((c) => {
          if (c.compartment_number === currentTarget) {
            return {
              ...c,
              status: 'OCCUPIED' as const,
              serial_number: scannedSerial || c.serial_number || 'OCCUPIED',
            };
          }
          return c;
        });
        const occupied = updatedCompartments.filter((c) => c.status === 'OCCUPIED').length;
        const total = updatedCompartments.length;
        return {
          ...prev,
          compartments: updatedCompartments,
          hu_status:
            occupied === total ? 'FULL' : occupied > 0 ? 'PARTIALLY_FILLED' : 'EMPTY',
        };
      });

      // Auto-advance selectedCompartment to next empty slot for continuous scanning
      const nextEmpty = (hu?.compartments || []).find(
        (c) => c.status === 'EMPTY' && c.compartment_number !== currentTarget
      );
      if (nextEmpty) {
        setSelectedCompartment(nextEmpty.compartment_number);
      } else {
        setSelectedCompartment(null);
      }
    }

    // 2. Refresh from server in background to ensure all backend associations are in sync
    setTimeout(() => {
      fetchLayout();
    }, 150);
  };

  const handleConfirmKardex = async () => {
    if (!hu) return;
    try {
      setConfirming(true);
      setConfirmError('');
      await apiPost(`/hu/${hu.hu_id}/confirm-put`, { status: 'SUCCESSFUL' });
      setConfirmSuccess(true);
      fetchLayout();
    } catch (err: any) {
      setConfirmError(err.message || 'Failed to confirm Kardex storage');
    } finally {
      setConfirming(false);
    }
  };

  // Filtered compartments
  const compartments = useMemo(() => hu?.compartments || [], [hu]);
  const filteredCompartments = useMemo(() => {
    return compartments.filter((c) => {
      if (filterMode === 'EMPTY' && c.status !== 'EMPTY') return false;
      if (filterMode === 'OCCUPIED' && c.status !== 'OCCUPIED') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSerial = c.serial_number?.toLowerCase().includes(q);
        const matchesComp = c.compartment_number.toString().includes(q);
        const matchesModel = c.material_name?.toLowerCase().includes(q);
        if (!matchesSerial && !matchesComp && !matchesModel) return false;
      }
      return true;
    });
  }, [compartments, filterMode, searchQuery]);

  if (loading) {
    return <Loader message={`Loading handling unit ${huId}...`} />;
  }

  if (error || !hu) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center py-5">
        <AlertCircle size={44} className="text-danger mb-3" />
        <h4 className="fw-bold text-dark">{error || 'Bin not found'}</h4>
        <p className="text-muted" style={{ fontSize: '14px' }}>
          The requested handling unit could not be located in the database.
        </p>
        <Link href="/app/bins" className="btn-back-nav mt-3">
          <ArrowLeft size={15} className="back-nav-arrow" />
          <span>Back to Handling Units List</span>
        </Link>
      </div>
    );
  }

  const isSlotPicked = (c: Compartment) =>
    !!c.serial_number &&
    !c.put?.text_file_downloaded &&
    (c.put?.pick_status === 'PICKED' || c.status === 'EMPTY');
  const isSlotOccupied = (c: Compartment) =>
    c.status === 'OCCUPIED' && !isSlotPicked(c);

  const occupiedCount = compartments.filter(isSlotOccupied).length;
  const pickedCount = compartments.filter(isSlotPicked).length;
  const totalCount = compartments.length;
  const emptyCount = totalCount - occupiedCount - pickedCount;
  const fillPct = totalCount > 0 ? Math.round((occupiedCount / totalCount) * 100) : 0;
  const isLocked = hu.storage_status === 'IN_KARDEX';
  const isFloorBin = hu.storage_status === 'DRAFT' || hu.storage_status === 'OUTSIDE_KARDEX';
  const canSendToKardex = isFloorBin;
  const canConfirmKardex = hu.storage_status === 'IN_KARDEX' && hu.transaction_status === 'PENDING';

  return (
    <div className="hu-detail-fullscreen">
      <style jsx>{`
        .hu-detail-fullscreen {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .back-nav-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: -0.25rem;
        }

        .header-hero {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.5rem 1.75rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.02);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1.25rem;
        }

        .hu-title-group {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .hu-icon-box {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          background: linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
          flex-shrink: 0;
        }

        .hu-id-text {
          font-size: 32px;
          font-weight: 800;
          color: #0f172a;
          font-family: monospace;
          letter-spacing: 1.5px;
          line-height: 1.1;
        }

        .copy-pill {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 2px 7px;
          color: #64748b;
          cursor: pointer;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s ease;
        }

        .copy-pill:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .tags-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .info-pill {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 3px 10px;
          font-size: 12px;
          color: #334155;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .actions-cluster {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn-action-primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          border: none;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);
        }

        .btn-action-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
        }

        .btn-action-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .btn-scan-put {
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          color: #ffffff;
          border: none;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 10px rgba(2, 132, 199, 0.3);
        }

        .btn-scan-put:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(2, 132, 199, 0.4);
        }

        .btn-scan-put:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .btn-action-success {
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
          color: #ffffff;
          border: none;
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 10px rgba(22, 163, 74, 0.3);
        }

        .btn-action-success:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(22, 163, 74, 0.4);
        }

        .btn-action-success:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .btn-icon-reload {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #475569;
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-icon-reload:hover {
          background: #f8fafc;
          color: #0f172a;
          border-color: #cbd5e1;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1rem;
          width: 100%;
        }

        .stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .stat-meta {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          margin-bottom: 4px;
        }

        .stat-number {
          font-size: 26px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.1;
        }

        .stat-sub {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .stat-icon-wrapper {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .progress-banner-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.25rem 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          width: 100%;
        }

        .progress-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.65rem;
        }

        .progress-title-text {
          font-size: 13.5px;
          font-weight: 700;
          color: #1e293b;
        }

        .progress-bar-track {
          height: 12px;
          background: #f1f5f9;
          border-radius: 9999px;
          overflow: hidden;
          position: relative;
        }

        .progress-bar-fill {
          height: 100%;
          border-radius: 9999px;
          background: linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #10b981 100%);
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .layout-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          width: 100%;
        }

        .layout-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #f1f5f9;
        }

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .toolbar-title {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .legend-group {
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 12px;
          color: #64748b;
          font-weight: 500;
          flex-wrap: wrap;
        }

        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .legend-indicator {
          width: 10px;
          height: 10px;
          border-radius: 3px;
        }

        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .search-box-wrap {
          position: relative;
          min-width: 200px;
        }

        .search-input {
          width: 100%;
          padding: 6px 12px 6px 32px;
          font-size: 12.5px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          outline: none;
          transition: all 0.15s ease;
        }

        .search-input:focus {
          background: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .search-icon-pos {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .filter-pill-container {
          display: inline-flex;
          background: #f1f5f9;
          border-radius: 8px;
          padding: 3px;
          gap: 3px;
        }

        .filter-pill-btn {
          border: none;
          background: transparent;
          padding: 5px 12px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 6px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-pill-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .btn-quick-scan {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-quick-scan:hover:not(:disabled) {
          background: #dbeafe;
          border-color: #93c5fd;
        }

        .btn-quick-scan:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .alert-bar-success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 12px 18px;
          color: #15803d;
          font-size: 13.5px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .alert-bar-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 12px 18px;
          color: #b91c1c;
          font-size: 13.5px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        :global(.spin-animation) {
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      {/* Top Breadcrumb & Quick Nav */}
      <div className="back-nav-bar d-flex align-items-center justify-content-between mb-3">
        <Link href="/app/bins" className="btn-back-nav" title="Return to Handling Units List">
          <ArrowLeft size={15} className="back-nav-arrow" />
          <span>Back to Handling Units List</span>
        </Link>
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted" style={{ fontSize: '12px' }}>
            Last Synced: {new Date().toLocaleTimeString()}
          </span>
          <button
            className="btn-icon-reload"
            onClick={() => fetchLayout()}
            title="Refresh Bin Layout"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Hero Header Card */}
      <div className="header-hero">
        <div className="hu-title-group">
          <div className="hu-icon-box">
            <Package size={26} />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2">
              <span className="hu-id-text">{hu.hu_id}</span>
              <button
                className="copy-pill"
                onClick={handleCopyId}
                title="Copy Handling Unit ID"
              >
                {copiedId ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                {copiedId ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="tags-row">
              <span className="info-pill">
                <Layers size={13} className="text-primary" />
                {hu.bin_type?.name || `Bin Type #${hu.bin_type_id}`}
              </span>
              <span className="info-pill">
                <Barcode size={13} className="text-secondary" />
                PPS Bin: <strong>{hu.bin_type?.bin_name || 'CON_BINA'}</strong>
              </span>
              <HUStatusBadge status={hu.hu_status} />
              <StorageStatusBadge status={hu.storage_status} />
              {hu.transaction_status && (
                <span
                  className={`badge ${
                    hu.transaction_status === 'PENDING'
                      ? 'bg-warning text-dark'
                      : hu.transaction_status === 'SUCCESSFUL'
                      ? 'bg-success'
                      : 'bg-danger'
                  }`}
                  style={{ fontSize: '11.5px', padding: '5px 9px' }}
                >
                  Transaction: {hu.transaction_status}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Cluster */}
        <div className="actions-cluster">
          {!isLocked && emptyCount > 0 && (
            <button
              className="btn-scan-put"
              onClick={() => {
                const nextEmpty = compartments.find((c) => c.status === 'EMPTY');
                setSelectedCompartment(nextEmpty ? nextEmpty.compartment_number : null);
                setIsScanModalOpen(true);
              }}
            >
              <PackagePlus size={16} /> PUT Process — Scan Part
            </button>
          )}

          {!isLocked && occupiedCount > 0 && (
            <>
              <button
                className="btn btn-warning text-dark d-flex align-items-center gap-2 fw-bold"
                onClick={() => {
                  setSelectedPickCompartment(null);
                  setIsScanPickModalOpen(true);
                }}
                style={{ padding: '9px 18px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(245, 158, 11, 0.25)' }}
                title="Scan and validate parts one-by-one with MES KANBAN-OUT"
              >
                <PackageMinus size={16} /> Scan & Pick (One-by-One)
              </button>

              <button
                className="btn btn-outline-danger d-flex align-items-center gap-2 fw-semibold"
                onClick={() => setIsPickAllConfirmOpen(true)}
                style={{ padding: '9px 16px', borderRadius: '10px' }}
                title="Pick and unload all occupied compartments in this bin"
              >
                <PackageMinus size={16} /> Pick All Parts
              </button>
            </>
          )}

          {hu.storage_status === 'IN_KARDEX' && (
            <button
              className="btn btn-warning d-flex align-items-center gap-2 fw-bold text-dark"
              onClick={() => setIsHUPickOpen(true)}
              style={{ padding: '9px 18px', borderRadius: '10px', boxShadow: '0 2px 6px rgba(245, 158, 11, 0.25)' }}
            >
              <PackageSearch size={16} /> Retrieve Bin from Kardex (HU PICK)
            </button>
          )}

          {pickedCount > 0 && (
            <button
              className="btn btn-warning text-dark d-flex align-items-center gap-2 fw-bold"
              onClick={handleSendPickToKardex}
              disabled={sendingPick}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                boxShadow: '0 2px 6px rgba(245, 158, 11, 0.25)',
              }}
              title="Generate Kardex Pick Order text file for all validated picked parts"
            >
              {sendingPick ? (
                <Loader2 size={16} className="spin-animation" />
              ) : (
                <Send size={16} />
              )}
              {sendingPick
                ? 'Sending Pick Order to Kardex...'
                : `Send Pick Order to Kardex PPS (${pickedCount} Picked)`}
            </button>
          )}

          {canSendToKardex && (
            <button
              className="btn-action-primary"
              onClick={() => setIsSendToKardexOpen(true)}
              disabled={occupiedCount === 0}
              title={
                occupiedCount === 0
                  ? 'Load at least one part into bin before sending to Kardex PPS'
                  : 'Send Bin to Kardex PPS'
              }
              style={{
                opacity: occupiedCount === 0 ? 0.6 : 1,
                cursor: occupiedCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Send size={16} /> Send Bin to Kardex PPS ({occupiedCount} Loaded)
            </button>
          )}

          {canConfirmKardex && !confirmSuccess && (
            <button
              className="btn-action-success"
              onClick={handleConfirmKardex}
              disabled={confirming}
            >
              {confirming ? (
                <Loader2 size={16} className="spin-animation" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {confirming ? 'Confirming with Kardex...' : 'Confirm Kardex Storage'}
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Notifications */}
      {pickSendSuccess && (
        <div className="alert-bar-success mb-3">
          <CheckCircle2 size={18} />
          <div className="d-flex align-items-center justify-content-between w-100">
            <span>{pickSendSuccess}</span>
            <button
              className="btn btn-sm btn-link text-success p-0 ms-3 text-decoration-none"
              onClick={() => setPickSendSuccess(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {confirmSuccess && (
        <div className="alert-bar-success">
          <CheckCircle2 size={20} className="flex-shrink-0" />
          <div>
            <strong>Kardex Storage Confirmed!</strong> This Handling Unit is now physically stored in Kardex and marked as <strong>IN_KARDEX</strong>.
          </div>
        </div>
      )}

      {confirmError && (
        <div className="alert-bar-error">
          <AlertCircle size={20} className="flex-shrink-0" />
          <div>
            <strong>Confirmation Error:</strong> {confirmError}
          </div>
        </div>
      )}

      {/* 4 Metric Cards Across Full Screen Width */}
      <div className="metrics-grid">
        <div className="stat-card">
          <div className="stat-meta">
            <span className="stat-label">Total Capacity</span>
            <span className="stat-number">{totalCount}</span>
            <span className="stat-sub">Physical compartments</span>
          </div>
          <div className="stat-icon-wrapper" style={{ background: '#f1f5f9', color: '#475569' }}>
            <Layers size={22} />
          </div>
        </div>

        {pickedCount > 0 && (
          <div className="stat-card" style={{ borderColor: '#fef08a' }}>
            <div className="stat-meta">
              <span className="stat-label">Picked Parts</span>
              <span className="stat-number" style={{ color: '#d97706' }}>
                {pickedCount}
              </span>
              <span className="stat-sub">Ready for Kardex PPS</span>
            </div>
            <div className="stat-icon-wrapper" style={{ background: '#fef9c3', color: '#d97706' }}>
              <PackageMinus size={22} />
            </div>
          </div>
        )}

        <div className="stat-card">
          <div className="stat-meta">
            <span className="stat-label">Occupied Slots</span>
            <span className="stat-number" style={{ color: '#16a34a' }}>
              {occupiedCount}
            </span>
            <span className="stat-sub">Adapters loaded</span>
          </div>
          <div className="stat-icon-wrapper" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <Boxes size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-meta">
            <span className="stat-label">Available to Scan</span>
            <span className="stat-number" style={{ color: '#2563eb' }}>
              {emptyCount}
            </span>
            <span className="stat-sub">Remaining empty slots</span>
          </div>
          <div className="stat-icon-wrapper" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Inbox size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-meta">
            <span className="stat-label">Load Percentage</span>
            <span className="stat-number" style={{ color: fillPct === 100 ? '#16a34a' : '#0f172a' }}>
              {fillPct}%
            </span>
            <span className="stat-sub">
              {fillPct === 100 ? 'Bin completely full' : `${emptyCount} slots open`}
            </span>
          </div>
          <div
            className="stat-icon-wrapper"
            style={{
              background: fillPct === 100 ? '#f0fdf4' : '#eff6ff',
              color: fillPct === 100 ? '#16a34a' : '#2563eb',
            }}
          >
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* Full Width Progress Tracker Bar */}
      <div className="progress-banner-card">
        <div className="progress-header-row">
          <span className="progress-title-text">
            Bin Allocation Progress: <strong>{occupiedCount}</strong> of <strong>{totalCount}</strong> compartments filled
          </span>
          <span style={{ fontSize: '13px', fontWeight: 800, color: fillPct === 100 ? '#16a34a' : '#2563eb' }}>
            {fillPct}% Complete
          </span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${fillPct}%` }} />
        </div>
      </div>

      {/* Main Compartments Layout Panel (Full Width) */}
      <div className="layout-card">
        <div className="layout-toolbar">
          <div className="toolbar-left">
            <h2 className="toolbar-title">Physical Compartment Layout</h2>
            <div className="legend-group">
              <span className="legend-item">
                <span className="legend-indicator" style={{ background: '#22c55e' }} />
                Occupied ({occupiedCount})
              </span>
              <span className="legend-item">
                <span className="legend-indicator" style={{ background: '#cbd5e1' }} />
                Empty ({emptyCount})
              </span>
              <span className="legend-item">
                <span className="legend-indicator" style={{ background: '#3b82f6' }} />
                Scanning
              </span>
            </div>
          </div>

          <div className="toolbar-right">
            {/* Quick Next Empty Action */}
            {!isLocked && emptyCount > 0 && (
              <button
                className="btn-quick-scan"
                onClick={handleQuickNextEmpty}
                title="Jump directly to scan the next empty slot"
              >
                Scan Next Empty (#{compartments.find((c) => c.status === 'EMPTY')?.compartment_number})
              </button>
            )}

            {/* Filter Toggle */}
            <div className="filter-pill-container">
              <button
                className={`filter-pill-btn ${filterMode === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterMode('ALL')}
              >
                All ({totalCount})
              </button>
              <button
                className={`filter-pill-btn ${filterMode === 'EMPTY' ? 'active' : ''}`}
                onClick={() => setFilterMode('EMPTY')}
              >
                Empty ({emptyCount})
              </button>
              <button
                className={`filter-pill-btn ${filterMode === 'OCCUPIED' ? 'active' : ''}`}
                onClick={() => setFilterMode('OCCUPIED')}
              >
                Occupied ({occupiedCount})
              </button>
            </div>

            {/* Search Input for Serial or Cell Number */}
            <div className="search-box-wrap">
              <Search size={14} className="search-icon-pos" />
              <input
                type="text"
                className="search-input"
                placeholder="Search cell or serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Lock Notice if in Kardex */}
        {isLocked && (
          <div
            className="d-flex align-items-center gap-2 mb-3 p-2 rounded"
            style={{ background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '13px', color: '#1d4ed8' }}
          >
            <Info size={16} className="flex-shrink-0" />
            <span>
              This Handling Unit is currently inside <strong>Kardex PPS storage</strong>. Compartments are read-only until the bin is retrieved via <strong>HU Pick</strong>.
            </span>
          </div>
        )}

        {/* Compartment Grid */}
        {filteredCompartments.length === 0 ? (
          <div className="text-center text-muted py-5" style={{ fontSize: '14px' }}>
            No compartments match your current filter or search criteria.
          </div>
        ) : (
          <CompartmentGrid
            compartments={filteredCompartments}
            onSelectEmpty={isLocked ? undefined : handleSelectEmpty}
            onSelectOccupied={
              !isLocked
                ? (comp) => {
                    setSelectedPickCompartment(comp.compartment_number);
                    setIsScanPickModalOpen(true);
                  }
                : undefined
            }
            selectedCompartment={isScanModalOpen ? selectedCompartment : null}
            disabled={isLocked}
            huId={hu.hu_id}
            binName={hu.bin_type?.bin_name || 'CON_BINA'}
            binType={hu.bin_type?.name}
          />
        )}
      </div>

      {/* Old Working PUT Process Modal (Same UI & Same 8-Step Process) */}
      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => {
          setIsScanModalOpen(false);
          setSelectedCompartment(null);
        }}
        onSuccess={handleScanSuccess}
        huId={hu.hu_id}
        compartmentNumber={selectedCompartment}
      />

      {/* One-by-One Pick Scan Modal with Live MES Validations */}
      {hu && isScanPickModalOpen && (
        <ScanPickModal
          isOpen={isScanPickModalOpen}
          onClose={() => {
            setIsScanPickModalOpen(false);
            setSelectedPickCompartment(null);
          }}
          onSuccess={() => {
            fetchLayout();
          }}
          hu={hu}
          initialCompartmentNumber={selectedPickCompartment}
        />
      )}

      {/* Send to Kardex Modal */}
      {isSendToKardexOpen && (
        <SendToKardexModal
          isOpen={isSendToKardexOpen}
          onClose={() => setIsSendToKardexOpen(false)}
          onSuccess={() => {
            setIsSendToKardexOpen(false);
            fetchLayout();
          }}
          hu={hu}
        />
      )}

      {/* HU Pick Retrieval Modal */}
      {hu && isHUPickOpen && (
        <HUPickModal
          isOpen={isHUPickOpen}
          onClose={() => setIsHUPickOpen(false)}
          onSuccess={() => {
            setIsHUPickOpen(false);
            fetchLayout();
          }}
          hu={hu}
        />
      )}

      {/* Single Compartment Pick Modal */}
      {pickCompartmentTarget && (
        <Modal
          isOpen={!!pickCompartmentTarget}
          onClose={() => setPickCompartmentTarget(null)}
          title={`Pick Part from Compartment #${pickCompartmentTarget.compartment_number}`}
          maxWidth="480px"
        >
          <div>
            <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
              Execute pick order for this seated part. This will update MES Kanban board history to <strong>KANBAN-OUT</strong>, mark the serial as <strong>PICKED</strong>, and empty compartment #{pickCompartmentTarget.compartment_number}.
            </p>
            <div className="bg-light p-3 rounded-3 border mb-3">
              <div className="d-flex justify-content-between mb-1" style={{ fontSize: '13px' }}>
                <span className="text-muted">Serial Number:</span>
                <strong className="font-monospace text-primary">{pickCompartmentTarget.serial_number}</strong>
              </div>
              <div className="d-flex justify-content-between" style={{ fontSize: '13px' }}>
                <span className="text-muted">Model / Part:</span>
                <strong>{pickCompartmentTarget.material_name || 'N/A'}</strong>
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setPickCompartmentTarget(null)}
                disabled={pickingSlot}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger d-flex align-items-center gap-2"
                onClick={handlePickCompartment}
                disabled={pickingSlot}
              >
                {pickingSlot ? <Loader2 size={15} className="spin-animation" /> : <PackageMinus size={15} />}
                {pickingSlot ? 'Picking...' : 'Confirm Pick Part'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Pick All Parts Modal */}
      {isPickAllConfirmOpen && (
        <Modal
          isOpen={isPickAllConfirmOpen}
          onClose={() => setIsPickAllConfirmOpen(false)}
          title={`Pick All ${occupiedCount} Parts from ${hu.hu_id}`}
          maxWidth="500px"
        >
          <div>
            <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
              Are you sure you want to unload all <strong>{occupiedCount}</strong> parts from Handling Unit <strong>{hu.hu_id}</strong>?
            </p>
            <div className="alert alert-warning py-2 px-3 mb-3" style={{ fontSize: '12.5px' }}>
              This will update MES Kanban board history for each part to <strong>KANBAN-OUT</strong>, mark all serials as <strong>PICKED</strong>, and clear all compartments back to <strong>EMPTY</strong>.
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setIsPickAllConfirmOpen(false)}
                disabled={pickingAll}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger d-flex align-items-center gap-2"
                onClick={handlePickAll}
                disabled={pickingAll}
              >
                {pickingAll ? <Loader2 size={15} className="spin-animation" /> : <PackageMinus size={15} />}
                {pickingAll ? 'Picking All Parts...' : `Confirm Pick All (${occupiedCount})`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
