'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { copyToClipboard as copyUtil } from '@/lib/clipboard';
import {
  MaterialDetailResponse,
  MaterialSerialItem,
  MaterialSerialsResponse,
  MaterialBinLocation,
} from '@/types/material';
import { Loader } from '@/components/shared/Loader';
import { Pagination } from '@/components/shared/Pagination';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  ArrowLeft,
  Tag,
  Copy,
  Check,
  RefreshCw,
  Boxes,
  Layers,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  MapPin,
  Clock,
  User,
  Activity,
  FileSpreadsheet,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
  Inbox,
  Package,
  X,
  PackageCheck,
  Cpu,
  HardDrive,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface MaterialDetailPageProps {
  params: Promise<{ modelNumber: string }>;
}

export default function MaterialDetailPage({ params }: MaterialDetailPageProps) {
  const { modelNumber: rawModel } = React.use(params);
  const modelNumber = decodeURIComponent(rawModel || '').trim();
  const router = useRouter();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'LOCATIONS' | 'SERIALS'>('LOCATIONS');

  // Material Overview Details
  const [details, setDetails] = useState<MaterialDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI state
  const [copiedModel, setCopiedModel] = useState(false);
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);
  const [searchAnotherModel, setSearchAnotherModel] = useState('');
  const [exporting, setExporting] = useState(false);

  // Serials Ledger State
  const [serials, setSerials] = useState<MaterialSerialItem[]>([]);
  const [serialsLoading, setSerialsLoading] = useState(false);
  const [serialSearch, setSerialSearch] = useState('');
  const [debouncedSerialSearch, setDebouncedSerialSearch] = useState('');
  const [serialStatusFilter, setSerialStatusFilter] = useState<string>('ALL');
  const [serialPage, setSerialPage] = useState(1);
  const [serialPageSize, setSerialPageSize] = useState(15);
  const [serialTotalPages, setSerialTotalPages] = useState(1);
  const [serialTotalItems, setSerialTotalItems] = useState(0);

  // Debounce serial search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSerialSearch(serialSearch);
      setSerialPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [serialSearch]);

  // Fetch full material detail
  const fetchDetails = useCallback(async () => {
    if (!modelNumber) return;
    try {
      setLoading(true);
      setError('');
      const res = await apiGet<MaterialDetailResponse>(
        `/material/${encodeURIComponent(modelNumber)}/details`
      );
      setDetails(res);
    } catch (err: any) {
      console.error('Failed to fetch material details:', err);
      setError(err.message || `Material "${modelNumber}" was not found in Kardex records.`);
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [modelNumber]);

  // Fetch serials ledger
  const fetchSerials = useCallback(
    async (pageNum = serialPage, pageSize = serialPageSize) => {
      if (!modelNumber) return;
      try {
        setSerialsLoading(true);
        const res = await apiPost<MaterialSerialsResponse>(
          `/material/${encodeURIComponent(modelNumber)}/serials`,
          {
            search: debouncedSerialSearch,
            status: serialStatusFilter,
            page: pageNum,
            size: pageSize,
          }
        );
        setSerials(res.data || []);
        setSerialTotalPages(res.totalPages || 1);
        setSerialTotalItems(res.totalItems || 0);
        setSerialPage(res.page || 1);
      } catch (err) {
        console.error('Failed to fetch serials ledger:', err);
        setSerials([]);
      } finally {
        setSerialsLoading(false);
      }
    },
    [modelNumber, debouncedSerialSearch, serialStatusFilter, serialPage, serialPageSize]
  );

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  useEffect(() => {
    fetchSerials(serialPage, serialPageSize);
  }, [fetchSerials, serialPage, serialPageSize]);

  // Copy helper
  const copyToClipboard = (text: string, isSerial = false) => {
    copyUtil(text);
    if (isSerial) {
      setCopiedSerial(text);
      setTimeout(() => setCopiedSerial(null), 1800);
    } else {
      setCopiedModel(true);
      setTimeout(() => setCopiedModel(false), 1800);
    }
  };

  // Jump to another model
  const handleJumpToModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchAnotherModel.trim()) return;
    router.push(`/app/materials/${encodeURIComponent(searchAnotherModel.trim())}`);
  };

  // Export serials to Excel
  const exportSerialsToExcel = () => {
    if (!serials.length) return;
    try {
      setExporting(true);
      const exportData = serials.map((s, idx) => ({
        '#': idx + 1,
        'Part / Model Number': modelNumber,
        'Serial Number': s.serial_number,
        'PV Validation': s.pv_status || 'N/A',
        'MES Process': s.process_status || 'N/A',
        'Storage Status': s.pick_status,
        'Bin Location (HU)': s.hu_id || 'Unassigned',
        'Compartment #': s.compartment_number ?? 'N/A',
        'Inbound Operator': s.scanned_by || 'SYSTEM',
        'Inbound Timestamp': s.scanned_at ? new Date(s.scanned_at).toLocaleString() : 'N/A',
        'Birth / MFD': s.birth_date ? new Date(s.birth_date).toLocaleDateString() : 'N/A',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Serials Ledger');
      XLSX.writeFile(workbook, `Material_${modelNumber}_Serials_${Date.now()}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  // Stock status determination & calculations
  const availableCount = details?.available_count || 0;
  const holdCount = details?.hold_count || 0;
  const pickedCount = details?.picked_count || 0;
  const totalCount = details?.total_count || availableCount + holdCount + pickedCount || 1;

  const isOutOfStock = availableCount === 0;
  const isLowStock = availableCount > 0 && availableCount <= 5;

  const availPct = Math.round((availableCount / totalCount) * 100);
  const holdPct = Math.round((holdCount / totalCount) * 100);
  const pickedPct = 100 - availPct - holdPct;

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
      {/* TOP HEADER: Breadcrumbs & Quick Actions */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <Link
            href="/app/materials"
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2 rounded-pill px-3 shadow-sm bg-white"
          >
            <ArrowLeft size={16} />
            <span className="fw-semibold">Back to Materials Master</span>
          </Link>
          <div className="breadcrumb-trail text-muted small d-none d-md-block">
            <span>Inventory</span> / <span>Materials Master</span> /{' '}
            <strong className="text-dark font-monospace">{modelNumber}</strong>
          </div>
        </div>

        {/* Quick Search & Actions */}
        <div className="d-flex align-items-center gap-2">
          <form onSubmit={handleJumpToModel} className="d-flex align-items-center gap-2">
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                className="text-muted"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ paddingLeft: '32px', borderRadius: '20px', width: '230px' }}
                placeholder="Jump to another part #..."
                value={searchAnotherModel}
                onChange={(e) => setSearchAnotherModel(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm px-3 fw-semibold">
              Go
            </button>
          </form>

          <button
            type="button"
            className="btn btn-white border btn-sm d-inline-flex align-items-center gap-1 px-3 shadow-sm bg-white"
            onClick={() => {
              fetchDetails();
              fetchSerials(1);
            }}
            title="Reload material specifications"
          >
            <RefreshCw size={13} className="text-secondary" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-5 text-center bg-white rounded-3 border p-5 shadow-sm">
          <Loader message={`Loading specifications and inventory breakdown for ${modelNumber}...`} />
        </div>
      ) : error ? (
        <div className="alert alert-danger d-flex align-items-center gap-2 shadow-sm p-4">
          <AlertTriangle size={20} />
          <div>
            <h6 className="mb-1 fw-bold">Material Not Found</h6>
            <p className="mb-0 small">{error}</p>
          </div>
        </div>
      ) : (
        <>
          {/* HERO BANNER: Material Identity & Live Stock Telemetry */}
          <div
            className="card shadow-sm mb-4 border-0"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '20px 24px',
            }}
          >
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
              {/* Left Identity Group */}
              <div className="d-flex align-items-center gap-4 flex-wrap">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                    paddingRight: '24px',
                    borderRight: '2px solid #e2e8f0',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#64748b',
                      letterSpacing: '0.6px',
                      textTransform: 'uppercase',
                    }}
                  >
                    PART / MODEL NUMBER
                  </span>
                  <div className="d-flex align-items-center gap-2">
                    <span
                      style={{
                        fontSize: '24px',
                        fontWeight: 800,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        color: '#0f172a',
                      }}
                    >
                      {modelNumber}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-light border p-1 px-2 d-flex align-items-center gap-1"
                      onClick={() => copyToClipboard(modelNumber)}
                      title={copiedModel ? 'Copied!' : 'Copy Model Number'}
                    >
                      {copiedModel ? (
                        <Check size={14} className="text-success" />
                      ) : (
                        <Copy size={14} className="text-muted" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Stock Status Badge */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    paddingRight: '20px',
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
                    STOCK AVAILABILITY
                  </span>
                  <div>
                    {isOutOfStock ? (
                      <span
                        className="badge d-inline-flex align-items-center gap-1 px-3 py-2 rounded-pill"
                        style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}
                      >
                        <XCircle size={13} /> Depleted (0 in stock)
                      </span>
                    ) : isLowStock ? (
                      <span
                        className="badge d-inline-flex align-items-center gap-1 px-3 py-2 rounded-pill"
                        style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}
                      >
                        <AlertTriangle size={13} /> Low Stock ({availableCount} units)
                      </span>
                    ) : (
                      <span
                        className="badge d-inline-flex align-items-center gap-1 px-3 py-2 rounded-pill"
                        style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}
                      >
                        <CheckCircle2 size={13} /> In Stock ({availableCount} units)
                      </span>
                    )}
                  </div>
                </div>

                {/* Available Units Stat */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    paddingRight: '20px',
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
                    AVAILABLE FOR PICK
                  </span>
                  <span
                    style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      color: availableCount > 0 ? '#15803d' : '#94a3b8',
                    }}
                  >
                    {availableCount.toLocaleString()}
                  </span>
                </div>

                {/* Quality Hold Stat */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    paddingRight: '20px',
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
                    QUALITY HOLD
                  </span>
                  <span
                    style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      color: holdCount > 0 ? '#b45309' : '#64748b',
                    }}
                  >
                    {holdCount.toLocaleString()}
                  </span>
                </div>

                {/* Picked / Dispatched Stat */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    paddingRight: '20px',
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
                    DISPATCHED / PICKED
                  </span>
                  <span
                    style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      color: '#1d4ed8',
                    }}
                  >
                    {pickedCount.toLocaleString()}
                  </span>
                </div>

                {/* Total Lifetime Stat */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#64748b',
                      letterSpacing: '0.5px',
                    }}
                  >
                    TOTAL LIFETIME
                  </span>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#334155' }}>
                    {totalCount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Right Action: Export Serial Ledger */}
              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2 rounded-pill px-3 shadow-sm bg-white"
                  onClick={exportSerialsToExcel}
                  disabled={exporting || serials.length === 0}
                  title="Export current serialized ledger to Excel"
                >
                  <FileSpreadsheet size={15} className="text-success" />
                  <span className="fw-semibold">
                    {exporting ? 'Exporting...' : 'Export Serial Ledger'}
                  </span>
                </button>
              </div>
            </div>

            {/* Stock Ratio Gauge */}
            <div className="mt-3 pt-3 border-top">
              <div className="d-flex align-items-center justify-content-between mb-1" style={{ fontSize: '11px', color: '#64748b' }}>
                <span>Stock Ratio Breakdown</span>
                <span>
                  Available: <strong className="text-success">{availPct}%</strong> | Hold:{' '}
                  <strong className="text-warning">{holdPct}%</strong> | Dispatched:{' '}
                  <strong className="text-primary">{pickedPct}%</strong>
                </span>
              </div>
              <div
                style={{
                  height: '8px',
                  borderRadius: '6px',
                  backgroundColor: '#e2e8f0',
                  display: 'flex',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: `${availPct}%`, backgroundColor: '#10b981' }} title={`Available: ${availableCount} units`} />
                <div style={{ width: `${holdPct}%`, backgroundColor: '#f59e0b' }} title={`On Hold: ${holdCount} units`} />
                <div style={{ width: `${pickedPct}%`, backgroundColor: '#3b82f6' }} title={`Dispatched: ${pickedCount} units`} />
              </div>
            </div>
          </div>

          {/* NAVIGATION TABS */}
          <div className="d-flex align-items-center gap-2 mb-3 border-bottom pb-2">
            <button
              type="button"
              className={`btn btn-sm px-4 py-2 rounded-pill fw-bold d-inline-flex align-items-center gap-2 transition-all ${
                activeTab === 'LOCATIONS'
                  ? 'btn-primary text-white shadow-sm'
                  : 'btn-light text-secondary border'
              }`}
              onClick={() => setActiveTab('LOCATIONS')}
            >
              <Boxes size={16} />
              <span>Storage Locations & Bins</span>
              <span
                className={`badge rounded-pill ms-1 ${
                  activeTab === 'LOCATIONS' ? 'bg-white text-primary' : 'bg-secondary text-white'
                }`}
              >
                {(details?.locations || []).length} Bins
              </span>
            </button>

            <button
              type="button"
              className={`btn btn-sm px-4 py-2 rounded-pill fw-bold d-inline-flex align-items-center gap-2 transition-all ${
                activeTab === 'SERIALS'
                  ? 'btn-primary text-white shadow-sm'
                  : 'btn-light text-secondary border'
              }`}
              onClick={() => setActiveTab('SERIALS')}
            >
              <Layers size={16} />
              <span>Serialized Part Ledger</span>
              <span
                className={`badge rounded-pill ms-1 ${
                  activeTab === 'SERIALS' ? 'bg-white text-primary' : 'bg-secondary text-white'
                }`}
              >
                {serialTotalItems} Units
              </span>
            </button>
          </div>

          {/* TAB 1: STORAGE LOCATIONS & BINS */}
          {activeTab === 'LOCATIONS' && (
            <div>
              {(details?.locations || []).length === 0 ? (
                <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}
                  >
                    <Inbox size={32} className="text-muted" />
                  </div>
                  <h5 className="fw-bold text-dark">No Active Storage Bins</h5>
                  <p className="text-muted small mb-0 max-w-md mx-auto">
                    There are currently no active physical bins (Handling Units) holding available units of{' '}
                    <strong>{modelNumber}</strong>. Units may be out of stock, awaiting replenishment, or already dispatched.
                  </p>
                </div>
              ) : (
                <div className="row g-4">
                  {(details?.locations || []).map((loc) => {
                    const availableInBin = (loc.units || []).filter(
                      (u) => u.pick_status === 'AVAILABLE'
                    ).length;
                    const holdInBin = (loc.units || []).filter(
                      (u) => u.pick_status === 'HOLD'
                    ).length;

                    return (
                      <div key={loc.hu_id} className="col-12 col-lg-6 col-xl-4">
                        <div
                          className="card h-100 shadow-sm border-0"
                          style={{
                            borderRadius: '14px',
                            border: '1px solid #e2e8f0',
                            overflow: 'hidden',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          {/* Bin Card Header */}
                          <div
                            style={{
                              padding: '16px 20px',
                              backgroundColor: '#f8fafc',
                              borderBottom: '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div className="d-flex align-items-center gap-2">
                              <Boxes size={18} className="text-primary" />
                              <Link
                                href={`/app/bins/${encodeURIComponent(loc.hu_id)}`}
                                className="fw-bold text-dark text-decoration-none font-monospace"
                                style={{ fontSize: '16px' }}
                                title="Click to view full tray layout and scan"
                              >
                                {loc.hu_id}
                              </Link>
                              <span
                                className="badge bg-light text-secondary border px-2 py-1"
                                style={{ fontSize: '10px' }}
                              >
                                {loc.storage_status || 'IN_STORAGE'}
                              </span>
                            </div>

                            <Link
                              href={`/app/bins/${encodeURIComponent(loc.hu_id)}`}
                              className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 rounded-pill px-2 py-1"
                              style={{ fontSize: '11.5px', fontWeight: 600 }}
                            >
                              <span>View Tray Layout</span>
                              <ArrowUpRight size={12} />
                            </Link>
                          </div>

                          {/* Bin Card Body */}
                          <div style={{ padding: '18px 20px' }}>
                            <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                              <span className="text-muted small fw-semibold">Current Stored Units:</span>
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 fw-semibold">
                                  {availableInBin} Available
                                </span>
                                {holdInBin > 0 && (
                                  <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1 fw-semibold">
                                    {holdInBin} Hold
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Compartment Slot Breakdown Grid */}
                            <div>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: '#64748b',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  display: 'block',
                                  marginBottom: '10px',
                                }}
                              >
                                Allocated Compartment Slots:
                              </span>

                              <div className="d-flex flex-column gap-2">
                                {(loc.units || []).map((u, uIdx) => (
                                  <div
                                    key={uIdx}
                                    style={{
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      backgroundColor: '#f8fafc',
                                      border: '1px solid #e2e8f0',
                                      fontSize: '12.5px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '8px',
                                    }}
                                  >
                                    <div className="d-flex align-items-center gap-2">
                                      <span
                                        className="badge bg-primary text-white"
                                        style={{ fontSize: '10.5px', padding: '3px 7px' }}
                                      >
                                        Slot #{u.compartment_number}
                                      </span>
                                      <Link
                                        href={`/app/logs/${encodeURIComponent(u.serial_number)}`}
                                        className="font-monospace text-dark text-decoration-none fw-bold"
                                        title="Inspect unit verification logs"
                                      >
                                        {u.serial_number}
                                      </Link>
                                    </div>

                                    <div className="d-flex align-items-center gap-2">
                                      <span
                                        className={`badge ${
                                          u.pv_status === 'PASS'
                                            ? 'bg-success-subtle text-success border border-success-subtle'
                                            : 'bg-danger-subtle text-danger border border-danger-subtle'
                                        }`}
                                        style={{ fontSize: '10px' }}
                                      >
                                        {u.pv_status}
                                      </span>
                                      <Link
                                        href={`/app/logs/${encodeURIComponent(u.serial_number)}`}
                                        className="btn btn-sm btn-link p-0 text-primary"
                                        title="View Serial Log"
                                      >
                                        <ArrowUpRight size={14} />
                                      </Link>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SERIALIZED PART LEDGER */}
          {activeTab === 'SERIALS' && (
            <div className="card shadow-sm border-0" style={{ borderRadius: '14px', overflow: 'hidden' }}>
              {/* Filter Toolbar */}
              <div
                style={{
                  padding: '16px 20px',
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                {/* Search Bar */}
                <div style={{ position: 'relative', minWidth: '300px', flexGrow: 1 }}>
                  <Search
                    size={14}
                    className="text-muted"
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  />
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    style={{ paddingLeft: '32px', paddingRight: serialSearch ? '30px' : '12px', borderRadius: '8px' }}
                    placeholder="Search by Serial Barcode..."
                    value={serialSearch}
                    onChange={(e) => setSerialSearch(e.target.value)}
                  />
                  {serialSearch && (
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-0 text-muted"
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                      onClick={() => setSerialSearch('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="d-flex align-items-center gap-2">
                  <select
                    className="form-select form-select-sm"
                    style={{ borderRadius: '8px', minWidth: '170px' }}
                    value={serialStatusFilter}
                    onChange={(e) => {
                      setSerialStatusFilter(e.target.value);
                      setSerialPage(1);
                    }}
                  >
                    <option value="ALL">All Storage Statuses</option>
                    <option value="AVAILABLE">Available Only</option>
                    <option value="HOLD">Quality Hold</option>
                    <option value="PICKED">Picked / Dispatched</option>
                  </select>

                  <select
                    className="form-select form-select-sm"
                    style={{ borderRadius: '8px', width: '120px' }}
                    value={serialPageSize}
                    onChange={(e) => {
                      setSerialPageSize(Number(e.target.value));
                      setSerialPage(1);
                    }}
                  >
                    <option value={15}>15 per page</option>
                    <option value={30}>30 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
              </div>

              {/* Table Body */}
              <div className="table-responsive">
                {serialsLoading ? (
                  <div className="py-5 text-center">
                    <Loader message="Loading serialized unit inventory..." />
                  </div>
                ) : serials.length === 0 ? (
                  <div className="py-5 text-center text-muted">
                    <Inbox size={32} className="mb-2 text-muted" />
                    <div>No serialized parts found matching the specified criteria.</div>
                  </div>
                ) : (
                  <table className="table table-hover align-middle mb-0" style={{ minWidth: '860px' }}>
                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <tr>
                        <th style={{ width: '50px', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>#</th>
                        <th style={{ width: '220px', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                          Serial Barcode
                        </th>
                        <th style={{ width: '130px', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                          PV Validation
                        </th>
                        <th style={{ width: '140px', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                          MES Process
                        </th>
                        <th style={{ width: '140px', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                          Storage Status
                        </th>
                        <th style={{ width: '160px', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                          Bin Location
                        </th>
                        <th style={{ width: '120px', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                          Slot #
                        </th>
                        <th style={{ width: '180px', fontSize: '11px', fontWeight: 700, color: '#64748b' }}>
                          Inbound Date
                        </th>
                        <th style={{ width: '130px', fontSize: '11px', fontWeight: 700, color: '#64748b' }} className="text-end">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {serials.map((s, idx) => (
                        <tr key={s.id || idx}>
                          <td className="text-muted small fw-bold">
                            {(serialPage - 1) * serialPageSize + idx + 1}
                          </td>

                          {/* Serial Number */}
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <Link
                                href={`/app/logs/${encodeURIComponent(s.serial_number)}`}
                                className="font-monospace fw-bold text-primary text-decoration-none"
                                style={{ fontSize: '13.5px' }}
                                title="Click to view process timeline and logs"
                              >
                                {s.serial_number}
                              </Link>
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-0 text-muted"
                                onClick={() => copyToClipboard(s.serial_number, true)}
                                title="Copy Serial"
                              >
                                {copiedSerial === s.serial_number ? (
                                  <Check size={12} className="text-success" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* PV Status */}
                          <td>
                            <span
                              className={`badge px-2 py-1 rounded-pill ${
                                s.pv_status === 'PASS'
                                  ? 'bg-success-subtle text-success border border-success-subtle'
                                  : 'bg-danger-subtle text-danger border border-danger-subtle'
                              }`}
                              style={{ fontSize: '11px', letterSpacing: '0.3px' }}
                            >
                              {s.pv_status === 'PASS' ? '● PASSED' : '● FAILED'}
                            </span>
                          </td>

                          {/* MES Process */}
                          <td>
                            <span className="fw-semibold text-dark small">
                              {s.process_status || '—'}
                            </span>
                          </td>

                          {/* Pick / Storage Status */}
                          <td>
                            <span
                              className={`badge px-2 py-1 rounded-pill ${
                                s.pick_status === 'AVAILABLE'
                                  ? 'bg-success-subtle text-success border border-success-subtle'
                                  : s.pick_status === 'PICKED'
                                  ? 'bg-primary-subtle text-primary border border-primary-subtle'
                                  : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                              }`}
                              style={{ fontSize: '11px' }}
                            >
                              ● {s.pick_status}
                            </span>
                          </td>

                          {/* Bin Location */}
                          <td>
                            {s.hu_id ? (
                              <Link
                                href={`/app/bins/${encodeURIComponent(s.hu_id)}`}
                                className="badge bg-light text-primary border text-decoration-none d-inline-flex align-items-center gap-1"
                                style={{ fontSize: '12px' }}
                              >
                                <Boxes size={11} />
                                {s.hu_id}
                              </Link>
                            ) : (
                              <span className="text-muted small">Floor / Unassigned</span>
                            )}
                          </td>

                          {/* Compartment Slot */}
                          <td>
                            <span className="font-monospace small text-dark fw-semibold">
                              {s.compartment_number ? `Slot #${s.compartment_number}` : '—'}
                            </span>
                          </td>

                          {/* Inbound Date */}
                          <td>
                            <span className="font-monospace small text-muted">
                              {s.scanned_at ? new Date(s.scanned_at).toLocaleString() : '—'}
                            </span>
                          </td>

                          {/* Action Link */}
                          <td className="text-end">
                            <Link
                              href={`/app/logs/${encodeURIComponent(s.serial_number)}`}
                              className="btn btn-outline-primary btn-sm py-1 px-2 d-inline-flex align-items-center gap-1"
                              style={{ fontSize: '11.5px', borderRadius: '6px' }}
                            >
                              <span>View Logs</span>
                              <ArrowUpRight size={12} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Table Footer with Pagination */}
              {serialTotalPages > 1 && (
                <div className="p-3 border-top bg-light">
                  <Pagination
                    currentPage={serialPage}
                    totalPages={serialTotalPages}
                    totalItems={serialTotalItems}
                    pageSize={serialPageSize}
                    onPageChange={(p) => setSerialPage(p)}
                    onPageSizeChange={(s) => {
                      setSerialPageSize(s);
                      setSerialPage(1);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
