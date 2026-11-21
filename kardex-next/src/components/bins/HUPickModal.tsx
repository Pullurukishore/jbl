'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiPost, apiDownloadFile, downloadBlob } from '@/lib/api';
import { HandlingUnit } from '@/types/hu';
import { HUStatusBadge } from './HUStatusBadge';
import { StorageStatusBadge } from './StorageStatusBadge';
import { PackageSearch, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface HUPickModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  hu: HandlingUnit;
}

type Step = 'details' | 'generated' | 'confirmed';

export const HUPickModal: React.FC<HUPickModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  hu,
}) => {
  const [step, setStep] = useState<Step>('details');
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [generatedFileName, setGeneratedFileName] = useState('');

  const handleClose = () => {
    setStep('details');
    setGenerating(false);
    setConfirming(false);
    setError('');
    setGeneratedFileName('');
    onClose();
  };

  const handleGenerateHUPick = async () => {
    try {
      setGenerating(true);
      setError('');
      const res = await apiPost<{ file_name?: string; fileName?: string; file?: { name?: string }; message?: string }>(
        `/hu/${hu.hu_id}/hu-pick`
      );
      setGeneratedFileName(res?.file?.name || res?.file_name || res?.fileName || 'HU_PICK file');
      setStep('generated');
    } catch (err: any) {
      setError(err.message || 'Failed to generate HU PICK file');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadFile = async () => {
    try {
      const { blob, fileName } = await apiDownloadFile(`/hu/${hu.hu_id}/hu-pick-download`);
      downloadBlob(blob, fileName);
    } catch {
      // silent — file already generated
    }
  };

  const handleConfirmRetrieval = async () => {
    try {
      setConfirming(true);
      setError('');
      await apiPost(`/hu/${hu.hu_id}/confirm-retrieval`, { status: 'SUCCESSFUL' });
      setStep('confirmed');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm retrieval');
    } finally {
      setConfirming(false);
    }
  };

  const compartments = hu.compartments || [];
  const occupiedCount = compartments.filter((c) => c.status === 'OCCUPIED').length;

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
              background: 'rgba(234, 88, 12, 0.12)',
              color: '#ea580c',
              border: '1px solid rgba(234, 88, 12, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PackageSearch size={18} />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              HU Pick — {hu.hu_id}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
              Retrieve bin from Kardex storage
            </div>
          </div>
        </div>
      }
      maxWidth="520px"
    >
      <div className="hu-pick-content">
        <style jsx>{`
          .hu-pick-content {
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

          .step-bar {
            display: flex;
            align-items: center;
            gap: 0;
            margin-bottom: 4px;
          }

          .step-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            flex: 1;
          }

          .step-dot {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            border: 2px solid #e2e8f0;
            background: #ffffff;
            color: #94a3b8;
          }

          .step-dot.active {
            border-color: #ea580c;
            background: #ea580c;
            color: #ffffff;
          }

          .step-dot.done {
            border-color: #22c55e;
            background: #22c55e;
            color: #ffffff;
          }

          .step-label-text {
            font-size: 10px;
            color: #94a3b8;
            font-weight: 500;
            text-align: center;
          }

          .step-label-text.active {
            color: #ea580c;
            font-weight: 600;
          }

          .step-label-text.done {
            color: #22c55e;
            font-weight: 600;
          }

          .step-connector {
            flex: 1;
            height: 2px;
            background: #e2e8f0;
            margin-bottom: 20px;
          }

          .step-connector.done {
            background: #22c55e;
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

          .btn-primary-custom {
            background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);
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
            box-shadow: 0 2px 5px rgba(234, 88, 12, 0.3);
            width: 100%;
            justify-content: center;
          }

          .btn-primary-custom:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(234, 88, 12, 0.4);
          }

          .btn-primary-custom:disabled {
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
            width: 100%;
            justify-content: center;
          }

          .btn-confirm-custom:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(22, 163, 74, 0.4);
          }

          .btn-confirm-custom:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          :global(.spin-anim) {
            animation: spin 0.8s linear infinite;
          }
        `}</style>

        {/* Step Progress Bar */}
        <div className="step-bar">
          <div className="step-item">
            <div className={`step-dot ${step === 'details' ? 'active' : 'done'}`}>
              {step === 'details' ? '1' : <CheckCircle2 size={14} />}
            </div>
            <span className={`step-label-text ${step === 'details' ? 'active' : 'done'}`}>
              Review
            </span>
          </div>
          <div className={`step-connector ${step !== 'details' ? 'done' : ''}`} />
          <div className="step-item">
            <div
              className={`step-dot ${
                step === 'generated' ? 'active' : step === 'confirmed' ? 'done' : ''
              }`}
            >
              {step === 'confirmed' ? <CheckCircle2 size={14} /> : '2'}
            </div>
            <span
              className={`step-label-text ${
                step === 'generated' ? 'active' : step === 'confirmed' ? 'done' : ''
              }`}
            >
              Generate File
            </span>
          </div>
          <div className={`step-connector ${step === 'confirmed' ? 'done' : ''}`} />
          <div className="step-item">
            <div className={`step-dot ${step === 'confirmed' ? 'done' : ''}`}>
              {step === 'confirmed' ? <CheckCircle2 size={14} /> : '3'}
            </div>
            <span className={`step-label-text ${step === 'confirmed' ? 'done' : ''}`}>
              Confirm
            </span>
          </div>
        </div>

        {/* HU Info Card */}
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
            <span className="info-label">Compartments</span>
            <span className="info-value">
              {occupiedCount} occupied / {compartments.length} total
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">HU Status</span>
            <HUStatusBadge status={hu.hu_status} />
          </div>
          <div className="info-row">
            <span className="info-label">Storage Status</span>
            <StorageStatusBadge status={hu.storage_status} />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="error-box">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Generate File */}
        {step === 'details' && (
          <button
            className="btn-primary-custom"
            onClick={handleGenerateHUPick}
            disabled={generating}
          >
            {generating ? (
              <Loader2 size={16} className="spin-anim" />
            ) : (
              <PackageSearch size={16} />
            )}
            {generating ? 'Generating HU PICK File...' : 'Generate HU PICK File'}
          </button>
        )}

        {/* Step 2: File Generated */}
        {step === 'generated' && (
          <>
            <div className="success-box">
              <CheckCircle2 size={22} className="text-success flex-shrink-0" />
              <div>
                <div className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>
                  HU PICK file generated!
                </div>
                <div style={{ fontSize: '12px', color: '#15803d' }}>
                  File: <strong>{generatedFileName}</strong>
                </div>
              </div>
              <button
                className="btn btn-sm btn-outline-success ms-auto d-flex align-items-center gap-1"
                onClick={handleDownloadFile}
                style={{ whiteSpace: 'nowrap' }}
              >
                <Download size={13} /> Download
              </button>
            </div>

            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#92400e',
              }}
            >
              ⚠ Please physically retrieve bin <strong>{hu.hu_id}</strong> from Kardex, then
              confirm below.
            </div>

            <button
              className="btn-confirm-custom"
              onClick={handleConfirmRetrieval}
              disabled={confirming}
            >
              {confirming ? (
                <Loader2 size={16} className="spin-anim" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {confirming ? 'Confirming...' : 'Confirm Physical Retrieval'}
            </button>
          </>
        )}

        {/* Step 3: Confirmed */}
        {step === 'confirmed' && (
          <div className="success-box">
            <CheckCircle2 size={24} className="text-success flex-shrink-0" />
            <div>
              <div className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>
                Retrieval confirmed successfully!
              </div>
              <div style={{ fontSize: '12px', color: '#15803d' }}>
                Bin <strong>{hu.hu_id}</strong> is now marked as outside Kardex.
              </div>
            </div>
            <button className="btn btn-sm btn-success ms-auto" onClick={handleClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

