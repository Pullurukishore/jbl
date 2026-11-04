'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/shared/Modal';
import { TimelineProgress } from '@/components/shared/TimelineProgress';
import { connectSSE, apiPost } from '@/lib/api';
import { Log, Put, PaginatedResponse } from '@/types';
import {
  PackageMinus,
  Search,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Minus,
  Plus,
  ArrowRight,
  Boxes,
  Copy,
  Check,
} from 'lucide-react';

interface ScanAndStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PICK_STEPS = [
  { key: 'FETCH_DETAILS', label: '1. Fetch Available Serial Numbers' },
  { key: 'CHECK_QTY', label: '2. Verify Required Quantity' },
  { key: 'CHECK_STATUS', label: '3. Update Kanban Board History' },
  { key: 'FILE_GENERATED', label: '4. Generate Pick Order Text File' },
];

export const ScanAndStoreModal: React.FC<ScanAndStoreModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [modelNumber, setModelNumber] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [previewPuts, setPreviewPuts] = useState<Put[]>([]);
  const [previewMsg, setPreviewMsg] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);

  const modelInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setModelNumber('');
      setQuantity(1);
      setPreviewPuts([]);
      setPreviewMsg('');
      setLogs([]);
      setIsSearching(false);
      setIsProcessing(false);
      setIsCompleted(false);
      setErrorMsg('');
    } else {
      setTimeout(() => modelInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if ((isProcessing || logs.length > 0) && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isProcessing, logs]);

  const handleReset = () => {
    setModelNumber('');
    setQuantity(1);
    setPreviewPuts([]);
    setPreviewMsg('');
    setLogs([]);
    setIsSearching(false);
    setIsProcessing(false);
    setIsCompleted(false);
    setErrorMsg('');
    setTimeout(() => modelInputRef.current?.focus(), 50);
  };

  const handleSearch = async () => {
    if (!modelNumber.trim() || quantity <= 0) return;
    try {
      setIsSearching(true);
      setErrorMsg('');
      const res = await apiPost<PaginatedResponse<Put>>('/put/find-by-model-and-qty', {
        partNumber: modelNumber.trim(),
        quantity: Number(quantity),
        page: 1,
        size: Number(quantity),
      });

      setPreviewPuts(res.data || []);
      setPreviewMsg(res.message || '');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error searching model number');
    } finally {
      setIsSearching(false);
    }
  };

  const handleProcess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelNumber.trim() || quantity <= 0 || isProcessing) return;

    setLogs([]);
    setIsProcessing(true);
    setIsCompleted(false);
    setErrorMsg('');

    connectSSE(
      `/pick/create/${encodeURIComponent(modelNumber.trim())}/${quantity}`,
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
            setErrorMsg(data.message || 'PICK process failed.');
            setIsProcessing(false);
          }

          if (data.activity === 'FILE_GENERATED' && data.status === 'SUCCESS') {
            setIsProcessing(false);
            setIsCompleted(true);
            onSuccess();
          }
        }
      },
      () => {
        setIsProcessing(false);
      },
      () => {
        setIsProcessing(false);
      }
    );
  };

  const copyToClipboard = (serial: string) => {
    navigator.clipboard.writeText(serial);
    setCopiedSerial(serial);
    setTimeout(() => setCopiedSerial(null), 1500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="d-flex align-items-center gap-2">
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.14)',
              color: '#d97706',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PackageMinus size={18} />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold" style={{ fontSize: '16px', color: '#0f172a' }}>
                PICK Process — Scan Model & Quantity
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#b45309',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  letterSpacing: '0.5px',
                }}
              >
                OUTBOUND
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Allocate available serial numbers from stock & generate pick order
            </div>
          </div>
        </div>
      }
      maxWidth="720px"
    >
      <div className="pick-modal-content">
        <style jsx>{`
          .pick-modal-content {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
          }

          .pick-form-card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          }

          .input-row {
            display: grid;
            grid-template-columns: 1fr 190px auto;
            gap: 0.75rem;
            align-items: flex-end;
          }

          @media (max-width: 640px) {
            .input-row {
              grid-template-columns: 1fr;
            }
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
            height: 40px;
            border: 1.5px solid #e2e8f0;
            border-radius: 8px;
            padding: 0 12px 0 34px;
            font-size: 13.5px;
            font-weight: 500;
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
            left: 10px;
            color: #94a3b8;
          }

          /* Stepper Input */
          .stepper-box {
            display: flex;
            align-items: center;
            border: 1.5px solid #e2e8f0;
            border-radius: 8px;
            height: 40px;
            overflow: hidden;
            background: #ffffff;
          }

          .stepper-box:focus-within {
            border-color: #d97706;
            box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.15);
          }

          .stepper-btn {
            width: 38px;
            height: 100%;
            background: #f8fafc;
            border: none;
            color: #64748b;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background 0.15s;
          }

          .stepper-btn:hover:not(:disabled) {
            background: #e2e8f0;
            color: #0f172a;
          }

          .stepper-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .stepper-input {
            flex: 1;
            width: 100%;
            border: none;
            text-align: center;
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            outline: none;
            padding: 0;
            background: transparent;
          }

          .btn-preview-action {
            height: 40px;
            padding: 0 16px;
            border-radius: 8px;
            background: #f8fafc;
            border: 1.5px solid #e2e8f0;
            color: #334155;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
            transition: all 0.15s ease;
          }

          .btn-preview-action:hover:not(:disabled) {
            background: #f1f5f9;
            border-color: #cbd5e1;
            color: #0f172a;
          }

          .btn-preview-action:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          /* Quick presets */
          .quick-presets {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11.5px;
            color: #64748b;
          }

          .preset-chip {
            padding: 2px 8px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            font-size: 11px;
            font-weight: 600;
            color: #475569;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .preset-chip:hover {
            background: #e2e8f0;
          }

          .preset-chip.selected {
            background: #d97706;
            color: #ffffff;
            border-color: #d97706;
          }

          /* Stock preview card */
          .preview-panel {
            border: 1px solid #fef3c7;
            background: #fffbeb;
            border-radius: 8px;
            padding: 12px 14px;
          }

          .preview-panel-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
          }

          .preview-panel-title {
            font-size: 12.5px;
            font-weight: 700;
            color: #92400e;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .preview-tag-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            max-height: 120px;
            overflow-y: auto;
          }

          .preview-chip {
            background: #ffffff;
            border: 1px solid #fde68a;
            color: #b45309;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 12px;
            font-family: monospace;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            cursor: pointer;
            transition: all 0.15s;
          }

          .preview-chip:hover {
            border-color: #d97706;
            background: #fff7ed;
          }

          /* Primary Execute Button */
          .btn-execute-action {
            background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
            color: #ffffff;
            border: none;
            height: 42px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            box-shadow: 0 2px 6px rgba(217, 119, 6, 0.25);
            transition: all 0.2s ease;
          }

          .btn-execute-action:hover:not(:disabled) {
            background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
            box-shadow: 0 4px 12px rgba(217, 119, 6, 0.35);
            transform: translateY(-1px);
          }

          .btn-execute-action:disabled {
            opacity: 0.65;
            cursor: not-allowed;
          }

          /* Success & Error Banners */
          .success-banner {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            padding: 1rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }

          .success-btn {
            background: #16a34a;
            color: #ffffff;
            border: none;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12.5px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: background 0.15s ease;
          }

          .success-btn:hover {
            background: #15803d;
          }

          .error-banner {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 10px;
            padding: 0.85rem 1rem;
            display: flex;
            align-items: center;
            gap: 10px;
            color: #991b1b;
            font-size: 13px;
          }

          .logs-wrapper {
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 1rem;
            background: #ffffff;
            max-height: 320px;
            overflow-y: auto;
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
          }
        `}</style>

        {/* Form Controls Card */}
        <form onSubmit={handleProcess} className="pick-form-card">
          <div className="input-row">
            {/* Model Number */}
            <div>
              <label className="field-label">Part / Model Number</label>
              <div className="field-input-box">
                <Search size={16} className="field-icon" />
                <input
                  ref={modelInputRef}
                  type="text"
                  className="field-input"
                  placeholder="Enter model number (e.g. 5013000)..."
                  value={modelNumber}
                  onChange={(e) => setModelNumber(e.target.value)}
                  disabled={isProcessing}
                  required
                />
              </div>
            </div>

            {/* Quantity with Stepper */}
            <div>
              <label className="field-label">Quantity</label>
              <div className="stepper-box">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={isProcessing || quantity <= 1}
                  title="Decrease"
                >
                  <Minus size={14} />
                </button>

                <input
                  type="number"
                  min="1"
                  max="100"
                  className="stepper-input"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  disabled={isProcessing}
                  required
                />

                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setQuantity((q) => q + 1)}
                  disabled={isProcessing}
                  title="Increase"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Preview Button */}
            <button
              type="button"
              className="btn-preview-action"
              onClick={handleSearch}
              disabled={isSearching || isProcessing || !modelNumber.trim()}
              title="Check available serial numbers in stock"
            >
              <Boxes size={15} />
              <span>{isSearching ? 'Checking...' : 'Check Stock'}</span>
            </button>
          </div>

          {/* Quick Quantity Chips & Hints */}
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="quick-presets">
              <span>Quick Qty:</span>
              {[1, 2, 5, 10, 20].map((q) => (
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

            {logs.length > 0 && (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none text-muted"
                onClick={handleReset}
                style={{ fontSize: '11.5px' }}
              >
                <RotateCcw size={11} className="me-1" /> Reset All
              </button>
            )}
          </div>

          {/* Available Serials Preview Card */}
          {previewPuts.length > 0 && (
            <div className="preview-panel">
              <div className="preview-panel-header">
                <div className="preview-panel-title">
                  <Boxes size={14} />
                  <span>
                    Available Inventory ({previewPuts.length} items ready for model &ldquo;{modelNumber}&rdquo;)
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: previewPuts.length >= quantity ? '#15803d' : '#b45309',
                  }}
                >
                  {previewPuts.length >= quantity
                    ? '✓ Sufficient stock available'
                    : `⚠ Only ${previewPuts.length} available (requested ${quantity})`}
                </span>
              </div>

              <div className="preview-tag-list">
                {previewPuts.map((p) => (
                  <span
                    key={p.id}
                    className="preview-chip"
                    onClick={() => copyToClipboard(p.serial_number)}
                    title="Click to copy serial"
                  >
                    {p.serial_number}
                    {copiedSerial === p.serial_number ? (
                      <Check size={11} className="text-success" />
                    ) : (
                      <Copy size={11} className="text-muted" />
                    )}
                  </span>
                ))}
              </div>

              {previewMsg && (
                <div style={{ fontSize: '11.5px', color: '#78350f', marginTop: '6px' }}>
                  {previewMsg}
                </div>
              )}
            </div>
          )}

          {/* Primary Execute Pick Button */}
          <button
            type="submit"
            className="btn-execute-action"
            disabled={isProcessing || !modelNumber.trim() || quantity <= 0}
          >
            <PackageMinus size={18} />
            <span>
              {isProcessing
                ? 'Executing Pick Process...'
                : `Execute Pick Process (${quantity} unit${quantity > 1 ? 's' : ''})`}
            </span>
          </button>
        </form>

        {/* Success Banner */}
        {isCompleted && (
          <div className="success-banner">
            <div className="d-flex align-items-center gap-2">
              <CheckCircle2 size={24} className="text-success flex-shrink-0" />
              <div>
                <div className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>
                  PICK Order Generated Successfully!
                </div>
                <div style={{ fontSize: '12px', color: '#15803d' }}>
                  Allocated {quantity} part{quantity > 1 ? 's' : ''} for model{' '}
                  <span className="fw-bold">{modelNumber}</span>.
                </div>
              </div>
            </div>

            <button type="button" className="success-btn" onClick={handleReset}>
              <span>Pick Another</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="error-banner">
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
        {(isProcessing || logs.length > 0) && (
          <div className="logs-wrapper">
            <TimelineProgress
              logs={logs}
              steps={PICK_STEPS}
              isProcessing={isProcessing}
            />
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </Modal>
  );
};

