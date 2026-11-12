'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiGet, apiPost } from '@/lib/api';
import { BinType } from '@/types/hu';
import {
  Package,
  PackagePlus,
  Loader2,
  Barcode,
  Layers,
  Check,
  AlertCircle,
  Tag,
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
  const [binTypeId, setBinTypeId] = useState<number | null>(null);
  const [binTypes, setBinTypes] = useState<BinType[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setHuId('');
      setBinTypeId(null);
      setError('');
      setSubmitting(false);
    } else {
      setHuId(initialHuId || '');
      fetchBinTypes();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, initialHuId]);

  const fetchBinTypes = async () => {
    try {
      setLoading(true);
      const res = await apiGet<BinType[]>('/hu/bin-types');
      const types = (res || []).filter((t) => t.compartment_count === 30);
      setBinTypes(types);
      // Auto-select the 30-compartment tray specification
      if (types.length > 0) {
        setBinTypeId(types[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load bin types from server');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = huId.trim();
    if (!cleanId) {
      setError('Please enter a valid Bin ID (e.g. H1, B01)');
      inputRef.current?.focus();
      return;
    }
    if (!binTypeId) {
      setError('Please select a bin specification type');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      await apiPost('/hu/register', { hu_id: cleanId, bin_type_id: binTypeId });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register bin');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = binTypes.find((bt) => bt.id === binTypeId);

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
              Assign a unique Handling Unit ID and physical tray specification
            </div>
          </div>
        </div>
      }
      maxWidth="520px"
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
            disabled={submitting || !huId.trim() || !binTypeId}
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
            gap: 1.25rem;
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
            padding: 10px 14px 10px 38px;
            font-size: 14px;
            font-weight: 700;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            color: #0f172a;
            letter-spacing: 0.5px;
            border: 1.5px solid #e2e8f0;
            border-radius: 9px;
            background: #f8fafc;
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

          /* Interactive Bin Type Selection Cards */
          .type-cards-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
            width: 100%;
          }

          .type-select-card {
            background: #ffffff;
            border: 1.5px solid #e2e8f0;
            border-radius: 10px;
            padding: 10px 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;
          }

          .type-select-card:hover {
            border-color: #cbd5e1;
            background: #f8fafc;
            transform: translateY(-1px);
          }

          .type-select-card.selected {
            border-color: #2563eb;
            background: #eff6ff;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
          }

          .card-main-meta {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .type-avatar-box {
            width: 34px;
            height: 34px;
            border-radius: 8px;
            background: #f1f5f9;
            color: #475569;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 12px;
            flex-shrink: 0;
            transition: all 0.15s ease;
          }

          .type-select-card.selected .type-avatar-box {
            background: #2563eb;
            color: #ffffff;
          }

          .type-title-text {
            font-size: 13.5px;
            font-weight: 700;
            color: #0f172a;
            line-height: 1.2;
          }

          .type-sub-meta {
            font-size: 11.5px;
            color: #64748b;
            margin-top: 2px;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .radio-indicator-circle {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2px solid #cbd5e1;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
            flex-shrink: 0;
          }

          .type-select-card.selected .radio-indicator-circle {
            border-color: #2563eb;
            background: #2563eb;
            color: #ffffff;
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
            padding: 7px 16px !important;
            border-radius: 8px !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
            transition: all 0.15s ease !important;
          }

          :global(.btn-cancel:hover) {
            background: #f8fafc !important;
            color: #0f172a !important;
            border-color: #94a3b8 !important;
          }

          :global(.btn-submit-register) {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
            border: 1px solid #1d4ed8 !important;
            color: #ffffff !important;
            padding: 7px 20px !important;
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
                Must match the barcode / physical label printed on the tray.
              </span>
            </div>

            {/* Bin Type Selection */}
            <div className="form-group-wrap">
              <label className="field-label">
                <span>Select Tray Specification</span>
                <span className="field-label-desc">Kardex PPS Shuttle Profile</span>
              </label>

              {loading ? (
                <div
                  className="d-flex align-items-center justify-content-center gap-2 py-4 text-muted bg-light rounded-3 border"
                  style={{ fontSize: '13px' }}
                >
                  <Loader2 size={16} className="spin-inline text-primary" />
                  <span>Loading tray profiles from server...</span>
                </div>
              ) : binTypes.length === 0 ? (
                <div className="p-3 bg-light rounded-3 border text-center text-muted" style={{ fontSize: '13px' }}>
                  No 30-compartment bin type found. Please ensure the 30-compartment profile exists.
                </div>
              ) : (
                <div className="type-cards-grid">
                  {binTypes.map((bt) => {
                    const isSelected = binTypeId === bt.id;
                    return (
                      <div
                        key={bt.id}
                        className={`type-select-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => setBinTypeId(bt.id)}
                      >
                        <div className="card-main-meta">
                          <div className="type-avatar-box">
                            <Layers size={17} />
                          </div>
                          <div>
                            <div className="type-title-text">{bt.name}</div>
                            <div className="type-sub-meta">
                              <span><strong>{bt.compartment_count}</strong> Compartments</span>
                              <span>•</span>
                              <span className="badge bg-light text-dark border font-monospace" style={{ fontSize: '10.5px' }}>
                                PPS: {bt.bin_name}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="radio-indicator-circle">
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Status Info */}
            <div className="info-deployment-banner">
              <Boxes size={16} className="text-success flex-shrink-0" />
              <span>
                New bin starts in <strong>Draft (Floor)</strong> status. It will immediately appear in <strong>HU Put</strong> ready to scan parts.
              </span>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
