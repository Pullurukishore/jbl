'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/shared/Modal';
import { TimelineProgress } from '@/components/shared/TimelineProgress';
import { connectSSE } from '@/lib/api';
import { Log } from '@/types';
import { Scan, RotateCcw, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ScanCompartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (compartmentNumber: number, serialNumber: string, materialName: string) => void;
  huId: string;
  compartmentNumber: number | null;
}

const SCAN_STEPS = [
  { key: 'FETCH_DETAILS', label: '1. Fetch Board History & Check Status' },
  { key: 'CHECK_STATUS', label: '2. PV Status Check' },
  { key: 'FIND_MODEL', label: '3. Get Material/Model Number' },
  { key: 'ALLOCATE', label: '4. Allocate to Compartment' },
];

export const ScanCompartmentModal: React.FC<ScanCompartmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  huId,
  compartmentNumber,
}) => {
  const [serialNumber, setSerialNumber] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedData, setCompletedData] = useState<{ serial: string; material: string } | null>(null);
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
      setIsCompleted(false);
      setErrorMsg('');
      setCompletedData(null);
    } else {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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
    setIsCompleted(false);
    setErrorMsg('');
    setCompletedData(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim() || isProcessing || compartmentNumber === null) return;

    setIsProcessing(true);
    setLogs([]);
    setErrorMsg('');
    setIsCompleted(false);
    setCompletedData(null);

    sseRef.current?.close();
    sseRef.current = connectSSE(
      `/hu/${encodeURIComponent(huId)}/scan/${compartmentNumber}/${encodeURIComponent(serialNumber.trim())}`,
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
            setErrorMsg(data.message || 'Scan process failed.');
            setIsProcessing(false);
            sseRef.current?.close();
            sseRef.current = null;
          }

          if (data.activity === 'ALLOCATE' && data.status === 'SUCCESS') {
            setIsProcessing(false);
            setIsCompleted(true);
            sseRef.current?.close();
            sseRef.current = null;
            const materialName = data.material_name || data.model_number || '';
            setCompletedData({ serial: serialNumber.trim(), material: materialName });
            if (compartmentNumber !== null) {
              onSuccess(compartmentNumber, serialNumber.trim(), materialName);
            }
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={isProcessing ? () => { } : onClose}
      title={
        <div className="d-flex align-items-center gap-2">
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(2, 132, 199, 0.12)',
              color: '#0284c7',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Scan size={18} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              Scan Compartment #{compartmentNumber}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Bin: <strong>{huId}</strong> — Scan serial number into this slot
            </div>
          </div>
        </div>
      }
      maxWidth="620px"
    >
      <div className="scan-compartment-content">
        <style jsx>{`
          .scan-compartment-content {
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
            max-height: 320px;
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
              placeholder="Scan or enter Serial Number..."
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              disabled={isProcessing || isCompleted}
              autoFocus
            />

            {serialNumber && !isProcessing && !isCompleted && (
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
              disabled={isProcessing || !serialNumber.trim() || isCompleted || compartmentNumber === null}
            >
              <Scan size={16} />
              <span>{isProcessing ? 'Processing...' : 'Scan'}</span>
            </button>
          </div>

          <div className="scanner-hint">
            <span>
              Scan barcode or type and press <kbd>Enter ↵</kbd>
            </span>
            {logs.length > 0 && !isProcessing && (
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-decoration-none text-muted"
                onClick={handleReset}
                style={{ fontSize: '11.5px' }}
              >
                <RotateCcw size={11} className="me-1" /> Reset
              </button>
            )}
          </div>
        </form>

        {/* Success Banner */}
        {isCompleted && completedData && (
          <div className="success-banner">
            <div className="success-meta">
              <CheckCircle2 size={24} className="text-success flex-shrink-0" />
              <div>
                <div className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>
                  Compartment #{compartmentNumber} allocated successfully!
                </div>
                <div style={{ fontSize: '12px', color: '#15803d' }}>
                  Serial <strong>{completedData.serial}</strong>
                  {completedData.material && (
                    <> — Model: <strong>{completedData.material}</strong></>
                  )}
                </div>
              </div>
            </div>
            <button type="button" className="success-btn" onClick={handleReset}>
              Scan Next
            </button>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="error-banner">
            <AlertCircle size={20} className="flex-shrink-0" />
            <div className="flex-1">
              <strong>Error: </strong>
              {errorMsg}
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
              steps={SCAN_STEPS}
              isProcessing={isProcessing}
            />
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </Modal>
  );
};

