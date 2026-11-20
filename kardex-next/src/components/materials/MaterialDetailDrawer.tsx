'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api';
import { copyToClipboard as copyUtil } from '@/lib/clipboard';
import {
  MaterialDetailResponse,
  MaterialSerialItem,
  MaterialSerialsResponse
} from '@/types/material';
import { Loader } from '@/components/shared/Loader';
import { Pagination } from '@/components/shared/Pagination';
import {
  X,
  Copy,
  Check,
  Boxes,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  PackageMinus,
  ExternalLink,
  Search,
  Tag,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface MaterialDetailDrawerProps {
  modelNumber: string | null;
  isOpen: boolean;
  onClose: () => void;
  onInitiatePick?: (modelNumber: string) => void;
}

export const MaterialDetailDrawer: React.FC<MaterialDetailDrawerProps> = ({
  modelNumber,
  isOpen,
  onClose,
  onInitiatePick
}) => {
  const [activeTab, setActiveTab] = useState<'LOCATIONS' | 'SERIALS'>('LOCATIONS');
  const [details, setDetails] = useState<MaterialDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedModel, setCopiedModel] = useState(false);
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);

  // Serials ledger tab states
  const [serials, setSerials] = useState<MaterialSerialItem[]>([]);
  const [serialsLoading, setSerialsLoading] = useState(false);
  const [serialSearch, setSerialSearch] = useState('');
  const [serialStatusFilter, setSerialStatusFilter] = useState<string>('ALL');
  const [serialPage, setSerialPage] = useState(1);
  const [serialTotalPages, setSerialTotalPages] = useState(1);
  const [serialTotalItems, setSerialTotalItems] = useState(0);

  // Fetch full material detail
  const fetchDetails = useCallback(async () => {
    if (!modelNumber) return;
    try {
      setLoading(true);
      const res = await apiGet<MaterialDetailResponse>(
        `/material/${encodeURIComponent(modelNumber)}/details`
      );
      setDetails(res);
    } catch (err) {
      console.error('Failed to fetch material details:', err);
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [modelNumber]);

  // Fetch serials for ledger
  const fetchSerials = useCallback(async (pageNum = 1) => {
    if (!modelNumber) return;
    try {
      setSerialsLoading(true);
      const res = await apiPost<MaterialSerialsResponse>(
        `/material/${encodeURIComponent(modelNumber)}/serials`,
        {
          search: serialSearch,
          status: serialStatusFilter,
          page: pageNum,
          size: 15
        }
      );
      setSerials(res.data || []);
      setSerialTotalPages(res.totalPages || 1);
      setSerialTotalItems(res.totalItems || 0);
      setSerialPage(res.page || 1);
    } catch (err) {
      console.error('Failed to fetch serials:', err);
      setSerials([]);
    } finally {
      setSerialsLoading(false);
    }
  }, [modelNumber, serialSearch, serialStatusFilter]);

  useEffect(() => {
    if (isOpen && modelNumber) {
      fetchDetails();
      fetchSerials(1);
    } else {
      setDetails(null);
      setSerials([]);
      setSerialSearch('');
      setSerialStatusFilter('ALL');
      setActiveTab('LOCATIONS');
    }
  }, [isOpen, modelNumber, fetchDetails, fetchSerials]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const exportSerialsToExcel = () => {
    if (!details || !serials.length) return;
    const exportData = serials.map((s, idx) => ({
      '#': idx + 1,
      'Model Number': modelNumber,
      'Serial Number': s.serial_number,
      'PV Status': s.pv_status || 'N/A',
      'Process Status': s.process_status || 'N/A',
      'Pick Status': s.pick_status,
      'Bin Location (HU)': s.hu_id || 'Unassigned',
      'Compartment #': s.compartment_number ?? 'N/A',
      'Scanned By': s.scanned_by || 'SYSTEM',
      'Scanned At': s.scanned_at ? new Date(s.scanned_at).toLocaleString() : 'N/A',
      'Birth Date': s.birth_date ? new Date(s.birth_date).toLocaleDateString() : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Serials');
    XLSX.writeFile(workbook, `Material_${modelNumber}_Serials_${Date.now()}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <style jsx>{`
        .drawer-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 1050;
          display: flex;
          justify-content: flex-end;
          animation: fadeIn 0.2s ease-out;
        }

        .drawer-panel {
          width: 100%;
          max-width: 820px;
          height: 100vh;
          background: #ffffff;
          box-shadow: -4px 0 24px rgba(15, 23, 42, 0.15);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        @media (max-width: 640px) {
          .drawer-panel {
            max-width: 100vw !important;
          }
          .drawer-header {
            padding: 14px 16px !important;
          }
          .drawer-tabs {
            padding: 0 12px !important;
          }
          .drawer-body {
            padding: 14px !important;
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .drawer-header {
          padding: 20px 24px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .model-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          padding: 6px 12px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 17px;
          font-weight: 700;
          color: #0f172a;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .copy-btn {
          border: none;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 2px;
          border-radius: 4px;
          transition: all 0.15s;
        }

        .copy-btn:hover {
          color: #2563eb;
          background: #eff6ff;
        }

        .close-btn {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          color: #64748b;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }

        .close-btn:hover {
          background: #fee2e2;
          color: #ef4444;
          border-color: #fecaca;
        }

        /* Stats Pill Row */
        .drawer-stats-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding: 14px 24px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
        }

        .stat-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12.5px;
          font-weight: 600;
        }

        .pill-emerald {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }

        .pill-amber {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .pill-slate {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .pill-purple {
          background: #faf5ff;
          color: #7e22ce;
          border: 1px solid #e9d5ff;
        }

        /* Tabs Header */
        .drawer-tabs {
          display: flex;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          padding: 0 24px;
          gap: 8px;
        }

        .tab-btn {
          background: transparent;
          border: none;
          padding: 12px 16px;
          font-size: 13.5px;
          font-weight: 600;
          color: #64748b;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: all 0.15s;
        }

        .tab-btn:hover {
          color: #0f172a;
        }

        .tab-btn.active {
          color: #2563eb;
          border-bottom-color: #2563eb;
          background: #ffffff;
        }

        /* Drawer Body */
        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          background: #f8fafc;
        }

        /* Bin Location Card */
        .bin-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          transition: all 0.2s;
        }

        .bin-card:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
        }

        .bin-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #f1f5f9;
        }

        .compartment-chips-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 8px;
        }

        .compartment-chip {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 10px;
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .compartment-num {
          font-weight: 700;
          color: #1e293b;
        }

        .chip-serial {
          font-family: monospace;
          color: #475569;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Serials Table */
        .table-responsive {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }

        .serials-table th {
          background: #f8fafc;
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #475569;
          padding: 10px 14px;
          border-bottom: 1px solid #e2e8f0;
        }

        .serials-table td {
          font-size: 12.5px;
          padding: 10px 14px;
          vertical-align: middle;
          border-bottom: 1px solid #f1f5f9;
        }

        .serials-table tr:hover td {
          background: #f8fafc;
        }

        /* Status tags */
        .tag-pass {
          background: #ecfdf5;
          color: #059669;
          font-weight: 700;
          font-size: 10.5px;
          padding: 2px 7px;
          border-radius: 4px;
          border: 1px solid #a7f3d0;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .tag-fail {
          background: #fef2f2;
          color: #dc2626;
          font-weight: 700;
          font-size: 10.5px;
          padding: 2px 7px;
          border-radius: 4px;
          border: 1px solid #fecaca;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .tag-available {
          background: #eff6ff;
          color: #2563eb;
          font-weight: 600;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .tag-hold {
          background: #fffbeb;
          color: #d97706;
          font-weight: 600;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .tag-picked {
          background: #f1f5f9;
          color: #64748b;
          font-weight: 600;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
        }
      `}</style>

      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div>
            <div className="text-muted small fw-semibold text-uppercase mb-1" style={{ letterSpacing: '0.5px' }}>
              Material Inventory Master
            </div>
            <div className="d-flex align-items-center gap-2">
              <div className="model-badge">
                <Tag size={16} className="text-primary" />
                <span>{modelNumber}</span>
                <button
                  className="copy-btn"
                  onClick={() => modelNumber && copyToClipboard(modelNumber)}
                  title="Copy Model Number"
                >
                  {copiedModel ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            {onInitiatePick && modelNumber && (details?.available_count ?? 0) > 0 && (
              <button
                className="btn btn-sm btn-primary d-flex align-items-center gap-1 shadow-sm px-3"
                onClick={() => onInitiatePick(modelNumber)}
              >
                <PackageMinus size={14} />
                <span>Pick Material</span>
              </button>
            )}

            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={exportSerialsToExcel}
              title="Export Serials to Excel"
            >
              <FileSpreadsheet size={14} />
              <span className="d-none d-sm-inline">Export</span>
            </button>

            <button className="close-btn" onClick={onClose} title="Close (Esc)">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stats Pill Row */}
        <div className="drawer-stats-row">
          <span className="stat-pill pill-emerald">
            <CheckCircle2 size={13} />
            Available: <strong>{details?.available_count ?? 0}</strong>
          </span>
          <span className="stat-pill pill-amber">
            <AlertTriangle size={13} />
            On Hold: <strong>{details?.hold_count ?? 0}</strong>
          </span>
          <span className="stat-pill pill-slate">
            <PackageMinus size={13} />
            Dispatched: <strong>{details?.picked_count ?? 0}</strong>
          </span>
          <span className="stat-pill pill-purple">
            <Boxes size={13} />
            Active Bins: <strong>{details?.locations.length ?? 0}</strong>
          </span>
        </div>

        {/* Tabs Nav */}
        <div className="drawer-tabs">
          <button
            className={`tab-btn ${activeTab === 'LOCATIONS' ? 'active' : ''}`}
            onClick={() => setActiveTab('LOCATIONS')}
          >
            <Boxes size={15} />
            Kardex Storage Locations ({details?.locations.length ?? 0})
          </button>
          <button
            className={`tab-btn ${activeTab === 'SERIALS' ? 'active' : ''}`}
            onClick={() => setActiveTab('SERIALS')}
          >
            <Layers size={15} />
            Serialized Unit Ledger ({serialTotalItems || details?.total_count || 0})
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="drawer-body">
          {loading ? (
            <div className="py-5 text-center">
              <Loader message="Loading material inventory..." />
            </div>
          ) : activeTab === 'LOCATIONS' ? (
            /* TAB 1: LOCATIONS & COMPARTMENTS */
            <div>
              {details?.locations && details.locations.length > 0 ? (
                <div>
                  <p className="text-muted small mb-3">
                    Physical Handling Units and compartments currently holding stock for{' '}
                    <strong>{modelNumber}</strong>. Click any bin to inspect its visual compartment grid.
                  </p>

                  {details.locations.map((loc) => (
                    <div key={loc.hu_id} className="bin-card">
                      <div className="bin-header">
                        <div className="d-flex align-items-center gap-2">
                          <Boxes size={18} className="text-primary" />
                          <span className="fw-bold fs-6 text-dark">{loc.hu_id}</span>
                          <span className="badge bg-light text-dark border">
                            {loc.storage_status}
                          </span>
                          <span className="badge bg-light text-secondary border">
                            {loc.hu_status}
                          </span>
                        </div>

                        <Link
                          href={`/app/bins/${encodeURIComponent(loc.hu_id)}`}
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                        >
                          <span>Open Bin Grid</span>
                          <ArrowUpRight size={13} />
                        </Link>
                      </div>

                      <div className="mb-2 text-muted small fw-semibold">
                        Occupied Compartments ({loc.units.length} unit{loc.units.length > 1 ? 's' : ''}):
                      </div>

                      <div className="compartment-chips-grid">
                        {loc.units.map((u, i) => (
                          <div key={i} className="compartment-chip">
                            <div className="d-flex justify-content-between align-items-center">
                              <span className="compartment-num">
                                Slot #{u.compartment_number}
                              </span>
                              <span
                                className={
                                  u.pv_status === 'PASS' ? 'tag-pass' : 'tag-fail'
                                }
                              >
                                {u.pv_status || 'N/A'}
                              </span>
                            </div>
                            <div className="chip-serial">
                              <span>{u.serial_number}</span>
                              <button
                                className="copy-btn"
                                onClick={() => copyToClipboard(u.serial_number, true)}
                                title="Copy Serial"
                              >
                                {copiedSerial === u.serial_number ? (
                                  <Check size={11} className="text-success" />
                                ) : (
                                  <Copy size={11} />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5 bg-white rounded border p-4">
                  <Boxes size={40} className="text-muted mb-2" />
                  <h6 className="fw-bold text-dark">No Active Bin Allocations</h6>
                  <p className="text-muted small mb-0">
                    All units for this material have either been picked or are pending put allocation.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* TAB 2: SERIALIZED UNIT LEDGER */
            <div>
              {/* Filter / Search Bar */}
              <div className="d-flex flex-wrap gap-2 mb-3">
                <div className="input-group input-group-sm" style={{ maxWidth: '280px' }}>
                  <span className="input-group-text bg-white border-end-0">
                    <Search size={13} className="text-muted" />
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0"
                    placeholder="Search serial barcode..."
                    value={serialSearch}
                    onChange={(e) => setSerialSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchSerials(1)}
                  />
                </div>

                <select
                  className="form-select form-select-sm"
                  style={{ width: '150px' }}
                  value={serialStatusFilter}
                  onChange={(e) => {
                    setSerialStatusFilter(e.target.value);
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="HOLD">On Hold</option>
                  <option value="PICKED">Picked</option>
                </select>

                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => fetchSerials(1)}
                >
                  Filter
                </button>
              </div>

              {serialsLoading ? (
                <div className="py-4 text-center">
                  <Loader message="Loading serial ledger..." />
                </div>
              ) : serials.length > 0 ? (
                <div>
                  <div className="table-responsive">
                    <table className="table serials-table mb-0">
                      <thead>
                        <tr>
                          <th>Serial Barcode</th>
                          <th>PV Check</th>
                          <th>Status</th>
                          <th>Storage Location</th>
                          <th>Scanned At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serials.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <span className="font-monospace fw-semibold text-dark">
                                  {s.serial_number}
                                </span>
                                <button
                                  className="copy-btn"
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
                            <td>
                              {s.pv_status === 'PASS' ? (
                                <span className="tag-pass">
                                  <ShieldCheck size={11} /> PASS
                                </span>
                              ) : (
                                <span className="tag-fail">
                                  <ShieldAlert size={11} /> {s.pv_status || 'FAIL'}
                                </span>
                              )}
                            </td>
                            <td>
                              <span
                                className={
                                  s.pick_status === 'AVAILABLE'
                                    ? 'tag-available'
                                    : s.pick_status === 'HOLD'
                                    ? 'tag-hold'
                                    : 'tag-picked'
                                }
                              >
                                {s.pick_status}
                              </span>
                            </td>
                            <td>
                              {s.hu_id ? (
                                <Link
                                  href={`/app/bins/${encodeURIComponent(s.hu_id)}`}
                                  className="text-decoration-none fw-semibold text-primary"
                                >
                                  {s.hu_id} {s.compartment_number ? `(#${s.compartment_number})` : ''}
                                </Link>
                              ) : (
                                <span className="text-muted">Unassigned</span>
                              )}
                            </td>
                            <td className="text-muted font-monospace small">
                              {s.scanned_at ? new Date(s.scanned_at).toLocaleString() : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3">
                    <Pagination
                      currentPage={serialPage}
                      totalPages={serialTotalPages}
                      totalItems={serialTotalItems}
                      pageSize={15}
                      onPageChange={(p) => fetchSerials(p)}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-5 bg-white rounded border p-4">
                  <Layers size={36} className="text-muted mb-2" />
                  <h6 className="fw-bold text-dark">No Serial Units Found</h6>
                  <p className="text-muted small mb-0">
                    No serialized records match your current search/filter.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

