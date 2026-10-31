'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import { apiPost } from '@/lib/api';
import { Log } from '@/types';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ViewLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  putId?: number | null;
  pickId?: number | null;
  title?: string;
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
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="650px">
      <style jsx>{`
        .logs-wrapper {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .log-card {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 1rem;
          background: #ffffff;
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
        }

        .log-icon {
          margin-top: 0.15rem;
        }

        .log-icon.success {
          color: #198754;
        }

        .log-icon.failed {
          color: #dc3545;
        }

        .log-details {
          flex: 1;
        }

        .activity-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: #1e293b;
        }

        .log-msg {
          font-size: 0.825rem;
          color: #475569;
          margin-top: 0.25rem;
        }

        .log-meta {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-top: 0.5rem;
          font-size: 0.75rem;
          color: #94a3b8;
        }
      `}</style>

      <div className="logs-wrapper">
        {loading ? (
          <Loader message="Loading logs..." />
        ) : logs.length === 0 ? (
          <EmptyState title="No logs found" description="No activity logs registered for this process." />
        ) : (
          logs.map((log) => (
            <div key={log.id} className="log-card">
              <div className={`log-icon ${log.status === 'SUCCESS' ? 'success' : 'failed'}`}>
                {log.status === 'SUCCESS' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              </div>
              <div className="log-details">
                <div className="activity-title">{log.activity}</div>
                {log.message && <div className="log-msg">{log.message}</div>}
                <div className="log-meta">
                  <span>Logged by: {log.user_first_name || log.logged_by || 'SYSTEM'}</span>
                  <span>Time: {new Date(log.log_date_time).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};
