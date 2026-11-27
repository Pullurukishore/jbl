'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiPost, apiPut } from '@/lib/api';
import { BinType } from '@/types/hu';
import {
  Layers,
  Edit2,
  PackagePlus,
  Loader2,
  AlertCircle,
  Tag,
  Hash,
  FileText,
  Info,
} from 'lucide-react';

interface BinTypeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  binTypeToEdit?: BinType | null;
}

export const BinTypeFormModal: React.FC<BinTypeFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  binTypeToEdit,
}) => {
  const isEdit = !!binTypeToEdit;
  const [name, setName] = useState('');
  const [binName, setBinName] = useState('');
  const [compartmentCount, setCompartmentCount] = useState<number | string>(30);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (binTypeToEdit) {
        setName(binTypeToEdit.name || '');
        setBinName(binTypeToEdit.bin_name || '');
        setCompartmentCount(binTypeToEdit.compartment_count || 30);
        setDescription(binTypeToEdit.description || '');
      } else {
        setName('');
        setBinName('');
        setCompartmentCount(30);
        setDescription('');
      }
      setError('');
      setSubmitting(false);
    }
  }, [isOpen, binTypeToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanBinName = binName.trim().toUpperCase();
    const count = parseInt(String(compartmentCount), 10);

    if (!cleanName) {
      setError('Specification Name is required.');
      return;
    }
    if (!cleanBinName) {
      setError('PPS Code / Bin Name is required (e.g. CON_BINC).');
      return;
    }
    if (isNaN(count) || count <= 0) {
      setError('Compartment count must be a positive integer greater than 0.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const payload = {
        name: cleanName,
        bin_name: cleanBinName,
        compartment_count: count,
        description: description.trim() || null,
      };

      if (isEdit && binTypeToEdit) {
        await apiPut(`/hu/bin-types/${binTypeToEdit.id}`, payload);
      } else {
        await apiPost('/hu/bin-types', payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save bin type.');
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
              background: isEdit
                ? 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 3px 8px rgba(37, 99, 235, 0.25)',
              flexShrink: 0,
            }}
          >
            {isEdit ? <Edit2 size={18} /> : <PackagePlus size={19} />}
          </div>
          <div>
            <div style={{ fontSize: '16.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>
              {isEdit ? 'Edit Bin Specification' : 'Add New Bin Specification'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              {isEdit
                ? `Update details for ${binTypeToEdit?.name || 'Bin Type'}`
                : 'Define a new tray type, slot configuration, and Kardex PPS code'}
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
            form="bin-type-form"
            className="btn-submit"
            disabled={submitting || !name.trim() || !binName.trim()}
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="spin-inline" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{isEdit ? 'Update Specification' : 'Create Specification'}</span>
            )}
          </button>
        </div>
      }
    >
      <div className="bin-type-form-container">
        <style jsx>{`
          .bin-type-form-container {
            display: flex;
            flex-direction: column;
            gap: 1.15rem;
            padding: 4px 0;
          }

          .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .label-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .label-text {
            font-size: 13px;
            font-weight: 700;
            color: #1e293b;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .label-hint {
            font-size: 11.5px;
            font-weight: 500;
            color: #64748b;
          }

          .input-wrap {
            position: relative;
            display: flex;
            align-items: center;
            width: 100%;
          }

          .input-icon {
            position: absolute;
            left: 12px;
            color: #64748b;
            pointer-events: none;
            display: flex;
            align-items: center;
          }

          .field-input {
            width: 100%;
            padding: 9px 12px 9px 36px;
            font-size: 13.5px;
            font-weight: 600;
            color: #0f172a;
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            background: #ffffff;
            outline: none;
            transition: all 0.15s ease;
          }

          .field-input:focus {
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
          }

          .field-textarea {
            width: 100%;
            padding: 9px 12px 9px 36px;
            font-size: 13px;
            color: #0f172a;
            border: 1.5px solid #cbd5e1;
            border-radius: 8px;
            background: #ffffff;
            outline: none;
            min-height: 70px;
            resize: vertical;
            transition: all 0.15s ease;
          }

          .field-textarea:focus {
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
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

          :global(.btn-submit) {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
            border: none !important;
            color: #ffffff !important;
            padding: 8px 18px !important;
            border-radius: 8px !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            cursor: pointer !important;
            box-shadow: 0 2px 6px rgba(37, 99, 235, 0.28) !important;
            transition: all 0.15s ease !important;
          }

          :global(.btn-submit:hover:not(:disabled)) {
            background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%) !important;
            transform: translateY(-1px) !important;
          }

          :global(.btn-submit:disabled) {
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
          <div className="error-banner">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form id="bin-type-form" onSubmit={handleSubmit}>
          <div className="d-flex flex-column gap-3">
            {/* Name */}
            <div className="form-group">
              <div className="label-row">
                <label className="label-text" htmlFor="bintype-name">
                  <Tag size={14} className="text-primary" />
                  <span>Specification Name</span>
                </label>
                <span className="label-hint">Required</span>
              </div>
              <div className="input-wrap">
                <Layers size={15} className="input-icon" />
                <input
                  id="bintype-name"
                  type="text"
                  className="field-input"
                  placeholder="e.g. Type-C (30 Compartments)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            {/* PPS Code / bin_name */}
            <div className="form-group">
              <div className="label-row">
                <label className="label-text" htmlFor="bintype-binname">
                  <Tag size={14} className="text-primary" />
                  <span>PPS Code / Kardex Tray ID</span>
                </label>
                <span className="label-hint">Uppercase code (e.g. CON_BINC)</span>
              </div>
              <div className="input-wrap">
                <Tag size={15} className="input-icon" />
                <input
                  id="bintype-binname"
                  type="text"
                  className="field-input font-monospace"
                  placeholder="e.g. CON_BINC or CON_BIND"
                  value={binName}
                  onChange={(e) => setBinName(e.target.value.toUpperCase())}
                  disabled={submitting}
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            {/* Compartment Count */}
            <div className="form-group">
              <div className="label-row">
                <label className="label-text" htmlFor="bintype-slots">
                  <Hash size={14} className="text-primary" />
                  <span>Total Compartment Slots</span>
                </label>
                <span className="label-hint">Slots generated per bin</span>
              </div>
              <div className="input-wrap">
                <Hash size={15} className="input-icon" />
                <input
                  id="bintype-slots"
                  type="number"
                  min="1"
                  max="120"
                  className="field-input"
                  placeholder="e.g. 30"
                  value={compartmentCount}
                  onChange={(e) => setCompartmentCount(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <div className="label-row">
                <label className="label-text" htmlFor="bintype-desc">
                  <FileText size={14} className="text-primary" />
                  <span>Description (Optional)</span>
                </label>
                <span className="label-hint">Brief details or notes</span>
              </div>
              <div className="input-wrap">
                <FileText size={15} className="input-icon" style={{ top: '12px' }} />
                <textarea
                  id="bintype-desc"
                  className="field-textarea"
                  placeholder="e.g. Standard 30-compartment horizontal tray (2×15)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                  rows={2}
                />
              </div>
            </div>

            <div className="info-note">
              <Info size={16} className="flex-shrink-0 text-success mt-0.5" />
              <span>
                {isEdit
                  ? 'Editing this specification updates the profile for future bins and displays current specifications for all linked handling units.'
                  : 'New bins registered with this specification will automatically have the configured number of compartment slots created.'}
              </span>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
