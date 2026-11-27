'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiPut, apiGet } from '@/lib/api';
import { HandlingUnit, BinType } from '@/types/hu';
import {
  Layers,
  Columns,
  Check,
  AlertCircle,
  Barcode,
  Loader2,
  Info,
  Package,
} from 'lucide-react';

interface EditBinSpecificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  hu: HandlingUnit | null;
  binTypes?: BinType[];
}

export const EditBinSpecificationModal: React.FC<EditBinSpecificationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  hu,
  binTypes: propBinTypes,
}) => {
  const [binId, setBinId] = useState<string>('');
  const [selectedBinName, setSelectedBinName] = useState<string>('CON_BINC');
  const [binTypes, setBinTypes] = useState<BinType[]>(propBinTypes || []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch available bin types if not provided
  useEffect(() => {
    if (isOpen) {
      if (!propBinTypes || propBinTypes.length === 0) {
        apiGet<BinType[]>('/hu/bin-types')
          .then((data) => setBinTypes(data || []))
          .catch(() => {});
      } else {
        setBinTypes(propBinTypes);
      }
    }
  }, [isOpen, propBinTypes]);

  // Sync initial specification and bin name from handling unit
  useEffect(() => {
    if (isOpen && hu) {
      const currentName = hu.bin_type?.bin_name || (hu.bin_type_id === 4 ? 'CON_BIND' : 'CON_BINC');
      setSelectedBinName(currentName);
      setBinId(hu.hu_id || '');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen, hu]);

  if (!hu) return null;

  const cleanBinId = binId.trim().toUpperCase();
  const isPrefixValid = cleanBinId.startsWith('BIN-');
  const isLengthValid = cleanBinId.length === 9;
  const isFormatValid = /^BIN-[A-Z0-9_\-]+$/.test(cleanBinId);
  const isBinNameValid = isPrefixValid && isLengthValid && isFormatValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPrefixValid) {
      setError("Bin Name must start with prefix 'BIN-' (e.g. BIN-00001).");
      return;
    }
    if (!isLengthValid) {
      setError(`Bin Name must be exactly 9 characters long (currently ${cleanBinId.length}/9, e.g. BIN-00001).`);
      return;
    }
    if (!isFormatValid) {
      setError('Invalid Bin Name. Only alphanumeric characters, hyphens, and underscores are allowed.');
      return;
    }
    if (!selectedBinName) {
      setError('Please select a bin specification.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const matchedType = binTypes.find((bt) => bt.bin_name === selectedBinName);
      await apiPut(`/hu/${encodeURIComponent(hu.hu_id)}/specification`, {
        bin_name: selectedBinName,
        bin_type_id: matchedType?.id,
        new_hu_id: cleanBinId,
        hu_id: cleanBinId,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update bin specification.');
    } finally {
      setSubmitting(false);
    }
  };

  const occupiedCount = (hu.compartments || []).filter((c) => c.status === 'OCCUPIED').length;

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
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 3px 8px rgba(37, 99, 235, 0.28)',
              flexShrink: 0,
            }}
          >
            <Layers size={19} />
          </div>
          <div>
            <div style={{ fontSize: '16.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>
              Edit Bin Specification
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Reassign physical tray layout and Kardex PPS station code for <strong>{binId.trim() || hu.hu_id}</strong>
            </div>
          </div>
        </div>
      }
      maxWidth="540px"
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
            form="edit-bin-spec-form"
            className="btn-submit-save"
            disabled={submitting || !selectedBinName || !isBinNameValid}
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="spin-inline" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Check size={15} />
                <span>Save Specification</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="edit-spec-content">
        <style jsx>{`
          .edit-spec-content {
            display: flex;
            flex-direction: column;
            gap: 1.15rem;
            padding: 4px 0;
          }

          .bin-name-input-box {
            background: #f8fafc;
            border: 1.5px solid #cbd5e1;
            border-radius: 10px;
            padding: 8px 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.2s ease;
          }

          .bin-name-input-box:focus-within {
            background: #ffffff;
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
          }

          .bin-name-icon {
            color: #1d4ed8;
            display: flex;
            align-items: center;
            flex-shrink: 0;
          }

          .bin-name-field {
            border: none;
            background: transparent;
            outline: none;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 14.5px;
            font-weight: 800;
            color: #1d4ed8;
            letter-spacing: 0.5px;
            width: 100%;
          }

          .bin-name-field::placeholder {
            color: #94a3b8;
            font-weight: 500;
          }

          .hu-load-tag {
            font-size: 12px;
            font-weight: 700;
            color: #475569;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 2px 8px;
            border-radius: 6px;
            white-space: nowrap;
            flex-shrink: 0;
          }

          .form-group-wrap {
            display: flex;
            flex-direction: column;
            gap: 8px;
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

          /* Selectable Specification Cards Grid */
          .spec-options-grid {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 4px;
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

          .error-box {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #b91c1c;
            border-radius: 8px;
            font-size: 12.5px;
            font-weight: 600;
          }

          .info-note {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 9px 12px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            font-size: 12px;
            color: #166534;
            line-height: 1.4;
          }

          :global(.btn-cancel) {
            background: #f1f5f9 !important;
            border: 1px solid #cbd5e1 !important;
            color: #475569 !important;
            padding: 8px 16px !important;
            border-radius: 8px !important;
            font-size: 13px !important;
            font-weight: 600 !important;
            cursor: pointer !important;
          }

          :global(.btn-cancel:hover) {
            background: #e2e8f0 !important;
            color: #1e293b !important;
          }

          :global(.btn-submit-save) {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
            border: none !important;
            color: #ffffff !important;
            padding: 8px 18px !important;
            border-radius: 8px !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 7px !important;
            cursor: pointer !important;
            box-shadow: 0 2px 6px rgba(37, 99, 235, 0.28) !important;
            transition: all 0.15s ease !important;
          }

          :global(.btn-submit-save:hover:not(:disabled)) {
            background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%) !important;
            transform: translateY(-1px) !important;
          }

          :global(.btn-submit-save:disabled) {
            opacity: 0.55 !important;
            cursor: not-allowed !important;
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

        <form id="edit-bin-spec-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Editable Bin Name (Handling Unit ID) */}
          <div className="form-group-wrap">
            <label className="field-label" htmlFor="edit-bin-id-input">
              <span>Handling Unit (Bin) Name</span>
              <span className="field-label-desc">Fixed 9 Characters ({binId.trim().length}/9)</span>
            </label>
            <div className="bin-name-input-box">
              <div className="bin-name-icon">
                <Barcode size={18} />
              </div>
              <input
                id="edit-bin-id-input"
                type="text"
                className="bin-name-field"
                value={binId}
                onChange={(e) => {
                  setBinId(e.target.value.toUpperCase());
                  setError('');
                }}
                placeholder="e.g. BIN-00001"
                disabled={submitting}
                maxLength={9}
                autoComplete="off"
                spellCheck={false}
                required
              />
              <div className="hu-load-tag">
                {occupiedCount > 0 ? `${occupiedCount} Slots Occupied` : 'Empty (0% Load)'}
              </div>
            </div>

            {/* Validation indicators */}
            <div className="d-flex align-items-center gap-3 px-1" style={{ fontSize: '11.5px', marginTop: '2px' }}>
              <span className={`d-inline-flex align-items-center gap-1 fw-bold ${isPrefixValid ? 'text-success' : 'text-danger'}`}>
                <span>{isPrefixValid ? '✓' : '✗'}</span> Starts with BIN-
              </span>
              <span className={`d-inline-flex align-items-center gap-1 fw-bold ${isLengthValid ? 'text-success' : (cleanBinId.length > 0 ? 'text-danger' : 'text-muted')}`}>
                <span>{isLengthValid ? '✓' : (cleanBinId.length > 0 ? '✗' : '○')}</span> Exactly 9 chars ({cleanBinId.length}/9)
              </span>
            </div>
          </div>

          <div className="form-group-wrap">
            <label className="field-label">
              <span>Tray Physical Profile & Layout</span>
              <span className="field-label-desc font-monospace">Select Profile</span>
            </label>

            {/* Selectable Cards (Strictly Type-C and Type-D matching Register Bin Modal) */}
            <div className="spec-options-grid">
              {/* Option 1: CON_BINC (Regular Horizontal 30 Slots) */}
              <div
                className={`selectable-spec-card ${selectedBinName === 'CON_BINC' ? 'selected' : ''} ${submitting ? 'disabled' : ''}`}
                onClick={() => !submitting && setSelectedBinName('CON_BINC')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setSelectedBinName('CON_BINC');
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

                {selectedBinName === 'CON_BINC' ? (
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
                className={`selectable-spec-card ${selectedBinName === 'CON_BIND' ? 'selected' : ''} ${submitting ? 'disabled' : ''}`}
                onClick={() => !submitting && setSelectedBinName('CON_BIND')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setSelectedBinName('CON_BIND');
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

                {selectedBinName === 'CON_BIND' ? (
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
        </form>

        <div className="info-note">
          <Info size={16} className="flex-shrink-0 text-success mt-0.5" />
          <span>
            Updating the specification changes this bin&apos;s Kardex PPS station profile and adjusts the visual slot arrangement accordingly.
          </span>
        </div>
      </div>
    </Modal>
  );
};
