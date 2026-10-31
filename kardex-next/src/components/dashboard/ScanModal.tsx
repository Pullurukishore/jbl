'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/shared/Modal';
import { TimelineProgress } from '@/components/shared/TimelineProgress';
import { connectSSE } from '@/lib/api';
import { Log } from '@/types';
import { Scan, RotateCcw, PackagePlus, CheckCircle2, AlertCircle, X, ArrowRight } from 'lucide-react';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PUT_STEPS = [
  { key: 'FETCH_DETAILS', label: '1. Fetch Board Details' },
  { key: 'CHECK_STATUS', label: '2. Check Kanban Process Status' },
  { key: 'PASS_FAIL', label: '3. Verify PV Status & Birth Date' },
  { key: 'FIND_CSV', label: '4. Find PO CSV in Network Drive' },
  { key: 'FIND_MODEL', label: '5. Parse & Find Model' },
  { key: 'MODEL_FOUND/NOTFOUND', label: '6. Verify Model Availability' },
  { key: 'CHECKING_AVAILABILITY', label: '7. Check Open GR Quantity' },
  { key: 'FILE_GENERATED', label: '8. Generate Put Order Text File' },
];

export const ScanModal: React.FC<ScanModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [serialNumber, setSerialNumber] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setSerialNumber('');
      setLogs([]);
      setIsProcessing(false);
      setErrorMsg('');
      setIsCompleted(false);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (logs.length > 0 && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleReset = () => {
    setSerialNumber('');
    setLogs([]);
    setIsProcessing(false);
    setErrorMsg('');
    setIsCompleted(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim() || isProcessing) return;

    setIsProcessing(true);
    setLogs([]);
    setErrorMsg('');
    setIsCompleted(false);

    connectSSE(
      `/put/create/${encodeURIComponent(serialNumber.trim())}`,
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
              background: 'rgba(56, 189, 248, 0.14)',
              color: '#0284c7',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PackagePlus size={18} />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold" style={{ fontSize: '16px', color: '#0f172a' }}>
                PUT Process — Scan Part Number
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#0369a1',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  letterSpacing: '0.5px',
                }}
              >
                INBOUND
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Verify Kanban board status, PV test results, and generate text order
            </div>
          </div>
        </div>
      }
      maxWidth="680px"
    >
      <div className="put-modal-content">
        <style jsx>{`
          .put-modal-content {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
          }

          .scanner-box {
            background: #ffffff;
            border: 1.5px solid #e2e8f0;
            border-radius: 10px;
            padding: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          }

          .scanner-box:focus-within {
            border-color: #0284c7;
            box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
          }

          .scanner-icon-wrap {
            padding-left: 10px;
            color: #64748b;
            display: flex;
            align-items: center;
          }

          .scanner-input {
            flex: 1;
            border: none;
            outline: none;
            font-size: 14px;
            font-weight: 500;
            color: #0f172a;
            padding: 8px 4px;
            background: transparent;
          }

          .scanner-input::placeholder {
            color: #94a3b8;
            font-weight: 400;
          }

          .btn-input-clear {
            background: transparent;
            border: none;
            color: #94a3b8;
            padding: 4px;
            cursor: pointer;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .btn-input-clear:hover {
            color: #0f172a;
            background: #f1f5f9;
          }

          .btn-scan-action {
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
            color: #ffffff;
            border: none;
            padding: 8px 18px;
            border-radius: 8px;
            font-size: 13.5px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 5px rgba(2, 132, 199, 0.25);
            white-space: nowrap;
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
            font-size: 11.5px;
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
            padding: 1rem;
            background: #ffffff;
            max-height: 360px;
            overflow-y: auto;
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
          }
        `}</style>

        {/* Scanner Input Form */}
        <form onSubmit={handleScan} className="d-flex flex-column gap-1">
          <div className="scanner-box">
            <div className="scanner-icon-wrap">
              <Scan size={18} />
            </div>

            <input
              ref={inputRef}
              type="text"
              className="scanner-input"
              placeholder="Scan or enter Serial Number (e.g. 2618991200001)..."
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
                <X size={16} />
              </button>
            )}

            <button
              type="submit"
              className="btn-scan-action"
              disabled={isProcessing || !serialNumber.trim()}
            >
              <PackagePlus size={16} />
              <span>{isProcessing ? 'Processing...' : 'Scan Part'}</span>
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
                  Order text file generated for serial <span className="fw-bold">{serialNumber}</span>.
                </div>
              </div>
            </div>

            <button type="button" className="success-btn" onClick={handleReset}>
              <span>Scan Next</span>
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
              onClick={handleReset}
            >
              Retry
            </button>
          </div>
        )}

        {/* Timeline Log Section */}
        {logs.length > 0 && (
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
    </Modal>
  );
};

