'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/shared/Modal';
import { TimelineProgress } from '@/components/shared/TimelineProgress';
import { connectSSE, apiPost, apiDownloadFile, downloadBlob } from '@/lib/api';
import { copyToClipboard as copyUtil } from '@/lib/clipboard';
import { Log, Put } from '@/types';
import {
  PackageMinus,
  Search,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Minus,
  Plus,
  Boxes,
  Copy,
  Check,
  Barcode,
  Download,
  Loader2,
  Clock,
  ArrowRight,
  ShieldCheck,
  MapPin,
} from 'lucide-react';

interface ScanAndStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PICK_STEPS = [
  { key: 'FETCH_DETAILS', label: '1. Verify Stock & MES Status' },
  { key: 'CHECK_QTY', label: '2. Verify Required Quantity' },
  { key: 'CHECK_STATUS', label: '3. Update MES Kanban History' },
  { key: 'FILE_GENERATED', label: '4. Generate Pick Order Text File' },
];

export const ScanAndStoreModal: React.FC<ScanAndStoreModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [resolvedModel, setResolvedModel] = useState('');
  const [specificSerial, setSpecificSerial] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [detectedNote, setDetectedNote] = useState<string | null>(null);

  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const [previewPuts, setPreviewPuts] = useState<Put[]>([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);
  const [serialDetails, setSerialDetails] = useState<any | null>(null);

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
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    } else {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if ((isProcessing || logs.length > 0) && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isProcessing, logs]);

  const handleReset = () => {
    setBarcodeInput('');
    setResolvedModel('');
    setSpecificSerial(null);
    setQuantity(1);
    setDetectedNote(null);
    setAvailableCount(null);
    setPreviewPuts([]);
    setSerialDetails(null);
    setLogs([]);
    setIsSearchingStock(false);
    setIsProcessing(false);
    setIsCompleted(false);
    setCompletedInfo(null);
    setIsDownloading(false);
    setErrorMsg('');
    setTimeout(() => barcodeInputRef.current?.focus(), 50);
  };

  const handleLookup = async () => {
    const raw = barcodeInput.trim();
    if (!raw) return;

    try {
      setIsSearchingStock(true);
      setErrorMsg('');
      setDetectedNote(null);
      setSerialDetails(null);

      const res = await apiPost<any>('/put/find-by-model-and-qty', {
        partNumber: raw,
        quantity: Math.max(1, Number(quantity) || 1),
        page: 1,
        size: 10,
      });

      const model = res.resolvedModelNumber || raw;
      setResolvedModel(model);
      setAvailableCount(res.totalItems || 0);
      setPreviewPuts(res.data || []);

      if (res.isFromSerial) {
        setSpecificSerial(raw);
        setDetectedNote(`Serial "${raw}" recognized (Model: ${model}).`);
        if (quantity <= 1) setQuantity(1);

        try {
          const detailRes = await apiPost<any>('/pick/validate-serial', { serialNumber: raw });
          if (detailRes?.data) setSerialDetails(detailRes.data);
        } catch {}
      } else {
        setSpecificSerial(null);
        setDetectedNote(`Model "${model}" confirmed. Available in inventory: ${res.totalItems || 0} unit(s).`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error looking up barcode.');
    } finally {
      setIsSearchingStock(false);
    }
  };

  const handleExecutePick = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = barcodeInput.trim();
    if (!raw || quantity <= 0 || isProcessing) return;

    const modelToPick = resolvedModel || raw;

    setLogs([]);
    setIsProcessing(true);
    setIsCompleted(false);
    setCompletedInfo(null);
    setErrorMsg('');

    let endpoint = `/pick/create/${encodeURIComponent(modelToPick)}/${quantity}`;
    if (specificSerial && quantity === 1) {
      endpoint += `?serials=${encodeURIComponent(specificSerial)}`;
    }

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
            const lineCount = data.lineCount || quantity;
            setCompletedInfo({
              fileName: data.fileName,
              pickId: data.pick_id,
              lineCount: lineCount,
              label: specificSerial && quantity === 1
                ? `Specific Serial ${specificSerial} (${modelToPick})`
                : `${lineCount} serials for model ${modelToPick}`,
            });
            onSuccess();
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

  const copyToClipboard = (serial: string) => {
    copyUtil(serial);
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
                PICK Process — Scan & Pick
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
              Scan Model Number or Serial Number, set quantity, and generate multi-line pick orders
            </div>
          </div>
        </div>
      }
      maxWidth="760px"
    >
      <div className="d-flex flex-column gap-3">
        <form onSubmit={handleExecutePick} className="bg-white border rounded-3 p-3 d-flex flex-column gap-3">
          {/* Barcode Input */}
          <div>
            <label className="form-label fw-semibold text-secondary" style={{ fontSize: '12px' }}>
              Scan Model Number OR Serial Number
            </label>
            <div className="d-flex gap-2">
              <div className="position-relative flex-1">
                <Barcode size={18} className="position-absolute text-muted" style={{ left: '12px', top: '12px' }} />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  className="form-control ps-5"
                  style={{ height: '42px', fontWeight: 600 }}
                  placeholder="Scan barcode (e.g. SA005157 or S1)..."
                  value={barcodeInput}
                  onChange={(e) => {
                    setBarcodeInput(e.target.value);
                    setDetectedNote(null);
                    setResolvedModel('');
                    setSpecificSerial(null);
                    setAvailableCount(null);
                    setPreviewPuts([]);
                    setSerialDetails(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLookup();
                    }
                  }}
                  disabled={isProcessing}
                  required
                />
              </div>

              <button
                type="button"
                className="btn btn-light border px-3 fw-semibold d-inline-flex align-items-center gap-1"
                onClick={handleLookup}
                disabled={isSearchingStock || isProcessing || !barcodeInput.trim()}
              >
                {isSearchingStock ? <Loader2 size={15} className="spin-animation" /> : <Search size={15} />}
                <span>{isSearchingStock ? 'Checking...' : 'Check'}</span>
              </button>
            </div>
          </div>

          {/* Quantity Stepper */}
          <div>
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="form-label fw-semibold text-secondary mb-0" style={{ fontSize: '12px' }}>
                Quantity to Pick
              </label>
              <div className="d-flex gap-1 align-items-center" style={{ fontSize: '11px' }}>
                <span className="text-muted">Presets:</span>
                {[1, 5, 10, 15, 20].map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`btn btn-sm py-0 px-2 fw-bold ${quantity === q ? 'btn-warning' : 'btn-light border'}`}
                    style={{ fontSize: '11px' }}
                    onClick={() => {
                      setQuantity(q);
                      if (barcodeInput.trim()) handleLookup();
                    }}
                    disabled={isProcessing}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group" style={{ maxWidth: '240px' }}>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={isProcessing || quantity <= 1}
              >
                <Minus size={14} />
              </button>
              {/* Maximum pick limit dynamically bounded by available stock or high safety ceiling */}
              {(() => {
                const maxAllowed = previewPuts.length > 0 ? previewPuts.length : 500;
                return (
                  <>
                    <input
                      type="number"
                      min="1"
                      max={maxAllowed}
                      className="form-control text-center fw-bold fs-6"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(maxAllowed, Number(e.target.value) || 1)))}
                      disabled={isProcessing}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setQuantity((q) => Math.min(maxAllowed, q + 1))}
                      disabled={isProcessing || quantity >= maxAllowed}
                    >
                      <Plus size={14} />
                    </button>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Detected Info */}
          {detectedNote && (
            <div className="bg-light p-2 rounded-2 border d-flex justify-content-between align-items-center" style={{ fontSize: '12.5px' }}>
              <div className="d-flex align-items-center gap-2">
                <CheckCircle2 size={15} className="text-success" />
                <span className="fw-semibold text-dark">{detectedNote}</span>
              </div>
              {availableCount !== null && (
                <span className="badge bg-secondary-subtle text-secondary border">
                  Stock: {availableCount}
                </span>
              )}
            </div>
          )}

          {/* Stock Preview (when quantity > 1) */}
          {previewPuts.length > 0 && quantity > 1 && (
            <div className="bg-warning-subtle border border-warning-subtle rounded-2 p-2">
              <div className="d-flex justify-content-between align-items-center mb-1" style={{ fontSize: '11.5px' }}>
                <span className="fw-bold text-dark">FIFO Stock Candidate Serials ({previewPuts.length} available):</span>
                <span className={previewPuts.length >= quantity ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                  {previewPuts.length >= quantity ? '✓ Sufficient' : `⚠ Only ${previewPuts.length} available`}
                </span>
              </div>
              <div className="d-flex flex-wrap gap-1">
                {previewPuts.slice(0, quantity).map((p) => (
                  <span
                    key={p.id}
                    className="badge bg-white text-dark border font-monospace px-2 py-1"
                    style={{ cursor: 'pointer' }}
                    onClick={() => copyToClipboard(p.serial_number)}
                  >
                    {p.serial_number}
                    {copiedSerial === p.serial_number ? <Check size={10} className="text-success ms-1" /> : <Copy size={10} className="text-muted ms-1" />}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Execute Button */}
          <button
            type="submit"
            className="btn btn-warning fw-bold py-2 text-white d-flex align-items-center justify-content-center gap-2"
            disabled={isProcessing || !barcodeInput.trim() || quantity <= 0}
            style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', border: 'none' }}
          >
            <PackageMinus size={18} />
            <span>
              {isProcessing
                ? `Validating & Picking ${quantity} Unit${quantity > 1 ? 's' : ''}...`
                : specificSerial && quantity === 1
                ? `Pick Serial [${specificSerial}] → Generate Pick Order`
                : `Pick ${quantity} Units (${resolvedModel || barcodeInput.trim()}) → Generate ${quantity}-Line File`}
            </span>
          </button>
        </form>

        {/* Success Banner */}
        {isCompleted && (
          <div className="alert alert-success d-flex align-items-center justify-content-between p-3 rounded-3">
            <div className="d-flex align-items-center gap-2">
              <CheckCircle2 size={24} className="text-success" />
              <div>
                <strong className="d-block" style={{ fontSize: '14px' }}>Pick Order Generated!</strong>
                <span style={{ fontSize: '12px' }}>
                  {completedInfo?.lineCount || quantity} line item(s) in file: <code className="fw-bold">{completedInfo?.fileName}</code>
                </span>
              </div>
            </div>

            <div className="d-flex gap-2">
              {completedInfo?.pickId && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm fw-semibold d-inline-flex align-items-center gap-1"
                  onClick={handleDownloadFile}
                  disabled={isDownloading}
                >
                  <Download size={13} />
                  <span>Download File</span>
                </button>
              )}
              <button type="button" className="btn btn-success btn-sm fw-semibold" onClick={handleReset}>
                <span>Pick Next</span>
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="alert alert-danger p-2 rounded-2 d-flex align-items-center justify-content-between mb-0" style={{ fontSize: '13px' }}>
            <span><strong>Error:</strong> {errorMsg}</span>
            <button type="button" className="btn-close" onClick={() => setErrorMsg('')} />
          </div>
        )}

        {/* SSE Timeline Logs */}
        {(isProcessing || logs.length > 0) && (
          <div className="border rounded-3 p-3 bg-white" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <TimelineProgress logs={logs} steps={PICK_STEPS} isProcessing={isProcessing} />
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </Modal>
  );
};
