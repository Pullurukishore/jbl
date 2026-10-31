'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { ViewLogsModal } from '@/components/dashboard/ViewLogsModal';
import { PartScanLogsModal } from '@/components/dashboard/PartScanLogsModal';
import { ScanModal } from '@/components/dashboard/ScanModal';
import { ScanAndStoreModal } from '@/components/dashboard/ScanAndStoreModal';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { Pagination } from '@/components/shared/Pagination';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import { apiPost, apiDownloadFile, downloadBlob } from '@/lib/api';
import { DashboardCounts, Put, PaginatedResponse } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Calendar, Search, FileText, Download, PackagePlus, PackageMinus, Copy, Check, Scan, Package, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function DashboardPage() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);

  const [puts, setPuts] = useState<Put[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedSerial, setCopiedSerial] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Modals
  const [isPutModalOpen, setIsPutModalOpen] = useState(false);
  const [isPickModalOpen, setIsPickModalOpen] = useState(false);
  const [viewLogPutId, setViewLogPutId] = useState<number | null>(null);
  const [viewLogPickId, setViewLogPickId] = useState<number | null>(null);
  const [isViewLogModalOpen, setIsViewLogModalOpen] = useState(false);
  const [partLogSerial, setPartLogSerial] = useState<string | undefined>(undefined);
  const [isPartLogModalOpen, setIsPartLogModalOpen] = useState(false);

  // Fetch Counts
  const fetchCounts = useCallback(async () => {
    try {
      setCountsLoading(true);
      const res = await apiPost<DashboardCounts>('/dashboard/get-all-counts', {
        startDate: startDate ? startDate.toISOString() : new Date('2000-01-01').toISOString(),
        endDate: endDate ? endDate.toISOString() : new Date().toISOString(),
      });
      setCounts(res);
    } catch {
      setCounts(null);
    } finally {
      setCountsLoading(false);
    }
  }, [startDate, endDate]);

  // Fetch Puts
  const fetchPuts = useCallback(
    async (pageNum = 1, currentSize = pageSize) => {
      try {
        setTableLoading(true);
        const res = await apiPost<PaginatedResponse<Put>>('/put/search-all', {
          search,
          page: pageNum,
          size: currentSize,
          sort: ['id', 'DESC'],
          startDate: startDate ? startDate.toISOString() : undefined,
          endDate: endDate ? endDate.toISOString() : undefined,
        });
        setPuts(res.data || []);
        setTotalPages(res.totalPages || 1);
        setTotalItems(res.totalItems || 0);
        setPage(res.page || 1);
      } catch {
        setPuts([]);
      } finally {
        setTableLoading(false);
      }
    },
    [search, startDate, endDate, pageSize]
  );

  useEffect(() => {
    fetchCounts();
    fetchPuts(1);
  }, [fetchCounts, fetchPuts]);

  const handleDownloadPutFile = async (putId: number) => {
    try {
      const { blob, fileName } = await apiDownloadFile('/put/download-text-file', { id: putId });
      downloadBlob(blob, fileName);
      fetchPuts(page);
    } catch (err: any) {
      alert(err.message || 'Error downloading PUT file');
    }
  };

  const handleDownloadPickFile = async (pickId: number) => {
    try {
      const { blob, fileName } = await apiDownloadFile('/pick/download-text-file', { id: pickId });
      downloadBlob(blob, fileName);
      fetchPuts(page);
    } catch (err: any) {
      alert(err.message || 'Error downloading PICK file');
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await apiPost<PaginatedResponse<Put>>('/put/search-all', {
        search,
        isExport: true,
        startDate: startDate ? startDate.toISOString() : undefined,
        endDate: endDate ? endDate.toISOString() : undefined,
      });

      const exportData = (res.data || []).map((p) => ({
        'Serial Number': p.serial_number,
        'PV Status': p.pv_status || '-',
        'Process Status': p.process_status || '-',
        'PO File': p.put_po_file?.name || '-',
        'Model Number': p.model_number,
        'Scanned By': p.user_first_name ? `${p.user_first_name} ${p.user_last_name || ''}` : p.scanned_by,
        'PUT File': p.put_text_file?.name || '-',
        'Pick Status': p.pick_status,
        'Pick File': p.pick?.pick_text_file?.name || '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Kardex Inventory');
      XLSX.writeFile(workbook, `Kardex_Inventory_${Date.now()}.xlsx`);
    } catch {
      alert('Error exporting Excel file');
    }
  };

  const totalPartsCount = counts
    ? (counts.totalPartsCount && counts.totalPartsCount === ((counts.availablePartsCount || 0) + (counts.pickedPartsCount || 0) + (counts.holdPartsCount || 0))
      ? counts.totalPartsCount
      : ((counts.availablePartsCount || 0) + (counts.pickedPartsCount || 0) + (counts.holdPartsCount || 0)))
    : 0;

  const validScans = counts?.validScanCount || 0;
  const invalidScans = counts?.invalidScanCount || 0;
  const totalScans = validScans + invalidScans;
  const passRate = totalScans > 0 ? Math.round((validScans / totalScans) * 100) : 100;

  const pickedParts = counts?.pickedPartsCount || 0;
  const availableParts = counts?.availablePartsCount || 0;
  const holdParts = counts?.holdPartsCount || 0;
  const totalInventory = totalPartsCount || (pickedParts + availableParts + holdParts);
  const pickedPct = totalInventory > 0 ? Math.round((pickedParts / totalInventory) * 100) : 0;
  const availPct = totalInventory > 0 ? Math.round((availableParts / totalInventory) * 100) : 0;
  const holdPct = totalInventory > 0 ? Math.round((holdParts / totalInventory) * 100) : 0;

  const pieData = [
    { name: 'Valid Scans', value: validScans, color: '#16a34a' },
    { name: 'Invalid Scans', value: invalidScans, color: '#ef4444' },
  ];

  return (
    <div className="dashboard-wrapper">
      <style jsx>{`
        .stat-metric-card {
          background-color: #fff;
          border-radius: 8px;
          border: 1.5px solid #d0d5dd;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 3px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.03);
          min-height: 102px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .stat-metric-card:hover {
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08), 0 6px 16px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
          transform: translateY(-1px);
        }
        .stat-metric-card small {
          font-weight: 600;
          color: #64748b;
          font-size: 13px;
        }
        .stat-icon-pill {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .bg-sky-light {
          background-color: #e0f2fe;
          color: #0284c7;
        }
        .bg-emerald-light {
          background-color: #ecfdf5;
          color: #059669;
        }
        .bg-amber-light {
          background-color: #fef3c7;
          color: #d97706;
        }
        .map-card {
          background-image: url('/assets/images/dashboard-matched-map.jpg');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          border-radius: 8px;
          background-color: #ffffff;
        }
        .bottom-stat {
          border-top: 1px solid #e9ecef;
          padding-top: 10px;
        }
        .border-r {
          border-right: 1px solid #e9ecef;
        }
        .scan-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 6px 14px 6px 8px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          color: #ffffff;
          user-select: none;
        }
        .scan-action-btn:active {
          transform: scale(0.98);
        }
        .scan-btn-put {
          background: linear-gradient(135deg, #091e3a 0%, #0f172a 100%);
          border: 1px solid rgba(56, 189, 248, 0.28);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(56, 189, 248, 0.08);
        }
        .scan-btn-put:hover {
          background: linear-gradient(135deg, #0c274c 0%, #172554 100%);
          border-color: rgba(56, 189, 248, 0.55);
          box-shadow: 0 4px 14px -1px rgba(56, 189, 248, 0.28);
          transform: translateY(-1px);
        }
        .scan-btn-pick {
          background: linear-gradient(135deg, #241804 0%, #0f172a 100%);
          border: 1px solid rgba(245, 158, 11, 0.28);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(245, 158, 11, 0.08);
        }
        .scan-btn-pick:hover {
          background: linear-gradient(135deg, #382404 0%, #1e1b15 100%);
          border-color: rgba(245, 158, 11, 0.55);
          box-shadow: 0 4px 14px -1px rgba(245, 158, 11, 0.28);
          transform: translateY(-1px);
        }
        .scan-icon-pill {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .put-pill {
          background: rgba(56, 189, 248, 0.16);
          color: #38bdf8;
          border: 1px solid rgba(56, 189, 248, 0.25);
        }
        .pick-pill {
          background: rgba(245, 158, 11, 0.16);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }
        .scan-btn-title {
          color: #f8fafc;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .scan-type-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 9999px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
        }
        .put-badge {
          background: rgba(56, 189, 248, 0.18);
          color: #7dd3fc;
          border: 1px solid rgba(56, 189, 248, 0.35);
        }
        .pick-badge {
          background: rgba(245, 158, 11, 0.18);
          color: #fcd34d;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }
        .table-card {
          background: #ffffff;
          border-radius: 8px;
          border: 1.5px solid #d0d5dd;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 3px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.03);
          padding: 20px;
        }
        .table th {
          font-size: 13px;
          font-weight: 600;
          color: #495057;
          background-color: #f8f9fa;
          border-color: #d0d5dd;
        }
        .table td {
          font-size: 13px;
          vertical-align: middle;
          border-color: #d0d5dd;
        }
        .table {
          border-color: #d0d5dd;
        }
        .table-bordered {
          border: 1.5px solid #d0d5dd;
        }
        .table-bordered th,
        .table-bordered td {
          border: 1px solid #d0d5dd;
        }
        .btn-link-custom {
          color: #0d6efd;
          text-decoration: underline;
          cursor: pointer;
          font-weight: 600;
        }
      `}</style>

      {/* Top Action Header */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-3">
        <DateRangePicker
          initialStartDate={startDate}
          initialEndDate={endDate}
          onApply={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
          onClear={() => {
            setStartDate(null);
            setEndDate(null);
          }}
        />

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="scan-action-btn scan-btn-put"
            onClick={() => setIsPutModalOpen(true)}
          >
            <div className="scan-icon-pill put-pill">
              <PackagePlus size={16} />
            </div>
            <span className="scan-btn-title">Scan Part Number</span>
            <span className="scan-type-badge put-badge">PUT</span>
          </button>

          <button
            type="button"
            className="scan-action-btn scan-btn-pick"
            onClick={() => setIsPickModalOpen(true)}
          >
            <div className="scan-icon-pill pick-pill">
              <PackageMinus size={16} />
            </div>
            <span className="scan-btn-title">Scan Model Number</span>
            <span className="scan-type-badge pick-badge">PICK</span>
          </button>
        </div>
      </div>

      {/* 3 Analytics Stat Cards - Uniform Size & Height */}
      <div className="row mt-1 mb-3 g-3">
        <div className="col-12 col-md-4">
          <div className="card shadow-sm stat-metric-card p-3 h-100 d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <small>Serial Numbers Scanned</small>
              <div className="stat-icon-pill bg-sky-light">
                <Scan size={16} />
              </div>
            </div>
            <h3 className="mb-0 text-dark fw-bold" style={{ fontSize: '28px', lineHeight: 1.2 }}>
              {countsLoading ? '...' : counts?.validScanCount || 0}
            </h3>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card shadow-sm stat-metric-card p-3 h-100 d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <small>Total Parts</small>
              <div className="stat-icon-pill bg-emerald-light">
                <Package size={16} />
              </div>
            </div>
            <h3 className="mb-0 text-dark fw-bold" style={{ fontSize: '28px', lineHeight: 1.2 }}>
              {countsLoading ? '...' : totalPartsCount}
            </h3>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card shadow-sm stat-metric-card p-3 h-100 d-flex flex-column justify-content-between">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <small>Date Range</small>
              <div className="stat-icon-pill bg-amber-light">
                <Calendar size={16} />
              </div>
            </div>
            <div className="d-flex align-items-center" style={{ minHeight: '34px' }}>
              <span className="text-dark fw-bold" style={{ fontSize: '15px' }}>
                {startDate ? startDate.toLocaleDateString() : 'All Time'}
              </span>
              <span className="text-muted mx-2 fw-semibold" style={{ fontSize: '13px' }}>—</span>
              <span className="text-dark fw-bold" style={{ fontSize: '15px' }}>
                {endDate ? endDate.toLocaleDateString() : 'Now'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="row mb-4 g-3">
        {/* Left Column: Part Scan Status */}
        <div className="col-lg-5 col-md-6 col-12">
          <div
            className="card shadow-sm p-3 h-100 d-flex flex-column justify-content-between"
            style={{ minHeight: '235px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1.5px solid #d0d5dd', boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 3px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03)' }}
          >
            {/* Header matching other cards */}
            <div className="d-flex justify-content-between align-items-center mb-1">
              <small className="text-muted fw-semibold" style={{ fontSize: '13px' }}>
                Part Scan Status
              </small>
              <div className="stat-icon-pill bg-emerald-light">
                <CheckCircle2 size={16} />
              </div>
            </div>

            {/* Middle: Centered Donut Chart with Center Number */}
            <div className="position-relative d-flex align-items-center justify-content-center my-auto" style={{ height: '115px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={totalScans === 0 ? [{ name: 'No Scans', value: 1, color: '#e2e8f0' }] : pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={36}
                    outerRadius={52}
                    paddingAngle={totalScans > 0 ? 3 : 0}
                    dataKey="value"
                  >
                    {(totalScans === 0 ? [{ name: 'No Scans', value: 1, color: '#e2e8f0' }] : pieData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  {totalScans > 0 && <Tooltip />}
                </PieChart>
              </ResponsiveContainer>
              {/* Center text */}
              <div className="position-absolute text-center" style={{ pointerEvents: 'none' }}>
                <div className="fw-bold text-dark" style={{ fontSize: '18px', lineHeight: 1 }}>
                  {countsLoading ? '...' : totalScans}
                </div>
                <div className="text-muted" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Scans
                </div>
              </div>
            </div>

            {/* Bottom Stat Row - Identical structure to Picked Parts card */}
            <div className="row bottom-stat pt-2">
              <div className="col-6 border-r text-center">
                <h4 className="text-dark mb-0" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Valid Scans
                </h4>
                <h3 className="text-success fw-bold mb-0">
                  {countsLoading ? '...' : validScans}
                </h3>
              </div>

              <div className="col-6 text-center">
                <h4 className="text-dark mb-0" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Invalid Scans
                </h4>
                <h3 className={`fw-bold mb-0 ${invalidScans > 0 ? 'text-danger' : 'text-muted'}`}>
                  {countsLoading ? '...' : invalidScans}
                </h3>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Picked Parts Map Card */}
        <div className="col-lg-7 col-md-6 col-12">
          <div className="card shadow-sm map-card p-3 h-100 d-flex flex-column justify-content-between" style={{ minHeight: '235px', borderRadius: '8px', border: '1.5px solid #d0d5dd', boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 3px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03)' }}>
            {/* Header matching other cards */}
            <div className="d-flex justify-content-between align-items-center mb-1">
              <small className="text-muted fw-semibold" style={{ fontSize: '13px' }}>
                Picked Parts
              </small>
              <div className="stat-icon-pill bg-sky-light">
                <PackageMinus size={16} />
              </div>
            </div>

            {/* Middle: Big Blue Count over the Map */}
            <div className="text-center my-auto">
              <h3 className="text-primary fw-bold mb-0" style={{ fontSize: '36px', lineHeight: 1.1 }}>
                {countsLoading ? '...' : counts?.pickedPartsCount || 0}
              </h3>
            </div>

            {/* Bottom Stat Row */}
            <div className="row bottom-stat pt-2">
              <div className="col-6 border-r text-center">
                <h4 className="text-dark mb-0" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Hold
                </h4>
                <h3 className="text-warning fw-bold mb-0">
                  {countsLoading ? '...' : counts?.holdPartsCount || 0}
                </h3>
              </div>

              <div className="col-6 text-center">
                <h4 className="text-dark mb-0" style={{ fontSize: '13px', fontWeight: 600 }}>
                  Available
                </h4>
                <h3 className="text-success fw-bold mb-0">
                  {countsLoading ? '...' : counts?.availablePartsCount || 0}
                </h3>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Serial Numbers Data Table Card */}
      <div className="card table-card">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h5 className="fw-bold mb-0">Serial Numbers</h5>

          <div className="d-flex align-items-center gap-2">
            <div className="position-relative" style={{ width: '250px' }}>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button
              className="btn btn-success btn-sm d-flex align-items-center gap-1"
              onClick={handleExportExcel}
            >
              <Download size={14} /> Export Excel
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive">
          {tableLoading ? (
            <Loader message="Loading inventory..." />
          ) : puts.length === 0 ? (
            <EmptyState title="No records found" description="No scan records available." />
          ) : (
            <table className="table table-hover table-bordered align-middle">
              <thead>
                <tr>
                  <th>Serial Number</th>
                  <th>PV Status</th>
                  <th>Process Status</th>
                  <th>PO File</th>
                  <th>Model Number</th>
                  <th>Scanned By</th>
                  <th>PUT File</th>
                  <th>Pick Status</th>
                  <th>Pick File</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {puts.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="d-flex align-items-center justify-content-between gap-1">
                        <span
                          className="btn-link-custom"
                          onClick={() => {
                            setPartLogSerial(row.serial_number);
                            setIsPartLogModalOpen(true);
                          }}
                        >
                          {row.serial_number}
                        </span>

                        <button
                          className="btn btn-sm p-1 border-0 text-muted ms-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (row.serial_number) {
                              navigator.clipboard.writeText(row.serial_number);
                              setCopiedSerial(row.serial_number);
                              setTimeout(() => setCopiedSerial(null), 1500);
                            }
                          }}
                          title={copiedSerial === row.serial_number ? 'Copied!' : 'Copy Serial Number'}
                          style={{ lineHeight: 1 }}
                        >
                          {copiedSerial === row.serial_number ? (
                            <Check size={14} className="text-success" />
                          ) : (
                            <Copy size={13} className="text-secondary" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge ${row.pv_status === 'PASS'
                          ? 'bg-success'
                          : row.pv_status === 'FAIL'
                            ? 'bg-danger'
                            : 'bg-secondary'
                          }`}
                      >
                        {row.pv_status || '-'}
                      </span>
                    </td>
                    <td>{row.process_status || '-'}</td>
                    <td>{row.put_po_file?.name || '-'}</td>
                    <td>{row.model_number}</td>
                    <td>
                      {row.user_first_name
                        ? `${row.user_first_name} ${row.user_last_name || ''}`
                        : row.scanned_by}
                    </td>
                    <td>
                      {row.put_text_file?.name ? (
                        <button
                          className="btn btn-link p-0 text-primary fw-bold"
                          style={{ fontSize: '13px' }}
                          onClick={() => handleDownloadPutFile(row.id)}
                        >
                          <FileText size={14} className="me-1" />
                          {row.put_text_file.name}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="text-center">
                      <span
                        className={`badge ${row.pick_status === 'AVAILABLE'
                          ? 'bg-success'
                          : row.pick_status === 'PICKED'
                            ? 'bg-warning'
                            : 'bg-danger'
                          }`}
                      >
                        {row.pick_status}
                      </span>
                    </td>
                    <td>
                      {row.pick?.pick_text_file?.name ? (
                        <button
                          className="btn btn-link p-0 text-info fw-bold"
                          style={{ fontSize: '13px' }}
                          onClick={() => row.pick_id && handleDownloadPickFile(row.pick_id)}
                        >
                          <FileText size={14} className="me-1" />
                          {row.pick.pick_text_file.name}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="text-center">
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          setViewLogPutId(row.id);
                          setViewLogPickId(null);
                          setIsViewLogModalOpen(true);
                        }}
                      >
                        Logs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="mt-3">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => fetchPuts(p, pageSize)}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              fetchPuts(1, newSize);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      </div>

      {/* Modals */}
      <ScanModal
        isOpen={isPutModalOpen}
        onClose={() => setIsPutModalOpen(false)}
        onSuccess={() => {
          fetchCounts();
          fetchPuts(1);
        }}
      />

      <ScanAndStoreModal
        isOpen={isPickModalOpen}
        onClose={() => setIsPickModalOpen(false)}
        onSuccess={() => {
          fetchCounts();
          fetchPuts(1);
        }}
      />

      <ViewLogsModal
        isOpen={isViewLogModalOpen}
        onClose={() => setIsViewLogModalOpen(false)}
        putId={viewLogPutId}
        pickId={viewLogPickId}
      />

      <PartScanLogsModal
        isOpen={isPartLogModalOpen}
        onClose={() => setIsPartLogModalOpen(false)}
        serialNumber={partLogSerial}
      />
    </div>
  );
}
