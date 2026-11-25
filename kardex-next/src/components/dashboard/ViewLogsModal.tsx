'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Modal } from '@/components/shared/Modal';
import { Loader } from '@/components/shared/Loader';
import { apiPost, apiDownloadFile, downloadBlob } from '@/lib/api';
import { copyToClipboard } from '@/lib/clipboard';
import { formatIndianDate, formatIndianDateTime } from '@/lib/date';
import { Log, PaginatedResponse } from '@/types';
import { Put } from '@/types/put';
import {
  CheckCircle2,
  XCircle,
  Download,
  Copy,
  Check,
  Layers,
  ChevronLeft,
  ChevronRight,
  Inbox,
  FileText,
  Calendar,
  User,
  Activity,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

interface ViewLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  put?: Put | null;
  putId?: number | null;
  pickId?: number | null;
  title?: string;
  onRefresh?: () => void;
}

const PUT_STEPS = [
  { activity: 'FETCH_DETAILS', name: 'Fetch Details' },
  { activity: 'CHECK_STATUS', name: 'Check Status' },
  { activity: 'PASS_FAIL', name: 'Pass/Fail' },
  { activity: 'FIND_CSV', name: 'Find CSV' },
  { activity: 'FIND_MODEL', name: 'Finding Model No' },
  { activity: 'MODEL_FOUND/NOTFOUND', name: 'Model No. Found/Not Found' },
  { activity: 'CHECKING_AVAILABILITY', name: 'Checking Availability' },
  { activity: 'FILE_GENERATED', name: 'File Generated' },
];

const PICK_STEPS = [
  { activity: 'FETCH_DETAILS', name: 'Fetching Details' },
  { activity: 'CHECK_QTY', name: 'Checking Quantity' },
  { activity: 'CHECK_STATUS', name: 'Checking Status (Pass/Hold)' },
  { activity: 'FILE_GENERATED', name: 'File Generated' },
];

export const ViewLogsModal: React.FC<ViewLogsModalProps> = ({
  isOpen,
  onClose,
  put,
  putId,
  pickId,
  onRefresh,
}) => {
  // Effective IDs and Serial
  const effectivePutId = put?.id || putId || null;
  const effectivePickId = put?.pick_id || put?.pick?.id || pickId || null;
  const serialNumber = put?.serial_number || '';
  const modelNumber = put?.model_number || '';

  // Process timeline logs
  const [putProcessLogs, setPutProcessLogs] = useState<Log[]>([]);
  const [pickProcessLogs, setPickProcessLogs] = useState<Log[]>([]);
  const [loadingTimelines, setLoadingTimelines] = useState(false);

  // Progressive animation index (like original Kardex zip)
  const [animatedPutStep, setAnimatedPutStep] = useState(0);
  const [animatedPickStep, setAnimatedPickStep] = useState(0);

  // Paginated log tables (history)
  const [putTableLogs, setPutTableLogs] = useState<Log[]>([]);
  const [putPage, setPutPage] = useState(1);
  const [putTotalPages, setPutTotalPages] = useState(1);
  const [putTotalItems, setPutTotalItems] = useState(0);
  const [putTableLoading, setPutTableLoading] = useState(false);

  const [pickTableLogs, setPickTableLogs] = useState<Log[]>([]);
  const [pickPage, setPickPage] = useState(1);
  const [pickTotalPages, setPickTotalPages] = useState(1);
  const [pickTotalItems, setPickTotalItems] = useState(0);
  const [pickTableLoading, setPickTableLoading] = useState(false);

  // Download states
  const [downloadingPut, setDownloadingPut] = useState(false);
  const [downloadingPick, setDownloadingPick] = useState(false);
  const [putDownloaded, setPutDownloaded] = useState<boolean>(!!put?.text_file_downloaded);
  const [pickDownloaded, setPickDownloaded] = useState<boolean>(!!put?.pick?.text_file_downloaded);

  // UI state
  const [copiedSerial, setCopiedSerial] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PUT' | 'PICK'>('ALL');

  // Sync download state with props
  useEffect(() => {
    setPutDownloaded(!!put?.text_file_downloaded);
    setPickDownloaded(!!put?.pick?.text_file_downloaded);
  }, [put]);

  // Progressive animation timer
  useEffect(() => {
    if (!isOpen) {
      setAnimatedPutStep(0);
      setAnimatedPickStep(0);
      return;
    }

    if (putProcessLogs.length > 0) {
      setAnimatedPutStep(0);
      const timer = setInterval(() => {
        setAnimatedPutStep((prev) => {
          if (prev >= PUT_STEPS.length) {
            clearInterval(timer);
            return prev;
          }
          return prev + 1;
        });
      }, 70);
      return () => clearInterval(timer);
    }
  }, [isOpen, putProcessLogs]);

  useEffect(() => {
    if (isOpen && pickProcessLogs.length > 0) {
      setAnimatedPickStep(0);
      const timer = setInterval(() => {
        setAnimatedPickStep((prev) => {
          if (prev >= PICK_STEPS.length) {
            clearInterval(timer);
            return prev;
          }
          return prev + 1;
        });
      }, 80);
      return () => clearInterval(timer);
    }
  }, [isOpen, pickProcessLogs]);

  // Fetch process timeline logs
  const fetchProcessLogs = useCallback(async () => {
    if (!effectivePutId && !effectivePickId) return;
    setLoadingTimelines(true);
    try {
      const promises: Promise<any>[] = [];
      if (effectivePutId) {
        promises.push(
          apiPost<Log[]>('/log/get-by-put-id', { putId: effectivePutId }).catch(() => [])
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      if (effectivePickId) {
        promises.push(
          apiPost<Log[]>('/log/get-by-pick-id', { pickId: effectivePickId }).catch(() => [])
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      const [putLogs, pickLogs] = await Promise.all(promises);
      setPutProcessLogs(putLogs || []);
      setPickProcessLogs(pickLogs || []);
    } catch {
      setPutProcessLogs([]);
      setPickProcessLogs([]);
    } finally {
      setLoadingTimelines(false);
    }
  }, [effectivePutId, effectivePickId]);

  // Fetch PUT historical table logs
  const fetchPutTableLogs = useCallback(
    async (page = 1) => {
      if (!serialNumber) return;
      setPutTableLoading(true);
      try {
        const res = await apiPost<PaginatedResponse<Log>>('/log/get-all-for-part', {
          serialNumber,
          modelNumber: modelNumber || undefined,
          log_type: 'PUT_PROCESS',
          page,
          size: 6,
          sort: ['id', 'DESC'],
        });
        setPutTableLogs(res.data || []);
        setPutTotalPages(res.totalPages || 1);
        setPutTotalItems(res.totalItems || 0);
        setPutPage(page);
      } catch {
        setPutTableLogs([]);
      } finally {
        setPutTableLoading(false);
      }
    },
    [serialNumber, modelNumber]
  );

  // Fetch PICK historical table logs
  const fetchPickTableLogs = useCallback(
    async (page = 1) => {
      if (!serialNumber || !effectivePickId) {
        setPickTableLogs([]);
        return;
      }
      setPickTableLoading(true);
      try {
        const res = await apiPost<PaginatedResponse<Log>>('/log/get-all-for-part', {
          serialNumber,
          modelNumber: modelNumber || undefined,
          log_type: 'PICK_PROCESS',
          page,
          size: 6,
          sort: ['id', 'DESC'],
        });
        setPickTableLogs(res.data || []);
        setPickTotalPages(res.totalPages || 1);
        setPickTotalItems(res.totalItems || 0);
        setPickPage(page);
      } catch {
        setPickTableLogs([]);
      } finally {
        setPickTableLoading(false);
      }
    },
    [serialNumber, modelNumber, effectivePickId]
  );

  useEffect(() => {
    if (isOpen) {
      fetchProcessLogs();
      fetchPutTableLogs(1);
      fetchPickTableLogs(1);
    }
  }, [isOpen, fetchProcessLogs, fetchPutTableLogs, fetchPickTableLogs]);

  // Handle PUT File Download
  const handleDownloadPut = async () => {
    if (!effectivePutId || downloadingPut) return;
    try {
      setDownloadingPut(true);
      const { blob, fileName } = await apiDownloadFile('/put/download-text-file', {
        id: effectivePutId,
      });
      downloadBlob(blob, fileName || `put_${serialNumber}.txt`);
      setPutDownloaded(true);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to download PUT file');
    } finally {
      setDownloadingPut(false);
    }
  };

  // Handle PICK File Download
  const handleDownloadPick = async () => {
    if (!effectivePickId || downloadingPick) return;
    try {
      setDownloadingPick(true);
      const { blob, fileName } = await apiDownloadFile('/pick/download-text-file', {
        id: effectivePickId,
      });
      downloadBlob(blob, fileName || `pick_${serialNumber}.txt`);
      setPickDownloaded(true);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to download PICK file');
    } finally {
      setDownloadingPick(false);
    }
  };

  const copySerial = () => {
    if (!serialNumber) return;
    copyToClipboard(serialNumber);
    setCopiedSerial(true);
    setTimeout(() => setCopiedSerial(false), 1500);
  };

  // Helper to render timeline step
  const renderStep = (
    step: { activity: string; name: string },
    logs: Log[],
    index: number,
    totalSteps: number,
    animationStepIndex: number
  ) => {
    const matchingLog = logs.find((l) => l.activity === step.activity);
    const hasLog = !!matchingLog;
    const isRevealed = index < animationStepIndex;
    const isSuccess = hasLog && matchingLog.status === 'SUCCESS';
    const isFailed = hasLog && matchingLog.status === 'FAILED';

    let displayTitle = step.name;
    if (step.activity === 'PASS_FAIL' && matchingLog) {
      displayTitle = isSuccess ? 'Pass' : 'Fail';
    } else if (step.activity === 'MODEL_FOUND/NOTFOUND' && matchingLog) {
      displayTitle = isSuccess ? 'Model No. Found' : 'Model No. Not Found';
    }

    const isLast = index === totalSteps - 1;

    return (
      <div key={step.activity} className={`timeline-item ${isRevealed ? 'item-revealed' : ''}`}>
        <div className="timeline-track">
          <div
            className={`timeline-icon-bubble ${
              !isRevealed
                ? 'bubble-pending'
                : isSuccess
                ? 'bubble-success'
                : isFailed
                ? 'bubble-failed'
                : 'bubble-pending'
            }`}
          >
            {isRevealed && isSuccess ? (
              <CheckCircle2 size={15} className="text-white" />
            ) : isRevealed && isFailed ? (
              <XCircle size={15} className="text-white" />
            ) : (
              <span className="dot-pending" />
            )}
          </div>
          {!isLast && (
            <div
              className={`timeline-line ${
                isRevealed && isSuccess
                  ? 'line-success'
                  : isRevealed && isFailed
                  ? 'line-failed'
                  : 'line-pending'
              }`}
            />
          )}
        </div>

        <div className="timeline-content">
          <div className="timeline-step-header">
            <span
              className={`timeline-step-title ${
                !isRevealed
                  ? 'title-pending'
                  : isSuccess
                  ? 'title-success'
                  : isFailed
                  ? 'title-failed'
                  : 'title-pending'
              }`}
            >
              {displayTitle}
            </span>
            {isRevealed && matchingLog?.log_date_time && (
              <span className="timeline-time">
                {new Date(matchingLog.log_date_time).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            )}
          </div>

          {isRevealed && matchingLog?.message && (
            <div className={`timeline-msg ${isFailed ? 'msg-failed' : 'msg-info'}`}>
              {matchingLog.message}
            </div>
          )}
        </div>
      </div>
    );
  };

  const modalTitle = (
    <div className="custom-modal-header d-flex align-items-center justify-content-between flex-wrap gap-2 w-100 pe-3">
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <div className="serial-chip">
          <span className="serial-chip-label">SERIAL</span>
          <span className="serial-chip-value">{serialNumber || '—'}</span>
          {serialNumber && (
            <button
              type="button"
              className="copy-btn"
              onClick={copySerial}
              title={copiedSerial ? 'Copied to clipboard!' : 'Copy Serial Number'}
            >
              {copiedSerial ? (
                <Check size={13} className="text-success" />
              ) : (
                <Copy size={13} className="text-muted" />
              )}
            </button>
          )}
        </div>

        {modelNumber && (
          <div className="meta-pill">
            <span className="meta-pill-label">Model:</span>
            <span className="meta-pill-value">{modelNumber}</span>
          </div>
        )}

        {put?.process_status && (
          <span className="meta-pill process-pill">
            {put.process_status}
          </span>
        )}

        {put?.pv_status && (
          <span
            className={`meta-pill ${
              put.pv_status === 'PASS' ? 'pv-pass' : 'pv-fail'
            }`}
          >
            PV: {put.pv_status}
          </span>
        )}

        {put?.pick_status && (
          <span
            className={`meta-pill ${
              put.pick_status === 'AVAILABLE'
                ? 'status-available'
                : put.pick_status === 'PICKED'
                ? 'status-picked'
                : 'status-hold'
            }`}
          >
            ● {put.pick_status}
          </span>
        )}
      </div>

      {put?.scanned_at && (
        <div className="d-none d-md-flex align-items-center gap-1 text-muted" style={{ fontSize: '12px' }}>
          <Calendar size={13} />
          <span>{new Date(put.scanned_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} maxWidth="1200px">
      <div className="view-logs-container">
        {/* Responsive Tab Bar for mobile/tablet */}
        <div className="tab-pill-bar d-lg-none mb-3">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveTab('ALL')}
          >
            All Sequences & Logs
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'PUT' ? 'active' : ''}`}
            onClick={() => setActiveTab('PUT')}
          >
            PUT ({putTableLogs.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'PICK' ? 'active' : ''}`}
            onClick={() => setActiveTab('PICK')}
          >
            PICK ({pickTableLogs.length})
          </button>
        </div>

        {/* TOP SECTION: Dual Side-by-Side Sequences */}
        <div className="row g-4 mb-4">
          {/* LEFT: PUT Timeline */}
          {(activeTab === 'ALL' || activeTab === 'PUT') && (
            <div className={activeTab === 'ALL' ? 'col-lg-6' : 'col-12'}>
              <div className="process-card">
                <div className="process-header">
                  <div className="d-flex align-items-center gap-2">
                    <span className="process-badge put-badge">PUT PROCESS</span>
                    <span className="sequence-label">8-Step MES Verification</span>
                  </div>

                  {/* PUT File Download Button */}
                  {effectivePutId && (
                    <button
                      type="button"
                      className={`download-btn ${
                        putDownloaded ? 'download-btn-secondary' : 'download-btn-primary'
                      }`}
                      onClick={handleDownloadPut}
                      disabled={downloadingPut}
                      title={putDownloaded ? 'File was previously downloaded (Click to re-download)' : 'Download PUT Order File (.txt)'}
                    >
                      <Download size={13} />
                      <span>
                        {downloadingPut
                          ? 'Downloading...'
                          : putDownloaded
                          ? 'Re-Download PUT File'
                          : 'Download PUT File'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="process-body">
                  {loadingTimelines ? (
                    <div className="py-4 text-center">
                      <Loader message="Loading PUT sequence..." />
                    </div>
                  ) : putProcessLogs.length === 0 ? (
                    <div className="empty-state-box py-4 text-center text-muted">
                      No active PUT sequence recorded for this entry.
                    </div>
                  ) : (
                    <div className="timeline-flow">
                      {PUT_STEPS.map((s, idx) =>
                        renderStep(s, putProcessLogs, idx, PUT_STEPS.length, animatedPutStep)
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* RIGHT: PICK Timeline */}
          {(activeTab === 'ALL' || activeTab === 'PICK') && (
            <div className={activeTab === 'ALL' ? 'col-lg-6' : 'col-12'}>
              <div className="process-card">
                <div className="process-header">
                  <div className="d-flex align-items-center gap-2">
                    <span className="process-badge pick-badge">PICK PROCESS</span>
                    <span className="sequence-label">4-Step MES Allocation</span>
                  </div>

                  {/* PICK File Download Button */}
                  {effectivePickId ? (
                    <button
                      type="button"
                      className={`download-btn ${
                        pickDownloaded ? 'download-btn-secondary' : 'download-btn-info'
                      }`}
                      onClick={handleDownloadPick}
                      disabled={downloadingPick}
                      title={pickDownloaded ? 'File was previously downloaded (Click to re-download)' : 'Download PICK Order File (.txt)'}
                    >
                      <Download size={13} />
                      <span>
                        {downloadingPick
                          ? 'Downloading...'
                          : pickDownloaded
                          ? 'Re-Download PICK File'
                          : 'Download PICK File'}
                      </span>
                    </button>
                  ) : (
                    <span className="badge bg-light text-muted border px-2 py-1" style={{ fontSize: '11px' }}>
                      Not Picked
                    </span>
                  )}
                </div>

                <div className="process-body">
                  {loadingTimelines ? (
                    <div className="py-4 text-center">
                      <Loader message="Loading PICK sequence..." />
                    </div>
                  ) : !effectivePickId ? (
                    <div className="empty-pick-box text-center py-5">
                      <div className="empty-pick-icon mx-auto mb-3">
                        <Inbox size={30} className="text-muted" />
                      </div>
                      <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>
                        Part In Storage (Available)
                      </div>
                      <p className="text-muted small mt-1 mb-0 px-4">
                        This serial number has not been picked yet. The 4-step pick sequence will
                        record and display here once an operator allocates a pick order.
                      </p>
                    </div>
                  ) : pickProcessLogs.length === 0 ? (
                    <div className="empty-state-box py-4 text-center text-muted">
                      No active PICK sequence recorded.
                    </div>
                  ) : (
                    <div className="timeline-flow">
                      {PICK_STEPS.map((s, idx) =>
                        renderStep(s, pickProcessLogs, idx, PICK_STEPS.length, animatedPickStep)
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MIDDLE SECTION: Section Header Divider */}
        <div className="divider-header my-4">
          <span className="divider-line" />
          <span className="divider-title">
            <Activity size={14} className="text-primary me-1" />
            Historical Audit Activity Logs
          </span>
          <span className="divider-line" />
        </div>

        {/* BOTTOM SECTION: Side-by-Side Dual Log Tables */}
        <div className="row g-4">
          {/* LEFT TABLE: Put Logs */}
          {(activeTab === 'ALL' || activeTab === 'PUT') && (
            <div className={activeTab === 'ALL' ? 'col-lg-6' : 'col-12'}>
              <div className="table-box">
                <div className="table-box-header">
                  <div className="d-flex align-items-center gap-2">
                    <span className="table-box-title">Put Logs</span>
                    <span className="count-chip put-count-chip">
                      {putTotalItems} logs
                    </span>
                  </div>
                </div>

                <div className="table-responsive" style={{ minHeight: '220px' }}>
                  {putTableLoading ? (
                    <div className="py-5 text-center">
                      <Loader message="Loading PUT logs..." />
                    </div>
                  ) : putTableLogs.length === 0 ? (
                    <div className="py-5 text-center text-muted small">
                      No PUT log history recorded.
                    </div>
                  ) : (
                    <table className="table table-hover log-table mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>Activity</th>
                          <th>Status</th>
                          <th>Message</th>
                          <th>Logged At</th>
                          <th>User</th>
                        </tr>
                      </thead>
                      <tbody>
                        {putTableLogs.map((l) => (
                          <tr key={l.id}>
                            <td className="fw-semibold text-dark" style={{ fontSize: '12px' }}>
                              {l.activity}
                            </td>
                            <td>
                              <span
                                className={`status-badge ${
                                  l.status === 'SUCCESS'
                                    ? 'status-badge-success'
                                    : l.status === 'FAILED'
                                    ? 'status-badge-failed'
                                    : 'status-badge-neutral'
                                }`}
                              >
                                {l.status === 'SUCCESS' ? '● SUCCESS' : l.status === 'FAILED' ? '● FAILED' : l.status}
                              </span>
                            </td>
                            <td
                              className="text-truncate text-muted"
                              style={{ maxWidth: '140px', fontSize: '11px' }}
                              title={l.message || ''}
                            >
                              {l.message || '—'}
                            </td>
                            <td className="text-nowrap text-muted" style={{ fontSize: '11px' }}>
                              {formatIndianDate(l.log_date_time)}{' '}
                              <span style={{ fontSize: '10px' }}>
                                {new Date(l.log_date_time).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </td>
                            <td className="text-muted" style={{ fontSize: '11px' }}>
                              {l.user_id || l.user_first_name || 'SYSTEM'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* PUT Table Pagination */}
                {putTotalPages > 1 && (
                  <div className="table-box-footer d-flex align-items-center justify-content-between p-2 px-3 border-top bg-light">
                    <span className="text-muted" style={{ fontSize: '11px' }}>
                      Page {putPage} of {putTotalPages} ({putTotalItems} logs)
                    </span>
                    <div className="btn-group btn-group-sm">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm p-1 px-2"
                        disabled={putPage <= 1 || putTableLoading}
                        onClick={() => fetchPutTableLogs(putPage - 1)}
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm p-1 px-2"
                        disabled={putPage >= putTotalPages || putTableLoading}
                        onClick={() => fetchPutTableLogs(putPage + 1)}
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RIGHT TABLE: Pick Logs */}
          {(activeTab === 'ALL' || activeTab === 'PICK') && (
            <div className={activeTab === 'ALL' ? 'col-lg-6' : 'col-12'}>
              <div className="table-box">
                <div className="table-box-header">
                  <div className="d-flex align-items-center gap-2">
                    <span className="table-box-title">Pick Logs</span>
                    <span className="count-chip pick-count-chip">
                      {pickTotalItems} logs
                    </span>
                  </div>
                </div>

                <div className="table-responsive" style={{ minHeight: '220px' }}>
                  {pickTableLoading ? (
                    <div className="py-5 text-center">
                      <Loader message="Loading PICK logs..." />
                    </div>
                  ) : !effectivePickId ? (
                    <div className="py-5 text-center text-muted small">
                      No PICK logs recorded because this board has not been picked yet.
                    </div>
                  ) : pickTableLogs.length === 0 ? (
                    <div className="py-5 text-center text-muted small">
                      No PICK log history recorded.
                    </div>
                  ) : (
                    <table className="table table-hover log-table mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>Activity</th>
                          <th>Status</th>
                          <th>Message</th>
                          <th>Logged At</th>
                          <th>User</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pickTableLogs.map((l) => (
                          <tr key={l.id}>
                            <td className="fw-semibold text-dark" style={{ fontSize: '12px' }}>
                              {l.activity}
                            </td>
                            <td>
                              <span
                                className={`status-badge ${
                                  l.status === 'SUCCESS'
                                    ? 'status-badge-success'
                                    : l.status === 'FAILED'
                                    ? 'status-badge-failed'
                                    : 'status-badge-neutral'
                                }`}
                              >
                                {l.status === 'SUCCESS' ? '● SUCCESS' : l.status === 'FAILED' ? '● FAILED' : l.status}
                              </span>
                            </td>
                            <td
                              className="text-truncate text-muted"
                              style={{ maxWidth: '140px', fontSize: '11px' }}
                              title={l.message || ''}
                            >
                              {l.message || '—'}
                            </td>
                            <td className="text-nowrap text-muted" style={{ fontSize: '11px' }}>
                              {formatIndianDate(l.log_date_time)}{' '}
                              <span style={{ fontSize: '10px' }}>
                                {new Date(l.log_date_time).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </td>
                            <td className="text-muted" style={{ fontSize: '11px' }}>
                              {l.user_id || l.user_first_name || 'SYSTEM'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* PICK Table Pagination */}
                {pickTotalPages > 1 && (
                  <div className="table-box-footer d-flex align-items-center justify-content-between p-2 px-3 border-top bg-light">
                    <span className="text-muted" style={{ fontSize: '11px' }}>
                      Page {pickPage} of {pickTotalPages} ({pickTotalItems} logs)
                    </span>
                    <div className="btn-group btn-group-sm">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm p-1 px-2"
                        disabled={pickPage <= 1 || pickTableLoading}
                        onClick={() => fetchPickTableLogs(pickPage - 1)}
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm p-1 px-2"
                        disabled={pickPage >= pickTotalPages || pickTableLoading}
                        onClick={() => fetchPickTableLogs(pickPage + 1)}
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .view-logs-container {
          padding: 2px;
        }

        /* Serial Chip in Header */
        .serial-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .serial-chip-label {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.5px;
        }

        .serial-chip-value {
          font-size: 15px;
          font-weight: 700;
          font-family: monospace;
          color: #0f172a;
        }

        .copy-btn {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        }

        .copy-btn:hover {
          background: #e2e8f0;
        }

        /* Metadata Pills */
        .meta-pill {
          font-size: 12px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #475569;
        }

        .meta-pill-label {
          color: #64748b;
          font-weight: 500;
        }

        .meta-pill-value {
          color: #0f172a;
          font-weight: 700;
        }

        .process-pill {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #1e293b;
        }

        .pv-pass {
          background: #dcfce7;
          border-color: #86efac;
          color: #15803d;
        }

        .pv-fail {
          background: #fee2e2;
          border-color: #fca5a5;
          color: #b91c1c;
        }

        .status-available {
          background: #ecfdf5;
          border-color: #a7f3d0;
          color: #047857;
        }

        .status-picked {
          background: #eff6ff;
          border-color: #bfdbfe;
          color: #1d4ed8;
        }

        .status-hold {
          background: #fffbeb;
          border-color: #fde68a;
          color: #b45309;
        }

        /* Responsive Tab Bar */
        .tab-pill-bar {
          display: flex;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 8px;
          gap: 4px;
        }

        .tab-btn {
          flex: 1;
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          background: transparent;
          color: #64748b;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tab-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        /* Process Cards */
        .process-card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .process-header {
          padding: 12px 18px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .process-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 4px;
          letter-spacing: 0.6px;
        }

        .put-badge {
          background-color: #2563eb;
          color: #ffffff;
        }

        .pick-badge {
          background-color: #0284c7;
          color: #ffffff;
        }

        .sequence-label {
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
        }

        .download-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .download-btn-primary {
          background-color: #2563eb;
          color: #ffffff;
        }

        .download-btn-primary:hover {
          background-color: #1d4ed8;
        }

        .download-btn-info {
          background-color: #0284c7;
          color: #ffffff;
        }

        .download-btn-info:hover {
          background-color: #0369a1;
        }

        .download-btn-secondary {
          background-color: #f1f5f9;
          color: #475569;
          border: 1px solid #cbd5e1;
        }

        .download-btn-secondary:hover {
          background-color: #e2e8f0;
          color: #0f172a;
        }

        .process-body {
          padding: 18px 20px;
          max-height: 400px;
          overflow-y: auto;
        }

        /* Timeline Flow */
        .timeline-flow {
          display: flex;
          flex-direction: column;
        }

        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          position: relative;
          opacity: 0.45;
          transition: opacity 0.25s ease, transform 0.25s ease;
        }

        .timeline-item.item-revealed {
          opacity: 1;
        }

        .timeline-track {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 22px;
          flex-shrink: 0;
        }

        .timeline-icon-bubble {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          transition: all 0.2s ease;
        }

        .bubble-success {
          background-color: #16a34a;
          box-shadow: 0 0 0 3px #dcfce7;
        }

        .bubble-failed {
          background-color: #dc2626;
          box-shadow: 0 0 0 3px #fee2e2;
        }

        .bubble-pending {
          background-color: #f8fafc;
          border: 2px solid #cbd5e1;
        }

        .dot-pending {
          width: 6px;
          height: 6px;
          background-color: #94a3b8;
          border-radius: 50%;
        }

        .timeline-line {
          width: 2px;
          min-height: 24px;
          flex: 1;
          transition: background-color 0.2s ease;
        }

        .line-success {
          background-color: #86efac;
        }

        .line-failed {
          background-color: #fca5a5;
        }

        .line-pending {
          background-color: #e2e8f0;
        }

        .timeline-content {
          flex: 1;
          padding-bottom: 14px;
        }

        .timeline-step-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
        }

        .timeline-step-title {
          font-size: 13px;
          font-weight: 600;
        }

        .title-success {
          color: #0f172a;
        }

        .title-failed {
          color: #dc2626;
        }

        .title-pending {
          color: #94a3b8;
        }

        .timeline-time {
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
        }

        .timeline-msg {
          font-size: 11px;
          margin-top: 4px;
          padding: 4px 8px;
          border-radius: 5px;
          line-height: 1.4;
        }

        .msg-info {
          background: #f1f5f9;
          color: #475569;
          border-left: 3px solid #94a3b8;
        }

        .msg-failed {
          background: #fef2f2;
          color: #b91c1c;
          border: 1px solid #fee2e2;
          border-left: 3px solid #dc2626;
        }

        .empty-pick-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Divider */
        .divider-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .divider-line {
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }

        .divider-title {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          display: flex;
          align-items: center;
        }

        /* Table Box */
        .table-box {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .table-box-header {
          padding: 12px 18px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .table-box-title {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
        }

        .count-chip {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .put-count-chip {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .pick-count-chip {
          background: #e0f2fe;
          color: #0369a1;
        }

        .log-table th {
          background-color: #f8fafc;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: #64748b;
          padding: 9px 12px;
          border-bottom: 1px solid #e2e8f0;
        }

        .log-table td {
          padding: 9px 12px;
          border-bottom: 1px solid #f1f5f9;
        }

        .log-table tr:last-child td {
          border-bottom: none;
        }

        .status-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          display: inline-block;
          letter-spacing: 0.3px;
        }

        .status-badge-success {
          background: #dcfce7;
          color: #15803d;
        }

        .status-badge-failed {
          background: #fee2e2;
          color: #b91c1c;
        }

        .status-badge-neutral {
          background: #f1f5f9;
          color: #64748b;
        }
      `}</style>
    </Modal>
  );
};
