'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiPost, apiDownloadFile, downloadBlob } from '@/lib/api';
import { Log, PaginatedResponse } from '@/types';
import { Put } from '@/types/put';
import { Loader } from '@/components/shared/Loader';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Download,
  Copy,
  Check,
  RefreshCw,
  Search,
  Package,
  FileText,
  AlertCircle,
  MapPin,
  Clock,
  ArrowRight,
  HardDrive,
  Cpu,
  User,
  Activity,
  Layers,
  Inbox,
  Sparkles,
} from 'lucide-react';

interface LogDetailPageProps {
  params: Promise<{ serialNumber: string }>;
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

export default function LogDetailPage({ params }: LogDetailPageProps) {
  const { serialNumber: rawSerial } = React.use(params);
  const serialNumber = decodeURIComponent(rawSerial || '').trim();
  const searchParams = useSearchParams();
  const putIdFromQuery = searchParams.get('putId');
  const router = useRouter();

  // Part & logs state
  const [put, setPut] = useState<Put | null>(null);
  const [putLogs, setPutLogs] = useState<Log[]>([]);
  const [pickLogs, setPickLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Download states
  const [downloadingPut, setDownloadingPut] = useState(false);
  const [downloadingPick, setDownloadingPick] = useState(false);
  const [downloadingPo, setDownloadingPo] = useState(false);
  const [putDownloaded, setPutDownloaded] = useState(false);
  const [pickDownloaded, setPickDownloaded] = useState(false);

  // UI state
  const [copiedSerial, setCopiedSerial] = useState(false);
  const [copiedModel, setCopiedModel] = useState(false);
  const [searchSerial, setSearchSerial] = useState('');

  // Load Part Details and its exact process logs
  const loadDetails = useCallback(async () => {
    if (!serialNumber) return;
    setLoading(true);
    setError('');

    try {
      let matchedPut: Put | null = null;

      const res = await apiPost<PaginatedResponse<Put>>('/put/search-all', {
        search: serialNumber,
        page: 1,
        size: 5,
      }).catch(() => null);

      if (res?.data && res.data.length > 0) {
        matchedPut =
          res.data.find(
            (p) =>
              p.serial_number?.toUpperCase() === serialNumber.toUpperCase() ||
              (putIdFromQuery && String(p.id) === String(putIdFromQuery))
          ) || res.data[0];
      }

      setPut(matchedPut);
      if (matchedPut) {
        setPutDownloaded(!!matchedPut.text_file_downloaded);
        setPickDownloaded(!!matchedPut.pick?.text_file_downloaded);
      }

      const effectivePutId = matchedPut?.id || (putIdFromQuery ? Number(putIdFromQuery) : null);
      let pLogs: Log[] = [];
      let kLogs: Log[] = [];

      if (effectivePutId) {
        pLogs = await apiPost<Log[]>('/log/get-by-put-id', { putId: effectivePutId }).catch(() => []);
      } else {
        pLogs = await apiPost<Log[]>('/log/get-latest-by-type', {
          entity_number: serialNumber,
          log_type: 'PUT_PROCESS',
        }).catch(() => []);
      }

      if (matchedPut?.pick_id) {
        kLogs = await apiPost<Log[]>('/log/get-by-pick-id', { pickId: matchedPut.pick_id }).catch(() => []);
      } else {
        kLogs = await apiPost<Log[]>('/log/get-latest-by-type', {
          entity_number: serialNumber,
          log_type: 'PICK_PROCESS',
        }).catch(() => []);
      }

      setPutLogs(pLogs || []);
      setPickLogs(kLogs || []);
    } catch (err: any) {
      setError(err.message || 'Error loading details for this part');
    } finally {
      setLoading(false);
    }
  }, [serialNumber, putIdFromQuery]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Combined chronologically ordered logs
  const allOrderedLogs = useMemo(() => {
    const combined = [
      ...putLogs.map((l) => ({ ...l, processLabel: 'PUT' })),
      ...pickLogs.map((l) => ({ ...l, processLabel: 'PICK' })),
    ];
    return combined.sort((a, b) => {
      const timeA = new Date(a.log_date_time || 0).getTime();
      const timeB = new Date(b.log_date_time || 0).getTime();
      return timeA - timeB;
    });
  }, [putLogs, pickLogs]);

  // Handle PUT File Download
  const handleDownloadPut = async () => {
    if (!put?.id || downloadingPut) return;
    try {
      setDownloadingPut(true);
      const { blob, fileName } = await apiDownloadFile('/put/download-text-file', {
        id: put.id,
      });
      downloadBlob(blob, fileName || `put_${serialNumber}.txt`);
      setPutDownloaded(true);
    } catch (err: any) {
      alert(err.message || 'Failed to download PUT file');
    } finally {
      setDownloadingPut(false);
    }
  };

  // Handle PICK File Download
  const handleDownloadPick = async () => {
    if (!put?.pick_id || downloadingPick) return;
    try {
      setDownloadingPick(true);
      const { blob, fileName } = await apiDownloadFile('/pick/download-text-file', {
        id: put.pick_id,
      });
      downloadBlob(blob, fileName || `pick_${serialNumber}.txt`);
      setPickDownloaded(true);
    } catch (err: any) {
      alert(err.message || 'Failed to download PICK file');
    } finally {
      setDownloadingPick(false);
    }
  };

  // Handle Source PO File Download
  const handleDownloadPo = async () => {
    const poId = put?.po_file_id || put?.put_po_file?.id;
    if (!poId || downloadingPo) return;
    try {
      setDownloadingPo(true);
      const { blob, fileName } = await apiDownloadFile('/file/download', { id: poId });
      downloadBlob(blob, fileName || `po_${serialNumber}.txt`);
    } catch (err: any) {
      alert(err.message || 'Failed to download PO file');
    } finally {
      setDownloadingPo(false);
    }
  };

  const copySerial = () => {
    if (!serialNumber) return;
    navigator.clipboard.writeText(serialNumber);
    setCopiedSerial(true);
    setTimeout(() => setCopiedSerial(false), 1500);
  };

  const copyModel = () => {
    if (!put?.model_number) return;
    navigator.clipboard.writeText(put.model_number);
    setCopiedModel(true);
    setTimeout(() => setCopiedModel(false), 1500);
  };

  const handleSearchAnother = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchSerial.trim()) return;
    router.push(`/app/logs/${encodeURIComponent(searchSerial.trim())}`);
  };

  // Helper to render timeline step
  const renderStep = (
    step: { activity: string; name: string },
    logs: Log[],
    index: number,
    totalSteps: number
  ) => {
    const matchingLog = logs.find((l) => l.activity === step.activity);
    const hasLog = !!matchingLog;
    const isSuccess = hasLog && matchingLog.status === 'SUCCESS';
    const isFailed = hasLog && matchingLog.status === 'FAILED';

    let displayTitle = step.name;
    if (step.activity === 'PASS_FAIL' && matchingLog) {
      displayTitle = isSuccess ? 'Pass Validation' : 'Fail Validation';
    } else if (step.activity === 'MODEL_FOUND/NOTFOUND' && matchingLog) {
      displayTitle = isSuccess ? 'Model No. Found' : 'Model No. Not Found';
    }

    const isLast = index === totalSteps - 1;

    return (
      <div
        key={step.activity}
        className="timeline-item"
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: '16px',
          position: 'relative',
        }}
      >
        {/* Left Track with Bubble & Connector Line */}
        <div
          className="timeline-track"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '36px',
            flexShrink: 0,
          }}
        >
          {/* Status Bubble */}
          <div
            className={`timeline-icon-bubble ${
              isSuccess ? 'bubble-success' : isFailed ? 'bubble-failed' : 'bubble-pending'
            }`}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              zIndex: 2,
              backgroundColor: isSuccess ? '#16a34a' : isFailed ? '#dc2626' : '#f8fafc',
              color: isSuccess || isFailed ? '#ffffff' : '#64748b',
              border: isSuccess || isFailed ? 'none' : '2px solid #cbd5e1',
              boxShadow: isSuccess
                ? '0 0 0 4px #dcfce7'
                : isFailed
                ? '0 0 0 4px #fee2e2'
                : 'none',
            }}
          >
            {isSuccess ? (
              <CheckCircle2 size={18} color="#ffffff" strokeWidth={2.5} />
            ) : isFailed ? (
              <XCircle size={18} color="#ffffff" strokeWidth={2.5} />
            ) : (
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                {index + 1}
              </span>
            )}
          </div>

          {/* Vertical Connecting Line */}
          {!isLast && (
            <div
              className={`timeline-line ${
                isSuccess ? 'line-success' : isFailed ? 'line-failed' : 'line-pending'
              }`}
              style={{
                width: '2px',
                minHeight: '32px',
                flexGrow: 1,
                margin: '4px 0',
                backgroundColor: isSuccess ? '#86efac' : isFailed ? '#fca5a5' : '#e2e8f0',
              }}
            />
          )}
        </div>

        {/* Right Content Card Box */}
        <div
          className="timeline-content"
          style={{
            flexGrow: 1,
            paddingBottom: isLast ? '0px' : '18px',
          }}
        >
          <div
            className={`timeline-step-card ${
              isSuccess ? 'card-success' : isFailed ? 'card-failed' : 'card-pending'
            }`}
            style={{
              background: isFailed ? '#fffbfa' : isSuccess ? '#ffffff' : '#fafbfc',
              border: '1px solid #e2e8f0',
              borderLeft: isSuccess
                ? '4px solid #16a34a'
                : isFailed
                ? '4px solid #dc2626'
                : '4px solid #cbd5e1',
              borderRadius: '10px',
              padding: '12px 16px',
            }}
          >
            <div
              className="timeline-step-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              {/* Step Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: isSuccess ? '#16a34a' : isFailed ? '#dc2626' : '#94a3b8',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                  }}
                >
                  Step {index + 1}
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: isSuccess ? '#0f172a' : isFailed ? '#b91c1c' : '#475569',
                  }}
                >
                  {displayTitle}
                </span>
              </div>

              {/* Badges & Timestamp */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isSuccess && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      letterSpacing: '0.3px',
                    }}
                  >
                    ● SUCCESS
                  </span>
                )}
                {isFailed && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#fee2e2',
                      color: '#b91c1c',
                      letterSpacing: '0.3px',
                    }}
                  >
                    ● FAILED
                  </span>
                )}
                {!hasLog && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#f1f5f9',
                      color: '#94a3b8',
                    }}
                  >
                    PENDING
                  </span>
                )}

                {matchingLog?.log_date_time && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      color: '#64748b',
                      backgroundColor: '#f8fafc',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <Clock size={11} color="#64748b" />
                    {new Date(matchingLog.log_date_time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* Diagnostic Message Callout */}
            {matchingLog?.message && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  lineHeight: 1.45,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  backgroundColor: isFailed ? '#fef2f2' : '#f8fafc',
                  color: isFailed ? '#991b1b' : '#334155',
                  border: isFailed ? '1px solid #fee2e2' : '1px solid #e2e8f0',
                  borderLeft: isFailed ? '3px solid #dc2626' : '3px solid #3b82f6',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                }}
              >
                <FileText
                  size={14}
                  style={{
                    marginTop: '2px',
                    flexShrink: 0,
                    color: isFailed ? '#dc2626' : '#2563eb',
                  }}
                />
                <div style={{ wordBreak: 'break-word' }}>{matchingLog.message}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="full-width-page py-4 px-3 px-xl-5"
      style={{
        width: '100%',
        maxWidth: '100%',
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
      }}
    >
      {/* TOP HEADER: Breadcrumbs & Actions */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <Link
            href="/app/dashboard"
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2 rounded-pill px-3 shadow-sm bg-white"
          >
            <ArrowLeft size={16} />
            <span className="fw-semibold">Back to Dashboard</span>
          </Link>
          <div className="breadcrumb-trail text-muted small d-none d-md-block">
            <span>Inventory</span> / <span>Process Logs</span> /{' '}
            <strong className="text-dark font-monospace">{serialNumber}</strong>
          </div>
        </div>

        {/* Quick Search & Actions */}
        <div className="d-flex align-items-center gap-2">
          <form onSubmit={handleSearchAnother} className="d-flex align-items-center gap-2">
            <div className="search-box-wrap" style={{ position: 'relative' }}>
              <Search
                size={14}
                className="search-box-icon text-muted"
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                type="text"
                className="form-control form-control-sm search-box-input"
                style={{ paddingLeft: '32px', borderRadius: '20px', width: '220px' }}
                placeholder="Jump to another serial..."
                value={searchSerial}
                onChange={(e) => setSearchSerial(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm px-3 fw-semibold">
              Search
            </button>
          </form>

          <button
            type="button"
            className="btn btn-white border btn-sm d-inline-flex align-items-center gap-1 px-3 shadow-sm bg-white"
            onClick={loadDetails}
            title="Reload part details"
          >
            <RefreshCw size={13} className="text-secondary" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-5 text-center bg-white rounded-3 border p-5 shadow-sm">
          <Loader message="Loading complete part specifications & sequence logs..." />
        </div>
      ) : error ? (
        <div className="alert alert-danger d-flex align-items-center gap-2 shadow-sm">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      ) : (
        <>
          {/* HERO BANNER: Part Telemetry & Real-Time Status */}
          <div
            className="hero-banner mb-4 shadow-sm"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '18px 24px',
            }}
          >
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
              {/* Left Identity Group */}
              <div className="d-flex align-items-center gap-3 flex-wrap">
                <div
                  className="hero-serial-badge"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    paddingRight: '20px',
                    borderRight: '2px solid #e2e8f0',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#64748b',
                      letterSpacing: '0.6px',
                    }}
                  >
                    SERIAL NUMBER
                  </span>
                  <div className="d-flex align-items-center gap-2">
                    <span
                      style={{
                        fontSize: '22px',
                        fontWeight: 800,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        color: '#0f172a',
                      }}
                    >
                      {serialNumber}
                    </span>
                    <button
                      type="button"
                      className="hero-copy-btn"
                      onClick={copySerial}
                      title={copiedSerial ? 'Copied!' : 'Copy Serial Number'}
                    >
                      {copiedSerial ? (
                        <Check size={16} className="text-success" />
                      ) : (
                        <Copy size={16} className="text-muted" />
                      )}
                    </button>
                  </div>
                </div>

                {put?.model_number && (
                  <div
                    className="hero-stat-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      padding: '0 16px',
                      borderRight: '1px solid #e2e8f0',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#64748b',
                        letterSpacing: '0.5px',
                      }}
                    >
                      PART MODEL
                    </span>
                    <div className="d-flex align-items-center gap-2">
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                        {put.model_number}
                      </span>
                      <button
                        type="button"
                        className="hero-copy-btn-sm"
                        onClick={copyModel}
                        title={copiedModel ? 'Copied!' : 'Copy Model'}
                      >
                        {copiedModel ? (
                          <Check size={12} className="text-success" />
                        ) : (
                          <Copy size={12} className="text-muted" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {put?.process_status && (
                  <div
                    className="hero-stat-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      padding: '0 16px',
                      borderRight: '1px solid #e2e8f0',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#64748b',
                        letterSpacing: '0.5px',
                      }}
                    >
                      MES PROCESS
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#2563eb' }}>
                      {put.process_status}
                    </span>
                  </div>
                )}

                {put?.pv_status && (
                  <div
                    className="hero-stat-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      padding: '0 16px',
                      borderRight: '1px solid #e2e8f0',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#64748b',
                        letterSpacing: '0.5px',
                      }}
                    >
                      PV STATUS
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        letterSpacing: '0.3px',
                        backgroundColor: put.pv_status === 'PASS' ? '#dcfce7' : '#fee2e2',
                        color: put.pv_status === 'PASS' ? '#15803d' : '#b91c1c',
                        border: put.pv_status === 'PASS' ? '1px solid #bbf7d0' : '1px solid #fecaca',
                      }}
                    >
                      {put.pv_status === 'PASS' ? '● PASSED' : '● FAILED'}
                    </span>
                  </div>
                )}

                {put?.pick_status && (
                  <div
                    className="hero-stat-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      padding: '0 16px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#64748b',
                        letterSpacing: '0.5px',
                      }}
                    >
                      INVENTORY STATUS
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        letterSpacing: '0.3px',
                        backgroundColor:
                          put.pick_status === 'AVAILABLE'
                            ? '#dcfce7'
                            : put.pick_status === 'PICKED'
                            ? '#dbeafe'
                            : '#fef3c7',
                        color:
                          put.pick_status === 'AVAILABLE'
                            ? '#15803d'
                            : put.pick_status === 'PICKED'
                            ? '#1d4ed8'
                            : '#b45309',
                        border:
                          put.pick_status === 'AVAILABLE'
                            ? '1px solid #bbf7d0'
                            : put.pick_status === 'PICKED'
                            ? '1px solid #bfdbfe'
                            : '1px solid #fde68a',
                      }}
                    >
                      ● {put.pick_status}
                    </span>
                  </div>
                )}
              </div>

              {/* Right Lifecycle Indicator */}
              <div
                className="lifecycle-track d-none d-xl-flex align-items-center gap-2"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '30px',
                  padding: '6px 16px',
                }}
              >
                <div className="lifecycle-step active" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                  <CheckCircle2 size={14} className="text-success" />
                  <span>MES Verified</span>
                </div>
                <ArrowRight size={13} className="text-muted" />
                <div className="lifecycle-step active" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                  <CheckCircle2 size={14} className="text-success" />
                  <span>Stored in Kardex</span>
                </div>
                <ArrowRight size={13} className="text-muted" />
                <div
                  className="lifecycle-step"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: put?.pick_status === 'PICKED' ? '#1d4ed8' : '#94a3b8',
                  }}
                >
                  {put?.pick_status === 'PICKED' ? (
                    <CheckCircle2 size={14} className="text-primary" />
                  ) : (
                    <Clock size={14} className="text-muted" />
                  )}
                  <span>{put?.pick_status === 'PICKED' ? 'Picked Order' : 'Awaiting Pick'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4-COLUMN BENTO SPECIFICATION GRID */}
          <div className="row g-3 mb-4">
            {/* Card 1: MES & Manufacturing Info */}
            <div className="col-12 col-md-6 col-xl-3">
              <div className="bento-card h-100 shadow-sm">
                <div className="bento-header">
                  <Cpu size={16} className="text-primary" />
                  <span>MES & Part Details</span>
                </div>
                <div className="bento-body">
                  <div className="bento-row">
                    <span className="bento-key">Serial Number:</span>
                    <span className="bento-val font-monospace">{serialNumber}</span>
                  </div>
                  <div className="bento-row">
                    <span className="bento-key">Part Model:</span>
                    <span className="bento-val">{put?.model_number || '—'}</span>
                  </div>
                  <div className="bento-row">
                    <span className="bento-key">MES Process:</span>
                    <span className="bento-val text-primary fw-bold">{put?.process_status || '—'}</span>
                  </div>
                  <div className="bento-row">
                    <span className="bento-key">PV Validation:</span>
                    <span className={`bento-val fw-bold ${put?.pv_status === 'PASS' ? 'text-success' : 'text-danger'}`}>
                      {put?.pv_status || '—'}
                    </span>
                  </div>
                  <div className="bento-row">
                    <span className="bento-key">Birth / MFD:</span>
                    <span className="bento-val">
                      {put?.birth_date ? new Date(put.birth_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Warehouse & Physical Location */}
            <div className="col-12 col-md-6 col-xl-3">
              <div className="bento-card h-100 shadow-sm">
                <div className="bento-header">
                  <MapPin size={16} className="text-success" />
                  <span>Physical Warehouse Location</span>
                </div>
                <div className="bento-body">
                  <div className="bento-row">
                    <span className="bento-key">Storage Status:</span>
                    <span className={`bento-val fw-bold ${put?.pick_status === 'AVAILABLE' ? 'text-success' : put?.pick_status === 'PICKED' ? 'text-primary' : 'text-warning'}`}>
                      {put?.pick_status || 'AVAILABLE'}
                    </span>
                  </div>
                  <div className="bento-row">
                    <span className="bento-key">Handling Unit (Bin):</span>
                    <span className="bento-val">
                      {put?.handling_unit?.hu_id ? (
                        <Link href={`/app/bins/${put.handling_unit.hu_id}`} className="text-primary fw-bold text-decoration-none">
                          {put.handling_unit.hu_id}
                        </Link>
                      ) : put?.handling_unit_id ? (
                        `HU #${put.handling_unit_id}`
                      ) : (
                        'Floor Stock / Unassigned'
                      )}
                    </span>
                  </div>
                  <div className="bento-row">
                    <span className="bento-key">Compartment Slot:</span>
                    <span className="bento-val">
                      {put?.compartment?.compartment_number ? (
                        `Slot #${put.compartment.compartment_number}`
                      ) : put?.compartment_id ? (
                        `Slot #${put.compartment_id}`
                      ) : (
                        'Standard Bin'
                      )}
                    </span>
                  </div>
                  <div className="bento-row">
                    <span className="bento-key">Bin Type:</span>
                    <span className="bento-val">
                      {put?.handling_unit?.bin_type?.name || 'Standard Kardex Tray'}
                    </span>
                  </div>
                  <div className="bento-row">
                    <span className="bento-key">System Put ID:</span>
                    <span className="bento-val font-monospace">#{put?.id || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Operators & Audit Trail */}
            <div className="col-12 col-md-6 col-xl-3">
              <div className="bento-card h-100 shadow-sm">
                <div className="bento-header">
                  <User size={16} className="text-info" />
                  <span>Operators & Audit Trail</span>
                </div>
                <div className="bento-body">
                  <div className="bento-row">
                    <span className="bento-key">Put Operator:</span>
                    <span className="bento-val fw-bold">{put?.user_first_name || put?.scanned_by || 'SYSTEM'}</span>
                  </div>
                  <div className="bento-row">
                    <span className="bento-key">Scanned At:</span>
                    <span className="bento-val">
                      {put?.scanned_at ? new Date(put.scanned_at).toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="bento-row">
                    <span className="bento-key">Pick Status:</span>
                    <span className="bento-val">{put?.pick_id ? 'Picked from storage' : 'In Storage'}</span>
                  </div>
                  <div className="bento-row">
                    <span className="bento-key">Pick Order ID:</span>
                    <span className="bento-val font-monospace">
                      {put?.pick_id ? `#${put.pick_id}` : 'None'}
                    </span>
                  </div>
                  <div className="bento-row">
                    <span className="bento-key">Pick Operator:</span>
                    <span className="bento-val">
                      {put?.pick?.entered_by || (put?.pick_id ? 'Operator' : '—')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Order Files & Downloads */}
            <div className="col-12 col-md-6 col-xl-3">
              <div className="bento-card h-100 shadow-sm">
                <div className="bento-header">
                  <HardDrive size={16} className="text-warning" />
                  <span>Order Files & Downloads</span>
                </div>
                <div className="bento-body">
                  {/* Source PO File */}
                  <div className="bento-row align-items-center">
                    <span className="bento-key">Source PO File:</span>
                    {put?.put_po_file?.name || put?.po_file_id ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 text-primary text-decoration-none d-inline-flex align-items-center gap-1"
                        onClick={handleDownloadPo}
                        disabled={downloadingPo}
                        title="Download Source PO Reference File"
                      >
                        <Download size={12} />
                        <span className="text-truncate" style={{ maxWidth: '120px' }}>
                          {put?.put_po_file?.name || 'PO File'}
                        </span>
                      </button>
                    ) : (
                      <span className="bento-val text-muted">Offline / None</span>
                    )}
                  </div>

                  {/* PUT Order File */}
                  <div className="bento-row align-items-center">
                    <span className="bento-key">PUT Order File:</span>
                    {put?.id ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 text-success text-decoration-none d-inline-flex align-items-center gap-1"
                        onClick={handleDownloadPut}
                        disabled={downloadingPut}
                        title="Download Kardex PUT Order Text File"
                      >
                        <Download size={12} />
                        <span>{putDownloaded ? 'PUT File (Ready)' : 'Download PUT'}</span>
                      </button>
                    ) : (
                      <span className="bento-val text-muted">—</span>
                    )}
                  </div>

                  {/* PICK Order File */}
                  <div className="bento-row align-items-center">
                    <span className="bento-key">PICK Order File:</span>
                    {put?.pick_id ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-link p-0 text-info text-decoration-none d-inline-flex align-items-center gap-1"
                        onClick={handleDownloadPick}
                        disabled={downloadingPick}
                        title="Download Kardex PICK Order Text File"
                      >
                        <Download size={12} />
                        <span>{pickDownloaded ? 'PICK File (Ready)' : 'Download PICK'}</span>
                      </button>
                    ) : (
                      <span className="bento-val text-muted">Not Picked</span>
                    )}
                  </div>

                  <div className="bento-row">
                    <span className="bento-key">Kardex Downloaded:</span>
                    <span className="bento-val fw-bold">
                      {put?.text_file_downloaded ? 'Downloaded to Kardex' : 'Pending Kardex Machine'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DUAL PROCESS SEQUENCES (PUT & PICK SIDE-BY-SIDE) */}
          <div className="row g-4 mb-4">
            {/* LEFT: PUT Process Sequence */}
            <div className="col-12 col-xl-6">
              <div className="process-card shadow-sm h-100">
                <div className="process-header">
                  <div className="d-flex align-items-center gap-2">
                    <span className="process-badge put-badge">PUT PROCESS</span>
                    <span className="sequence-label">8-Step Sequence & Verification</span>
                  </div>

                  {put?.id && (
                    <button
                      type="button"
                      className={`download-btn ${
                        putDownloaded ? 'download-btn-secondary' : 'download-btn-primary'
                      }`}
                      onClick={handleDownloadPut}
                      disabled={downloadingPut}
                      title={
                        putDownloaded
                          ? 'File was previously downloaded (Click to re-download)'
                          : 'Download PUT Order File (.txt)'
                      }
                    >
                      <Download size={14} />
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
                  {putLogs.length === 0 ? (
                    <div className="text-center py-5 text-muted small">
                      No active PUT sequence recorded for this serial number.
                    </div>
                  ) : (
                    <div className="timeline-flow">
                      {PUT_STEPS.map((s, idx) =>
                        renderStep(s, putLogs, idx, PUT_STEPS.length)
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: PICK Process Sequence */}
            <div className="col-12 col-xl-6">
              <div className="process-card shadow-sm h-100">
                <div className="process-header">
                  <div className="d-flex align-items-center gap-2">
                    <span className="process-badge pick-badge">PICK PROCESS</span>
                    <span className="sequence-label">4-Step Sequence & Allocation</span>
                  </div>

                  {put?.pick_id ? (
                    <button
                      type="button"
                      className={`download-btn ${
                        pickDownloaded ? 'download-btn-secondary' : 'download-btn-info'
                      }`}
                      onClick={handleDownloadPick}
                      disabled={downloadingPick}
                      title={
                        pickDownloaded
                          ? 'File was previously downloaded (Click to re-download)'
                          : 'Download PICK Order File (.txt)'
                      }
                    >
                      <Download size={14} />
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
                      Awaiting Pick
                    </span>
                  )}
                </div>

                <div className="process-body">
                  {!put?.pick_id ? (
                    <div className="d-flex flex-column gap-3">
                      {/* Storage Availability Banner */}
                      <div
                        style={{
                          background: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          borderRadius: '12px',
                          padding: '16px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                        }}
                      >
                        <div
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            backgroundColor: '#e0f2fe',
                            color: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Inbox size={24} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0369a1' }}>
                            Part In Storage (Available for Pick)
                          </div>
                          <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                            This unit has passed all verification checks and is safely stored in bin{' '}
                            <strong>{put?.handling_unit?.hu_id || 'BIN1'}</strong>. When an operator issues a pick order, the sequence below will execute.
                          </div>
                        </div>
                      </div>

                      {/* Queued 4-Step PICK Sequence Preview */}
                      <div className="timeline-flow mt-2">
                        {PICK_STEPS.map((s, idx) => (
                          <div
                            key={s.activity}
                            className="timeline-item"
                            style={{
                              display: 'flex',
                              alignItems: 'stretch',
                              gap: '16px',
                              position: 'relative',
                            }}
                          >
                            <div
                              className="timeline-track"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                width: '36px',
                                flexShrink: 0,
                              }}
                            >
                              <div
                                style={{
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: '50%',
                                  backgroundColor: '#f8fafc',
                                  color: '#94a3b8',
                                  border: '2px dashed #cbd5e1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  zIndex: 2,
                                }}
                              >
                                {idx + 1}
                              </div>
                              {idx < PICK_STEPS.length - 1 && (
                                <div
                                  style={{
                                    width: '2px',
                                    minHeight: '32px',
                                    flexGrow: 1,
                                    margin: '4px 0',
                                    backgroundColor: '#e2e8f0',
                                  }}
                                />
                              )}
                            </div>

                            <div
                              className="timeline-content"
                              style={{
                                flexGrow: 1,
                                paddingBottom: idx === PICK_STEPS.length - 1 ? '0px' : '18px',
                              }}
                            >
                              <div
                                style={{
                                  background: '#fafbfc',
                                  border: '1px solid #e2e8f0',
                                  borderLeft: '4px solid #cbd5e1',
                                  borderRadius: '10px',
                                  padding: '12px 16px',
                                  opacity: 0.85,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '12px',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        color: '#94a3b8',
                                        letterSpacing: '0.5px',
                                        textTransform: 'uppercase',
                                      }}
                                    >
                                      Step {idx + 1}
                                    </span>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>
                                      {s.name}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      backgroundColor: '#f1f5f9',
                                      color: '#94a3b8',
                                    }}
                                  >
                                    QUEUED
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : pickLogs.length === 0 ? (
                    <div className="text-center py-5 text-muted small">
                      No active PICK sequence recorded.
                    </div>
                  ) : (
                    <div className="timeline-flow">
                      {PICK_STEPS.map((s, idx) =>
                        renderStep(s, pickLogs, idx, PICK_STEPS.length)
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* DETAILED EXECUTION AUDIT TABLE (CHRONOLOGICAL EVENT LOG) */}
          <div className="table-box shadow-sm mb-4">
            <div className="table-box-header d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2">
                <Activity size={16} className="text-primary" />
                <span className="table-box-title">Execution Event Telemetry Logs</span>
                <span className="badge bg-primary-subtle text-primary rounded-pill px-2">
                  {allOrderedLogs.length} events
                </span>
              </div>
            </div>

            <div className="table-responsive">
              {allOrderedLogs.length === 0 ? (
                <div className="py-5 text-center text-muted small">
                  No execution event telemetry recorded for this part.
                </div>
              ) : (
                <table className="table table-hover log-table mb-0 align-middle" style={{ minWidth: '820px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>#</th>
                      <th style={{ width: '90px' }}>Process</th>
                      <th style={{ width: '220px' }}>Activity Step</th>
                      <th style={{ width: '110px' }}>Status</th>
                      <th>Message / Diagnostic Details</th>
                      <th style={{ width: '180px' }}>Timestamp</th>
                      <th style={{ width: '120px' }}>Operator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allOrderedLogs.map((l, index) => (
                      <tr key={l.id || index}>
                        <td className="text-muted fw-bold" style={{ fontSize: '11px' }}>
                          {index + 1}
                        </td>
                        <td>
                          <span
                            className={`process-tag ${
                              l.processLabel === 'PUT' ? 'tag-put' : 'tag-pick'
                            }`}
                          >
                            {l.processLabel}
                          </span>
                        </td>
                        <td className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
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
                        <td style={{ fontSize: '13px', color: '#334155' }}>
                          {l.message ? (
                            <span className="font-monospace small">{l.message}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="text-muted font-monospace" style={{ fontSize: '12px' }}>
                          {l.log_date_time ? new Date(l.log_date_time).toLocaleString() : '—'}
                        </td>
                        <td className="text-muted" style={{ fontSize: '12px' }}>
                          {l.user_id || l.user_first_name || 'SYSTEM'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
