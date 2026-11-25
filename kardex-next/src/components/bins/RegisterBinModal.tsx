'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiPost } from '@/lib/api';
import {
  PackagePlus,
  Loader2,
  Barcode,
  Layers,
  Columns,
  Check,
  AlertCircle,
  Info,
  Boxes,
} from 'lucide-react';

interface RegisterBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialHuId?: string;
}

export const RegisterBinModal: React.FC<RegisterBinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialHuId,
}) => {
  const [huId, setHuId] = useState('BIN-');
  const [selectedBinType, setSelectedBinType] = useState<'CON_BINC' | 'CON_BIND'>('CON_BINC');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setHuId('BIN-');
      setSelectedBinType('CON_BINC');
      setError('');
      setSubmitting(false);
    } else {
      const init = initialHuId
        ? (initialHuId.toUpperCase().startsWith('BIN-') ? initialHuId.toUpperCase() : `BIN-${initialHuId}`)
        : 'BIN-';
      setHuId(init);
      setSelectedBinType('CON_BINC');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const len = inputRef.current.value.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }, 150);
    }
  }, [isOpen, initialHuId]);

  const cleanId = huId.trim().toUpperCase();
  const isPrefixValid = cleanId.startsWith('BIN-');
  const isLengthValid = cleanId.length >= 9;
  const isFormatValid = /^BIN-[A-Z0-9_\-]+$/.test(cleanId);
  const isBinValid = isPrefixValid && isLengthValid && isFormatValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPrefixValid) {
      setError("Bin ID must start with prefix 'BIN-' (e.g. BIN-00001)");
      inputRef.current?.focus();
      return;
    }
    if (!isLengthValid) {
      setError(`Bin ID must be at least 9 characters long (currently ${cleanId.length}/9, e.g. BIN-00001)`);
      inputRef.current?.focus();
      return;
    }
    if (!isFormatValid) {
      setError("Invalid format. Only alphanumeric characters, dashes, and underscores are allowed.");
      inputRef.current?.focus();
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await apiPost('/hu/register', {
        hu_id: cleanId,
        bin_name: selectedBinType,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register bin');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="d-flex align-items-center gap-3">
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 3px 8px rgba(37, 99, 235, 0.3)',
              flexShrink: 0,
            }}
          >
            <PackagePlus size={20} />
          </div>
          <div>
            <div style={{ fontSize: '16.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>
              Register New Physical Bin
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Assign a unique Handling Unit ID with 30-slot tray specification (CON_BINC or CON_BIND)
            </div>
          </div>
        </div>
      }
      maxWidth="500px"
      footer={
        <div className="d-flex gap-2 justify-content-end w-100">
          <button
            type="button"
            className="btn-cancel"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="register-bin-form"
            className="btn-submit-register"
            disabled={submitting || !isBinValid}
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="spin-inline" />
                <span>Registering...</span>
              </>
            ) : (
              <>
                <PackagePlus size={15} />
                <span>Register Bin</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="register-bin-content">
        <style jsx>{`
          .register-bin-content {
            display: flex;
            flex-direction: column;
            gap: 1.2rem;
            padding: 4px 0;
          }

          .form-group-wrap {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .field-label {
            font-size: 13px;
            font-weight: 700;
            color: #1e293b;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .field-label-desc {
            font-size: 11.5px;
            font-weight: 500;
            color: #64748b;
          }

          /* Input Box with Prefix Icon */
          .input-icon-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            width: 100%;
          }

          .input-affix-icon {
            position: absolute;
            left: 12px;
            color: #2563eb;
            pointer-events: none;
            display: flex;
            align-items: center;
          }

          .input-clean-field {
            width: 100%;
            padding: 11px 14px 11px 38px;
            font-size: 15px;
            font-weight: 700;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            color: #0f172a;
            letter-spacing: 0.5px;
            border: 1.5px solid #cbd5e1;
            border-radius: 9px;
            background: #ffffff;
            outline: none;
            transition: all 0.2s ease;
          }

          .input-clean-field:focus {
            background: #ffffff;
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
          }

          .helper-text {
            font-size: 11.5px;
            color: #64748b;
            margin-top: 3px;
            display: flex;
            align-items: center;
            gap: 4px;
          }

          /* Selectable Tray Specification Cards */
          .spec-options-grid {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .selectable-spec-card {
            background: #ffffff;
            border: 1.5px solid #e2e8f0;
            border-radius: 10px;
            padding: 11px 13px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;
          }

          .selectable-spec-card:hover:not(.disabled) {
            border-color: #93c5fd;
            background: #f8fafc;
            transform: translateY(-1px);
          }

          .selectable-spec-card.selected {
            background: #eff6ff;
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.16);
          }

          .selectable-spec-card.disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .spec-icon-box {
            width: 36px;
            height: 36px;
            border-radius: 9px;
            background: #f1f5f9;
            color: #64748b;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            border: 1px solid #e2e8f0;
            transition: all 0.2s ease;
          }

          .selectable-spec-card.selected .spec-icon-box {
            background: #dbeafe;
            color: #2563eb;
            border-color: #bfdbfe;
          }

          .spec-title {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            line-height: 1.25;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .selectable-spec-card.selected .spec-title {
            color: #1d4ed8;
          }

          .spec-sub-meta {
            font-size: 11px;
            color: #64748b;
            margin-top: 3px;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .spec-active-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #ecfdf5;
            color: #059669;
            border: 1px solid #a7f3d0;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 10.5px;
            font-weight: 700;
            flex-shrink: 0;
          }

          .spec-inactive-radio {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 1.5px solid #cbd5e1;
            background: #ffffff;
            flex-shrink: 0;
            transition: all 0.2s ease;
          }

          .selectable-spec-card:hover .spec-inactive-radio {
            border-color: #94a3b8;
          }

          /* Kardex Integration Info Banner */
          .info-deployment-banner {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 9px;
            padding: 10px 14px;
            font-size: 12px;
            color: #166534;
            display: flex;
            align-items: center;
            gap: 9px;
          }

          .error-box {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 9px;
            padding: 10px 14px;
            color: #b91c1c;
            font-size: 12.5px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          /* Buttons in Footer */
          :global(.btn-cancel) {
            background: #ffffff !important;
            border: 1.5px solid #cbd5e1 !important;
            color: #475569 !important;
            padding: 8px 16px !important;
            border-radius: 8px !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.15s ease !important;
          }

          :global(.btn-cancel:hover:not(:disabled)) {
            background: #f1f5f9 !important;
            color: #1e293b !important;
          }

          :global(.btn-submit-register) {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
            border: none !important;
            color: #ffffff !important;
            padding: 8px 22px !important;
            border-radius: 8px !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 7px !important;
            cursor: pointer !important;
            box-shadow: 0 2px 6px rgba(37, 99, 235, 0.28) !important;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }

          :global(.btn-submit-register:hover:not(:disabled)) {
            background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%) !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.38) !important;
          }

          :global(.btn-submit-register:disabled) {
            opacity: 0.55 !important;
            cursor: not-allowed !important;
            transform: none !important;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
          :global(.spin-inline) {
            animation: spin 0.8s linear infinite;
          }
        `}</style>

        {error && (
          <div className="error-box">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form id="register-bin-form" onSubmit={handleSubmit}>
          <div className="d-flex flex-column gap-3">
            {/* Bin ID Input */}
            <div className="form-group-wrap">
              <label className="field-label" htmlFor="hu-id-input">
                <span>Handling Unit (Bin) ID</span>
                <span className="field-label-desc">Required</span>
              </label>

              <div className="input-icon-wrapper">
                <Barcode size={18} className="input-affix-icon" />
                <input
                  id="hu-id-input"
                  ref={inputRef}
                  type="text"
                  className="input-clean-field"
                  placeholder="e.g. BIN-00001"
                  value={huId}
                  onChange={(e) => {
                    setHuId(e.target.value.toUpperCase());
                    setError('');
                  }}
                  disabled={submitting}
                  autoComplete="off"
                />
              </div>

              {/* Real-time Validation Indicators */}
              <div className="d-flex align-items-center gap-3 mt-1 px-1" style={{ fontSize: '11.5px' }}>
                <span className={`d-inline-flex align-items-center gap-1 fw-bold ${isPrefixValid ? 'text-success' : 'text-danger'}`}>
                  <span>{isPrefixValid ? '✓' : '✗'}</span> Starts with BIN-
                </span>
                <span className={`d-inline-flex align-items-center gap-1 fw-bold ${isLengthValid ? 'text-success' : 'text-muted'}`}>
                  <span>{isLengthValid ? '✓' : '○'}</span> Min 9 chars ({cleanId.length}/9)
                </span>
              </div>

              <span className="helper-text">
                <Info size={12} className="text-muted" />
                Prefix must be BIN- followed by at least 5 alphanumeric characters (e.g. BIN-00001).
              </span>
            </div>

            {/* Selectable Tray Specification Options */}
            <div className="form-group-wrap">
              <label className="field-label">
                <span>Tray Physical Profile & Layout</span>
                <span className="field-label-desc font-monospace">Select Profile</span>
              </label>

              <div className="spec-options-grid">
                {/* Option 1: CON_BINC (Regular Horizontal 30 Slots) */}
                <div
                  className={`selectable-spec-card ${selectedBinType === 'CON_BINC' ? 'selected' : ''} ${submitting ? 'disabled' : ''}`}
                  onClick={() => !submitting && setSelectedBinType('CON_BINC')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setSelectedBinType('CON_BINC');
                    }
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div className="spec-icon-box">
                      <Layers size={18} />
                    </div>
                    <div>
                      <div className="spec-title">
                        <span>Type-C (30 Compartments)</span>
                        <span className="badge bg-secondary-subtle text-secondary-emphasis" style={{ fontSize: '10px' }}>Regular Bin</span>
                      </div>
                      <div className="spec-sub-meta">
                        <span>Horizontal 2×15 (1–15 & 16–30)</span>
                        <span>•</span>
                        <span className="badge bg-white text-dark border font-monospace" style={{ fontSize: '10.5px' }}>
                          PPS: CON_BINC
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedBinType === 'CON_BINC' ? (
                    <div className="spec-active-badge">
                      <Check size={12} strokeWidth={3} />
                      <span>Regular</span>
                    </div>
                  ) : (
                    <div className="spec-inactive-radio" />
                  )}
                </div>

                {/* Option 2: CON_BIND (Side Bin Vertical 30 Slots) */}
                <div
                  className={`selectable-spec-card ${selectedBinType === 'CON_BIND' ? 'selected' : ''} ${submitting ? 'disabled' : ''}`}
                  onClick={() => !submitting && setSelectedBinType('CON_BIND')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setSelectedBinType('CON_BIND');
                    }
                  }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div className="spec-icon-box">
                      <Columns size={18} />
                    </div>
                    <div>
                      <div className="spec-title">
                        <span>Type-D (30 Compartments)</span>
                        <span className="badge bg-primary-subtle text-primary-emphasis" style={{ fontSize: '10px' }}>Side Bin Vertical</span>
                      </div>
                      <div className="spec-sub-meta">
                        <span>Vertical 2×15 (1–15 Up & 16–30 Up)</span>
                        <span>•</span>
                        <span className="badge bg-white text-dark border font-monospace" style={{ fontSize: '10.5px' }}>
                          PPS: CON_BIND
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedBinType === 'CON_BIND' ? (
                    <div className="spec-active-badge">
                      <Check size={12} strokeWidth={3} />
                      <span>Vertical</span>
                    </div>
                  ) : (
                    <div className="spec-inactive-radio" />
                  )}
                </div>
              </div>
            </div>

            {/* Quick Status Info */}
            <div className="info-deployment-banner">
              <Boxes size={16} className="text-success flex-shrink-0" />
              <span>
                New bin starts in <strong>Draft (Floor)</strong> status and will immediately appear in <strong>HU Put</strong> ready to scan parts.
              </span>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
