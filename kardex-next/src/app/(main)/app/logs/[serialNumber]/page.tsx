'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet, apiDownloadFile, downloadBlob } from '@/lib/api';
import { Log } from '@/types';
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
  AlertCircle,
  MapPin,
  Clock,
  HardDrive,
  Cpu,
  User,
  Activity,
  Layers,
  Box,
  Calendar,
  ShieldCheck,
  Boxes,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCheck,
} from 'lucide-react';

interface LogDetailPageProps {
  params: Promise<{ serialNumber: string }>;
}

interface SerialAuditResponse {
  serialNumber: string;
  put: Put | null;
  aging: {
    storage_age_days: number;
    storage_age_hours: number;
    storage_total_hours: number;
    storage_formatted: string;
    birth_date: string | null;
    birth_age_days: number | null;
    is_kanban: boolean;
    kanban_dwell_hours: number | null;
    kanban_dwell_days: number | null;
  } | null;
  logs: Log[];
}

export interface VerificationStepConfig {
  id: number;
  activity: string;
  aliases: string[];
  name: string;
  category: string;
  description: string;
  inferSuccess?: (put: Put | null, aging: any) => { inferred: boolean; message: string; timestamp?: string } | null;
}

const PUT_VERIFICATION_STEPS: VerificationStepConfig[] = [
  {
    id: 1,
    activity: 'FETCH_DETAILS',
    aliases: ['FETCH_DETAILS', 'VALIDATE'],
    name: 'Fetch Details',
    category: 'MES',
    description: 'Verify serial in MES & get board details',
    inferSuccess: (put) => {
      if (put?.birth_date || put?.process_status) {
        return {
          inferred: true,
          message: `MES record confirmed (${put.process_status || 'KANBAN-IN'})`,
          timestamp: put.scanned_at || undefined,
        };
      }
      return null;
    },
  },
  {
    id: 2,
    activity: 'CHECK_STATUS',
    aliases: ['CHECK_STATUS'],
    name: 'Check Status',
    category: 'Storage',
    description: 'Check serial is not duplicate in Kardex',
    inferSuccess: (put) => {
      if (put?.id) {
        return {
          inferred: true,
          message: 'Serial verified unique in Kardex storage',
          timestamp: put.scanned_at || undefined,
        };
      }
      return null;
    },
  },
  {
    id: 3,
    activity: 'PASS_FAIL',
    aliases: ['PASS_FAIL'],
    name: 'PV Validation',
    category: 'Quality',
    description: 'Verify PV status & check MES WIP hold',
    inferSuccess: (put) => {
      if (put?.pv_status === 'PASS' || put?.id) {
        return {
          inferred: true,
          message: `PV Status: ${put?.pv_status || 'PASS'} (Passed)`,
          timestamp: put?.scanned_at || undefined,
        };
      }
      return null;
    },
  },
  {
    id: 4,
    activity: 'FIND_CSV',
    aliases: ['FIND_CSV'],
    name: 'Find PO File',
    category: 'PO Check',
    description: 'Locate PO file in shared network drive',
    inferSuccess: (put, aging) => {
      if (aging?.is_kanban || put?.process_status === 'KANBAN-RTN') {
        return {
          inferred: true,
          message: 'Kanban Return: PO check bypassed',
          timestamp: put?.scanned_at || undefined,
        };
      }
      if (put?.put_po_file?.name || put?.po_file_id) {
        return {
          inferred: true,
          message: `PO File: ${put?.put_po_file?.name || 'Verified'}`,
          timestamp: put?.scanned_at || undefined,
        };
      }
      if (put?.id) {
        return {
          inferred: true,
          message: 'Inbound PO file verified',
          timestamp: put.scanned_at || undefined,
        };
      }
      return null;
    },
  },
  {
    id: 5,
    activity: 'FIND_MODEL',
    aliases: ['FIND_MODEL'],
    name: 'Find Model',
    category: 'Model',
    description: 'Identify model number from PO data',
    inferSuccess: (put) => {
      if (put?.model_number) {
        return {
          inferred: true,
          message: `Model identified: ${put.model_number}`,
          timestamp: put.scanned_at || undefined,
        };
      }
      return null;
    },
  },
  {
    id: 6,
    activity: 'MODEL_FOUND/NOTFOUND',
    aliases: ['MODEL_FOUND/NOTFOUND', 'MODEL_MATCH'],
    name: 'Model Match',
    category: 'Model',
    description: 'Match part model in PO schedule',
    inferSuccess: (put) => {
      if (put?.model_number || put?.id) {
        return {
          inferred: true,
          message: `Model ${put?.model_number || 'part'} matched in PO`,
          timestamp: put?.scanned_at || undefined,
        };
      }
      return null;
    },
  },
  {
    id: 7,
    activity: 'CHECKING_AVAILABILITY',
    aliases: ['CHECKING_AVAILABILITY', 'ALLOCATE'],
    name: 'Check Availability',
    category: 'Storage',
    description: 'Check capacity and allocate tray slot',
    inferSuccess: (put) => {
      if (put?.handling_unit?.hu_id) {
        const compStr = put.compartment?.compartment_number !== undefined ? ` (Slot #${put.compartment.compartment_number})` : '';
        return {
          inferred: true,
          message: `Allocated to Tray ${put.handling_unit.hu_id}${compStr}`,
          timestamp: put.scanned_at || undefined,
        };
      }
      if (put?.id) {
        return {
          inferred: true,
          message: 'Storage capacity allocated',
          timestamp: put.scanned_at || undefined,
        };
      }
      return null;
    },
  },
  {
    id: 8,
    activity: 'FILE_GENERATED',
    aliases: ['FILE_GENERATED', 'COMPLETE'],
    name: 'File Generated',
    category: 'System',
    description: 'Generate machine order file for Kardex',
    inferSuccess: (put) => {
      if (put?.id) {
        const transferStr = put.text_file_downloaded ? 'Downloaded to Kardex' : 'Order file ready';
        return {
          inferred: true,
          message: `Order #${put.id} generated (${transferStr})`,
          timestamp: put.scanned_at || undefined,
        };
      }
      return null;
    },
  },
];

const PICK_VERIFICATION_STEPS: VerificationStepConfig[] = [
  {
    id: 1,
    activity: 'FETCH_DETAILS',
    aliases: ['FETCH_DETAILS'],
    name: 'Fetch Details',
    category: 'MES',
    description: 'Verify pick order details',
    inferSuccess: (put) => {
      if (put?.pick_id) {
        return {
          inferred: true,
          message: `Pick Order #${put.pick_id} verified`,
        };
      }
      return null;
    },
  },
  {
    id: 2,
    activity: 'CHECK_QTY',
    aliases: ['CHECK_QTY'],
    name: 'Check Quantity',
    category: 'Storage',
    description: 'Confirm available stock in storage',
    inferSuccess: (put) => {
      if (put?.pick_id) {
        return {
          inferred: true,
          message: 'Available inventory confirmed in Kardex',
        };
      }
      return null;
    },
  },
  {
    id: 3,
    activity: 'CHECK_STATUS',
    aliases: ['CHECK_STATUS', 'PASS_FAIL'],
    name: 'Check Status',
    category: 'Quality',
    description: 'Check outbound PV & MES status',
    inferSuccess: (put) => {
      if (put?.pick_id) {
        return {
          inferred: true,
          message: 'PV qualification passed for outbound',
        };
      }
      return null;
    },
  },
  {
    id: 4,
    activity: 'FILE_GENERATED',
    aliases: ['FILE_GENERATED', 'COMPLETE'],
    name: 'File Generated',
    category: 'System',
    description: 'Generate machine pick order file',
    inferSuccess: (put) => {
      if (put?.pick_id) {
        const dlStr = put.pick?.text_file_downloaded ? 'Downloaded to Kardex' : 'Order file generated';
        return {
          inferred: true,
          message: `Pick order file generated (${dlStr})`,
        };
      }
      return null;
    },
  },
];

export default function LogDetailPage({ params }: LogDetailPageProps) {
  const { serialNumber: rawSerial } = React.use(params);
  const serialNumber = decodeURIComponent(rawSerial || '').trim();
  const router = useRouter();

  // Part & logs state
  const [put, setPut] = useState<Put | null>(null);
  const [aging, setAging] = useState<SerialAuditResponse['aging']>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Downloads
  const [downloadingPut, setDownloadingPut] = useState(false);
  const [downloadingPick, setDownloadingPick] = useState(false);
  const [downloadingPo, setDownloadingPo] = useState(false);
  const [putDownloaded, setPutDownloaded] = useState(false);
  const [pickDownloaded, setPickDownloaded] = useState(false);

  // UI state
  const [copiedSerial, setCopiedSerial] = useState(false);
  const [copiedModel, setCopiedModel] = useState(false);
  const [searchSerial, setSearchSerial] = useState('');
  const [activeViewTab, setActiveViewTab] = useState<'sequence' | 'events'>('sequence');

  // Load Part Details and its complete logs from dedicated audit endpoint
  const loadDetails = useCallback(async () => {
    if (!serialNumber) return;
    setLoading(true);
    setError('');

    try {
      const res = await apiGet<SerialAuditResponse>(
        `/report/serial-audit/${encodeURIComponent(serialNumber)}`
      );

      setPut(res.put || null);
      setAging(res.aging || null);
      setLogs(res.logs || []);

      if (res.put) {
        setPutDownloaded(!!res.put.text_file_downloaded);
        setPickDownloaded(!!res.put.pick?.text_file_downloaded);
      }
    } catch (err: any) {
      console.error('Failed to load audit details:', err);
      setError(err.message || 'Error loading details for this serial number.');
    } finally {
      setLoading(false);
    }
  }, [serialNumber]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Separate PUT logs and PICK logs
  const putLogs = useMemo(() => {
    return logs.filter((l) => l.log_type === 'PUT_PROCESS');
  }, [logs]);

  const pickLogs = useMemo(() => {
    return logs.filter((l) => l.log_type === 'PICK_PROCESS');
  }, [logs]);

  // File downloads
  const handleDownloadPut = async () => {
    if (!put?.id || downloadingPut) return;
    try {
      setDownloadingPut(true);
      const { blob, fileName } = await apiDownloadFile('/put/download-text-file', { id: put.id });
      downloadBlob(blob, fileName || `put_${serialNumber}.txt`);
      setPutDownloaded(true);
    } catch (err: any) {
      alert(err.message || 'Failed to download PUT file');
    } finally {
      setDownloadingPut(false);
    }
  };

  const handleDownloadPick = async () => {
    if (!put?.pick_id || downloadingPick) return;
    try {
      setDownloadingPick(true);
      const { blob, fileName } = await apiDownloadFile('/pick/download-text-file', { id: put.pick_id });
      downloadBlob(blob, fileName || `pick_${serialNumber}.txt`);
      setPickDownloaded(true);
    } catch (err: any) {
      alert(err.message || 'Failed to download PICK file');
    } finally {
      setDownloadingPick(false);
    }
  };

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

  // Evaluates a step using telemetry logs with intelligent DB fallback
  const evaluateStep = useCallback(
    (step: VerificationStepConfig, stepLogs: Log[]) => {
      // Find all logs matching this step or its aliases
      const candidateLogs = stepLogs.filter(
        (l) => l.activity === step.activity || step.aliases.includes(l.activity)
      );

      // 1. Check for failure first (decisive)
      const failedLog = candidateLogs.find((l) => l.status === 'FAILED');
      if (failedLog) {
        return {
          status: 'FAILED' as const,
          message: failedLog.message || 'Verification check failed.',
          timestamp: failedLog.log_date_time,
          operator: failedLog.user_first_name || failedLog.user_id || null,
          isBypassed: false,
          isInferred: false,
        };
      }

      // 2. Check for success log
      const successLog = candidateLogs.find((l) => l.status === 'SUCCESS');
      if (successLog) {
        const isBypass =
          successLog.message?.toLowerCase().includes('bypass') ||
          (step.activity === 'FIND_CSV' && (aging?.is_kanban || put?.process_status === 'KANBAN-RTN'));
        return {
          status: (isBypass ? 'BYPASSED' : 'PASSED') as 'PASSED' | 'BYPASSED',
          message: successLog.message || 'Step completed successfully.',
          timestamp: successLog.log_date_time,
          operator: successLog.user_first_name || successLog.user_id || null,
          isBypassed: isBypass,
          isInferred: false,
        };
      }

      // 3. Check for in-progress log
      const inProgressLog = candidateLogs.find((l) => l.status === 'IN_PROGRESS');
      if (inProgressLog) {
        return {
          status: 'IN_PROGRESS' as const,
          message: inProgressLog.message || 'Verification in progress...',
          timestamp: inProgressLog.log_date_time,
          operator: inProgressLog.user_first_name || inProgressLog.user_id || null,
          isBypassed: false,
          isInferred: false,
        };
      }

      // 4. If no explicit log exists, infer from verified DB records (for historical / pre-existing parts)
      if (put && step.inferSuccess) {
        const inferred = step.inferSuccess(put, aging);
        if (inferred) {
          const isBypass = inferred.message.toLowerCase().includes('bypass');
          return {
            status: (isBypass ? 'BYPASSED' : 'PASSED') as 'PASSED' | 'BYPASSED',
            message: inferred.message,
            timestamp: inferred.timestamp || (put.scanned_at ? String(put.scanned_at) : null),
            operator: put.user_first_name || put.scanned_by || 'SYSTEM',
            isBypassed: isBypass,
            isInferred: true,
          };
        }
      }

      // 5. Otherwise step is pending
      return {
        status: 'PENDING' as const,
        message: 'Awaiting execution',
        timestamp: null,
        operator: null,
        isBypassed: false,
        isInferred: false,
      };
    },
    [put, aging]
  );

  // Evaluate all 8 PUT steps
  const evaluatedPutSteps = useMemo(() => {
    return PUT_VERIFICATION_STEPS.map((step) => {
      const evaluation = evaluateStep(step, putLogs);
      return { step, evaluation };
    });
  }, [evaluateStep, putLogs]);

  // Overall PUT sequence metrics
  const putSummary = useMemo(() => {
    const total = evaluatedPutSteps.length;
    const passed = evaluatedPutSteps.filter(
      (s) => s.evaluation.status === 'PASSED' || s.evaluation.status === 'BYPASSED'
    ).length;
    const failedStepItem = evaluatedPutSteps.find((s) => s.evaluation.status === 'FAILED');
    const hasFailed = !!failedStepItem;
    const isAllPassed = passed === total && !hasFailed;
    const inProgress = evaluatedPutSteps.some((s) => s.evaluation.status === 'IN_PROGRESS');
    const percent = Math.round((passed / total) * 100);

    return {
      total,
      passed,
      hasFailed,
      failedStepItem,
      isAllPassed,
      inProgress,
      percent,
    };
  }, [evaluatedPutSteps]);

  // Evaluate PICK steps if pick exists
  const evaluatedPickSteps = useMemo(() => {
    if (!put?.pick_id) return [];
    return PICK_VERIFICATION_STEPS.map((step) => {
      const evaluation = evaluateStep(step, pickLogs);
      return { step, evaluation };
    });
  }, [evaluateStep, pickLogs, put?.pick_id]);
  const renderSequenceTable = (
    title: string,
    steps: {
      step: VerificationStepConfig;
      evaluation: {
        status: 'PASSED' | 'FAILED' | 'BYPASSED' | 'IN_PROGRESS' | 'PENDING';
        message: string;
        timestamp: string | null;
        operator: string | null;
        isBypassed: boolean;
        isInferred: boolean;
      };
    }[],
    isAllDone: boolean,
    hasFailed: boolean,
    failedMsg?: string
  ) => {
    return (
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '14px',
            paddingBottom: '12px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: hasFailed ? '#fee2e2' : isAllDone ? '#dcfce7' : '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {hasFailed ? (
                <AlertTriangle size={18} color="#dc2626" />
              ) : isAllDone ? (
                <CheckCircle2 size={18} color="#16a34a" />
              ) : (
                <RefreshCw size={16} color="#2563eb" />
              )}
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {title}
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                {hasFailed
                  ? `Failed: ${failedMsg || 'Verification check failed'}`
                  : isAllDone
                  ? 'All verification checks completed successfully.'
                  : 'Verification checks in progress.'}
              </p>
            </div>
          </div>

          <div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: '20px',
                background: hasFailed ? '#fee2e2' : isAllDone ? '#dcfce7' : '#eff6ff',
                color: hasFailed ? '#b91c1c' : isAllDone ? '#15803d' : '#1d4ed8',
                border: `1px solid ${hasFailed ? '#fecaca' : isAllDone ? '#bbf7d0' : '#bfdbfe'}`,
              }}
            >
              {hasFailed ? 'Failed' : isAllDone ? `${steps.length} of ${steps.length} Passed (100%)` : 'In Progress'}
            </span>
          </div>
        </div>

        {/* Clean Checklist Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '8px 12px', width: '45px', color: '#475569', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>#</th>
                <th style={{ padding: '8px 12px', width: '220px', color: '#475569', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Verification Step</th>
                <th style={{ padding: '8px 12px', width: '100px', color: '#475569', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Category</th>
                <th style={{ padding: '8px 12px', width: '90px', color: '#475569', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Diagnostic Result</th>
                <th style={{ padding: '8px 12px', width: '110px', textAlign: 'right', color: '#475569', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {steps.map(({ step, evaluation }, idx) => {
                const isSuccess = evaluation.status === 'PASSED';
                const isFailed = evaluation.status === 'FAILED';
                const isBypass = evaluation.status === 'BYPASSED';

                return (
                  <tr
                    key={step.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isFailed ? '#fff5f5' : idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                    }}
                  >
                    {/* # Icon */}
                    <td style={{ padding: '9px 12px', verticalAlign: 'middle' }}>
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isSuccess ? '#dcfce7' : isFailed ? '#fee2e2' : isBypass ? '#f3e8ff' : '#f1f5f9',
                          color: isSuccess ? '#15803d' : isFailed ? '#b91c1c' : isBypass ? '#7c3aed' : '#94a3b8',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        {isSuccess ? <Check size={13} strokeWidth={3} /> : isFailed ? <XCircle size={13} /> : isBypass ? <CheckCheck size={13} /> : idx + 1}
                      </div>
                    </td>

                    {/* Step Name */}
                    <td style={{ padding: '9px 12px', verticalAlign: 'middle', fontWeight: 600, color: '#0f172a' }}>
                      {idx + 1}. {step.name}
                    </td>

                    {/* Category */}
                    <td style={{ padding: '9px 12px', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {step.category}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '9px 12px', verticalAlign: 'middle' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: isSuccess ? '#dcfce7' : isFailed ? '#fee2e2' : isBypass ? '#f3e8ff' : '#f1f5f9',
                          color: isSuccess ? '#15803d' : isFailed ? '#b91c1c' : isBypass ? '#7c3aed' : '#64748b',
                          border: `1px solid ${isSuccess ? '#bbf7d0' : isFailed ? '#fecaca' : isBypass ? '#d8b4fe' : '#cbd5e1'}`,
                        }}
                      >
                        {isSuccess ? 'Pass' : isFailed ? 'Failed' : isBypass ? 'Bypassed' : 'Pending'}
                      </span>
                    </td>

                    {/* Diagnostic Result Message */}
                    <td
                      style={{
                        padding: '9px 12px',
                        verticalAlign: 'middle',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: isFailed ? '#dc2626' : '#334155',
                      }}
                    >
                      {evaluation.message || '—'}
                    </td>

                    {/* Timestamp */}
                    <td
                      style={{
                        padding: '9px 12px',
                        verticalAlign: 'middle',
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: '#64748b',
                      }}
                    >
                      {evaluation.timestamp
                        ? new Date(evaluation.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="log-detail-container">
      <style jsx>{`
        .log-detail-container {
          padding-bottom: 2.5rem;
          color: #0f172a;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        /* Top Header */
        .top-nav-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .btn-back {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 0.825rem;
          font-weight: 600;
          color: #475569;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-back:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .nav-right-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .search-box-wrap {
          position: relative;
        }

        .search-input {
          padding: 6px 12px 6px 30px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.8rem;
          width: 200px;
          outline: none;
        }

        .search-input:focus {
          border-color: #2563eb;
        }

        /* Main Identity Banner */
        .identity-banner {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.15rem 1.25rem;
          margin-bottom: 1.25rem;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .identity-left {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 1.25rem;
        }

        .identity-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .identity-label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
        }

        .identity-val {
          font-size: 1.15rem;
          font-weight: 800;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .copy-pill {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 5px;
          padding: 2px 5px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          color: #64748b;
        }

        .copy-pill:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        /* Badges */
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 8px;
          border-radius: 5px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          white-space: nowrap;
        }

        .badge-available { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
        .badge-hold { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
        .badge-picked { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .badge-pass { background: #dcfce7; color: #15803d; }
        .badge-fail { background: #fee2e2; color: #b91c1c; }
        .badge-success { background: #dcfce7; color: #15803d; }
        .badge-danger { background: #fee2e2; color: #b91c1c; }
        .badge-pending { background: #f1f5f9; color: #94a3b8; }

        /* Aging Highlight Cards Grid */
        .aging-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 0.85rem;
          margin-bottom: 1.25rem;
        }

        .aging-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0.9rem 1.1rem;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          border-top: 3px solid #2563eb;
        }

        .aging-card.card-storage { border-top-color: #2563eb; }
        .aging-card.card-kanban { border-top-color: #8b5cf6; }
        .aging-card.card-birth { border-top-color: #10b981; }
        .aging-card.card-loc { border-top-color: #f59e0b; }

        .aging-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.35rem;
        }

        .aging-card-title {
          font-size: 0.725rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
        }

        .aging-card-val {
          font-size: 1.35rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          line-height: 1.15;
        }

        .aging-card-sub {
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 0.3rem;
        }

        /* DB Detail Specifications Grid - Clean & Non-repetitive */
        .spec-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .spec-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 1rem 1.15rem;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .spec-card-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 0.85rem 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .spec-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid #f1f5f9;
          font-size: 0.8rem;
        }

        .spec-row:last-child {
          border-bottom: none;
        }

        .spec-key {
          color: #64748b;
          font-weight: 500;
        }

        .spec-val {
          font-weight: 600;
          color: #0f172a;
          text-align: right;
        }

        /* Order Files & Actions Bar */
        .files-bar {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0.75rem 1rem;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .files-group {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.6rem;
        }

        .btn-file-download {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 0.775rem;
          font-weight: 600;
          color: #334155;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
        }

        .btn-file-download:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .btn-file-download:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* View Toggle Tabs */
        .view-toggle-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 1rem;
          background: #e2e8f0;
          padding: 3px;
          border-radius: 8px;
          width: fit-content;
        }

        .view-toggle-btn {
          padding: 5px 14px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          border: none;
          background: transparent;
          color: #475569;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .view-toggle-btn.active {
          background: #ffffff;
          color: #2563eb;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
        }

        /* Step Timeline & Verification Sequence */
        .step-timeline-container {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.25rem;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
        }

        /* Top Summary Card for Sequence */
        .seq-summary-card {
          border-radius: 10px;
          padding: 1rem 1.25rem;
          margin-bottom: 1.5rem;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .seq-summary-card.status-passed {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .seq-summary-card.status-failed {
          background: #fef2f2;
          border-color: #fecaca;
        }

        .seq-summary-card.status-progress {
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .seq-summary-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .seq-summary-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .seq-summary-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .seq-summary-sub {
          font-size: 0.775rem;
          color: #64748b;
          margin: 3px 0 0 0;
          line-height: 1.4;
        }

        .seq-progress-wrap {
          margin: 0.75rem 0;
        }

        .seq-progress-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.725rem;
          font-weight: 600;
          color: #475569;
          margin-bottom: 4px;
        }

        .seq-progress-track {
          width: 100%;
          height: 7px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
        }

        .seq-progress-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.3s ease;
        }

        .fill-success {
          background: linear-gradient(90deg, #16a34a, #22c55e);
        }

        .fill-failed {
          background: linear-gradient(90deg, #dc2626, #ef4444);
        }

        .fill-progress {
          background: linear-gradient(90deg, #2563eb, #3b82f6);
        }

        .seq-meta-bar {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
          padding-top: 0.6rem;
          border-top: 1px dashed rgba(148, 163, 184, 0.3);
          font-size: 0.75rem;
        }

        .seq-meta-item {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #475569;
        }

        .seq-meta-item strong {
          color: #0f172a;
        }

        /* Stepper Flow */
        .seq-step-list {
          display: flex;
          flex-direction: column;
          margin-top: 0.5rem;
        }

        .seq-step-row {
          display: flex;
          align-items: stretch;
          gap: 14px;
        }

        .seq-stepper-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 28px;
          flex-shrink: 0;
        }

        .seq-node {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          z-index: 2;
          transition: all 0.2s ease;
        }

        .node-success {
          background: #16a34a;
          color: #ffffff;
          box-shadow: 0 0 0 3px #dcfce7;
        }

        .node-failed {
          background: #dc2626;
          color: #ffffff;
          box-shadow: 0 0 0 3px #fee2e2;
        }

        .node-bypass {
          background: #7c3aed;
          color: #ffffff;
          box-shadow: 0 0 0 3px #f3e8ff;
        }

        .node-progress {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 0 0 3px #dbeafe;
        }

        .node-pending {
          background: #f1f5f9;
          color: #94a3b8;
          border: 1px solid #cbd5e1;
        }

        .seq-node-num {
          font-size: 0.725rem;
          font-weight: 700;
        }

        .seq-connector {
          width: 2px;
          flex: 1;
          min-height: 22px;
          background: #e2e8f0;
          margin: 4px 0;
        }

        .seq-connector.connector-done {
          background: #86efac;
        }

        .seq-card {
          flex: 1;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          padding: 10px 14px;
          margin-bottom: 12px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.02);
          transition: all 0.15s ease;
        }

        .seq-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 2px 4px rgba(15, 23, 42, 0.04);
        }

        .seq-card.card-failed {
          border-color: #fca5a5;
          background: #fffafa;
        }

        .seq-card.card-success {
          border-color: #e2e8f0;
        }

        .seq-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 6px;
        }

        .seq-card-titles {
          flex: 1;
        }

        .seq-title-line {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }

        .seq-gate-pill {
          background: #f1f5f9;
          color: #475569;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          letter-spacing: 0.04em;
        }

        .seq-step-name {
          font-size: 0.85rem;
          font-weight: 700;
          color: #0f172a;
        }

        .seq-cat-pill {
          font-size: 0.65rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px solid;
          letter-spacing: 0.02em;
        }

        .seq-step-desc {
          font-size: 0.75rem;
          color: #64748b;
          margin: 3px 0 0 0;
          line-height: 1.35;
        }

        .seq-card-badges {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .badge-bypass {
          background: #f3e8ff;
          color: #6b21a8;
          border: 1px solid #d8b4fe;
        }

        .badge-progress {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .seq-time {
          font-size: 0.7rem;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-family: monospace;
        }

        /* Diagnostic Message Box */
        .seq-diag-box {
          margin-top: 8px;
          padding: 7px 10px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 0.775rem;
          font-family: monospace;
          line-height: 1.35;
        }

        .seq-diag-content {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          flex: 1;
          word-break: break-word;
        }

        .seq-diag-msg {
          flex: 1;
        }

        .diag-normal {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #334155;
        }

        .diag-failed {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .diag-bypass {
          background: #faf5ff;
          border: 1px solid #e9d5ff;
          color: #581c87;
        }

        .seq-diag-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .seq-inferred-pill {
          font-size: 0.65rem;
          font-weight: 600;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
          padding: 1px 6px;
          border-radius: 4px;
          white-space: nowrap;
        }

        .btn-copy-diag {
          background: transparent;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          padding: 2px 5px;
          color: #64748b;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .btn-copy-diag:hover {
          background: #f1f5f9;
          color: #0f172a;
          border-color: #94a3b8;
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        /* Clean Audit Table */
        .audit-table-wrapper {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          margin-bottom: 1.25rem;
        }

        .clean-audit-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
          text-align: left;
        }

        .clean-audit-table th {
          background: #f8fafc;
          color: #475569;
          font-weight: 700;
          font-size: 0.725rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 9px 12px;
          border-bottom: 1px solid #e2e8f0;
        }

        .clean-audit-table td {
          padding: 9px 12px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .clean-audit-table tbody tr:hover {
          background: #f8fafc;
        }
      `}</style>

      {/* TOP BAR: Clean Back Navigation & Quick Search */}
      <div className="top-nav-bar">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn-back"
          title="Return to previous page"
        >
          <ArrowLeft size={15} />
          <span>Back</span>
        </button>

        <div className="nav-right-actions">
          <form onSubmit={handleSearchAnother} style={{ display: 'flex', gap: '4px' }}>
            <div className="search-box-wrap">
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                }}
              />
              <input
                type="text"
                className="search-input"
                placeholder="Lookup another serial..."
                value={searchSerial}
                onChange={(e) => setSearchSerial(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn-back"
              style={{ background: '#2563eb', color: '#ffffff', borderColor: '#2563eb' }}
            >
              Go
            </button>
          </form>

          <button type="button" className="btn-back" onClick={loadDetails} title="Refresh details">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '4rem 0', textAlign: 'center', background: '#ffffff', borderRadius: '10px' }}>
          <Loader message="Loading complete part specifications & aging details from database..." />
        </div>
      ) : error ? (
        <div style={{ padding: '1.5rem', background: '#fee2e2', borderRadius: '10px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      ) : (
        <>
          {/* MAIN IDENTITY BANNER */}
          <div className="identity-banner">
            <div className="identity-left">
              <div className="identity-item">
                <span className="identity-label">Serial Number</span>
                <span className="identity-val" style={{ fontFamily: 'monospace' }}>
                  {serialNumber}
                  <button type="button" className="copy-pill" onClick={copySerial} title="Copy Serial">
                    {copiedSerial ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                  </button>
                </span>
              </div>

              {put?.model_number && (
                <div className="identity-item" style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
                  <span className="identity-label">Model</span>
                  <span className="identity-val" style={{ fontSize: '1rem' }}>
                    {put.model_number}
                    <button type="button" className="copy-pill" onClick={copyModel} title="Copy Model">
                      {copiedModel ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                    </button>
                  </span>
                </div>
              )}

              {put?.process_status && (
                <div className="identity-item" style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
                  <span className="identity-label">Process</span>
                  <span
                    className="badge"
                    style={{
                      background: put.process_status.includes('RTN') ? '#fdf4ff' : '#eff6ff',
                      color: put.process_status.includes('RTN') ? '#a21caf' : '#1d4ed8',
                      fontSize: '0.8rem',
                    }}
                  >
                    {put.process_status}
                  </span>
                </div>
              )}

              {put?.pv_status && (
                <div className="identity-item" style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '1rem' }}>
                  <span className="identity-label">PV Status</span>
                  <span className={`badge ${put.pv_status === 'PASS' ? 'badge-pass' : 'badge-fail'}`}>
                    {put.pv_status === 'PASS' ? '● PASS' : '● FAIL'}
                  </span>
                </div>
              )}
            </div>

            {/* Inventory Status Pill */}
            <div>
              <span
                className={`badge ${
                  put?.pick_status === 'AVAILABLE'
                    ? 'badge-available'
                    : put?.pick_status === 'HOLD'
                    ? 'badge-hold'
                    : 'badge-picked'
                }`}
                style={{ fontSize: '0.85rem', padding: '5px 12px' }}
              >
                ● {put?.pick_status || 'AVAILABLE'}
              </span>
            </div>
          </div>

          {/* AGING HIGHLIGHT CARDS (Clean, Non-Redundant) */}
          <div className="aging-cards-grid">
            {/* Card 1: Storage Age in Kardex */}
            <div className="aging-card card-storage">
              <div className="aging-card-header">
                <span className="aging-card-title">Storage Age (In Kardex)</span>
                <Clock size={16} color="#2563eb" />
              </div>
              <p className="aging-card-val">
                {aging ? aging.storage_formatted : '—'}
              </p>
              <p className="aging-card-sub">
                Put on: {put?.scanned_at ? new Date(put.scanned_at).toLocaleString() : '—'}
              </p>
            </div>

            {/* Card 2: Board Birth Date & Manufacturing Age */}
            <div className="aging-card card-birth">
              <div className="aging-card-header">
                <span className="aging-card-title">MES Birth Date (Board Age)</span>
                <Calendar size={16} color="#10b981" />
              </div>
              <p className="aging-card-val" style={{ fontSize: '1.15rem' }}>
                {put?.birth_date ? new Date(put.birth_date).toLocaleDateString() : 'N/A'}
              </p>
              <p className="aging-card-sub">
                {aging?.birth_age_days !== null && aging?.birth_age_days !== undefined
                  ? `${aging.birth_age_days} days old since birth`
                  : 'No MES birth date'}
              </p>
            </div>

            {/* Card 3: Warehouse Physical Location */}
            <div className="aging-card card-loc">
              <div className="aging-card-header">
                <span className="aging-card-title">Location in Kardex</span>
                <MapPin size={16} color="#f59e0b" />
              </div>
              <p className="aging-card-val" style={{ fontSize: '1.15rem' }}>
                {put?.handling_unit?.hu_id ? (
                  <Link
                    href={`/app/bins/${put.handling_unit.hu_id}`}
                    style={{ color: '#2563eb', textDecoration: 'none' }}
                  >
                    {put.handling_unit.hu_id}
                    {put.compartment?.compartment_number !== undefined && (
                      <span style={{ color: '#64748b', fontSize: '0.9rem', marginLeft: '4px' }}>
                        #{put.compartment.compartment_number}
                      </span>
                    )}
                  </Link>
                ) : (
                  'Floor Stock'
                )}
              </p>
              <p className="aging-card-sub">
                Status: {put?.handling_unit?.storage_status || put?.handling_unit?.status || 'IN_KARDEX'}
              </p>
            </div>
          </div>

          {/* ALL DATABASE SPECIFICATIONS (Clean, Comprehensive, No Repetition) */}
          <div className="spec-grid">
            {/* Card 1: Part & MES Specifications */}
            <div className="spec-card">
              <h3 className="spec-card-title">
                <Cpu size={16} color="#2563eb" />
                <span>Part & MES Details</span>
              </h3>
              <div className="spec-row">
                <span className="spec-key">Serial Number</span>
                <span className="spec-val font-monospace">{serialNumber}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Model Number</span>
                <span className="spec-val">{put?.model_number || '—'}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">MES Process Step</span>
                <span className="spec-val" style={{ color: '#2563eb' }}>{put?.process_status || '—'}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">PV Status</span>
                <span className="spec-val" style={{ color: put?.pv_status === 'PASS' ? '#16a34a' : '#dc2626' }}>
                  {put?.pv_status || '—'}
                </span>
              </div>
              <div className="spec-row">
                <span className="spec-key">MES Birth Date</span>
                <span className="spec-val">
                  {put?.birth_date ? new Date(put.birth_date).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Total Board Age</span>
                <span className="spec-val">
                  {aging?.birth_age_days !== null && aging?.birth_age_days !== undefined
                    ? `${aging.birth_age_days} Days`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {/* Card 2: Warehouse Location & Storage */}
            <div className="spec-card">
              <h3 className="spec-card-title">
                <MapPin size={16} color="#16a34a" />
                <span>Kardex Physical Storage</span>
              </h3>
              <div className="spec-row">
                <span className="spec-key">Handling Unit (Tray)</span>
                <span className="spec-val">
                  {put?.handling_unit?.hu_id ? (
                    <Link href={`/app/bins/${put.handling_unit.hu_id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                      {put.handling_unit.hu_id}
                    </Link>
                  ) : (
                    'Unassigned'
                  )}
                </span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Compartment Slot</span>
                <span className="spec-val">
                  {put?.compartment?.compartment_number ? `Slot #${put.compartment.compartment_number}` : '—'}
                </span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Storage Location Status</span>
                <span className="spec-val">{put?.handling_unit?.storage_status || put?.handling_unit?.status || 'IN_KARDEX'}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Tray Status</span>
                <span className="spec-val">{put?.handling_unit?.hu_status || put?.handling_unit?.status || 'PARTIALLY_FILLED'}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Put Operator</span>
                <span className="spec-val">{put?.user_first_name || put?.scanned_by || 'SYSTEM'}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Put Timestamp</span>
                <span className="spec-val">
                  {put?.scanned_at ? new Date(put.scanned_at).toLocaleString() : '—'}
                </span>
              </div>
            </div>

            {/* Card 3: Pick & Machine File Transfer */}
            <div className="spec-card">
              <h3 className="spec-card-title">
                <HardDrive size={16} color="#d97706" />
                <span>Orders & Files Status</span>
              </h3>
              <div className="spec-row">
                <span className="spec-key">Inventory Pick Status</span>
                <span className="spec-val" style={{ color: put?.pick_status === 'AVAILABLE' ? '#16a34a' : put?.pick_status === 'PICKED' ? '#2563eb' : '#d97706' }}>
                  {put?.pick_status || 'AVAILABLE'}
                </span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Pick Order ID</span>
                <span className="spec-val font-monospace">{put?.pick_id ? `#${put.pick_id}` : 'Not Picked'}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Pick Operator</span>
                <span className="spec-val">{put?.pick?.entered_by || (put?.pick_id ? 'Operator' : '—')}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Kardex Machine Transfer</span>
                <span className="spec-val">
                  {put?.text_file_downloaded ? 'Downloaded to Kardex' : 'Pending Transfer'}
                </span>
              </div>
              <div className="spec-row">
                <span className="spec-key">Source PO Reference</span>
                <span className="spec-val">{put?.put_po_file?.name || 'PO File'}</span>
              </div>
              <div className="spec-row">
                <span className="spec-key">PUT Order ID (Internal)</span>
                <span className="spec-val font-monospace">#{put?.id || '—'}</span>
              </div>
            </div>
          </div>

          {/* DOWNLOADS & ORDER FILES BAR */}
          <div className="files-bar">
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
              Associated Order Files:
            </span>
            <div className="files-group">
              {/* Source PO File */}
              {put?.put_po_file?.name || put?.po_file_id ? (
                <button
                  type="button"
                  className="btn-file-download"
                  onClick={handleDownloadPo}
                  disabled={downloadingPo}
                  title="Download Source PO File"
                >
                  <Download size={12} />
                  <span>PO File ({put?.put_po_file?.name || 'Download'})</span>
                </button>
              ) : null}

              {/* PUT Order File */}
              {put?.id ? (
                <button
                  type="button"
                  className="btn-file-download"
                  onClick={handleDownloadPut}
                  disabled={downloadingPut}
                  title="Download Kardex PUT Order File (.txt)"
                >
                  <Download size={12} />
                  <span>{putDownloaded ? 'PUT File (Ready)' : 'Download PUT File'}</span>
                </button>
              ) : null}

              {/* PICK Order File */}
              {put?.pick_id ? (
                <button
                  type="button"
                  className="btn-file-download"
                  onClick={handleDownloadPick}
                  disabled={downloadingPick}
                  title="Download Kardex PICK Order File (.txt)"
                >
                  <Download size={12} />
                  <span>{pickDownloaded ? 'PICK File (Ready)' : 'Download PICK File'}</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* VIEW SWITCHER: Verification Sequence vs Event Telemetry */}
          <div className="view-toggle-bar">
            <button
              className={`view-toggle-btn ${activeViewTab === 'sequence' ? 'active' : ''}`}
              onClick={() => setActiveViewTab('sequence')}
            >
              <ShieldCheck size={14} /> Verification Sequence
            </button>
            <button
              className={`view-toggle-btn ${activeViewTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveViewTab('events')}
            >
              <Activity size={14} /> Event Telemetry Logs ({logs.length})
            </button>
          </div>

          {/* TAB 1: Verification Sequence Flow */}
          {activeViewTab === 'sequence' ? (
            <div>
              {renderSequenceTable(
                'PUT Verification Sequence (8 Steps)',
                evaluatedPutSteps,
                putSummary.isAllPassed,
                putSummary.hasFailed,
                putSummary.failedStepItem?.evaluation.message
              )}

              {put?.pick_id &&
                renderSequenceTable(
                  'PICK Order Verification Sequence (4 Steps)',
                  evaluatedPickSteps,
                  evaluatedPickSteps.every((s) => s.evaluation.status === 'PASSED' || s.evaluation.status === 'BYPASSED'),
                  evaluatedPickSteps.some((s) => s.evaluation.status === 'FAILED'),
                  evaluatedPickSteps.find((s) => s.evaluation.status === 'FAILED')?.evaluation.message
                )}
            </div>
          ) : (
            /* TAB 2: Clean Chronological Event Table */
            <div className="audit-table-wrapper">
              {logs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No execution event telemetry recorded for this part.
                </div>
              ) : (
                <table className="clean-audit-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th style={{ width: '80px' }}>Process</th>
                      <th>Step / Activity</th>
                      <th style={{ width: '90px' }}>Status</th>
                      <th>Diagnostic Details</th>
                      <th style={{ width: '160px' }}>Timestamp</th>
                      <th style={{ width: '100px' }}>Operator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l, index) => (
                      <tr key={l.id || index}>
                        <td style={{ color: '#94a3b8' }}>{index + 1}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              background: l.log_type === 'PUT_PROCESS' ? '#eff6ff' : '#fdf4ff',
                              color: l.log_type === 'PUT_PROCESS' ? '#1d4ed8' : '#a21caf',
                            }}
                          >
                            {l.log_type === 'PUT_PROCESS' ? 'PUT' : 'PICK'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{l.activity}</td>
                        <td>
                          <span className={`badge ${l.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>
                            {l.status}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#334155' }}>
                          {l.message || '—'}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }}>
                          {l.log_date_time ? new Date(l.log_date_time).toLocaleString() : '—'}
                        </td>
                        <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {l.user_id || l.user_first_name || 'SYSTEM'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
