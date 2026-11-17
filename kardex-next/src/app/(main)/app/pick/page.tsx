'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { TimelineProgress } from '@/components/shared/TimelineProgress';
import { connectSSE, apiPost, apiDownloadFile, downloadBlob } from '@/lib/api';
import { Log } from '@/types';
import {
  PackageMinus,
  Search,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Minus,
  Plus,
  Boxes,
  Barcode,
  Download,
  Loader2,
  Clock,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Check,
  Zap,
  ListChecks,
  CheckSquare,
  Square,
} from 'lucide-react';

interface AvailableInventoryItem {
  id: number;
  serial_number: string;
  model_number: string;
  birth_date?: string | null;
  compartment?: {
    compartment_number?: number | null;
  } | null;
  handling_unit?: {
    hu_id?: string | null;
  } | null;
}

const PICK_STEPS = [
  { key: 'FETCH_DETAILS', label: '1. Verify Stock & MES Status' },
  { key: 'CHECK_QTY', label: '2. Verify Required Quantity' },
  { key: 'CHECK_STATUS', label: '3. Update MES Kanban History' },
  { key: 'FILE_GENERATED', label: '4. Generate Pick Order Text File' },
];

export default function PickWorkstationPage() {
  const router = useRouter();
  const { canPick, isLoading: authLoading } = useAuth();

  // Mode Selection: 'quick' (Auto FIFO by Quantity) vs 'select' (Select Specific Serials)
  const [pickMode, setPickMode] = useState<'quick' | 'select'>('quick');

  // ==========================================
  // MODE 1: Auto FIFO Pick by Quantity
  // ==========================================
  const [barcodeInput, setBarcodeInput] = useState('');
  const [detectedModel, setDetectedModel] = useState<string | null>(null);
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);

  // ==========================================
  // MODE 2: Select Specific Serials from Inventory
  // ==========================================
  const [selectModelInput, setSelectModelInput] = useState('');
  const [resolvedSelectModel, setResolvedSelectModel] = useState<string | null>(null);
  const [selectTargetQty, setSelectTargetQty] = useState<number>(1);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [inventoryList, setInventoryList] = useState<AvailableInventoryItem[]>([]);
  const [selectedSerialNumbers, setSelectedSerialNumbers] = useState<string[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');

  // Universal Feedback & Error
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // SSE & Execution State
  const [logs, setLogs] = useState<Log[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedInfo, setCompletedInfo] = useState<{
    fileName?: string;
    pickId?: number;
    lineCount?: number;
    label?: string;
  } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Refs
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const selectModelInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const autoCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && !canPick) {
      router.replace('/error/403');
    }
  }, [authLoading, canPick, router]);

  useEffect(() => {
    if (pickMode === 'quick') {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    } else {
      setTimeout(() => selectModelInputRef.current?.focus(), 100);
    }
  }, [pickMode]);

  useEffect(() => {
    if ((isProcessing || logs.length > 0) && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isProcessing, logs]);

  const handleResetAll = () => {
    setBarcodeInput('');
    setDetectedModel(null);
    setAvailableStock(null);
    setIsCheckingStock(false);
    setQuantity(1);

    setSelectModelInput('');
    setResolvedSelectModel(null);
    setSelectTargetQty(1);
    setInventoryList([]);
    setSelectedSerialNumbers([]);
    setInventorySearch('');

    setFeedback(null);
    setErrorMsg('');
    setLogs([]);
    setIsProcessing(false);
    setIsCompleted(false);
    setCompletedInfo(null);
    setIsDownloading(false);

    if (pickMode === 'quick') {
      setTimeout(() => barcodeInputRef.current?.focus(), 50);
    } else {
      setTimeout(() => selectModelInputRef.current?.focus(), 50);
    }
  };

  // -------------------------------------------------------------
  // Mode 1: Automatic Background Stock Detection
  // -------------------------------------------------------------
  const checkStockInBackground = useCallback(async (raw: string) => {
    const clean = raw.trim();
    if (!clean || clean.length < 2) {
      setDetectedModel(null);
      setAvailableStock(null);
      return;
    }

    try {
      setIsCheckingStock(true);
      const res = await apiPost<any>('/put/find-by-model-and-qty', {
        partNumber: clean,
        quantity: 0,
        page: 1,
        size: 10,
      });

      if (res?.totalItems > 0) {
        setDetectedModel(res.resolvedModelNumber || clean);
        setAvailableStock(res.totalItems);
      } else {
        setDetectedModel(clean);
        setAvailableStock(0);
      }
    } catch {
      // silent fallback
    } finally {
      setIsCheckingStock(false);
    }
  }, []);

  const handleBarcodeInput = (val: string) => {
    setBarcodeInput(val);
    if (autoCheckTimeoutRef.current) clearTimeout(autoCheckTimeoutRef.current);
    autoCheckTimeoutRef.current = setTimeout(() => {
      checkStockInBackground(val);
    }, 350);
  };

  // Mode 1: Direct Execute Auto-Pick (FIFO)
  const handleExecuteQuickPick = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = barcodeInput.trim();
    if (!raw || isProcessing) return;

    if (quantity <= 0) {
      setErrorMsg('Please enter a valid quantity to pick.');
      return;
    }

    const endpoint = `/pick/create/${encodeURIComponent(raw)}/${quantity}`;
    executeSSEPick(
      endpoint,
      quantity,
      `${quantity} units of ${detectedModel || raw}`
    );
  };

  // -------------------------------------------------------------
  // Mode 2: Auto-Load Inventory Checklist (No "Load Stock" button)
  // -------------------------------------------------------------
  const loadInventoryAuto = useCallback(async (raw: string) => {
    const clean = raw.trim();
    if (!clean || clean.length < 2) {
      setInventoryList([]);
      setResolvedSelectModel(null);
      setSelectedSerialNumbers([]);
      return;
    }

    try {
      setIsLoadingInventory(true);
      setErrorMsg('');
      setFeedback(null);

      const res = await apiPost<any>('/put/find-by-model-and-qty', {
        partNumber: clean,
        quantity: 0,
        page: 1,
        size: 150,
      });

      const model = res?.resolvedModelNumber || clean;
      setResolvedSelectModel(model);

      if (res?.data && res.data.length > 0) {
        setInventoryList(res.data);
      } else {
        setInventoryList([]);
      }
    } catch {
      setInventoryList([]);
    } finally {
      setIsLoadingInventory(false);
    }
  }, []);

  const handleSelectModelInputChange = (val: string) => {
    setSelectModelInput(val);
    if (autoCheckTimeoutRef.current) clearTimeout(autoCheckTimeoutRef.current);
    autoCheckTimeoutRef.current = setTimeout(() => {
      loadInventoryAuto(val);
    }, 400);
  };

  const handleToggleSelectSerial = (serial: string) => {
    setSelectedSerialNumbers((prev) =>
      prev.includes(serial) ? prev.filter((s) => s !== serial) : [...prev, serial]
    );
  };

  const handleSelectFirstN = () => {
    const filtered = filteredInventory;
    const toSelect = filtered.slice(0, selectTargetQty).map((item) => item.serial_number);
    setSelectedSerialNumbers(toSelect);
  };

  const handleDeselectAll = () => {
    setSelectedSerialNumbers([]);
  };

  const filteredInventory = inventoryList.filter((item) => {
    if (!inventorySearch.trim()) return true;
    const query = inventorySearch.toLowerCase();
    return (
      item.serial_number.toLowerCase().includes(query) ||
      (item.handling_unit?.hu_id && item.handling_unit.hu_id.toLowerCase().includes(query)) ||
      (item.compartment?.compartment_number && String(item.compartment.compartment_number).includes(query))
    );
  });

  // Mode 2: Direct Execute Selected Serials Pick
  const handleExecuteSelectedPick = () => {
    if (!resolvedSelectModel || selectedSerialNumbers.length === 0 || isProcessing) return;

    const count = selectedSerialNumbers.length;
    const serialList = selectedSerialNumbers.join(',');
    const endpoint = `/pick/create/${encodeURIComponent(resolvedSelectModel)}/${count}?serials=${encodeURIComponent(serialList)}`;

    executeSSEPick(
      endpoint,
      count,
      `${count} selected serials (${resolvedSelectModel})`
    );
  };

  // -------------------------------------------------------------
  // Universal SSE Execution & File Generation
  // -------------------------------------------------------------
  const executeSSEPick = (endpoint: string, expectedLineCount: number, label: string) => {
    setLogs([]);
    setIsProcessing(true);
    setIsCompleted(false);
    setCompletedInfo(null);
    setErrorMsg('');

    connectSSE(
      endpoint,
      (data: any) => {
        if (data && typeof data === 'object') {
          setLogs((prev) => {
            const index = prev.findIndex((l) => l.activity === data.activity);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = data;
              return updated;
            }
            return [...prev, data];
          });

          if (data.status === 'FAILED') {
            setErrorMsg(data.message || 'Pick process failed.');
            setIsProcessing(false);
          }

          if (data.activity === 'FILE_GENERATED' && data.status === 'SUCCESS') {
            setIsProcessing(false);
            setIsCompleted(true);
            const lineCount = data.lineCount || expectedLineCount;
            setCompletedInfo({
              fileName: data.fileName,
              pickId: data.pick_id,
              lineCount: lineCount,
              label: label,
            });
          }
        }
      },
      () => setIsProcessing(false),
      () => setIsProcessing(false)
    );
  };

  const handleDownloadFile = async () => {
    if (!completedInfo?.pickId) return;
    try {
      setIsDownloading(true);
      const { blob, fileName } = await apiDownloadFile('/pick/download-text-file', {
        id: completedInfo.pickId,
      });
      downloadBlob(blob, fileName);
    } catch (err: any) {
      alert(err.message || 'Error downloading pick file');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="pick-page-layout">
      <style jsx>{`
        .pick-page-layout {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          min-height: calc(100vh - 90px);
        }

        .workstation-header {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: rgba(245, 158, 11, 0.14);
          color: #d97706;
          border: 1px solid rgba(245, 158, 11, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
        }

        .header-sub {
          font-size: 12.5px;
          color: #64748b;
          margin-top: 2px;
        }

        /* Two-Column Split */
        .workstation-split {
          display: grid;
          grid-template-columns: 530px 1fr;
          gap: 1.25rem;
          align-items: flex-start;
        }

        @media (max-width: 1080px) {
          .workstation-split {
            grid-template-columns: 1fr;
          }
        }

        .panel-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        /* 2-Segment Mode Toggle */
        .mode-toggle-bar {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 10px;
          gap: 4px;
        }

        .mode-tab-btn {
          border: none;
          background: transparent;
          padding: 9px 12px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          transition: all 0.15s ease;
        }

        .mode-tab-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 5px;
        }

        .field-input-box {
          position: relative;
          display: flex;
          align-items: center;
        }

        .field-input {
          width: 100%;
          height: 44px;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          padding: 0 12px 0 38px;
          font-size: 14.5px;
          font-weight: 600;
          color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
        }

        .field-input:focus {
          border-color: #d97706;
          box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.15);
        }

        .field-icon {
          position: absolute;
          left: 12px;
          color: #94a3b8;
        }

        /* Stepper */
        .stepper-box {
          display: flex;
          align-items: center;
          border: 1.5px solid #e2e8f0;
          border-radius: 8px;
          height: 42px;
          overflow: hidden;
          background: #ffffff;
        }

        .stepper-btn {
          width: 40px;
          height: 100%;
          background: #f8fafc;
          border: none;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .stepper-btn:hover:not(:disabled) {
          background: #e2e8f0;
          color: #0f172a;
        }

        .stepper-input {
          flex: 1;
          width: 100%;
          border: none;
          text-align: center;
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          outline: none;
        }

        .preset-chip {
          padding: 4px 9px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          font-size: 11.5px;
          font-weight: 700;
          color: #475569;
          cursor: pointer;
        }

        .preset-chip:hover {
          background: #e2e8f0;
        }

        .preset-chip.selected {
          background: #d97706;
          color: #ffffff;
          border-color: #d97706;
        }

        .inventory-table-container {
          max-height: 280px;
          overflow-y: auto;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
        }

        .inventory-row {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid #f1f5f9;
          gap: 10px;
          font-size: 12.5px;
          cursor: pointer;
          transition: background 0.1s ease;
        }

        .inventory-row:hover {
          background: #f8fafc;
        }

        .inventory-row.selected {
          background: #fffbeb;
          border-left: 3px solid #d97706;
        }

        /* Primary Pick Button */
        .btn-pick-execute {
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
          color: #ffffff;
          border: none;
          height: 48px;
          border-radius: 9px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          box-shadow: 0 2px 6px rgba(217, 119, 6, 0.25);
          transition: all 0.2s ease;
        }

        .btn-pick-execute:hover:not(:disabled) {
          background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
          box-shadow: 0 4px 12px rgba(217, 119, 6, 0.35);
          transform: translateY(-1px);
        }

        .btn-pick-execute:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Right Monitor Section */
        .success-banner {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 1rem 1.2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .success-btn {
          background: #16a34a;
          color: #ffffff;
          border: none;
          padding: 7px 15px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .download-btn {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 7px 15px;
          border-radius: 7px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .logs-wrapper {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 1.1rem;
          background: #ffffff;
          min-height: 220px;
          max-height: 480px;
          overflow-y: auto;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
        }
      `}</style>

      {/* Top Header */}
      <div className="workstation-header">
        <div className="header-left">
          <div className="header-icon">
            <PackageMinus size={22} />
          </div>
          <div>
            <h1 className="header-title">PICK Workstation</h1>
            <div className="header-sub">
              Auto FIFO pick by quantity, or select specific serial numbers from Kardex storage
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
          onClick={handleResetAll}
          disabled={isProcessing}
          style={{ fontSize: '12px' }}
        >
          <RotateCcw size={12} />
          <span>Reset Workstation</span>
        </button>
      </div>

      {/* Two-Column Split */}
      <div className="workstation-split">
        {/* Left Column: Command & Selection */}
        <div className="panel-card">
          {/* Mode Switcher */}
          <div className="mode-toggle-bar">
            <button
              type="button"
              className={`mode-tab-btn ${pickMode === 'quick' ? 'active' : ''}`}
              onClick={() => {
                setPickMode('quick');
                setFeedback(null);
                setErrorMsg('');
              }}
              disabled={isProcessing}
            >
              <Zap size={16} className={pickMode === 'quick' ? 'text-warning' : 'text-muted'} />
              <span>Auto Pick (FIFO by Qty)</span>
            </button>

            <button
              type="button"
              className={`mode-tab-btn ${pickMode === 'select' ? 'active' : ''}`}
              onClick={() => {
                setPickMode('select');
                setFeedback(null);
                setErrorMsg('');
              }}
              disabled={isProcessing}
            >
              <ListChecks size={16} className={pickMode === 'select' ? 'text-primary' : 'text-muted'} />
              <span>Select Specific Serials</span>
            </button>
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div
              style={{
                fontSize: '12.5px',
                padding: '8px 12px',
                borderRadius: '7px',
                background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                color: feedback.type === 'success' ? '#15803d' : '#991b1b',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {feedback.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* =========================================================================
              MODE 1: AUTO PICK (FIFO BY QUANTITY) - PURE 1-CLICK FLOW
             ========================================================================= */}
          {pickMode === 'quick' && (
            <form onSubmit={handleExecuteQuickPick} className="d-flex flex-column gap-3">
              {/* Barcode Input */}
              <div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="field-label mb-0">
                    Scan Model Number or Serial Number
                  </label>
                  {isCheckingStock && (
                    <span className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                      <Loader2 size={11} className="spin-animation" /> Checking stock...
                    </span>
                  )}
                  {availableStock !== null && !isCheckingStock && (
                    <span
                      className={`badge ${availableStock > 0 ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger'}`}
                      style={{ fontSize: '11px' }}
                    >
                      {availableStock > 0 ? `${availableStock} available in Kardex` : 'No available stock'}
                    </span>
                  )}
                </div>

                <div className="field-input-box">
                  <Barcode size={18} className="field-icon" />
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    className="field-input"
                    placeholder="Scan barcode (e.g. SA005157 or S1)..."
                    value={barcodeInput}
                    onChange={(e) => handleBarcodeInput(e.target.value)}
                    disabled={isProcessing}
                    required
                    autoFocus
                  />
                </div>

                {detectedModel && detectedModel !== barcodeInput.trim() && (
                  <div className="mt-1" style={{ fontSize: '11.5px', color: '#15803d' }}>
                    ✓ Auto-detected Model: <strong>{detectedModel}</strong>
                  </div>
                )}
              </div>

              {/* Quantity Stepper & Presets */}
              <div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="field-label mb-0">Quantity to Pick</label>
                  <div className="d-flex align-items-center gap-1">
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Presets:</span>
                    {[1, 5, 10, 15, 20].map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={`preset-chip ${quantity === q ? 'selected' : ''}`}
                        onClick={() => setQuantity(q)}
                        disabled={isProcessing}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="stepper-box">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={isProcessing || quantity <= 1}
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={availableStock || 50}
                    className="stepper-input"
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Math.max(1, Math.min(availableStock || 50, Number(e.target.value) || 1)))
                    }
                    disabled={isProcessing}
                  />
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => setQuantity((q) => Math.min(availableStock || 50, q + 1))}
                    disabled={isProcessing || (availableStock ? quantity >= availableStock : false)}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Direct 1-Click Pick Button */}
              <button
                type="submit"
                className="btn-pick-execute mt-2"
                disabled={isProcessing || !barcodeInput.trim()}
              >
                <PackageMinus size={18} />
                <span>
                  {isProcessing
                    ? 'Validating & Processing Pick Order...'
                    : !barcodeInput.trim()
                    ? 'Scan Model or Serial to Start'
                    : `Auto-Pick ${quantity} Units (${detectedModel || barcodeInput.trim()}) → Generate File`}
                </span>
              </button>
            </form>
          )}

          {/* =========================================================================
              MODE 2: SELECT SPECIFIC SERIALS (AUTO-LOADS AS YOU TYPE/SCAN)
             ========================================================================= */}
          {pickMode === 'select' && (
            <div className="d-flex flex-column gap-3">
              {/* Model Input with Auto-Load */}
              <div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="field-label mb-0">
                    Scan or Enter Model Number
                  </label>
                  {isLoadingInventory && (
                    <span className="text-muted d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                      <Loader2 size={11} className="spin-animation" /> Loading available stock...
                    </span>
                  )}
                  {inventoryList.length > 0 && (
                    <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '11px' }}>
                      {inventoryList.length} serials in stock
                    </span>
                  )}
                </div>

                <div className="field-input-box">
                  <Search size={18} className="field-icon" />
                  <input
                    ref={selectModelInputRef}
                    type="text"
                    className="field-input"
                    placeholder="Enter model number (e.g. SA005157)..."
                    value={selectModelInput}
                    onChange={(e) => handleSelectModelInputChange(e.target.value)}
                    disabled={isProcessing}
                    autoFocus
                  />
                </div>
              </div>

              {/* Target Quantity Stepper */}
              {inventoryList.length > 0 && (
                <div className="d-flex align-items-center justify-content-between p-2 rounded bg-light border">
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                      Model: {resolvedSelectModel}
                    </strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Available in Kardex: {inventoryList.length} units
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Target:</span>
                    <div className="stepper-box" style={{ width: '120px', height: '34px' }}>
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => setSelectTargetQty((q) => Math.max(1, q - 1))}
                        disabled={isProcessing || selectTargetQty <= 1}
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        className="stepper-input"
                        value={selectTargetQty}
                        onChange={(e) => setSelectTargetQty(Math.max(1, Number(e.target.value) || 1))}
                        disabled={isProcessing}
                        style={{ fontSize: '13px' }}
                      />
                      <button
                        type="button"
                        className="stepper-btn"
                        onClick={() => setSelectTargetQty((q) => q + 1)}
                        disabled={isProcessing}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Serials Checklist */}
              {inventoryList.length > 0 && (
                <div className="p-2 rounded bg-light border d-flex flex-column gap-2">
                  {/* Toolbar */}
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    <span className="badge bg-primary text-white">
                      Selected: {selectedSerialNumbers.length} / {selectTargetQty}
                    </span>

                    <div className="d-flex align-items-center gap-1">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary py-1 px-2"
                        style={{ fontSize: '11.5px' }}
                        onClick={handleSelectFirstN}
                        disabled={isProcessing}
                      >
                        Select First {selectTargetQty}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary py-1 px-2"
                        style={{ fontSize: '11.5px' }}
                        onClick={handleDeselectAll}
                        disabled={isProcessing || selectedSerialNumbers.length === 0}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Filter Search */}
                  <div className="field-input-box">
                    <Search size={14} className="field-icon" />
                    <input
                      type="text"
                      className="field-input"
                      placeholder="Filter serials or slot..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      style={{ height: '34px', fontSize: '12px' }}
                    />
                  </div>

                  {/* Serials List */}
                  <div className="inventory-table-container">
                    {filteredInventory.map((item) => {
                      const isSelected = selectedSerialNumbers.includes(item.serial_number);
                      return (
                        <div
                          key={item.serial_number}
                          className={`inventory-row ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleToggleSelectSerial(item.serial_number)}
                        >
                          <div className="text-primary flex-shrink-0">
                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </div>

                          <span className="font-monospace fw-bold text-dark flex-1">
                            {item.serial_number}
                          </span>

                          <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: '11px' }}>
                            <MapPin size={11} />
                            <span>
                              {item.handling_unit?.hu_id || 'Bin'} (Slot #{item.compartment?.compartment_number || '-'})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Execute Selected Pick Button */}
              <button
                type="button"
                className="btn-pick-execute mt-1"
                onClick={handleExecuteSelectedPick}
                disabled={isProcessing || selectedSerialNumbers.length === 0}
              >
                <PackageMinus size={18} />
                <span>
                  {isProcessing
                    ? 'Validating & Processing Selected Serials...'
                    : selectedSerialNumbers.length === 0
                    ? selectModelInput.trim()
                      ? 'Select Serial Numbers from List Above'
                      : 'Scan or Enter Model Number to View Serials'
                    : `Pick ${selectedSerialNumbers.length} Selected Serials → Generate File`}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Live MES Verification & Status Monitor */}
        <div className="panel-card">
          <div className="d-flex align-items-center justify-content-between pb-2 border-bottom">
            <h2 className="panel-title d-flex align-items-center gap-2 m-0" style={{ fontSize: '15px' }}>
              <ShieldCheck size={18} className="text-success" />
              <span>Live MES Verification & File Generation</span>
            </h2>

            {isProcessing && (
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1 py-1 px-2">
                <Loader2 size={12} className="spin-animation" /> Processing Live
              </span>
            )}
          </div>

          {/* Success Banner */}
          {isCompleted && (
            <div className="success-banner">
              <div className="d-flex align-items-center gap-3">
                <CheckCircle2 size={26} className="text-success flex-shrink-0" />
                <div>
                  <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>
                    Pick Order Generated Successfully!
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#15803d' }}>
                    Generated <strong>{completedInfo?.lineCount || 1} line item{completedInfo?.lineCount && completedInfo.lineCount > 1 ? 's' : ''}</strong>{' '}
                    ({completedInfo?.label}) in file:{' '}
                    <span className="font-monospace fw-bold">{completedInfo?.fileName}</span>
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                {completedInfo?.pickId && (
                  <button
                    type="button"
                    className="download-btn"
                    onClick={handleDownloadFile}
                    disabled={isDownloading}
                  >
                    <Download size={14} />
                    <span>{isDownloading ? 'Downloading...' : 'Download Pick File'}</span>
                  </button>
                )}

                <button type="button" className="success-btn" onClick={handleResetAll}>
                  <span>Pick Next</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                padding: '0.85rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#991b1b',
                fontSize: '13px',
              }}
            >
              <AlertCircle size={20} className="flex-shrink-0" />
              <div className="flex-1">
                <strong>Error: </strong> {errorMsg}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger ms-auto"
                style={{ fontSize: '12px', padding: '3px 8px' }}
                onClick={() => setErrorMsg('')}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Timeline Logs Section */}
          <div className="logs-wrapper">
            {logs.length === 0 && !isProcessing && !isCompleted && (
              <div className="text-center py-5 text-muted" style={{ fontSize: '13px' }}>
                <Clock size={32} className="text-secondary opacity-50 mb-2 d-block mx-auto" />
                Scan barcode on the left to begin. Live MES validation will stream here.
              </div>
            )}

            {(isProcessing || logs.length > 0) && (
              <>
                <TimelineProgress
                  logs={logs}
                  steps={PICK_STEPS}
                  isProcessing={isProcessing}
                />
                <div ref={logsEndRef} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
