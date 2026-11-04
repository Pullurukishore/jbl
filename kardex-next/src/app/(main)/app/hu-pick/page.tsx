'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { apiGet, apiPost } from '@/lib/api';
import { HandlingUnit } from '@/types/hu';
import { Put, PaginatedResponse } from '@/types';
import { HUPickModal } from '@/components/bins/HUPickModal';
import { SendToKardexModal } from '@/components/bins/SendToKardexModal';
import { ScanPickModal } from '@/components/bins/ScanPickModal';
import { HUStatusBadge } from '@/components/bins/HUStatusBadge';
import { StorageStatusBadge } from '@/components/bins/StorageStatusBadge';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  PackageSearch,
  Package,
  PackageMinus,
  ArrowRight,
  RefreshCw,
  Search,
  Boxes,
  Minus,
  Plus,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Zap,
  Layers,
  Barcode,
  Eye,
  Inbox,
  Filter,
  Send,
} from 'lucide-react';

type FilterTab = 'ALL_IN_KARDEX' | 'PARTIAL' | 'FULL' | 'EMPTY' | 'OUTSIDE_KARDEX' | 'BY_MODEL';

export default function HUPickPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL_IN_KARDEX');
  const [inKardexHUs, setInKardexHUs] = useState<HandlingUnit[]>([]);
  const [outsideHUs, setOutsideHUs] = useState<HandlingUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [huPickTarget, setHuPickTarget] = useState<HandlingUnit | null>(null);
  const [sendToKardexTarget, setSendToKardexTarget] = useState<HandlingUnit | null>(null);
  const [scanPickTarget, setScanPickTarget] = useState<HandlingUnit | null>(null);

  // Model search state
  const [searchModel, setSearchModel] = useState('');
  const [modelPuts, setModelPuts] = useState<Put[]>([]);
  const [searchingModel, setSearchingModel] = useState(false);
  const [modelSearchError, setModelSearchError] = useState('');

  const fetchHUs = useCallback(async () => {
    try {
      setLoading(true);
      const [inKardexRes, outsideRes] = await Promise.all([
        apiGet<HandlingUnit[]>('/hu/in-kardex').catch(() => []),
        apiPost<{ data: HandlingUnit[] }>('/hu/list', { storage_status: 'OUTSIDE_KARDEX', size: 100 }).catch(() => ({ data: [] })),
      ]);
      setInKardexHUs(inKardexRes || []);
      setOutsideHUs(outsideRes?.data || []);
    } catch {
      setInKardexHUs([]);
      setOutsideHUs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHUs();
  }, [fetchHUs]);

  // Derived counts
  const fullCount = useMemo(
    () => inKardexHUs.filter((b) => b.hu_status === 'FULL').length,
    [inKardexHUs]
  );
  const partialCount = useMemo(
    () => inKardexHUs.filter((b) => b.hu_status === 'PARTIALLY_FILLED').length,
    [inKardexHUs]
  );
  const emptyCount = useMemo(
    () => inKardexHUs.filter((b) => b.hu_status === 'EMPTY').length,
    [inKardexHUs]
  );
  const outsideCount = outsideHUs.length;

  // Filtered bins based on activeTab and searchTerm
  const filteredBins = useMemo(() => {
    let list: HandlingUnit[] = [];
    if (activeTab === 'ALL_IN_KARDEX') {
      list = inKardexHUs;
    } else if (activeTab === 'FULL') {
      list = inKardexHUs.filter((b) => b.hu_status === 'FULL');
    } else if (activeTab === 'PARTIAL') {
      list = inKardexHUs.filter((b) => b.hu_status === 'PARTIALLY_FILLED');
    } else if (activeTab === 'EMPTY') {
      list = inKardexHUs.filter((b) => b.hu_status === 'EMPTY');
    } else if (activeTab === 'OUTSIDE_KARDEX') {
      list = outsideHUs;
    }

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase().trim();
    return list.filter((b) => {
      const matchId = b.hu_id.toLowerCase().includes(q);
      const matchName = b.bin_type?.name?.toLowerCase().includes(q);
      const matchPps = b.bin_type?.bin_name?.toLowerCase().includes(q);
      const matchModel = (b.compartments || []).some(
        (c) => c.material_name?.toLowerCase().includes(q) || c.serial_number?.toLowerCase().includes(q)
      );
      return matchId || matchName || matchPps || matchModel;
    });
  }, [activeTab, inKardexHUs, outsideHUs, searchTerm]);

  // Search by Model: Group matching serials by Handling Unit
  const handleSearchByModel = async () => {
    if (!searchModel.trim()) return;
    try {
      setSearchingModel(true);
      setModelSearchError('');
      const res = await apiPost<PaginatedResponse<Put>>('/put/find-by-model-and-qty', {
        partNumber: searchModel.trim(),
        quantity: 100,
        page: 1,
        size: 100,
      });
      setModelPuts(res.data || []);
      if (!res.data || res.data.length === 0) {
        setModelSearchError(`No stored inventory found for model "${searchModel.trim()}".`);
      }
    } catch (err: any) {
      setModelSearchError(err.message || 'Error looking up inventory');
      setModelPuts([]);
    } finally {
      setSearchingModel(false);
    }
  };

  // Group puts by handling unit
  const modelBinsMap = useMemo(() => {
    const map = new Map<string, { count: number; serials: string[]; bin: HandlingUnit | null }>();
    modelPuts.forEach((p) => {
      const anyPut = p as any;
      const binId = anyPut.handling_unit?.hu_id || (anyPut.handling_unit_id ? `HU #${anyPut.handling_unit_id}` : 'Unassigned');
      const existing = map.get(binId) || {
        count: 0,
        serials: [],
        bin: inKardexHUs.find((h) => h.hu_id === binId || h.id === anyPut.handling_unit_id) || null,
      };
      existing.count++;
      existing.serials.push(p.serial_number);
      map.set(binId, existing);
    });
    return map;
  }, [modelPuts, inKardexHUs]);

  return (
    <div className="hu-pick-page">
      <style jsx>{`
        .hu-pick-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        .header-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.5rem 1.75rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          color: #b45309;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #fcd34d;
          box-shadow: 0 2px 4px rgba(245, 158, 11, 0.15);
        }

        .header-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .header-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 2px 0 0 0;
        }

        /* 5 Metric Filter Cards */
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          width: 100%;
        }

        .metric-card {
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          user-select: none;
        }

        .metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
          border-color: #cbd5e1;
        }

        .metric-card.active {
          border-color: #f59e0b;
          background: linear-gradient(180deg, #ffffff 0%, #fffbeb 100%);
          box-shadow: 0 4px 14px rgba(245, 158, 11, 0.15);
        }

        .metric-meta {
          display: flex;
          flex-direction: column;
        }

        .metric-label {
          font-size: 11.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
        }

        .metric-value {
          font-size: 26px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.2;
          margin-top: 2px;
        }

        .metric-card.active .metric-value {
          color: #b45309;
        }

        .metric-sub {
          font-size: 11px;
          color: #94a3b8;
        }

        .metric-icon-box {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Filter Tab Bar */
        .filter-nav-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .tab-pill-group {
          display: flex;
          gap: 6px;
          background: #f1f5f9;
          padding: 4px;
          border-radius: 12px;
          flex-wrap: wrap;
        }

        .tab-btn {
          padding: 7px 16px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          border: none;
          background: transparent;
          border-radius: 9px;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }

        .tab-btn:hover {
          color: #0f172a;
        }

        .tab-btn.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          font-weight: 700;
        }

        .tab-counter {
          font-size: 11px;
          font-weight: 700;
          padding: 1px 7px;
          border-radius: 9999px;
          background: #e2e8f0;
          color: #475569;
        }

        .tab-btn.active .tab-counter {
          background: #fef3c7;
          color: #92400e;
        }

        .search-box-wrap {
          position: relative;
          min-width: 260px;
        }

        .search-input {
          width: 100%;
          padding: 7px 12px 7px 34px;
          font-size: 13px;
          border-radius: 9px;
          border: 1px solid #cbd5e1;
          outline: none;
          background: #ffffff;
        }

        .search-input:focus {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
        }

        /* Content Card */
        .content-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .table th {
          font-size: 11.5px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background-color: #f8fafc;
          border-color: #e2e8f0;
          padding: 12px 14px;
        }

        .table td {
          font-size: 13px;
          vertical-align: middle;
          border-color: #f1f5f9;
          padding: 12px 14px;
        }

        .hu-id-mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-weight: 800;
          font-size: 13.5px;
          color: #b45309;
        }

        .mini-progress-track {
          width: 110px;
          height: 6px;
          background: #e2e8f0;
          border-radius: 9999px;
          overflow: hidden;
          margin-top: 4px;
        }

        .mini-progress-fill {
          height: 100%;
          border-radius: 9999px;
          background: linear-gradient(90deg, #f59e0b 0%, #10b981 100%);
        }

        .btn-retrieve-hu {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: #ffffff;
          border: none;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);
          transition: all 0.15s ease;
        }

        .btn-retrieve-hu:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(245, 158, 11, 0.4);
          color: #ffffff;
        }
      `}</style>

      {/* Hero Header */}
      <div className="header-card">
        <div className="header-left">
          <div className="header-icon-box">
            <PackageSearch size={24} />
          </div>
          <div>
            <h1 className="header-title">Handling Unit PICK Management</h1>
            <p className="header-subtitle">
              Retrieve carrier handling units from Kardex PPS storage to the floor, or inspect stored bins.
            </p>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-outline-secondary d-flex align-items-center gap-1"
            onClick={fetchHUs}
            disabled={loading}
            title="Refresh stored inventory"
            style={{ fontSize: '13px', padding: '7px 14px', borderRadius: '8px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* 5 Clickable Metric Filter Cards */}
      <div className="metrics-grid">
        <div
          className={`metric-card ${activeTab === 'ALL_IN_KARDEX' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL_IN_KARDEX')}
        >
          <div className="metric-meta">
            <span className="metric-label">In Kardex Storage</span>
            <span className="metric-value">{inKardexHUs.length}</span>
            <span className="metric-sub">Total stored trays</span>
          </div>
          <div className="metric-icon-box" style={{ background: '#fef3c7', color: '#b45309' }}>
            <Boxes size={20} />
          </div>
        </div>

        <div
          className={`metric-card ${activeTab === 'PARTIAL' ? 'active' : ''}`}
          onClick={() => setActiveTab('PARTIAL')}
        >
          <div className="metric-meta">
            <span className="metric-label">Partially Filled</span>
            <span className="metric-value" style={{ color: '#0284c7' }}>
              {partialCount}
            </span>
            <span className="metric-sub">Ready to pick or top up</span>
          </div>
          <div className="metric-icon-box" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <Layers size={20} />
          </div>
        </div>

        <div
          className={`metric-card ${activeTab === 'FULL' ? 'active' : ''}`}
          onClick={() => setActiveTab('FULL')}
        >
          <div className="metric-meta">
            <span className="metric-label">Full Capacity Bins</span>
            <span className="metric-value" style={{ color: '#16a34a' }}>
              {fullCount}
            </span>
            <span className="metric-sub">100% Loaded carrier bins</span>
          </div>
          <div className="metric-icon-box" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div
          className={`metric-card ${activeTab === 'EMPTY' ? 'active' : ''}`}
          onClick={() => setActiveTab('EMPTY')}
        >
          <div className="metric-meta">
            <span className="metric-label">Empty Bins in Kardex</span>
            <span className="metric-value" style={{ color: '#64748b' }}>
              {emptyCount}
            </span>
            <span className="metric-sub">Ready to retrieve for PUT</span>
          </div>
          <div className="metric-icon-box" style={{ background: '#f1f5f9', color: '#64748b' }}>
            <Package size={20} />
          </div>
        </div>

        <div
          className={`metric-card ${activeTab === 'OUTSIDE_KARDEX' ? 'active' : ''}`}
          onClick={() => setActiveTab('OUTSIDE_KARDEX')}
        >
          <div className="metric-meta">
            <span className="metric-label">Retrieved to Floor</span>
            <span className="metric-value" style={{ color: '#ea580c' }}>
              {outsideCount}
            </span>
            <span className="metric-sub">At workstation / unload</span>
          </div>
          <div className="metric-icon-box" style={{ background: '#ffedd5', color: '#ea580c' }}>
            <Inbox size={20} />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="filter-nav-bar">
        <div className="tab-pill-group">
          <button
            className={`tab-btn ${activeTab === 'ALL_IN_KARDEX' ? 'active' : ''}`}
            onClick={() => setActiveTab('ALL_IN_KARDEX')}
          >
            <Boxes size={15} /> All In Kardex
            <span className="tab-counter">{inKardexHUs.length}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'PARTIAL' ? 'active' : ''}`}
            onClick={() => setActiveTab('PARTIAL')}
          >
            <Layers size={15} /> Partial Bins
            <span className="tab-counter">{partialCount}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'FULL' ? 'active' : ''}`}
            onClick={() => setActiveTab('FULL')}
          >
            <CheckCircle2 size={15} /> Full Bins
            <span className="tab-counter">{fullCount}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'EMPTY' ? 'active' : ''}`}
            onClick={() => setActiveTab('EMPTY')}
          >
            <Package size={15} /> Empty Bins
            <span className="tab-counter">{emptyCount}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'OUTSIDE_KARDEX' ? 'active' : ''}`}
            onClick={() => setActiveTab('OUTSIDE_KARDEX')}
          >
            <Inbox size={15} /> Retrieved on Floor
            <span className="tab-counter">{outsideCount}</span>
          </button>

          <button
            className={`tab-btn ${activeTab === 'BY_MODEL' ? 'active' : ''}`}
            onClick={() => setActiveTab('BY_MODEL')}
          >
            <Search size={15} /> Find Bin by Model
          </button>
        </div>

        {activeTab !== 'BY_MODEL' && (
          <div className="search-box-wrap">
            <Search
              size={15}
              className="position-absolute"
              style={{ left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
            />
            <input
              type="text"
              className="search-input"
              placeholder="Filter by HU ID, PPS bin, or model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Main Tab Views */}
      {activeTab !== 'BY_MODEL' ? (
        <div className="content-card">
          {loading ? (
            <div className="text-center py-5">
              <Loader />
            </div>
          ) : filteredBins.length === 0 ? (
            <EmptyState
              title="No Handling Units Found"
              description={
                searchTerm
                  ? `No handling units match your search "${searchTerm}".`
                  : activeTab === 'OUTSIDE_KARDEX'
                  ? 'No handling units are currently retrieved to the floor.'
                  : 'No handling units match this category in Kardex storage.'
              }
            />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Handling Unit ID</th>
                    <th>Bin Type</th>
                    <th>PPS Shuttle Location</th>
                    <th>Capacity / Fill Status</th>
                    <th>Contained Part Models</th>
                    <th>Storage Status</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBins.map((bin) => {
                    const compartments = bin.compartments || [];
                    const occupiedCount = compartments.filter((c) => c.status === 'OCCUPIED').length;
                    const totalSlots = compartments.length || bin.bin_type?.compartment_count || 15;
                    const fillPct = Math.round((occupiedCount / totalSlots) * 100);

                    // Extract unique models
                    const models = Array.from(
                      new Set(
                        compartments
                          .map((c) => c.material_name)
                          .filter((m): m is string => Boolean(m))
                      )
                    );

                    return (
                      <tr key={bin.id}>
                        <td>
                          <span className="hu-id-mono">{bin.hu_id}</span>
                        </td>
                        <td>
                          <div className="fw-semibold text-dark">{bin.bin_type?.name || 'Standard Bin'}</div>
                          <small className="text-muted">{totalSlots} Compartments</small>
                        </td>
                        <td>
                          <span
                            className="badge bg-light text-dark border font-monospace"
                            style={{ fontSize: '12px' }}
                          >
                            <Barcode size={11} className="me-1 text-secondary" />
                            {bin.bin_type?.bin_name || 'CON_BINA'}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <span className="fw-bold" style={{ fontSize: '13px' }}>
                              {occupiedCount} / {totalSlots}
                            </span>
                            <span className="text-muted" style={{ fontSize: '12px' }}>
                              ({fillPct}%)
                            </span>
                          </div>
                          <div className="mini-progress-track">
                            <div className="mini-progress-fill" style={{ width: `${fillPct}%` }} />
                          </div>
                        </td>
                        <td>
                          {models.length === 0 ? (
                            <span className="text-muted" style={{ fontSize: '12px' }}>
                              Empty (No parts)
                            </span>
                          ) : (
                            <div className="d-flex flex-wrap gap-1">
                              {models.slice(0, 2).map((m, idx) => (
                                <span
                                  key={idx}
                                  className="badge bg-light text-primary border font-monospace"
                                  style={{ fontSize: '11px' }}
                                >
                                  {m}
                                </span>
                              ))}
                              {models.length > 2 && (
                                <span className="badge bg-secondary" style={{ fontSize: '10px' }}>
                                  +{models.length - 2} more
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="d-flex flex-column gap-1">
                            <StorageStatusBadge status={bin.storage_status} />
                            <HUStatusBadge status={bin.hu_status} />
                          </div>
                        </td>
                        <td className="text-end">
                          <div className="d-inline-flex align-items-center gap-2">
                            {bin.storage_status === 'IN_KARDEX' ? (
                              <button
                                className="btn-retrieve-hu"
                                onClick={() => setHuPickTarget(bin)}
                                title="Generate HU_PICK file to retrieve carrier tray from Kardex"
                              >
                                <PackageSearch size={14} /> Retrieve from Kardex
                              </button>
                            ) : (
                              <>
                                {occupiedCount > 0 && (
                                  <>
                                    <button
                                      className="btn btn-sm btn-warning text-dark d-inline-flex align-items-center gap-1 fw-bold"
                                      style={{ borderRadius: '7px' }}
                                      onClick={() => setScanPickTarget(bin)}
                                      title="Scan and validate parts one-by-one from this bin"
                                    >
                                      <PackageMinus size={13} /> Scan & Pick
                                    </button>

                                    <button
                                      className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 fw-semibold"
                                      style={{ borderRadius: '7px' }}
                                      onClick={() => setSendToKardexTarget(bin)}
                                      title="Send bin back to Kardex PPS storage"
                                    >
                                      <Send size={13} /> Send to Kardex
                                    </button>
                                  </>
                                )}
                                <Link
                                  href={`/app/bins/${encodeURIComponent(bin.hu_id)}`}
                                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 fw-semibold"
                                  style={{ borderRadius: '7px' }}
                                >
                                  <Eye size={13} /> View Bin
                                </Link>
                              </>
                            )}

                            <Link
                              href={`/app/bins/${encodeURIComponent(bin.hu_id)}`}
                              className="btn btn-sm btn-light border text-muted"
                              title="View Bin Detail"
                              style={{ borderRadius: '7px', padding: '5px 8px' }}
                            >
                              <ArrowRight size={13} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ───────────────────────────────────────────────────────────── */
        /* TAB: Find Stored Bin by Model Number                           */
        /* ───────────────────────────────────────────────────────────── */
        <div className="content-card">
          <div className="mb-4 pb-3 border-bottom">
            <h5 className="fw-bold text-dark mb-1 d-flex align-items-center gap-2">
              <Search size={18} className="text-warning" />
              Find Kardex Handling Unit by Model Number
            </h5>
            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
              Locate which handling unit carrier tray contains the model you need, then retrieve the entire bin with 1 click.
            </p>
          </div>

          <div className="row g-3 align-items-end mb-4">
            <div className="col-12 col-md-6">
              <label className="form-label fw-bold" style={{ fontSize: '12px', color: '#475569' }}>
                ENTER MODEL NUMBER / PART NUMBER
              </label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <Search size={15} className="text-muted" />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 font-monospace"
                  placeholder="e.g. SFG001970..."
                  value={searchModel}
                  onChange={(e) => setSearchModel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchByModel()}
                  style={{ fontSize: '13.5px', fontWeight: 600 }}
                />
              </div>
            </div>

            <div className="col-12 col-md-3">
              <button
                type="button"
                className="btn btn-warning w-100 fw-bold text-dark d-flex align-items-center justify-content-center gap-2"
                onClick={handleSearchByModel}
                disabled={searchingModel || !searchModel.trim()}
                style={{ height: '42px' }}
              >
                {searchingModel ? <RefreshCw size={15} className="spin-animation" /> : <Search size={15} />}
                {searchingModel ? 'Searching Kardex...' : 'Find Handling Units'}
              </button>
            </div>
          </div>

          {modelSearchError && (
            <div className="alert alert-warning py-2 px-3 d-flex align-items-center gap-2 mb-3" style={{ fontSize: '13px' }}>
              <AlertCircle size={16} />
              <span>{modelSearchError}</span>
            </div>
          )}

          {modelPuts.length > 0 && (
            <div>
              <h6 className="fw-bold text-dark mb-3">
                Found {modelPuts.length} parts across {modelBinsMap.size} Handling Unit carrier(s):
              </h6>

              <div className="row g-3">
                {Array.from(modelBinsMap.entries()).map(([binId, item]) => {
                  const targetBin = item.bin;
                  return (
                    <div key={binId} className="col-12 col-md-6 col-lg-4">
                      <div className="card shadow-sm border p-3 h-100 d-flex flex-column justify-content-between">
                        <div>
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="hu-id-mono fs-5">{binId}</span>
                            <span className="badge bg-success-subtle text-success fw-bold" style={{ fontSize: '11.5px' }}>
                              {item.count} Units Available
                            </span>
                          </div>

                          <div className="text-muted mb-2" style={{ fontSize: '12.5px' }}>
                            PPS Location: <strong>{targetBin?.bin_type?.bin_name || 'Kardex PPS'}</strong>
                          </div>

                          <div className="small text-muted mb-3 font-monospace" style={{ fontSize: '11px', maxHeight: '55px', overflowY: 'auto' }}>
                            Serials: {item.serials.slice(0, 3).join(', ')}
                            {item.serials.length > 3 ? ` +${item.serials.length - 3} more` : ''}
                          </div>
                        </div>

                        <div>
                          {targetBin ? (
                            targetBin.storage_status === 'IN_KARDEX' ? (
                              <button
                                className="btn-retrieve-hu w-100 justify-content-center"
                                onClick={() => setHuPickTarget(targetBin)}
                              >
                                <PackageSearch size={15} /> Retrieve Bin {targetBin.hu_id}
                              </button>
                            ) : (
                              <div className="d-flex gap-2">
                                <button
                                  className="btn btn-sm btn-outline-success flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1 fw-bold"
                                  onClick={() => setSendToKardexTarget(targetBin)}
                                >
                                  <Send size={14} /> Send to Kardex
                                </button>
                                <Link
                                  href={`/app/bins/${encodeURIComponent(targetBin.hu_id)}`}
                                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 fw-semibold"
                                >
                                  <Eye size={14} /> View
                                </Link>
                              </div>
                            )
                          ) : (
                            <Link
                              href="/app/bins"
                              className="btn btn-sm btn-outline-secondary w-100"
                            >
                              View in Handling Units
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* HU Pick Execution Modal (Generates HU_PICK_<huId>_<timestamp>.txt) */}
      {huPickTarget && (
        <HUPickModal
          isOpen={!!huPickTarget}
          onClose={() => setHuPickTarget(null)}
          onSuccess={() => {
            setHuPickTarget(null);
            fetchHUs();
          }}
          hu={huPickTarget}
        />
      )}

      {/* Send to Kardex PPS Modal */}
      {sendToKardexTarget && (
        <SendToKardexModal
          isOpen={!!sendToKardexTarget}
          onClose={() => setSendToKardexTarget(null)}
          onSuccess={() => {
            setSendToKardexTarget(null);
            fetchHUs();
          }}
          hu={sendToKardexTarget}
        />
      )}

      {/* Scan & Pick Modal for One-by-One Validation */}
      {scanPickTarget && (
        <ScanPickModal
          isOpen={!!scanPickTarget}
          onClose={() => setScanPickTarget(null)}
          onSuccess={() => {
            fetchHUs();
          }}
          hu={scanPickTarget}
        />
      )}
    </div>
  );
}
