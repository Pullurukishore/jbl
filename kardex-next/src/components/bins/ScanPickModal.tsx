'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/shared/Modal';
import { TimelineProgress } from '@/components/shared/TimelineProgress';
import { connectSSE } from '@/lib/api';
import { Log } from '@/types';
import { HandlingUnit, Compartment } from '@/types/hu';
import {
  PackageMinus,
  Scan,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Boxes,
  Check,
} from 'lucide-react';

interface ScanPickModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pickedSerial?: string, remainingCount?: number) => void;
  hu: HandlingUnit;
  initialCompartmentNumber?: number | null;
}

const PICK_STEPS = [
  { key: 'FETCH_DETAILS', label: '1. Verify Board in Bin & Check MES Status' },
  { key: 'CHECK_STATUS', label: '2. PV Status Check (KANBAN-OUT)' },
  { key: 'PASS_FAIL', label: '3. Verify WIP Hold Status' },
  { key: 'FILE_GENERATED', label: '4. Update MES Kanban & Pick from Bin' },
];

export const ScanPickModal: React.FC<ScanPickModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  hu,
  initialCompartmentNumber,
}) => {
  const [selectedCompartment, setSelectedCompartment] = useState<number | null>(null);
  const [serialNumber, setSerialNumber] = useState('');
  const [logs, setLogs] = useState<Log[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedData, setCompletedData] = useState<{
    serial: string;
    compartmentNumber: number;
    model: string;
    remaining: number;
  } | null>(null);

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

  const occupiedCompartments = (hu.compartments || []).filter(
    (c) => c.status === 'OCCUPIED'
  );

  useEffect(() => {
    if (isOpen) {
      if (initialCompartmentNumber) {
        setSelectedCompartment(initialCompartmentNumber);
        const comp = (hu.compartments || []).find(
          (c) => c.compartment_number === initialCompartmentNumber
        );
        if (comp?.serial_number) {
          setSerialNumber(comp.serial_number);
        } else {
          setSerialNumber('');
        }
      } else {
        setSelectedCompartment(null);
        setSerialNumber('');
      }
      setLogs([]);
      setIsProcessing(false);
      setIsCompleted(false);
      setErrorMsg('');
      setCompletedData(null);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, initialCompartmentNumber, hu]);

  useEffect(() => {
    if ((isProcessing || logs.length > 0) && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isProcessing, logs]);

  const handleResetForNext = () => {
    sseRef.current?.close();
    sseRef.current = null;
    setSerialNumber('');
    setLogs([]);
    setIsProcessing(false);
    setIsCompleted(false);
    setErrorMsg('');
    setCompletedData(null);
    setSelectedCompartment(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handlePick = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSerial = serialNumber.trim();
    if (!cleanSerial || isProcessing) return;

    setIsProcessing(true);
    setLogs([]);
    setErrorMsg('');
    setIsCompleted(false);
    setCompletedData(null);

    const compParam = selectedCompartment ? `?compartment_number=${selectedCompartment}` : '';
    const url = `/hu/${encodeURIComponent(hu.hu_id)}/pick-scan/${encodeURIComponent(cleanSerial)}${compParam}`;

    sseRef.current?.close();
    sseRef.current = connectSSE(
      url,
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
            setErrorMsg(data.message || 'Pick validation failed.');
            setIsProcessing(false);
            sseRef.current?.close();
            sseRef.current = null;
          }

          if (data.activity === 'FILE_GENERATED' && data.status === 'SUCCESS') {
            setIsProcessing(false);
            setIsCompleted(true);
            sseRef.current?.close();
            sseRef.current = null;
            const compNum = data.compartment_number || selectedCompartment || 0;
            const modelNum = data.model_number || 'N/A';
            const remaining = typeof data.remaining_occupied === 'number' ? data.remaining_occupied : occupiedCompartments.length - 1;

            setCompletedData({
              serial: cleanSerial,
              compartmentNumber: compNum,
              model: modelNum,
              remaining: Math.max(0, remaining),
            });

            onSuccess(cleanSerial, remaining);
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

  const targetComp = selectedCompartment
    ? (hu.compartments || []).find((c) => c.compartment_number === selectedCompartment)
    : null;

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
              background: 'rgba(234, 88, 12, 0.14)',
              color: '#ea580c',
              border: '1px solid rgba(234, 88, 12, 0.3)',
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
                Pick Part from Bin {hu.hu_id}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: 'rgba(234, 88, 12, 0.15)',
                  color: '#c2410c',
                  border: '1px solid rgba(234, 88, 12, 0.35)',
                  letterSpacing: '0.5px',
                }}
              >
                ONE-BY-ONE PICK
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Scan each part to validate in MES & unload from compartment
            </div>
          </div>
        </div>
      }
      maxWidth="700px"
    >
      <div className="scan-pick-modal-content">
        <style jsx>{`
          .scan-pick-modal-content {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
          }

          .scan-pick-box {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          }

          .info-strip {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            font-size: 12.5px;
          }

          .scan-input-group {
            display: flex;
            gap: 0.75rem;
            align-items: center;
          }

          .scan-input-field {
            position: relative;
            flex-grow: 1;
          }

          .scan-input {
            width: 100%;
            height: 42px;
            padding: 0 12px 0 38px;
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            font-size: 14px;
            font-family: monospace;
            font-weight: 600;
            color: #0f172a;
            outline: none;
            transition: all 0.2s ease;
          }

          .scan-input:focus {
            border-color: #ea580c;
            box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.15);
          }

          .scan-btn-submit {
            height: 42px;
            padding: 0 20px;
            background: #ea580c;
            color: #ffffff;
            font-size: 13.5px;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
          }

          .scan-btn-submit:hover:not(:disabled) {
            background: #c2410c;
            box-shadow: 0 2px 6px rgba(234, 88, 12, 0.3);
          }

          .scan-btn-submit:disabled {
            background: #94a3b8;
            cursor: not-allowed;
          }

          .success-card {
            background: #f0fdf4;
            border: 1.5px solid #86efac;
            border-radius: 10px;
            padding: 1rem 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }
        `}</style>

        {/* Info Header Strip */}
        <div className="info-strip">
          <div className="d-flex align-items-center gap-2">
            <Boxes size={16} className="text-muted" />
            <span>
              Handling Unit: <strong className="font-monospace text-dark">{hu.hu_id}</strong>
            </span>
            <span className="text-muted">•</span>
            <span>
              Type: <strong>{hu.bin_type?.name || 'Bin'}</strong>
            </span>
          </div>

          <div>
            <span className="badge bg-warning-subtle text-dark fw-bold" style={{ fontSize: '12px' }}>
              {completedData ? completedData.remaining : occupiedCompartments.length} parts seated in bin
            </span>
          </div>
        </div>

        {/* Completion Success Card */}
        {isCompleted && completedData && (
          <div className="success-card">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <CheckCircle2 size={20} className="text-success" />
                <span className="fw-bold text-success" style={{ fontSize: '15px' }}>
                  Part Picked & Validated Successfully!
                </span>
              </div>
              <span className="badge bg-success font-monospace" style={{ fontSize: '12px' }}>
                COMPARTMENT #{completedData.compartmentNumber} EMPTY
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-2 border" style={{ fontSize: '13px' }}>
              <div className="row g-2">
                <div className="col-6">
                  <span className="text-muted">Picked Serial:</span>{' '}
                  <strong className="font-monospace text-dark">{completedData.serial}</strong>
                </div>
                <div className="col-6">
                  <span className="text-muted">Model Number:</span>{' '}
                  <strong className="text-dark">{completedData.model}</strong>
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between pt-1">
              <span className="text-muted" style={{ fontSize: '12.5px' }}>
                {completedData.remaining > 0
                  ? `${completedData.remaining} part(s) remaining in this Handling Unit.`
                  : 'All parts have been picked! This Handling Unit is now completely EMPTY.'}
              </span>

              <div className="d-flex gap-2">
                {completedData.remaining > 0 ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1 fw-bold"
                    onClick={handleResetForNext}
                  >
                    Scan Next Part <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-success d-inline-flex align-items-center gap-1 fw-bold"
                    onClick={onClose}
                  >
                    <Check size={14} /> Done Picking
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scan Input Box */}
        {!isCompleted && (
          <div className="scan-pick-box">
            <div className="d-flex align-items-center justify-content-between">
              <label className="fw-bold" style={{ fontSize: '13px', color: '#0f172a' }}>
                {targetComp ? (
                  <span>
                    SCAN SERIAL FOR COMPARTMENT #{targetComp.compartment_number}
                    {targetComp.serial_number && (
                      <span className="text-muted fw-normal ms-2">
                        (Expected: <code className="text-primary">{targetComp.serial_number}</code>)
                      </span>
                    )}
                  </span>
                ) : (
                  'SCAN PART SERIAL NUMBER TO PICK'
                )}
              </label>

              {occupiedCompartments.length > 0 && (
                <div className="d-flex align-items-center gap-1">
                  <span className="text-muted" style={{ fontSize: '12px' }}>Slot:</span>
                  <select
                    className="form-select form-select-sm"
                    style={{ fontSize: '12px', padding: '2px 24px 2px 8px', height: '28px' }}
                    value={selectedCompartment || ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null;
                      setSelectedCompartment(val);
                      if (val) {
                        const found = (hu.compartments || []).find((c) => c.compartment_number === val);
                        if (found?.serial_number) setSerialNumber(found.serial_number);
                      }
                    }}
                    disabled={isProcessing}
                  >
                    <option value="">Any occupied compartment...</option>
                    {occupiedCompartments.map((c) => (
                      <option key={c.id} value={c.compartment_number}>
                        Slot #{c.compartment_number} ({c.serial_number || 'Seated'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <form onSubmit={handlePick} className="scan-input-group">
              <div className="scan-input-field">
                <Scan
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                  }}
                />
                <input
                  ref={inputRef}
                  type="text"
                  className="scan-input"
                  placeholder="Scan or enter barcode / serial number..."
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  disabled={isProcessing}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="scan-btn-submit"
                disabled={isProcessing || !serialNumber.trim()}
              >
                <PackageMinus size={16} />
                {isProcessing ? 'Validating...' : 'Validate & Pick'}
              </button>

              <button
                type="button"
                className="btn btn-outline-secondary d-flex align-items-center justify-content-center"
                style={{ height: '42px', width: '42px', borderRadius: '8px' }}
                onClick={handleResetForNext}
                disabled={isProcessing}
                title="Reset input"
              >
                <RotateCcw size={15} />
              </button>
            </form>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="alert alert-danger py-2 px-3 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Live Timeline Progress (Same as PUT) */}
        {(isProcessing || logs.length > 0) && (
          <div className="bg-light p-3 rounded-3 border">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h6 className="fw-bold mb-0 text-dark" style={{ fontSize: '13px' }}>
                Pick Validation Progress (MES)
              </h6>
              {isProcessing && (
                <div className="spinner-border spinner-border-sm text-warning" role="status" />
              )}
            </div>

            <TimelineProgress steps={PICK_STEPS} logs={logs} isProcessing={isProcessing} />

            <div
              className="mt-3 p-2 bg-white rounded border overflow-auto"
              style={{ maxHeight: '140px', fontSize: '12px', fontFamily: 'monospace' }}
            >
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`py-1 ${
                    log.status === 'FAILED'
                      ? 'text-danger fw-bold'
                      : log.status === 'SUCCESS'
                      ? 'text-success'
                      : 'text-primary'
                  }`}
                >
                  [{log.status}] {log.activity}: {log.message || 'Processed'}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="d-flex align-items-center justify-content-between pt-2 border-top">
          <span className="text-muted" style={{ fontSize: '12px' }}>
            Handling Unit: <strong>{hu.hu_id}</strong> • Location:{' '}
            <strong>{hu.bin_type?.bin_name || 'Floor'}</strong>
          </span>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
            disabled={isProcessing}
          >
            {isCompleted ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
