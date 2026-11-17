'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import { apiPost } from '@/lib/api';
import { Log } from '@/types';
import { CheckCircle2, XCircle, Clock, User, Calendar } from 'lucide-react';

interface ViewLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  putId?: number | null;
  pickId?: number | null;
  title?: string;
}

const ACTIVITY_LABELS: Record<string, string> = {
  FETCH_DETAILS: 'Fetch Serial Details',
  CHECK_STATUS: 'Check Process Status',
  PASS_FAIL: 'PV Status Validation',
  FIND_CSV: 'Find PO Reference File',
  FIND_MODEL: 'Verify Model Number',
  'MODEL_FOUND/NOTFOUND': 'Model Verification Result',
  CHECKING_AVAILABILITY: 'Check Inventory Availability',
  FILE_GENERATED: 'Kardex Order File Generated',
  CHECK_QTY: 'Check Quantity',
};

function formatActivityName(activity: string): string {
  if (ACTIVITY_LABELS[activity]) return ACTIVITY_LABELS[activity];
  return activity
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const ViewLogsModal: React.FC<ViewLogsModalProps> = ({
  isOpen,
  onClose,
  putId,
  pickId,
  title = 'Process Logs Timeline',
}) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, putId, pickId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let data: Log[] = [];
      if (putId) {
        data = await apiPost<Log[]>('/log/get-by-put-id', { putId });
      } else if (pickId) {
        data = await apiPost<Log[]>('/log/get-by-pick-id', { pickId });
      }
      setLogs(data || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="680px">
      <style jsx>{`
        .timeline-container {
          position: relative;
          padding-left: 28px;
        }

        .timeline-line {
          position: absolute;
          left: 11px;
          top: 14px;
          bottom: 14px;
          width: 2px;
          background: #e2e8f0;
        }

        .timeline-step {
          position: relative;
          padding-bottom: 20px;
        }

        .timeline-step:last-child {
          padding-bottom: 0;
        }

        .timeline-dot {
          position: absolute;
          left: -28px;
          top: 2px;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }

        .timeline-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          transition: border-color 0.15s ease;
        }

        .timeline-card:hover {
          border-color: #cbd5e1;
        }

        .activity-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }

        .activity-title {
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
        }

        .status-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
          letter-spacing: 0.3px;
        }

        .badge-success {
          background-color: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .badge-failed {
          background-color: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .badge-pending {
          background-color: #f8fafc;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .log-message-box {
          font-size: 12.5px;
          color: #334155;
          background: #f8fafc;
          border-radius: 6px;
          padding: 8px 10px;
          margin-top: 8px;
          border-left: 3px solid #cbd5e1;
          word-break: break-word;
        }

        .log-message-box.msg-failed {
          background: #fff5f5;
          border-left-color: #ef4444;
          color: #b91c1c;
        }

        .log-meta-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 8px;
          font-size: 11.5px;
          color: #64748b;
          flex-wrap: wrap;
        }

        .log-meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
      `}</style>

      {loading ? (
        <Loader message="Loading logs..." />
      ) : logs.length === 0 ? (
        <EmptyState title="No logs found" description="No activity logs registered for this process." />
      ) : (
        <div className="timeline-container">
          <div className="timeline-line" />
          {logs.map((log) => {
            const isSuccess = log.status === 'SUCCESS';
            const isFailed = log.status === 'FAILED';

            return (
              <div key={log.id} className="timeline-step">
                <div className="timeline-dot">
                  {isSuccess ? (
                    <CheckCircle2 size={20} className="text-success" />
                  ) : isFailed ? (
                    <XCircle size={20} className="text-danger" />
                  ) : (
                    <Clock size={18} className="text-muted" />
                  )}
                </div>

                <div className="timeline-card">
                  <div className="activity-header">
                    <span className="activity-title">
                      {log.title || formatActivityName(log.activity)}
                    </span>
                    <span
                      className={`status-badge ${
                        isSuccess ? 'badge-success' : isFailed ? 'badge-failed' : 'badge-pending'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>

                  {log.message && (
                    <div className={`log-message-box ${isFailed ? 'msg-failed' : ''}`}>
                      {log.message}
                    </div>
                  )}

                  <div className="log-meta-row">
                    <div className="log-meta-item">
                      <User size={13} className="text-muted" />
                      <span>{log.user_first_name ? `${log.user_first_name} ${log.user_last_name || ''}` : log.logged_by || 'SYSTEM'}</span>
                    </div>

                    <div className="log-meta-item">
                      <Calendar size={13} className="text-muted" />
                      <span>{new Date(log.log_date_time).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};
