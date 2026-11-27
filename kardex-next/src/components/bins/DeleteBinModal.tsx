'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiDelete } from '@/lib/api';
import { HandlingUnit } from '@/types/hu';
import {
  Trash2,
  AlertTriangle,
  Loader2,
  AlertCircle,
  Barcode,
  Check,
  ShieldAlert,
} from 'lucide-react';

interface DeleteBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  hu: HandlingUnit | null;
}

export const DeleteBinModal: React.FC<DeleteBinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  hu,
}) => {
  const [confirmInput, setConfirmInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
      setError('');
      setSubmitting(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  if (!hu) return null;

  const targetId = hu.hu_id.trim().toUpperCase();
  const enteredId = confirmInput.trim().toUpperCase();
  const isMatch = enteredId === targetId;
  const occupiedCount = (hu.compartments || []).filter((c) => c.status === 'OCCUPIED').length;

  const handleDelete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isMatch) {
      setError(`Bin ID does not match. Please scan or enter "${targetId}".`);
      inputRef.current?.focus();
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await apiDelete(`/hu/${encodeURIComponent(hu.hu_id)}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete handling unit.');
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
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #fecaca',
              flexShrink: 0,
            }}
          >
            <Trash2 size={19} />
          </div>
          <div>
            <div style={{ fontSize: '16.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>
              Delete Handling Unit
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Permanently remove physical bin <strong>{hu.hu_id}</strong>
            </div>
          </div>
        </div>
      }
      maxWidth="480px"
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
            form="delete-bin-form"
            className="btn-danger-confirm"
            disabled={submitting || !isMatch}
            title={isMatch ? 'Confirm permanent deletion' : `Enter ${targetId} to enable`}
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="spin-inline" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={15} />
                <span>Delete Bin</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="delete-bin-content">
        <style jsx>{`
          .delete-bin-content {
            display: flex;
            flex-direction: column;
            gap: 1.15rem;
            padding: 4px 0;
          }

          .warning-callout {
            background: #fffbeb;
            border: 1px solid #fef3c7;
            border-radius: 9px;
            padding: 11px 13px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            color: #92400e;
            font-size: 12.5px;
            line-height: 1.45;
          }

          .bin-preview-card {
            background: #f8fafc;
            border: 1.5px solid #e2e8f0;
            border-radius: 10px;
            padding: 11px 14px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .bin-id-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .bin-id-badge {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 800;
            font-size: 14px;
            color: #1d4ed8;
            display: flex;
            align-items: center;
            gap: 6px;
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
            font-weight: 600;
            color: #dc2626;
          }

          .input-icon-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            width: 100%;
          }

          .input-affix-icon {
            position: absolute;
            left: 12px;
            color: #64748b;
            pointer-events: none;
            display: flex;
            align-items: center;
          }

          .confirm-input-field {
            width: 100%;
            padding: 10px 14px 10px 38px;
            font-size: 14.5px;
            font-weight: 700;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            letter-spacing: 0.5px;
            color: #0f172a;
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            background: #ffffff;
            outline: none;
            transition: all 0.2s ease;
          }

          .confirm-input-field:focus {
            border-color: #dc2626;
            box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.15);
          }

          .confirm-input-field.matched {
            border-color: #16a34a;
            background: #f0fdf4;
            box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.15);
          }

          .match-indicator {
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 5px;
            margin-top: 2px;
          }

          .match-indicator.valid {
            color: #16a34a;
          }

          .match-indicator.pending {
            color: #64748b;
          }

          .match-indicator.invalid {
            color: #dc2626;
          }

          .error-banner {
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

          :global(.btn-cancel:hover) {
            background: #f1f5f9 !important;
            border-color: #94a3b8 !important;
            color: #0f172a !important;
          }

          :global(.btn-danger-confirm) {
            background: #dc2626 !important;
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
            box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3) !important;
            transition: all 0.15s ease !important;
          }

          :global(.btn-danger-confirm:hover:not(:disabled)) {
            background: #b91c1c !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 4px 10px rgba(220, 38, 38, 0.4) !important;
          }

          :global(.btn-danger-confirm:disabled) {
            opacity: 0.5 !important;
            cursor: not-allowed !important;
            background: #cbd5e1 !important;
            color: #64748b !important;
            box-shadow: none !important;
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
          <div className="error-banner">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="warning-callout">
          <AlertTriangle size={18} className="flex-shrink-0 text-warning" />
          <span>
            Are you sure you want to delete handling unit <strong>{hu.hu_id}</strong>? All associated empty compartment records will be removed.
          </span>
        </div>

        <div className="bin-preview-card">
          <div className="bin-id-row">
            <div className="bin-id-badge">
              <Barcode size={17} />
              <span>{hu.hu_id}</span>
            </div>
            <span className="badge bg-secondary-subtle text-secondary-emphasis">
              {hu.storage_status}
            </span>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b' }}>
            <span>Specification: <strong>{hu.bin_type?.name || `Type #${hu.bin_type_id}`}</strong></span>
            <span className="mx-2">•</span>
            <span>PPS: <strong className="font-monospace">{hu.bin_type?.bin_name || 'CON_BINC'}</strong></span>
          </div>

          <div style={{ fontSize: '12px', color: occupiedCount > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
            {occupiedCount > 0
              ? `Warning: ${occupiedCount} compartment(s) currently occupied.`
              : 'Bin is currently empty (0 parts stored).'}
          </div>
        </div>

        {/* Scan or Enter Bin ID Form */}
        <form id="delete-bin-form" onSubmit={handleDelete}>
          <div className="form-group-wrap">
            <label className="field-label" htmlFor="confirm-hu-id-input">
              <span>Scan or Type Bin ID to Confirm</span>
              <span className="field-label-desc font-monospace">{targetId}</span>
            </label>

            <div className="input-icon-wrapper">
              <Barcode size={18} className="input-affix-icon" />
              <input
                id="confirm-hu-id-input"
                ref={inputRef}
                type="text"
                className={`confirm-input-field ${isMatch ? 'matched' : ''}`}
                placeholder={`Scan barcode or type ${targetId}`}
                value={confirmInput}
                onChange={(e) => {
                  setConfirmInput(e.target.value.toUpperCase());
                  setError('');
                }}
                disabled={submitting}
                autoComplete="off"
              />
            </div>

            {/* Validation match indicator */}
            {enteredId.length === 0 ? (
              <div className="match-indicator pending">
                <span>Scan barcode or type the Bin ID above to unlock deletion.</span>
              </div>
            ) : isMatch ? (
              <div className="match-indicator valid">
                <Check size={14} strokeWidth={3} />
                <span>Bin ID verified. Press Enter or click &ldquo;Delete Bin&rdquo; to delete.</span>
              </div>
            ) : (
              <div className="match-indicator invalid">
                <ShieldAlert size={14} />
                <span>ID does not match &ldquo;{targetId}&rdquo;</span>
              </div>
            )}
          </div>
        </form>
      </div>
    </Modal>
  );
};
