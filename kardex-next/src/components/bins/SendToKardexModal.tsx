'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiPost } from '@/lib/api';
import { HandlingUnit, Compartment } from '@/types/hu';
import { HUStatusBadge } from './HUStatusBadge';
import { StorageStatusBadge } from './StorageStatusBadge';
import { Send, CheckCircle2, XCircle, AlertCircle, Loader2, Package } from 'lucide-react';

interface SendToKardexModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orderNumber?: string) => void;
  hu: HandlingUnit;
}

type Step = 'preview' | 'sent' | 'confirmed';

export const SendToKardexModal: React.FC<SendToKardexModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  hu,
}) => {
  const [step, setStep] = useState<Step>('preview');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [failing, setFailing] = useState(false);
  const [error, setError] = useState('');
  const [sendResult, setSendResult] = useState<{
    file_name?: string;
    fileName?: string;
    line_count?: number;
    lineCount?: number;
    orderNumber?: string;
    file?: { name: string };
  } | null>(null);

  const handleClose = () => {
    setStep('preview');
    setSending(false);
    setConfirming(false);
    setFailing(false);
    setError('');
    setSendResult(null);
    onClose();
  };

  const occupiedCompartments: Compartment[] = (hu.compartments || []).filter(
    (c) => c.status === 'OCCUPIED'
  );

  const handleSendToKardex = async () => {
    try {
      setSending(true);
      setError('');
      const res = await apiPost<{
        file_name?: string;
        fileName?: string;
        line_count?: number;
        lineCount?: number;
        orderNumber?: string;
        file?: { name: string };
      }>(`/hu/${hu.hu_id}/send-to-kardex`);
      setSendResult(res);
      setStep('sent');
      onSuccess(res?.orderNumber);
    } catch (err: any) {
      setError(err.message || 'Failed to generate PUT file');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
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
            <Send size={18} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              Send to Kardex — {hu.hu_id}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Generate PUT file and store bin in Kardex
            </div>
          </div>
        </div>
      }
      maxWidth="580px"
    >
      <div className="send-kardex-content">
        <style jsx>{`
          .send-kardex-content {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
          }

          .info-card {
            background: #f8fafc;
            border: 1.5px solid #e2e8f0;
            border-radius: 10px;
            padding: 1rem 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 13px;
          }

          .info-label {
            color: #64748b;
            font-weight: 500;
          }

          .info-value {
            color: #0f172a;
            font-weight: 600;
          }

          .compartments-section {
            border: 1.5px solid #e2e8f0;
            border-radius: 10px;
            overflow: hidden;
          }

          .compartments-header {
            background: #f1f5f9;
            padding: 8px 14px;
            font-size: 12px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #e2e8f0;
          }

          .compartment-row {
            display: flex;
            align-items: center;
            padding: 8px 14px;
            font-size: 12.5px;
            border-bottom: 1px solid #f1f5f9;
            gap: 10px;
          }

          .compartment-row:last-child {
            border-bottom: none;
          }

          .comp-num {
            font-weight: 700;
            color: #64748b;
            width: 24px;
            text-align: right;
            flex-shrink: 0;
          }

          .comp-serial {
            font-weight: 600;
            color: #0f172a;
            font-family: monospace;
            font-size: 12px;
            flex: 1;
          }

          .comp-model {
            color: #64748b;
            font-size: 11.5px;
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .success-box {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            padding: 1rem;
            display: flex;
            align-items: center;
            gap: 10px;
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

          .btn-send-custom {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: #ffffff;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 5px rgba(37, 99, 235, 0.3);
            width: 100%;
            justify-content: center;
          }

          .btn-send-custom:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
          }

          .btn-send-custom:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-confirm-custom {
            background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
            color: #ffffff;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
            box-shadow: 0 2px 5px rgba(22, 163, 74, 0.3);
            flex: 1;
            justify-content: center;
          }

          .btn-confirm-custom:hover:not(:disabled) {
            transform: translateY(-1px);
          }

          .btn-confirm-custom:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-fail-custom {
            background: #ffffff;
            color: #dc2626;
            border: 1.5px solid #fca5a5;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
            flex: 1;
            justify-content: center;
          }

          .btn-fail-custom:hover:not(:disabled) {
            background: #fef2f2;
          }

          .btn-fail-custom:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          :global(.spin-ani) {
            animation: spin 0.8s linear infinite;
          }
        `}</style>

        {/* Info card */}
        <div className="info-card">
          <div className="info-row">
            <span className="info-label">Bin ID</span>
            <span className="info-value" style={{ fontFamily: 'monospace', fontSize: '14px' }}>
              {hu.hu_id}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Bin Type</span>
            <span className="info-value">{hu.bin_type?.name || `Type #${hu.bin_type_id}`}</span>
          </div>
          <div className="info-row">
            <span className="info-label">HU Status</span>
            <HUStatusBadge status={hu.hu_status} />
          </div>
          <div className="info-row">
            <span className="info-label">Storage Status</span>
            <StorageStatusBadge status={hu.storage_status} />
          </div>
          <div className="info-row">
            <span className="info-label">Occupied Slots</span>
            <span className="info-value">
              {occupiedCompartments.length} / {(hu.compartments || []).length}
            </span>
          </div>
        </div>

        {/* Occupied Compartments */}
        {occupiedCompartments.length > 0 && (
          <div className="compartments-section">
            <div className="compartments-header">
              <Package size={12} style={{ display: 'inline', marginRight: '5px' }} />
              Loaded Compartments ({occupiedCompartments.length})
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {occupiedCompartments.map((comp) => (
                <div key={comp.id} className="compartment-row">
                  <span className="comp-num">#{comp.compartment_number}</span>
                  <span className="comp-serial">{comp.serial_number || '—'}</span>
                  {comp.material_name && (
                    <span className="comp-model" title={comp.material_name}>
                      {comp.material_name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-box">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Step: Preview — Send button */}
        {step === 'preview' && (
          <button
            className="btn-send-custom"
            onClick={handleSendToKardex}
            disabled={sending || occupiedCompartments.length === 0}
          >
            {sending ? <Loader2 size={16} className="spin-ani" /> : <Send size={16} />}
            {sending ? 'Generating PUT File...' : 'Generate PUT File & Send to Kardex'}
          </button>
        )}

        {/* Step: Sent */}
        {step === 'sent' && (
          <>
            <div className="success-box">
              <CheckCircle2 size={26} className="text-success flex-shrink-0" />
              <div style={{ flex: 1 }}>
                <div className="fw-bold text-success" style={{ fontSize: '15px' }}>
                  Sent to Kardex Successfully!
                </div>
                <div style={{ fontSize: '12.5px', color: '#14532d', marginTop: '2px' }}>
                  Bin <strong>{hu.hu_id}</strong> dispatched to Kardex PPS.
                </div>
                {sendResult?.orderNumber && (
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#166534', marginTop: '4px' }}>
                    Order Number: <span style={{ fontFamily: 'monospace' }}>{sendResult.orderNumber}</span>
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
                  {sendResult?.file?.name || sendResult?.file_name || sendResult?.fileName || 'PUT file ready'}
                  {(sendResult?.line_count || sendResult?.lineCount) && (
                    <> — {sendResult.line_count || sendResult.lineCount} lines</>
                  )}
                </div>
              </div>
            </div>

            <button
              className="btn btn-success fw-bold w-100 py-2 d-flex align-items-center justify-content-center gap-2"
              onClick={handleClose}
              style={{ borderRadius: '8px', fontSize: '14px', marginTop: '0.5rem' }}
            >
              <CheckCircle2 size={16} /> Done
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};

