'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiPost } from '@/lib/api';
import {
  PackagePlus,
  Loader2,
  Barcode,
  Layers,
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
  const [huId, setHuId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setHuId('');
      setError('');
      setSubmitting(false);
    } else {
      setHuId(initialHuId || '');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, initialHuId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = huId.trim();
    if (!cleanId) {
      setError('Please enter a valid Bin ID (e.g. H1, B01)');
      inputRef.current?.focus();
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      await apiPost('/hu/register', { hu_id: cleanId });
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
              Assign a unique Handling Unit ID with standard 30-slot tray specification
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
            disabled={submitting || !huId.trim()}
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

          /* Fixed Tray Specification Card */
          .fixed-spec-card {
            background: #f8fafc;
            border: 1.5px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }

          .spec-icon-box {
            width: 36px;
            height: 36px;
            border-radius: 9px;
            background: #eff6ff;
            color: #2563eb;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            border: 1px solid #bfdbfe;
          }

          .spec-title {
            font-size: 13.5px;
            font-weight: 700;
            color: #0f172a;
            line-height: 1.2;
          }

          .spec-sub-meta {
            font-size: 11.5px;
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
            font-size: 11px;
            font-weight: 700;
            flex-shrink: 0;
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
                  placeholder="e.g. H1, H2, BIN-01"
                  value={huId}
                  onChange={(e) => setHuId(e.target.value)}
                  disabled={submitting}
                  autoComplete="off"
                />
              </div>

              <span className="helper-text">
                <Info size={12} className="text-muted" />
                Scan or enter the barcode printed on the physical tray.
              </span>
            </div>

            {/* Fixed Tray Specification Info */}
            <div className="form-group-wrap">
              <label className="field-label">
                <span>Tray Specification</span>
                <span className="field-label-desc font-monospace">Kardex PPS Shuttle Profile</span>
              </label>

              <div className="fixed-spec-card">
                <div className="d-flex align-items-center gap-3">
                  <div className="spec-icon-box">
                    <Layers size={18} />
                  </div>
                  <div>
                    <div className="spec-title">Type-C (30 Compartments)</div>
                    <div className="spec-sub-meta">
                      <span><strong>30</strong> Compartments (Slots 1–30)</span>
                      <span>•</span>
                      <span className="badge bg-white text-dark border font-monospace" style={{ fontSize: '10.5px' }}>
                        PPS: CON_BINC
                      </span>
                    </div>
                  </div>
                </div>

                <div className="spec-active-badge">
                  <Check size={12} strokeWidth={3} />
                  <span>Standard</span>
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
