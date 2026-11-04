'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiGet, apiPost } from '@/lib/api';
import { BinType } from '@/types/hu';
import { Package, Loader2 } from 'lucide-react';

interface RegisterBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RegisterBinModal: React.FC<RegisterBinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
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
      fetchBinTypes();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const fetchBinTypes = async () => {
    try {
      setLoading(true);
      const res = await apiGet<BinType[]>('/hu/bin-types');
      setBinTypes(res || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load bin types');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!huId.trim()) {
      setError('Bin ID is required');
      return;
    }
    if (!binTypeId) {
      setError('Please select a bin type');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      await apiPost('/hu/register', { hu_id: huId.trim(), bin_type_id: binTypeId });
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
        <div className="d-flex align-items-center gap-2">
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(37, 99, 235, 0.12)',
              color: '#2563eb',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Package size={18} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              Register New Bin
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Assign a physical bin ID and bin type
            </div>
          </div>
        </div>
      }
      maxWidth="480px"
      footer={
        <div className="d-flex gap-2 justify-content-end w-100">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="register-bin-form"
            className="btn btn-primary btn-sm d-flex align-items-center gap-2"
            disabled={submitting || !huId.trim() || !binTypeId}
          >
            {submitting && <Loader2 size={14} className="spin-inline" />}
            {submitting ? 'Registering...' : 'Register Bin'}
          </button>
        </div>
      }
    >
      <div className="register-bin-content">
        <style jsx>{`
          .register-bin-content {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .form-label-custom {
            font-size: 13px;
            font-weight: 600;
            color: #374151;
          }

          .form-control-custom {
            border: 1.5px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 14px;
            color: #0f172a;
            outline: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
            width: 100%;
            background: #ffffff;
          }

          .form-control-custom:focus {
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
          }

          .select-custom {
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 14px center;
            padding-right: 36px;
          }

          .error-box {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 10px 14px;
            color: #991b1b;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .hint-text {
            font-size: 11.5px;
            color: #94a3b8;
            margin-top: 2px;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          :global(.spin-inline) {
            animation: spin 0.8s linear infinite;
          }
        `}</style>

        {error && (
          <div className="error-box">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form id="register-bin-form" onSubmit={handleSubmit}>
          <div className="d-flex flex-column gap-3">
            <div className="form-group">
              <label className="form-label-custom" htmlFor="hu-id-input">
                Bin ID (e.g. H1)
              </label>
              <input
                id="hu-id-input"
                ref={inputRef}
                type="text"
                className="form-control-custom"
                placeholder="Enter physical bin ID..."
                value={huId}
                onChange={(e) => setHuId(e.target.value)}
                disabled={submitting}
                autoComplete="off"
              />
              <span className="hint-text">
                This should match the physical label on the bin tray.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label-custom" htmlFor="bin-type-select">
                Bin Type
              </label>
              {loading ? (
                <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '13px', padding: '10px 0' }}>
                  <Loader2 size={14} className="spin-inline" /> Loading bin types...
                </div>
              ) : (
                <select
                  id="bin-type-select"
                  className="form-control-custom select-custom"
                  value={binTypeId ?? ''}
                  onChange={(e) => setBinTypeId(e.target.value ? Number(e.target.value) : null)}
                  disabled={submitting}
                >
                  <option value="">— Select a bin type —</option>
                  {binTypes.map((bt) => (
                    <option key={bt.id} value={bt.id}>
                      {bt.name} ({bt.compartment_count} compartments)
                    </option>
                  ))}
                </select>
              )}
              {binTypeId && binTypes.length > 0 && (
                <span className="hint-text">
                  {binTypes.find((b) => b.id === binTypeId)?.description ||
                    `${binTypes.find((b) => b.id === binTypeId)?.compartment_count} compartment slots available`}
                </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};

