'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/shared/Modal';
import { apiGet } from '@/lib/api';
import { HandlingUnit } from '@/types/hu';
import { RegisterBinModal } from '@/components/bins/RegisterBinModal';
import { HUStatusBadge } from '@/components/bins/HUStatusBadge';
import { StorageStatusBadge } from '@/components/bins/StorageStatusBadge';
import {
  PackagePlus,
  Eye,
  Boxes,
  Plus,
  AlertCircle,
  CheckCircle2,
  Barcode,
  Loader2,
  ArrowRight,
  Layers,
  ChevronRight,
  Sparkles,
  X,
  Info,
} from 'lucide-react';

interface HUPutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const HUPutModal: React.FC<HUPutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const router = useRouter();
  const [binInput, setBinInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [validatedHu, setValidatedHu] = useState<HandlingUnit | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sub-modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBinInput('');
      setError('');
      setWarning('');
      setValidatedHu(null);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleLookup = async (idToSearch?: string) => {
    const rawId = (idToSearch !== undefined ? idToSearch : binInput).trim();
    if (!rawId) {
      setError('Please scan or enter a Bin ID (e.g. H1, H2, B01).');
      setValidatedHu(null);
      inputRef.current?.focus();
      return;
    }

    try {
      setLoading(true);
      setError('');
      setWarning('');
      const data = await apiGet<HandlingUnit>(`/hu/${encodeURIComponent(rawId)}/layout`);

      if (!data) {
        throw new Error('Handling unit not found.');
      }

      onClose();
      router.push(`/app/bins/${data.hu_id}`);
    } catch (err: any) {
      setValidatedHu(null);
      const msg = err.message || '';
      if (msg.toLowerCase().includes('not found') || msg.includes('404')) {
        setError(`Bin "${rawId}" was not found in the system. Check the label or register it below.`);
      } else {
        setError(msg || `Failed to check bin "${rawId}". Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLookup();
    }
  };

  const occupiedCount = (validatedHu?.compartments || []).filter(
    (c) => c.status === 'OCCUPIED'
  ).length;

  const totalSlots =
    validatedHu?.compartments?.length || validatedHu?.bin_type?.compartment_count || 15;
  const pct = totalSlots > 0 ? Math.round((occupiedCount / totalSlots) * 100) : 0;

  return (
    <>
      <Modal
        isOpen={isOpen && !isRegisterOpen}
        onClose={onClose}
        title={
          <div className="d-flex align-items-center gap-2">
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 3px 8px rgba(37, 99, 235, 0.28)',
                flexShrink: 0,
              }}
            >
              <PackagePlus size={20} />
            </div>
            <div>
              <div style={{ fontSize: '16.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>
                Handling Unit PUT Workflow
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                Scan or enter a Bin ID to put adapters into compartments
              </div>
            </div>
          </div>
        }
        maxWidth="580px"
      >
        <div className="hu-put-modal-content">
          <style jsx>{`
            .hu-put-modal-content {
              display: flex;
              flex-direction: column;
              gap: 1.15rem;
              padding: 4px 0;
            }

            /* Subheader Bar */
            .workflow-intro-bar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-bottom: 0.75rem;
              border-bottom: 1px solid #f1f5f9;
            }

            .intro-text {
              font-size: 12.5px;
              color: #64748b;
              margin: 0;
            }

            .btn-new-bin-shortcut {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              color: #2563eb;
              padding: 5px 12px;
              border-radius: 7px;
              font-size: 12px;
              font-weight: 700;
              display: inline-flex;
              align-items: center;
              gap: 5px;
              cursor: pointer;
              transition: all 0.15s ease;
            }

            .btn-new-bin-shortcut:hover {
              background: #eff6ff;
              border-color: #93c5fd;
              color: #1d4ed8;
            }

            /* Scan / Input Box */
            .scan-section-wrap {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }

            .scan-label-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #475569;
            }

            .live-scan-badge {
              display: inline-flex;
              align-items: center;
              gap: 5px;
              font-size: 11px;
              font-weight: 700;
              color: #059669;
              background: #ecfdf5;
              border: 1px solid #a7f3d0;
              padding: 2px 8px;
              border-radius: 9999px;
            }

            .pulse-dot-green {
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: #10b981;
              animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }

            .scan-input-group {
              display: flex;
              align-items: center;
              gap: 8px;
              width: 100%;
            }

            .scan-input-container {
              position: relative;
              flex-grow: 1;
              display: flex;
              align-items: center;
            }

            .scan-affix-icon {
              position: absolute;
              left: 14px;
              color: #2563eb;
              pointer-events: none;
            }

            .scan-input-field {
              width: 100%;
              padding: 11px 40px 11px 44px;
              font-size: 16px;
              font-weight: 700;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              letter-spacing: 0.6px;
              border: 2px solid #cbd5e1;
              border-radius: 10px;
              background: #ffffff;
              color: #0f172a;
              outline: none;
              transition: all 0.2s ease;
            }

            .scan-input-field:focus {
              border-color: #2563eb;
              box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
            }

            .clear-input-btn {
              position: absolute;
              right: 12px;
              background: transparent;
              border: none;
              color: #94a3b8;
              cursor: pointer;
              display: flex;
              align-items: center;
              padding: 2px;
            }

            .clear-input-btn:hover {
              color: #0f172a;
            }

            .btn-lookup-action {
              background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
              border: 1px solid #1d4ed8;
              color: #ffffff;
              padding: 11px 20px;
              border-radius: 10px;
              font-size: 13.5px;
              font-weight: 700;
              display: inline-flex;
              align-items: center;
              gap: 7px;
              cursor: pointer;
              transition: all 0.2s ease;
              box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
              white-space: nowrap;
              flex-shrink: 0;
            }

            .btn-lookup-action:hover:not(:disabled) {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);
            }

            .btn-lookup-action:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }

            /* Error and Warning Alert Boxes */
            .alert-box-error {
              background: #fef2f2;
              border: 1.5px solid #fecaca;
              border-radius: 10px;
              padding: 12px 14px;
              color: #991b1b;
              font-size: 13px;
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 10px;
            }

            .alert-box-warning {
              background: #fffbeb;
              border: 1.5px solid #fde68a;
              border-radius: 10px;
              padding: 12px 14px;
              color: #92400e;
              font-size: 13px;
              display: flex;
              align-items: flex-start;
              gap: 10px;
            }

            /* Validated Bin Success Card */
            .validated-bin-card {
              background: #f8fafc;
              border: 1.5px solid #bbf7d0;
              border-radius: 12px;
              padding: 14px 16px;
              display: flex;
              flex-direction: column;
              gap: 12px;
              box-shadow: 0 2px 8px rgba(16, 185, 129, 0.08);
            }

            .val-card-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
            }

            .val-id-row {
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .val-hu-badge {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 14px;
              font-weight: 800;
              background: #2563eb;
              color: #ffffff;
              padding: 4px 10px;
              border-radius: 6px;
              letter-spacing: 0.5px;
            }

            .val-type-text {
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
            }

            .val-pps-badge {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              font-size: 11px;
              font-weight: 700;
              background: #e2e8f0;
              color: #334155;
              padding: 2px 7px;
              border-radius: 4px;
            }

            .val-card-metrics {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px 12px;
            }

            .val-metric-col {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }

            .val-metric-lbl {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              color: #64748b;
            }

            .val-metric-val {
              font-size: 13.5px;
              font-weight: 800;
              color: #0f172a;
            }

            /* Mini Progress */
            .val-progress-track {
              height: 6px;
              background: #e2e8f0;
              border-radius: 9999px;
              overflow: hidden;
              margin-top: 4px;
            }

            .val-progress-fill {
              height: 100%;
              border-radius: 9999px;
              background: linear-gradient(90deg, #2563eb 0%, #10b981 100%);
              transition: width 0.3s ease;
            }

            /* Modal Footer Buttons */
            .footer-actions-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding-top: 0.75rem;
              border-top: 1px solid #f1f5f9;
              gap: 10px;
              flex-wrap: wrap;
            }

            .btn-modal-cancel {
              background: #ffffff;
              border: 1.5px solid #cbd5e1;
              color: #475569;
              padding: 8px 16px;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.15s ease;
            }

            .btn-modal-cancel:hover {
              background: #f8fafc;
              color: #0f172a;
              border-color: #94a3b8;
            }

            .btn-open-bin-primary {
              background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
              border: 1px solid #1d4ed8;
              color: #ffffff;
              padding: 8px 20px;
              border-radius: 8px;
              font-size: 13.5px;
              font-weight: 700;
              display: inline-flex;
              align-items: center;
              gap: 8px;
              cursor: pointer;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
            }

            .btn-open-bin-primary:hover {
              background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
              transform: translateY(-1px);
              box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
            }

            .btn-send-kardex-direct {
              background: #ecfdf5;
              border: 1.5px solid #a7f3d0;
              color: #047857;
              padding: 8px 16px;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 700;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              cursor: pointer;
              transition: all 0.15s ease;
            }

            .btn-send-kardex-direct:hover {
              background: #d1fae5;
              border-color: #6ee7b7;
              transform: translateY(-1px);
            }

            @keyframes pulse {
              0%, 100% {
                opacity: 1;
              }
              50% {
                opacity: 0.4;
              }
            }

            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
            .spin-inline {
              animation: spin 0.8s linear infinite;
            }
          `}</style>

          {/* Subheader Bar with Quick Register Link */}
          <div className="workflow-intro-bar">
            <p className="intro-text">
              Directly scan or enter the physical Handling Unit barcode below.
            </p>
            <button
              type="button"
              className="btn-new-bin-shortcut"
              onClick={() => setIsRegisterOpen(true)}
              title="Register a new physical bin"
            >
              <Plus size={14} />
              <span>Register New Bin</span>
            </button>
          </div>

          {/* Scan or Enter Field */}
          <div className="scan-section-wrap">
            <div className="scan-label-row">
              <span>Scan or Enter Handling Unit (Bin) ID</span>
              <div className="live-scan-badge">
                <span className="pulse-dot-green" />
                <span>Ready for Barcode Scanner</span>
              </div>
            </div>

            <div className="scan-input-group">
              <div className="scan-input-container">
                <Barcode size={20} className="scan-affix-icon" />
                <input
                  ref={inputRef}
                  type="text"
                  className="scan-input-field"
                  placeholder="Scan barcode or type Bin ID (e.g. H1, H2)..."
                  value={binInput}
                  onChange={(e) => {
                    setBinInput(e.target.value);
                    if (error) setError('');
                    if (warning) setWarning('');
                  }}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  disabled={loading}
                />
                {binInput && (
                  <button
                    type="button"
                    className="clear-input-btn"
                    onClick={() => {
                      setBinInput('');
                      setValidatedHu(null);
                      setError('');
                      setWarning('');
                      inputRef.current?.focus();
                    }}
                    title="Clear input"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Error Message Box with Option to Register */}
          {error && (
            <div className="alert-box-error">
              <div className="d-flex align-items-center gap-2">
                <AlertCircle size={18} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
              {binInput.trim() && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1 flex-shrink-0 fw-bold"
                  style={{ fontSize: '11.5px', borderRadius: '6px' }}
                  onClick={() => setIsRegisterOpen(true)}
                >
                  <Plus size={13} />
                  <span>Register &quot;{binInput.trim().toUpperCase()}&quot;</span>
                </button>
              )}
            </div>
          )}

          {/* Warning Message Box */}
          {warning && (
            <div className="alert-box-warning">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          {/* Validated Bin Success Card */}
          {validatedHu && !error && (
            <div className="validated-bin-card">
              <div className="val-card-header">
                <div className="val-id-row">
                  <CheckCircle2 size={18} className="text-success" />
                  <span className="val-hu-badge">{validatedHu.hu_id}</span>
                  <span className="val-type-text">{validatedHu.bin_type?.name || 'Bin'}</span>
                  <span className="val-pps-badge">PPS: {validatedHu.bin_type?.bin_name || 'CON_BINA'}</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <StorageStatusBadge status={validatedHu.storage_status} />
                  <HUStatusBadge status={validatedHu.hu_status} />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="val-card-metrics">
                <div className="val-metric-col">
                  <span className="val-metric-lbl">Total Compartments</span>
                  <span className="val-metric-val">{totalSlots} Slots</span>
                </div>
                <div className="val-metric-col">
                  <span className="val-metric-lbl">Current Load</span>
                  <span className="val-metric-val" style={{ color: occupiedCount > 0 ? '#16a34a' : '#64748b' }}>
                    {occupiedCount} / {totalSlots} Loaded
                  </span>
                </div>
                <div className="val-metric-col">
                  <span className="val-metric-lbl">Fill Capacity</span>
                  <span className="val-metric-val">{pct}%</span>
                  <div className="val-progress-track">
                    <div className="val-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="footer-actions-row">
            <button type="button" className="btn-modal-cancel" onClick={onClose}>
              Cancel
            </button>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn-open-bin-primary"
                onClick={() => handleLookup()}
                disabled={loading || !binInput.trim()}
                title="Open bin layout to scan and fill adapters"
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="spin-inline" />
                    <span>Opening...</span>
                  </>
                ) : (
                  <>
                    <Barcode size={16} />
                    <span>Open Bin & Scan Parts</span>
                    <ChevronRight size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Register New Bin Submodal with initial ID passed */}
      <RegisterBinModal
        isOpen={isRegisterOpen}
        initialHuId={binInput.trim()}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={() => {
          setIsRegisterOpen(false);
          const currentId = binInput.trim();
          if (currentId) {
            handleLookup(currentId);
          }
        }}
      />
    </>
  );
};
