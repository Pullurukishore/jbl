'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiDelete } from '@/lib/api';
import { BinType } from '@/types/hu';
import {
  AlertTriangle,
  Loader2,
  AlertCircle,
  Layers,
  Trash2,
} from 'lucide-react';

interface DeleteBinTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  binType: BinType | null;
}

export const DeleteBinTypeModal: React.FC<DeleteBinTypeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  binType,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!binType) return null;

  const handleDelete = async () => {
    try {
      setSubmitting(true);
      setError('');
      await apiDelete(`/hu/bin-types/${binType.id}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete bin type.');
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
              Delete Bin Specification
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Confirm deletion of specification profile
            </div>
          </div>
        </div>
      }
      maxWidth="460px"
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
            type="button"
            className="btn-danger-confirm"
            onClick={handleDelete}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="spin-inline" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={15} />
                <span>Delete Specification</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="delete-modal-content">
        <style jsx>{`
          .delete-modal-content {
            display: flex;
            flex-direction: column;
            gap: 1.15rem;
            padding: 4px 0;
          }

          .warning-callout {
            background: #fffbeb;
            border: 1px solid #fef3c7;
            border-radius: 9px;
            padding: 12px 14px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            color: #92400e;
            font-size: 12.5px;
            line-height: 1.45;
          }

          .spec-card-preview {
            background: #f8fafc;
            border: 1.5px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .spec-title-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .spec-name {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
          }

          .spec-pps-badge {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            color: #334155;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          }

          .spec-meta-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #64748b;
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

          :global(.btn-danger-confirm) {
            background: #dc2626 !important;
            border: none !important;
            color: #ffffff !important;
            padding: 8px 16px !important;
            border-radius: 8px !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            cursor: pointer !important;
            box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3) !important;
            transition: all 0.15s ease !important;
          }

          :global(.btn-danger-confirm:hover:not(:disabled)) {
            background: #b91c1c !important;
            transform: translateY(-1px) !important;
          }

          :global(.btn-danger-confirm:disabled) {
            opacity: 0.6 !important;
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
          <div className="error-banner">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="warning-callout">
          <AlertTriangle size={18} className="flex-shrink-0 text-warning" />
          <span>
            Are you sure you want to permanently delete this bin specification? This action cannot be undone.
          </span>
        </div>

        <div className="spec-card-preview">
          <div className="spec-title-row">
            <span className="spec-name">{binType.name}</span>
            <span className="spec-pps-badge">PPS: {binType.bin_name}</span>
          </div>
          <div className="spec-meta-row">
            <span><strong>{binType.compartment_count}</strong> Compartment Slots</span>
            {binType.description && (
              <>
                <span>•</span>
                <span>{binType.description}</span>
              </>
            )}
          </div>
        </div>

        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
          <strong>Note:</strong> If any physical handling units are currently registered with this specification, deletion will be blocked to maintain data integrity.
        </p>
      </div>
    </Modal>
  );
};
