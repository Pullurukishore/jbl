'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiPost } from '@/lib/api';
import { HandlingUnit, Compartment } from '@/types/hu';
import { HUStatusBadge } from './HUStatusBadge';
import { StorageStatusBadge } from './StorageStatusBadge';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  FileText,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  RotateCw,
  AlertTriangle,
} from 'lucide-react';

interface SendResult {
  file_name?: string;
  fileName?: string;
  line_count?: number;
  lineCount?: number;
  orderNumber?: string;
  orderRange?: string;
  file?: { name: string; path?: string; id?: number };
}

interface SendToKardexModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result?: SendResult) => void;
  hu: HandlingUnit;
  isResend?: boolean;
}

type Step = 'preview' | 'sent';

export const SendToKardexModal: React.FC<SendToKardexModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  hu,
  isResend = false,
}) => {
  const [step, setStep] = useState<Step>('preview');
  const [sending, setSending] = useState(false);
  const [sendingStep, setSendingStep] = useState<'idle' | 'generating' | 'waiting_kardex'>('idle');
  const [isKardexRejected, setIsKardexRejected] = useState(false);
  const [error, setError] = useState('');
  const [copiedFile, setCopiedFile] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  const handleClose = () => {
    setStep('preview');
    setSending(false);
    setSendingStep('idle');
    setIsKardexRejected(false);
    setError('');
    setSendResult(null);
    setCopiedFile(false);
    onClose();
  };

  const handleFinish = () => {
    const result = sendResult || undefined;
    handleClose();
    onSuccess(result);
  };

  const occupiedCompartments: Compartment[] = (hu.compartments || []).filter(
    (c) => c.status === 'OCCUPIED'
  );

  const handleSendToKardex = async () => {
    let timer: any = null;
    try {
      setSending(true);
      setSendingStep('generating');
      setError('');
      setIsKardexRejected(false);

      // Transition to waiting for Kardex feedback after initial dispatch
      timer = setTimeout(() => {
        setSendingStep('waiting_kardex');
      }, 1000);

      const res = await apiPost<SendResult>(`/hu/${encodeURIComponent(hu.hu_id)}/send-to-kardex`);
      if (timer) clearTimeout(timer);
      setSendResult(res);
      setStep('sent');
      // Intentionally keep modal open on 'sent' step so operator clearly sees the success screen!
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      const isRejected = Boolean(
        err.kardexRejected ||
        err.message?.toLowerCase().includes('kardex rejected') ||
        err.message?.toLowerCase().includes('previous order') ||
        err.message?.toLowerCase().includes('not been processed')
      );
      setIsKardexRejected(isRejected);
      setError(err.message || 'Failed to send PUT order to Kardex');
    } finally {
      setSending(false);
      setSendingStep('idle');
    }
  };

  const resolvedFileName =
    sendResult?.file?.name ||
    sendResult?.file_name ||
    sendResult?.fileName ||
    `PUT_${hu.hu_id}.txt`;

  const resolvedLineCount =
    sendResult?.line_count ?? sendResult?.lineCount ?? occupiedCompartments.length;

  const resolvedOrderNumber =
    sendResult?.orderNumber || sendResult?.orderRange || `${hu.hu_id}-PUT`;

  const handleCopyFileName = () => {
    navigator.clipboard.writeText(resolvedFileName);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={step === 'sent' ? handleFinish : handleClose}
      title={
        step === 'sent' ? (
          <div className="d-flex align-items-center gap-2">
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: '#dcfce7',
                color: '#15803d',
                border: '1px solid #86efac',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle size={20} className="text-success" />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#14532d' }}>
                Kardex Transmission Complete
              </div>
              <div style={{ fontSize: '12px', color: '#16a34a' }}>
                PUT file generated & dispatched to Kardex Remstar
              </div>
            </div>
          </div>
        ) : (
          <div className="d-flex align-items-center gap-2">
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: isResend ? '#fef3c7' : 'rgba(37, 99, 235, 0.12)',
                color: isResend ? '#b45309' : '#2563eb',
                border: isResend ? '1px solid #fde68a' : '1px solid rgba(37, 99, 235, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isResend ? <RotateCw size={17} /> : <Send size={18} />}
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                {isResend ? 'Resend to Kardex' : 'Send to Kardex'} — {hu.hu_id}
              </div>
              <div style={{ fontSize: '12px', color: isResend ? '#b45309' : '#64748b', marginTop: '1px' }}>
                {isResend
                  ? 'Re-generating PUT file and re-transmitting to Kardex PPS'
                  : 'Generate PUT file and store bin in Kardex'}
              </div>
            </div>
          </div>
        )
      }
      maxWidth="620px"
    >
      <div className="send-kardex-content">
        <style jsx>{`
          .send-kardex-content {
            display: flex;
            flex-direction: column;
            gap: 1.1rem;
          }

          /* STEP: PREVIEW STYLES */
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

          .waiting-banner {
            background: #f0f9ff;
            border: 1.5px solid #bae6fd;
            border-radius: 10px;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            animation: pulse-border 2s infinite ease-in-out;
          }

          @keyframes pulse-border {
            0% {
              border-color: #bae6fd;
            }
            50% {
              border-color: #38bdf8;
            }
            100% {
              border-color: #bae6fd;
            }
          }

          .rejected-box {
            background: #fef2f2;
            border: 1.5px solid #f87171;
            border-radius: 10px;
            padding: 14px 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.08);
          }

          .rejected-steps {
            margin-top: 8px;
            background: #ffffff;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 10px 14px;
          }

          .btn-send-custom {
            background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
            color: #ffffff;
            border: none;
            padding: 12px 24px;
            border-radius: 9px;
            font-size: 14.5px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 9px;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(22, 163, 74, 0.25);
            width: 100%;
            justify-content: center;
          }

          .btn-send-custom:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(22, 163, 74, 0.35);
          }

          .btn-send-custom:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          /* STEP: NOTABLE HERO SUCCESS CARD */
          .success-hero-card {
            background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%);
            border: 2px solid #86efac;
            border-radius: 14px;
            padding: 1.5rem 1.25rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 14px;
            box-shadow: 0 10px 25px -5px rgba(22, 163, 74, 0.12);
          }

          .success-badge-pulse {
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: #dcfce7;
            border: 3px solid #22c55e;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #15803d;
            box-shadow: 0 0 0 8px rgba(34, 197, 94, 0.15);
            animation: pulse-ring 2s infinite;
          }

          @keyframes pulse-ring {
            0% {
              box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
            }
            70% {
              box-shadow: 0 0 0 14px rgba(34, 197, 94, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
            }
          }

          .success-title {
            font-size: 20px;
            font-weight: 800;
            color: #14532d;
            letter-spacing: -0.3px;
            margin: 0;
          }

          .success-subtitle {
            font-size: 13px;
            color: #15803d;
            font-weight: 500;
            margin: 0;
            max-width: 420px;
          }

          .receipt-box {
            width: 100%;
            background: #ffffff;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            padding: 12px 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            text-align: left;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          }

          .receipt-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            gap: 10px;
            padding-bottom: 6px;
            border-bottom: 1px dashed #e2e8f0;
          }

          .receipt-row:last-child {
            padding-bottom: 0;
            border-bottom: none;
          }

          .receipt-label {
            color: #64748b;
            font-weight: 600;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .receipt-value {
            color: #0f172a;
            font-weight: 700;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 13px;
            text-align: right;
          }

          .file-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            color: #0f172a;
          }

          .btn-copy-mini {
            border: none;
            background: transparent;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 4px;
            color: #64748b;
            display: inline-flex;
            align-items: center;
          }
          .btn-copy-mini:hover {
            color: #0f172a;
            background: #e2e8f0;
          }

          .status-pill-success {
            background: #dcfce7;
            color: #15803d;
            border: 1px solid #86efac;
            font-size: 11.5px;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 9999px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
          }

          .btn-finish-custom {
            background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
            color: #ffffff;
            border: none;
            padding: 12px 24px;
            border-radius: 9px;
            font-size: 14.5px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            transition: all 0.2s ease;
            box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35);
          }

          .btn-finish-custom:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(22, 163, 74, 0.45);
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          :global(.spin-ani) {
            animation: spin 0.8s linear infinite;
          }
        `}</style>

        {/* STEP: PREVIEW */}
        {step === 'preview' && (
          <>
            {isResend && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1.5px solid #fde68a',
                  borderRadius: '9px',
                  padding: '9px 13px',
                  fontSize: '12.5px',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={16} className="text-warning flex-shrink-0" />
                <span>
                  <strong>Re-dispatch Notice:</strong> This bin was previously transmitted. Confirming will generate Order Batch Sequence #{(hu.put_order_seq || 1) + 1}.
                </span>
              </div>
            )}

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
                <span className="info-label">Occupied Slots to Send</span>
                <span className="info-value" style={{ color: '#16a34a', fontWeight: 800 }}>
                  {occupiedCompartments.length} / {(hu.compartments || []).length} parts
                  {occupiedCompartments.some((c) => !c.put?.text_file_id) &&
                    occupiedCompartments.some((c) => Boolean(c.put?.text_file_id)) && (
                      <span style={{ fontSize: '11.5px', color: '#0369a1', marginLeft: '6px', fontWeight: 600 }}>
                        ({occupiedCompartments.filter((c) => !c.put?.text_file_id).length} new)
                      </span>
                    )}
                </span>
              </div>
            </div>

            {occupiedCompartments.length > 0 && (
              <div className="compartments-section">
                <div className="compartments-header">
                  <Package size={12} style={{ display: 'inline', marginRight: '5px' }} />
                  Parts Ready to Dispatch ({occupiedCompartments.length})
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {occupiedCompartments.map((comp) => (
                    <div key={comp.id} className="compartment-row">
                      <span className="comp-num">#{comp.compartment_number}</span>
                      <span className="comp-serial">{comp.serial_number || '—'}</span>
                      {comp.material_name && (
                        <span className="comp-model" title={comp.material_name}>
                          {comp.material_name}
                        </span>
                      )}
                      {!comp.put?.text_file_id && (
                        <span
                          className="badge"
                          style={{
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #86efac',
                            fontSize: '10px',
                            padding: '2px 6px',
                            fontWeight: 700,
                            borderRadius: '4px',
                            marginLeft: 'auto',
                          }}
                        >
                          NEW
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sending && (
              <div className="waiting-banner">
                <Loader2 size={22} className="spin-ani" style={{ color: '#0284c7', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13.5px', color: '#0369a1' }}>
                    {sendingStep === 'waiting_kardex'
                      ? 'Waiting for Kardex Response...'
                      : 'Sending PUT File to Kardex...'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '2px' }}>
                    {sendingStep === 'waiting_kardex'
                      ? 'Monitoring IN and Error folders to verify machine acceptance.'
                      : 'Writing order instruction file to network transmission directory.'}
                  </div>
                </div>
              </div>
            )}

            {error && (
              isKardexRejected ? (
                <div className="rejected-box">
                  <div className="d-flex align-items-start gap-2">
                    <AlertTriangle size={20} className="text-danger flex-shrink-0" style={{ marginTop: '2px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: '#991b1b' }}>
                        Previous Order Not Processed Yet in Kardex
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#b91c1c', marginTop: '3px', lineHeight: 1.4 }}>
                        Kardex rejected this order because order <strong>{resolvedOrderNumber}</strong> is still active or unprocessed in the Kardex machine.
                      </div>
                      <div className="rejected-steps">
                        <div style={{ fontWeight: 700, fontSize: '12px', color: '#7f1d1d', marginBottom: '4px' }}>
                          How to proceed:
                        </div>
                        <div style={{ fontSize: '12px', color: '#991b1b', lineHeight: 1.5 }}>
                          1. Go to the Kardex machine terminal.<br />
                          2. Open the <strong>Order List</strong>.<br />
                          3. Complete or <strong>Delete</strong> the previous order <code>{resolvedOrderNumber}</code>.<br />
                          4. Click <strong>Try Again</strong> below.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="error-box">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )
            )}

            <button
              className="btn-send-custom"
              onClick={handleSendToKardex}
              disabled={sending || occupiedCompartments.length === 0}
              style={{
                background: isKardexRejected
                  ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                  : isResend
                  ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                  : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                boxShadow: isKardexRejected
                  ? '0 4px 12px rgba(220, 38, 38, 0.28)'
                  : isResend
                  ? '0 4px 12px rgba(217, 119, 6, 0.28)'
                  : '0 4px 12px rgba(22, 163, 74, 0.25)',
              }}
            >
              {sending ? (
                <Loader2 size={17} className="spin-ani" />
              ) : isKardexRejected ? (
                <RotateCw size={17} />
              ) : isResend ? (
                <RotateCw size={17} />
              ) : (
                <Send size={17} />
              )}
              {sending
                ? sendingStep === 'waiting_kardex'
                  ? 'Waiting for Kardex Response...'
                  : 'Generating PUT File...'
                : isKardexRejected
                ? `Try Again — Send to Kardex (${occupiedCompartments.length} Parts)`
                : isResend
                ? `Generate PUT File & Resend (${occupiedCompartments.length} Parts)`
                : `Generate PUT File & Send (${occupiedCompartments.length} Parts)`}
            </button>
          </>
        )}

        {/* STEP: SENT (HIGH IMPACT NOTABLE SUCCESS SCREEN) */}
        {step === 'sent' && (
          <div className="success-hero-card">
            <div className="success-badge-pulse">
              <CheckCircle2 size={36} strokeWidth={2.6} />
            </div>

            <div>
              <h3 className="success-title">Transmitted & Accepted by Kardex!</h3>
              <p className="success-subtitle mt-1">
                The machine PUT order file was picked from the transmission queue and accepted by Kardex Remstar.
              </p>
            </div>

            <div className="receipt-box">
              <div className="receipt-row">
                <span className="receipt-label">
                  <ShieldCheck size={14} className="text-success" /> Kardex Order Number
                </span>
                <span className="receipt-value" style={{ color: '#15803d', fontSize: '14px' }}>
                  {resolvedOrderNumber}
                </span>
              </div>

              <div className="receipt-row">
                <span className="receipt-label">
                  <FileText size={14} className="text-primary" /> Generated PUT File
                </span>
                <div className="file-chip">
                  <span>{resolvedFileName}</span>
                  <button
                    className="btn-copy-mini"
                    onClick={handleCopyFileName}
                    title="Copy filename"
                  >
                    {copiedFile ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div className="receipt-row">
                <span className="receipt-label">
                  <Package size={14} className="text-secondary" /> Parts Sent
                </span>
                <span className="receipt-value">
                  {resolvedLineCount} Part{resolvedLineCount === 1 ? '' : 's'} Loaded
                </span>
              </div>

              <div className="receipt-row">
                <span className="receipt-label">
                  <ArrowRight size={14} className="text-muted" /> Target Bin
                </span>
                <span className="receipt-value">{hu.hu_id}</span>
              </div>

              <div className="receipt-row">
                <span className="receipt-label">Storage Status</span>
                <span className="status-pill-success">
                  <CheckCircle2 size={11} /> IN_KARDEX
                </span>
              </div>
            </div>

            <button className="btn-finish-custom mt-2" onClick={handleFinish}>
              <CheckCircle2 size={18} />
              <span>Done & Return to Bin View</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
