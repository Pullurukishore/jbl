'use client';

import React from 'react';
import { Log } from '@/types';
import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';

interface TimelineProgressProps {
  logs: Log[];
  steps: { key: string; label: string }[];
  isProcessing: boolean;
}

export const TimelineProgress: React.FC<TimelineProgressProps> = ({
  logs,
  steps,
  isProcessing,
}) => {
  const logMap = new Map<string, Log>();
  logs.forEach((l) => logMap.set(l.activity, l));

  let activeIndex = -1;
  let completedCount = 0;
  let hasFailed = false;

  steps.forEach((step, index) => {
    const log = logMap.get(step.key);
    if (log) {
      activeIndex = index;
      if (log.status === 'SUCCESS') completedCount++;
      if (log.status === 'FAILED') hasFailed = true;
    }
  });

  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="timeline-container">
      <style jsx>{`
        .timeline-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .progress-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #f1f5f9;
        }

        .progress-title {
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .progress-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
          background: ${hasFailed ? '#fee2e2' : completedCount === steps.length ? '#dcfce7' : '#eff6ff'};
          color: ${hasFailed ? '#ef4444' : completedCount === steps.length ? '#16a34a' : '#2563eb'};
        }

        .progress-track {
          width: 100%;
          height: 6px;
          background-color: #e2e8f0;
          border-radius: 9999px;
          overflow: hidden;
          margin-bottom: 0.75rem;
        }

        .progress-fill {
          height: 100%;
          border-radius: 9999px;
          background: ${hasFailed
            ? '#ef4444'
            : completedCount === steps.length
            ? 'linear-gradient(90deg, #10b981, #059669)'
            : 'linear-gradient(90deg, #3b82f6, #2563eb)'};
          transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .timeline-list {
          position: relative;
          display: flex;
          flex-direction: column;
          padding-left: 6px;
        }

        .timeline-step {
          position: relative;
          display: flex;
          align-items: flex-start;
          padding-bottom: 16px;
          gap: 12px;
          width: 100%;
        }

        .timeline-step:last-child {
          padding-bottom: 4px;
        }

        .step-line {
          position: absolute;
          left: 11px;
          top: 24px;
          bottom: 0;
          width: 2px;
          background-color: #e2e8f0;
          transition: background-color 0.3s ease;
        }

        .step-line.completed {
          background-color: #10b981;
        }

        .icon-wrapper {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #ffffff;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .icon-wrapper.success {
          color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
        }

        .icon-wrapper.failed {
          color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
        }

        .icon-wrapper.active {
          color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
        }

        .icon-wrapper.pending {
          color: #94a3b8;
        }

        .step-body {
          flex: 1;
          min-width: 0;
        }

        .step-title {
          font-size: 13px;
          font-weight: 600;
          line-height: 1.4;
          transition: color 0.2s ease;
        }

        .step-title.success {
          color: #0f172a;
        }

        .step-title.failed {
          color: #dc2626;
        }

        .step-title.active {
          color: #2563eb;
          font-weight: 700;
        }

        .step-title.pending {
          color: #94a3b8;
          font-weight: 500;
        }

        .step-msg-box {
          margin-top: 4px;
          padding: 5px 10px;
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 6px;
          font-size: 11.5px;
          color: #475569;
          line-height: 1.4;
          word-break: break-word;
        }

        .step-msg-box.error {
          background: #fef2f2;
          border-color: #fee2e2;
          color: #b91c1c;
          font-weight: 500;
        }

        .spin-loader {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Progress Header & Bar */}
      <div>
        <div className="progress-header">
          <span className="progress-title">Process Progress</span>
          <span className="progress-badge">
            {hasFailed
              ? 'Failed'
              : completedCount === steps.length
              ? 'Complete (100%)'
              : `${completedCount}/${steps.length} Steps (${progressPercent}%)`}
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Step Timeline */}
      <div className="timeline-list">
        {steps.map((step, idx) => {
          const log = logMap.get(step.key);
          const isSuccess = log?.status === 'SUCCESS';
          const isFailed = log?.status === 'FAILED';
          const isInProgress = isProcessing && idx === activeIndex + 1;
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.key} className="timeline-step">
              {!isLast && (
                <div className={`step-line ${isSuccess ? 'completed' : ''}`} />
              )}

              <div
                className={`icon-wrapper ${
                  isSuccess
                    ? 'success'
                    : isFailed
                    ? 'failed'
                    : isInProgress
                    ? 'active'
                    : 'pending'
                }`}
              >
                {isSuccess && <CheckCircle2 size={18} />}
                {isFailed && <XCircle size={18} />}
                {isInProgress && <Loader2 size={16} className="spin-loader" />}
                {!isSuccess && !isFailed && !isInProgress && <Circle size={14} />}
              </div>

              <div className="step-body">
                <div
                  className={`step-title ${
                    isSuccess
                      ? 'success'
                      : isFailed
                      ? 'failed'
                      : isInProgress
                      ? 'active'
                      : 'pending'
                  }`}
                >
                  {step.label}
                </div>

                {log?.message && (
                  <div className={`step-msg-box ${isFailed ? 'error' : ''}`}>
                    {log.message}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

