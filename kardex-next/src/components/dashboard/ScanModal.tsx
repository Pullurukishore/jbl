'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/shared/Modal';
import { TimelineProgress } from '@/components/shared/TimelineProgress';
import { connectSSE } from '@/lib/api';
import { Log } from '@/types';
import { Scan, RotateCcw, PackagePlus, CheckCircle2, AlertCircle, X, ArrowRight, Send } from 'lucide-react';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (serialNumber?: string) => void;
  huId?: string;
  compartmentNumber?: number | null;
  embedded?: boolean;
  isFull?: boolean;
  onSendToKardex?: () => void;
}

const PUT_STEPS = [
  { key: 'FETCH_DETAILS', label: '1. Fetch Board Details' },
  { key: 'CHECK_STATUS', label: '2. Check Kanban Process Status' },
  { key: 'PASS_FAIL', label: '3. Verify PV Status & Birth Date' },
  { key: 'FIND_CSV', label: '4. Find PO CSV in Network Drive' },
  { key: 'FIND_MODEL', label: '5. Parse & Find Model' },
  { key: 'MODEL_FOUND/NOTFOUND', label: '6. Verify Model Availability' },
  { key: 'CHECKING_AVAILABILITY', label: '7. Check Open GR Quantity' },
];

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  huId,
  compartmentNumber,
  embedded = false,
  isFull = false,
  onSendToKardex,
}) => {
  const [serialNumber, setSerialNumber] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  // Clean up any active SSE connection on unmount
  useEffect(() => {
    return () => {
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      sseRef.current?.close();
      sseRef.current = null;
      setSerialNumber('');
      setLogs([]);
      setIsProcessing(false);
      setErrorMsg('');
      setIsCompleted(false);
    } else if (!isFull) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isFull]);

  useEffect(() => {
    if (isOpen) {
      setSerialNumber('');
      setLogs([]);
      setIsProcessing(false);
      setErrorMsg('');
      setIsCompleted(false);
      if (!isFull) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    }
  }, [compartmentNumber, isFull]);

  useEffect(() => {
    if ((isProcessing || logs.length > 0) && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isProcessing, logs]);

  const handleReset = () => {
    sseRef.current?.close();
    sseRef.current = null;
    setSerialNumber('');
    setLogs([]);
    setIsProcessing(false);
    setErrorMsg('');
    setIsCompleted(false);
    if (!isFull) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFull || !serialNumber.trim() || isProcessing) return;

    setIsProcessing(true);
    setLogs([]);
    setErrorMsg('');
    setIsCompleted(false);

    const queryParams = new URLSearchParams();
    if (huId) queryParams.append('hu_id', huId);
    if (compartmentNumber !== null && compartmentNumber !== undefined) {
      queryParams.append('compartment_number', String(compartmentNumber));
    }
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    sseRef.current?.close();
    sseRef.current = connectSSE(
      `/put/create/${encodeURIComponent(serialNumber.trim())}${queryString}`,
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
            setErrorMsg(data.message || 'PUT process failed.');
            setIsProcessing(false);
            sseRef.current?.close();
            sseRef.current = null;
          }

          const isFinished =
            data.status === 'SUCCESS' &&
            (data.activity === 'CHECKING_AVAILABILITY' ||
              data.activity === 'FILE_GENERATED' ||
              data.activity === 'ALLOCATE' ||
              data.activity === 'COMPLETE' ||
              data.success === true);

          if (isFinished) {
            setIsProcessing(false);
            setIsCompleted(true);
            sseRef.current?.close();
            sseRef.current = null;
            onSuccess(serialNumber.trim());
          }
        }
      },
      () => {
        setIsProcessing(false);
        sseRef.current?.close();
        sseRef.current = null;
      },
      () => {
        setIsProcessing(false);
        sseRef.current?.close();
        sseRef.current = null;
      }
    );
  };

  const titleContent = (
    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0, overflow: 'hidden' }}>
      <div
        style={{
          width: embedded ? '28px' : '32px',
          height: embedded ? '28px' : '32px',
          borderRadius: embedded ? '7px' : '8px',
          background: isFull ? 'rgba(239, 68, 68, 0.12)' : 'rgba(56, 189, 248, 0.14)',
          color: isFull ? '#dc2626' : '#0284c7',
          border: isFull ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <PackagePlus size={embedded ? 15 : 18} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="d-flex align-items-center justify-content-between gap-1">
          <span className="fw-bold text-truncate" style={{ fontSize: embedded ? '13px' : '15.5px', color: '#0f172a' }}>
            {isFull ? 'Bin Full' : 'PUT Process'}
          </span>
          <span
            style={{
              fontSize: embedded ? '9px' : '10px',
              fontWeight: 700,
              padding: embedded ? '1px 6px' : '2px 8px',
              borderRadius: '9999px',
              background: isFull ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              color: isFull ? '#b91c1c' : '#0369a1',
              border: isFull ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(56, 189, 248, 0.35)',
              letterSpacing: '0.4px',
              whiteSpace: 'nowrap',
            }}
          >
            {isFull ? 'LOCKED' : 'INBOUND'}
          </span>
        </div>
        <div className="text-truncate" style={{ fontSize: embedded ? '11px' : '12px', color: '#64748b', marginTop: '1px' }}>
          {isFull
            ? 'All 30 compartments filled.'
            : huId && compartmentNumber
              ? `Target: Slot #${compartmentNumber < 10 ? '0' + compartmentNumber : compartmentNumber} • Bin ${huId}`
              : huId
                ? `Target: Next available empty slot`
                : 'Verify Kanban & generate order'}
        </div>
      </div>
    </div>
  );

  const bodyContent = (
    <div className="put-modal-content">
      <style jsx>{`
          .put-modal-content {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .scanner-box {
            background: #ffffff;
            border: 1.5px solid #e2e8f0;
            border-radius: 9px;
            padding: 3px 5px;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          }

          .scanner-box:focus-within {
            border-color: #0284c7;
            box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
          }

          .scanner-icon-wrap {
            padding-left: 6px;
            color: #64748b;
            display: flex;
            align-items: center;
            flex-shrink: 0;
          }

          .scanner-input {
            flex: 1;
            border: none;
            outline: none;
            font-size: 13px;
            font-weight: 500;
            color: #0f172a;
            padding: 6px 2px;
            background: transparent;
            min-width: 0;
          }

          .scanner-input::placeholder {
            color: #94a3b8;
            font-weight: 400;
          }

          .btn-input-clear {
            background: transparent;
            border: none;
            color: #94a3b8;
            padding: 3px;
            cursor: pointer;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .btn-input-clear:hover {
            color: #0f172a;
            background: #f1f5f9;
          }

          .btn-scan-action {
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
            color: #ffffff;
            border: none;
            padding: 6px 12px;
            border-radius: 7px;
            font-size: 12.5px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 5px rgba(2, 132, 199, 0.25);
            white-space: nowrap;
            flex-shrink: 0;
          }

          .btn-scan-action:hover:not(:disabled) {
            background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 10px rgba(2, 132, 199, 0.35);
          }

          .btn-scan-action:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .scanner-hint {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 4px;
            font-size: 11px;
            color: #64748b;
          }

          .scanner-hint kbd {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 1px 5px;
            font-family: inherit;
            font-size: 10.5px;
            color: #475569;
          }

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

          .success-meta {
            display: flex;
            align-items: center;
            gap: 10px;
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
            padding: 0.75rem;
            background: #ffffff;
            max-height: 280px;
            overflow-y: auto;
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
          }
        `}</style>

      {/* Scanner Input Form or Bin Full Locked State */}
      {isFull ? (
        <div
          className="p-3 rounded-3 text-center d-flex flex-column align-items-center gap-2"
          style={{
            background: '#f8fafc',
            border: '1.5px solid #cbd5e1',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: '#dcfce7',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>
              All Compartments Filled (100%)
            </div>
            <div className="text-muted mt-1" style={{ fontSize: '12px', maxWidth: '340px' }}>
              All 30 compartments in this handling unit are occupied and verified. Part scanning is now locked.
            </div>
          </div>
          {onSendToKardex && (
            <button
              type="button"
              className="btn btn-sm btn-success fw-bold d-inline-flex align-items-center gap-2 mt-1 px-3 py-2"
              style={{ fontSize: '12.5px', borderRadius: '7px' }}
              onClick={onSendToKardex}
            >
              <Send size={14} /> Send Bin to Kardex
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleScan} className="d-flex flex-column gap-1">
          <div className="scanner-box">
            <div className="scanner-icon-wrap">
              <Scan size={embedded ? 16 : 18} />
            </div>

            <input
              ref={inputRef}
              type="text"
              className="scanner-input"
              placeholder={embedded ? "Scan Serial Number..." : "Scan or enter Serial Number (e.g. 2618991200001)..."}
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              disabled={isProcessing}
              autoFocus
            />

            {serialNumber && !isProcessing && (
              <button
                type="button"
                className="btn-input-clear"
                onClick={() => setSerialNumber('')}
                title="Clear"
              >
                <X size={15} />
              </button>
            )}

            <button
              type="submit"
              className="btn-scan-action"
              disabled={isProcessing || !serialNumber.trim()}
            >
              <PackagePlus size={15} />
              <span>{embedded ? (isProcessing ? '...' : 'Scan') : (isProcessing ? 'Processing...' : 'Scan Part')}</span>
            </button>
          </div>

          <div className="scanner-hint">
            <span>Scan barcode or type and press <kbd>Enter ↵</kbd></span>
            {logs.length > 0 && (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none text-muted"
                onClick={handleReset}
                style={{ fontSize: '11.5px' }}
              >
                <RotateCcw size={11} className="me-1" /> Reset / Clear
              </button>
            )}
          </div>
        </form>
      )}

      {/* Success Banner */}
      {isCompleted && (
        <div className="success-banner">
          <div className="success-meta">
            <CheckCircle2 size={24} className="text-success flex-shrink-0" />
            <div>
              <div className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>
                PUT Process Completed Successfully!
              </div>
              <div style={{ fontSize: '12px', color: '#15803d' }}>
                Serial <span className="fw-bold">{serialNumber}</span> verified and processed successfully.
              </div>
            </div>
          </div>

          {!isFull ? (
            <button type="button" className="success-btn" onClick={handleReset}>
              <span>Scan Next</span>
              <ArrowRight size={14} />
            </button>
          ) : onSendToKardex ? (
            <button type="button" className="success-btn" onClick={onSendToKardex}>
              <span>Send to Kardex</span>
              <Send size={14} />
            </button>
          ) : null}
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
            onClick={handleReset}
          >
            Retry
          </button>
        </div>
      )}

      {/* Timeline Log Section */}
      {(isProcessing || logs.length > 0) && (
        <div className="logs-wrapper">
          <TimelineProgress
            logs={logs}
            steps={PUT_STEPS}
            isProcessing={isProcessing}
          />
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );

  if (embedded) {
    if (!isOpen) return null;

    return (
      <div
        className="embedded-scan-panel shadow-sm bg-white"
        style={{
          borderRadius: '12px',
          border: '1.5px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          background: '#ffffff',
          boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div
          className="d-flex align-items-center justify-content-between p-2 px-2.5 border-bottom"
          style={{ background: '#f8fafc' }}
        >
          {titleContent}
          <button
            type="button"
            className="btn btn-sm btn-link text-muted p-1 rounded-circle"
            onClick={onClose}
            title="Close Panel"
            style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-2.5 p-sm-3 flex-grow-1 d-flex flex-column" style={{ overflowY: 'auto' }}>
          {bodyContent}
        </div>
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titleContent}
      maxWidth="680px"
    >
      {bodyContent}
    </Modal>
  );
};

