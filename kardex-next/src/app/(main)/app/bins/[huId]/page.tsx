'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { HandlingUnit, Compartment } from '@/types/hu';
import { HUStatusBadge } from '@/components/bins/HUStatusBadge';
import { CompartmentGrid } from '@/components/bins/CompartmentGrid';
import { ScanModal } from '@/components/dashboard/ScanModal';
import { SendToKardexModal } from '@/components/bins/SendToKardexModal';
import { Modal } from '@/components/shared/Modal';
import { Loader } from '@/components/shared/Loader';
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Layers,
  Barcode,
  Search,
  PackagePlus,
  PackageMinus,
} from 'lucide-react';

interface HUDetailPageProps {
  params: Promise<{ huId: string }>;
}

export default function HUDetailPage({ params }: HUDetailPageProps) {
  const { huId } = React.use(params);
  const router = useRouter();
  const { canPut } = useAuth();

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

  // Modals & Side-by-Side Panel State
  const [selectedCompartment, setSelectedCompartment] = useState<number | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(true);
  const [userDismissedScan, setUserDismissedScan] = useState(false);
  const [isScanPickModalOpen, setIsScanPickModalOpen] = useState(false);
  const [selectedPickCompartment, setSelectedPickCompartment] = useState<number | null>(null);
  const [isSendToKardexOpen, setIsSendToKardexOpen] = useState(false);
  const [pickCompartmentTarget, setPickCompartmentTarget] = useState<Compartment | null>(null);
  const [pickingSlot, setPickingSlot] = useState(false);
  const [sendingPick, setSendingPick] = useState(false);
  const [pickSendSuccess, setPickSendSuccess] = useState<string | null>(null);
  const [kardexPutSuccess, setKardexPutSuccess] = useState<string | null>(null);

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

  const fetchLayout = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      const res = await apiGet<HandlingUnit>(`/hu/${encodeURIComponent(huId)}/layout`);
      setHu(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load bin details');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [huId]);

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

  // Strictly sort compartments by compartment_number in ascending order (1, 2, 3... 30)
  const compartments = useMemo(() => {
    if (!hu?.compartments) return [];
    return [...hu.compartments].sort((a, b) => a.compartment_number - b.compartment_number);
  }, [hu]);

  // Auto-open scan panel and target the lowest numbered empty slot (#1, #2...) by default on page load
  useEffect(() => {
    if (hu && !userDismissedScan) {
      if (selectedCompartment === null) {
        const firstEmpty = compartments.find((c) => c.status === 'EMPTY');
        if (firstEmpty) {
          setSelectedCompartment(firstEmpty.compartment_number);
          setIsScanModalOpen(true);
        }
      }
    }
  }, [hu, compartments, selectedCompartment, userDismissedScan]);

  const handleCopyId = () => {
    if (!hu) return;
    navigator.clipboard.writeText(hu.hu_id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSelectEmpty = (compartmentNumber: number) => {
    if (!hu) return;
    setUserDismissedScan(false);
    setSelectedCompartment(compartmentNumber);
    setIsScanModalOpen(true);
  };

  const handleQuickNextEmpty = () => {
    if (!hu) return;
    const firstEmpty = compartments.find((c) => c.status === 'EMPTY');
    if (firstEmpty) {
      handleSelectEmpty(firstEmpty.compartment_number);
    }
  };

  const handleScanSuccess = (scannedSerial?: string) => {
    // 1. Immediately update UI state optimistically (0ms update - no reload needed)
    const currentTarget =
      selectedCompartment ||
      compartments.find((c) => c.status === 'EMPTY')?.compartment_number;

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

      // Auto-advance selectedCompartment to the next lowest empty slot for continuous scanning
      const nextEmpty = compartments.find(
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

  // Filtered compartments for display
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
  const isLocked = !canPut;
  const isFloorBin = hu.storage_status === 'DRAFT' || hu.storage_status === 'OUTSIDE_KARDEX';
  const canSendToKardex = canPut && occupiedCount > 0;

  return (
    <div className="hu-detail-fullscreen">
      <style jsx>{`
        .hu-detail-fullscreen {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          min-height: calc(100vh - 85px);
        }

        /* Unified Sleek Top Command Bar */
        .top-command-bar {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 8px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          flex-shrink: 0;
          flex-wrap: wrap;
        }

        .cmd-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: nowrap;
        }

        .btn-nav-chip {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 7px;
          padding: 4px 9px;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          text-decoration: none;
          transition: all 0.15s ease;
        }

        .btn-nav-chip:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .hu-id-box {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 15px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.5px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 3px 8px;
          border-radius: 7px;
        }

        .copy-btn-mini {
          border: none;
          background: transparent;
          color: #94a3b8;
          padding: 2px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
        }

        .copy-btn-mini:hover {
          color: #0f172a;
        }

        .meta-chip {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 11.5px;
          font-weight: 600;
          color: #334155;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }

        .cmd-center {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          max-width: 340px;
          min-width: 180px;
        }

        .progress-compact-block {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .progress-compact-labels {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
        }

        .progress-compact-track {
          height: 7px;
          background: #f1f5f9;
          border-radius: 9999px;
          overflow: hidden;
          position: relative;
        }

        .progress-compact-fill {
          height: 100%;
          border-radius: 9999px;
          background: linear-gradient(90deg, #2563eb 0%, #3b82f6 50%, #10b981 100%);
          transition: width 0.3s ease;
        }

        .cmd-right {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: nowrap;
        }

        /* Main Workspace Split Row */
        .workspace-split-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          width: 100%;
        }

        .layout-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          display: flex;
          flex-direction: column;
        }

        .layout-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid #f1f5f9;
        }

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .toolbar-title {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .legend-group {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
          flex-wrap: wrap;
        }

        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .legend-indicator {
          width: 8px;
          height: 8px;
          border-radius: 2px;
        }

        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .search-box-wrap {
          position: relative;
          min-width: 150px;
        }

        .search-input {
          width: 100%;
          padding: 4px 10px 4px 28px;
          font-size: 11.5px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          outline: none;
          transition: all 0.15s ease;
        }

        .search-input:focus {
          background: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .search-icon-pos {
          position: absolute;
          left: 8px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .filter-pill-container {
          display: inline-flex;
          background: #f1f5f9;
          border-radius: 6px;
          padding: 2px;
          gap: 2px;
        }

        .filter-pill-btn {
          border: none;
          background: transparent;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 5px;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-pill-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
        }

        .btn-quick-scan {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 5px;
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
          border-radius: 8px;
          padding: 6px 12px;
          color: #15803d;
          font-size: 12.5px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .alert-bar-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 6px 12px;
          color: #b91c1c;
          font-size: 12.5px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        :global(.spin-animation) {
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      {/* Sleek All-in-One Command Bar */}
      <div className="top-command-bar">
        {/* Left: Navigation, HU ID, Spec Badges */}
        <div className="cmd-left">
          <Link href={canPut ? '/app/hu-put' : '/app/bins'} className="btn-nav-chip" title={canPut ? 'Back to HU Put' : 'Back to Bins'}>
            <ArrowLeft size={13} />
            <span>{canPut ? 'HU Put' : 'Bins'}</span>
          </Link>

          <div className="hu-id-box">
            <span>{hu.hu_id}</span>
            <button className="copy-btn-mini" onClick={handleCopyId} title="Copy Handling Unit ID">
              {copiedId ? <Check size={11} className="text-success" /> : <Copy size={11} />}
            </button>
          </div>

          <span className="meta-chip">
            <Barcode size={12} className="text-secondary" />
            <strong>{hu.bin_type?.bin_name || 'CON_BINA'}</strong>
          </span>

          <span className="meta-chip">
            <Layers size={12} className="text-primary" />
            <span>{hu.bin_type?.name || 'Bin Carrier'}</span>
          </span>

          <HUStatusBadge status={hu.hu_status} />
        </div>

        {/* Center: Inline Allocation Progress Meter */}
        <div className="cmd-center">
          <div className="progress-compact-block">
            <div className="progress-compact-labels">
              <span>
                <strong>{occupiedCount}</strong> / {totalCount} Loaded ({fillPct}%)
              </span>
              <span className="text-muted">{emptyCount} empty</span>
            </div>
            <div className="progress-compact-track">
              <div className="progress-compact-fill" style={{ width: `${fillPct}%` }} />
            </div>
          </div>
        </div>

        {/* Right: Actions Cluster */}
        <div className="cmd-right">
          {!isLocked && emptyCount > 0 && !isScanModalOpen && (
            <button
              className="btn btn-sm btn-primary fw-bold d-flex align-items-center gap-1"
              onClick={() => {
                setUserDismissedScan(false);
                const nextEmpty = compartments.find((c) => c.status === 'EMPTY');
                setSelectedCompartment(nextEmpty ? nextEmpty.compartment_number : null);
                setIsScanModalOpen(true);
              }}
              style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '7px' }}
            >
              <PackagePlus size={13} /> Scan Part
            </button>
          )}

          {canSendToKardex && (
            <button
              className="btn btn-sm btn-success fw-bold d-flex align-items-center gap-1"
              onClick={() => setIsSendToKardexOpen(true)}
              disabled={occupiedCount === 0}
              style={{
                fontSize: '11.5px',
                padding: '4px 12px',
                borderRadius: '7px',
                opacity: occupiedCount === 0 ? 0.6 : 1,
              }}
            >
              <Send size={13} /> Send to Kardex ({occupiedCount})
            </button>
          )}

          <button
            className="btn btn-sm btn-light border text-muted p-1 rounded-circle"
            onClick={() => fetchLayout()}
            title="Refresh Bin"
            style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Confirmation Notifications */}
      {kardexPutSuccess && (
        <div className="alert-bar-success">
          <CheckCircle2 size={16} />
          <div className="d-flex align-items-center justify-content-between w-100">
            <span>{kardexPutSuccess}</span>
            <button
              className="btn btn-sm btn-link text-success p-0 ms-2 text-decoration-none"
              onClick={() => setKardexPutSuccess(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {pickSendSuccess && (
        <div className="alert-bar-success">
          <CheckCircle2 size={16} />
          <div className="d-flex align-items-center justify-content-between w-100">
            <span>{pickSendSuccess}</span>
            <button
              className="btn btn-sm btn-link text-success p-0 ms-2 text-decoration-none"
              onClick={() => setPickSendSuccess(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {confirmSuccess && (
        <div className="alert-bar-success">
          <CheckCircle2 size={16} className="flex-shrink-0" />
          <div>
            <strong>Kardex Storage Confirmed!</strong> This Handling Unit is physically stored in Kardex PPS.
          </div>
        </div>
      )}

      {confirmError && (
        <div className="alert-bar-error">
          <AlertCircle size={16} className="flex-shrink-0" />
          <div>
            <strong>Confirmation Error:</strong> {confirmError}
          </div>
        </div>
      )}

      {/* Side-by-Side Split Workspace: Bin Layout on Left, Scan & Validation on Right */}
      <div className="workspace-split-row">
        {/* Left Side: Compartment Layout */}
        <div
          className="layout-card"
          style={{
            flex: canPut && isScanModalOpen ? '1 1 58%' : '1 1 100%',
            minWidth: 0,
          }}
        >
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
                  Next Empty (#{compartments.find((c) => c.status === 'EMPTY')?.compartment_number})
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
                <Search size={13} className="search-icon-pos" />
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

          {/* Compartment Grid */}
          {filteredCompartments.length === 0 ? (
            <div className="text-center text-muted py-4" style={{ fontSize: '13px' }}>
              No compartments match your current filter or search criteria.
            </div>
          ) : (
            <CompartmentGrid
              compartments={filteredCompartments}
              onSelectEmpty={isLocked ? undefined : handleSelectEmpty}
              selectedCompartment={canPut && isScanModalOpen ? selectedCompartment : null}
              huId={hu.hu_id}
              binName={hu.bin_type?.bin_name || 'CON_BINA'}
              binType={hu.bin_type?.name}
            />
          )}
        </div>

        {/* Right Side: Permanent PUT Process Scan & Live Validation Panel */}
        {canPut && isScanModalOpen && (
          <div
            className="scan-panel-col"
            style={{
              flex: '0 0 450px',
              maxWidth: '480px',
              width: '100%',
              minWidth: '350px',
              marginTop: '48px',
            }}
          >
            <ScanModal
              isOpen={isScanModalOpen}
              onClose={() => {}}
              onSuccess={handleScanSuccess}
              huId={hu.hu_id}
              compartmentNumber={selectedCompartment}
              embedded={true}
            />
          </div>
        )}
      </div>

      {/* Send to Kardex Modal */}
      {isSendToKardexOpen && (
        <SendToKardexModal
          isOpen={isSendToKardexOpen}
          onClose={() => setIsSendToKardexOpen(false)}
          onSuccess={(orderNumber) => {
            setIsSendToKardexOpen(false);
            setKardexPutSuccess(`Handling Unit ${hu.hu_id} Sent to Kardex Successfully! ${orderNumber ? `(Order: ${orderNumber})` : ''}`);
            fetchLayout(true);
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

    </div>
  );
}
