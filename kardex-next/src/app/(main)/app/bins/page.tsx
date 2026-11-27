'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { apiPost, apiGet } from '@/lib/api';
import { copyToClipboard } from '@/lib/clipboard';
import { formatIndianDate } from '@/lib/date';
import { useAuth } from '@/context/AuthContext';
import { HandlingUnit, StorageStatus, HUStatus, HUListResponse, HUStats, BinType } from '@/types/hu';
import { HUStatusBadge } from '@/components/bins/HUStatusBadge';
import { RegisterBinModal } from '@/components/bins/RegisterBinModal';
import { BinTypeFormModal } from '@/components/bins/BinTypeFormModal';
import { DeleteBinTypeModal } from '@/components/bins/DeleteBinTypeModal';
import { ManageBinTypesModal } from '@/components/bins/ManageBinTypesModal';
import { EditBinSpecificationModal } from '@/components/bins/EditBinSpecificationModal';
import { DeleteBinModal } from '@/components/bins/DeleteBinModal';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import {
  Boxes,
  PackagePlus,
  Eye,
  CheckCircle2,
  Package,
  Layers,
  Search,
  RefreshCw,
  Copy,
  Check,
  X,
  Tag,
  Barcode,
  Calendar,
  User,
  Zap,
  Archive,
  ChevronRight,
  PieChart,
  Edit2,
  Trash2,
  Plus,
  Sliders,
} from 'lucide-react';

const PAGE_SIZE = 20;

type SortOption = 'HU_ASC' | 'HU_DESC' | 'CAPACITY_DESC' | 'CAPACITY_ASC' | 'DATE_DESC';

export default function BinsMasterPage() {
  const { canPut, isAdmin } = useAuth();
  const [hus, setHus] = useState<HandlingUnit[]>([]);
  const [binTypes, setBinTypes] = useState<BinType[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters, Search & Sort
  const [storageFilter, setStorageFilter] = useState<StorageStatus | 'ALL'>('ALL');
  const [huStatusFilter, setHuStatusFilter] = useState<HUStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('HU_ASC');
  const [copiedHuId, setCopiedHuId] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<HUStats>({
    total: 0,
    inKardex: 0,
    draft: 0,
    outsideKardex: 0,
    empty: 0,
    partial: 0,
    full: 0,
  });

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [binTypeToEdit, setBinTypeToEdit] = useState<BinType | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [binTypeToDelete, setBinTypeToDelete] = useState<BinType | null>(null);

  // Edit bin specification modal & delete bin modal (Handling Unit)
  const [selectedHUForSpecEdit, setSelectedHUForSpecEdit] = useState<HandlingUnit | null>(null);
  const [isEditSpecOpen, setIsEditSpecOpen] = useState(false);
  const [selectedHUForDelete, setSelectedHUForDelete] = useState<HandlingUnit | null>(null);
  const [isDeleteHUOpen, setIsDeleteHUOpen] = useState(false);

  const handleOpenEditBinSpec = (hu: HandlingUnit) => {
    setSelectedHUForSpecEdit(hu);
    setIsEditSpecOpen(true);
  };

  const handleOpenDeleteBin = (hu: HandlingUnit) => {
    setSelectedHUForDelete(hu);
    setIsDeleteHUOpen(true);
  };

  const handleOpenAddType = () => {
    setBinTypeToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditType = (bt: BinType, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setBinTypeToEdit(bt);
    setIsFormModalOpen(true);
  };

  const handleOpenDeleteType = (bt: BinType, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setBinTypeToDelete(bt);
    setIsDeleteModalOpen(true);
  };

  const fetchBinTypes = async () => {
    try {
      const data = await apiGet<BinType[]>('/hu/bin-types');
      setBinTypes(data || []);
    } catch {
      // silently fallback
    }
  };

  const fetchHUs = useCallback(
    async (
      pageNum = page,
      storage = storageFilter,
      huStatus = huStatusFilter,
      search = searchQuery
    ) => {
      try {
        setLoading(true);
        const body: Record<string, unknown> = {
          page: pageNum,
          size: PAGE_SIZE,
        };
        if (storage !== 'ALL') body.storage_status = storage;
        if (huStatus !== 'ALL') body.hu_status = huStatus;
        if (search.trim()) body.search = search.trim();

        const res = await apiPost<HUListResponse>('/hu/list', body);
        setHus(res.data || []);
        setTotalPages(res.totalPages || 1);
        setTotalItems(res.totalItems || 0);
        setPage(res.page || 1);

        if (res.stats) {
          setStats(res.stats);
        }
      } catch {
        setHus([]);
      } finally {
        setLoading(false);
      }
    },
    [page, storageFilter, huStatusFilter, searchQuery]
  );

  useEffect(() => {
    fetchBinTypes();
  }, []);

  useEffect(() => {
    fetchHUs(1, storageFilter, huStatusFilter, searchQuery);
  }, [storageFilter, huStatusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHUs(1, storageFilter, huStatusFilter, searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCopyId = (huId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(huId);
    setCopiedHuId(huId);
    setTimeout(() => setCopiedHuId(null), 2000);
  };

  const handleRefresh = () => {
    fetchHUs(page, storageFilter, huStatusFilter, searchQuery);
    fetchBinTypes();
  };

  const handleSuccess = () => {
    fetchHUs(page, storageFilter, huStatusFilter, searchQuery);
    fetchBinTypes();
  };

  const handleBinTypeMutated = () => {
    fetchBinTypes();
    fetchHUs(page, storageFilter, huStatusFilter, searchQuery);
  };

  // Client-side sorting
  const sortedHUs = useMemo(() => {
    const list = [...hus];
    switch (sortBy) {
      case 'HU_ASC':
        return list.sort((a, b) => a.hu_id.localeCompare(b.hu_id));
      case 'HU_DESC':
        return list.sort((a, b) => b.hu_id.localeCompare(a.hu_id));
      case 'CAPACITY_DESC':
        return list.sort((a, b) => {
          const occA = (a.compartments || []).filter((c) => c.status === 'OCCUPIED').length;
          const occB = (b.compartments || []).filter((c) => c.status === 'OCCUPIED').length;
          return occB - occA;
        });
      case 'CAPACITY_ASC':
        return list.sort((a, b) => {
          const occA = (a.compartments || []).filter((c) => c.status === 'OCCUPIED').length;
          const occB = (b.compartments || []).filter((c) => c.status === 'OCCUPIED').length;
          return occA - occB;
        });
      case 'DATE_DESC':
        return list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      default:
        return list;
    }
  }, [hus, sortBy]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return formatIndianDate(dateStr);
  };

  return (
    <div className="bins-master-container">
      <style jsx>{`
        .bins-master-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        /* Top Header Card */
        .page-header-card {
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

        @media (max-width: 768px) {
          .page-header-card {
            padding: 1rem 1.15rem;
          }
          .page-title {
            font-size: 19px !important;
          }
          .header-icon-box {
            width: 44px !important;
            height: 44px !important;
          }
          .header-actions {
            width: 100%;
            justify-content: flex-start;
          }
          .table-card {
            padding: 1rem 0.85rem !important;
          }
        }

        .header-title-wrap {
          display: flex;
          align-items: center;
          gap: 1.15rem;
        }

        .header-icon-box {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #4f46e5 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.28);
          flex-shrink: 0;
        }

        .page-title {
          font-size: 23px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.3px;
          margin: 0;
          line-height: 1.2;
        }

        .page-subtitle {
          font-size: 13px;
          color: #64748b;
          margin-top: 4px;
          margin-bottom: 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn-reload {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-reload:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .btn-register-primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          color: #ffffff;
          padding: 9px 20px;
          border-radius: 10px;
          font-size: 13.5px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 3px 10px rgba(37, 99, 235, 0.3);
        }

        .btn-register-primary:hover {
          transform: translateY(-1.5px);
          box-shadow: 0 5px 16px rgba(37, 99, 235, 0.4);
        }

        .btn-manage-types {
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          color: #1e293b;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-manage-types:hover {
          background: #f8fafc;
          border-color: #2563eb;
          color: #2563eb;
        }

        .bintypes-badge {
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          border-radius: 9999px;
          padding: 1px 7px;
          font-size: 11px;
          font-weight: 800;
        }

        .btn-table-spec-action {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #475569;
          padding: 2px 5px;
          border-radius: 5px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          line-height: 1;
        }

        .btn-table-spec-action.btn-table-spec-edit:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #2563eb;
          transform: translateY(-1px);
        }

        .btn-table-spec-action.btn-table-spec-delete {
          border-color: #fecaca;
          color: #dc2626;
        }

        .btn-table-spec-action.btn-table-spec-delete:hover {
          background: #fef2f2;
          border-color: #f87171;
          color: #b91c1c;
          transform: translateY(-1px);
        }

        /* Bin Specification Summary Pill Banner */
        .specs-banner-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.15rem 1.35rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .specs-banner-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }

        .specs-banner-title {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.2px;
        }

        .specs-count-pill {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          color: #475569;
          font-size: 11.5px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
        }

        .btn-banner-action {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          padding: 5px 12px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-banner-action:hover {
          background: #dbeafe;
          transform: translateY(-1px);
        }

        .btn-banner-action-secondary {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #475569;
          padding: 5px 12px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-banner-action-secondary:hover {
          background: #f8fafc;
          color: #0f172a;
          border-color: #94a3b8;
        }

        .specs-chips-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 0.75rem;
        }

        .spec-chip-card {
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          transition: all 0.15s ease;
        }

        .spec-chip-card:hover {
          background: #ffffff;
          border-color: #cbd5e1;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
        }

        .spec-chip-main {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
          flex: 1;
        }

        .spec-chip-title-row {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .spec-chip-name {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .spec-chip-pps {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #0284c7;
          font-size: 10.5px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
        }

        .spec-chip-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          color: #64748b;
        }

        .spec-slots-badge {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          color: #334155;
          font-weight: 700;
          font-size: 10.5px;
          padding: 1px 6px;
          border-radius: 4px;
        }

        .spec-desc-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
        }

        .spec-chip-admin-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .btn-spec-chip-edit {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #2563eb;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .btn-spec-chip-edit:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          transform: translateY(-1px);
        }

        .btn-spec-chip-delete {
          background: #ffffff;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .btn-spec-chip-delete:hover {
          background: #fef2f2;
          border-color: #f87171;
          transform: translateY(-1px);
        }

        /* 6 Interactive Stats Cards */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 0.85rem;
          width: 100%;
        }

        .interactive-stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem 1.15rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          user-select: none;
        }

        .interactive-stat-card:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        .interactive-stat-card.active-stat {
          border-color: #2563eb;
          background: #f8faff;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.22), 0 4px 12px rgba(37, 99, 235, 0.08);
        }

        .stat-meta {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #64748b;
          margin-bottom: 2px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 800;
          line-height: 1.1;
        }

        .stat-icon-well {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Main Table Card */
        .table-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.25rem 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        /* Table Toolbar */
        .table-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #f1f5f9;
        }

        .toolbar-left-cluster {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .filter-tab-pill-group {
          display: inline-flex;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          padding: 3px;
          gap: 3px;
        }

        .filter-tab-pill {
          border: none;
          background: transparent;
          padding: 6px 14px;
          font-size: 12.5px;
          font-weight: 600;
          border-radius: 7px;
          color: #64748b;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s ease;
        }

        .filter-tab-pill.active {
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          font-weight: 700;
        }

        .tab-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 9999px;
          background: #e2e8f0;
          color: #475569;
        }

        .filter-tab-pill.active .tab-badge {
          background: #eff6ff;
          color: #1d4ed8;
        }

        .select-filter-control {
          padding: 6px 12px;
          font-size: 12.5px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          color: #334155;
          font-weight: 600;
          outline: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .select-filter-control:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .toolbar-right-cluster {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .search-box-wrapper {
          position: relative;
          min-width: 240px;
        }

        .search-input-field {
          width: 100%;
          padding: 7px 32px 7px 32px;
          font-size: 12.5px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          outline: none;
          transition: all 0.15s ease;
        }

        .search-input-field:focus {
          background: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .search-icon-affix {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .search-clear-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
        }

        .search-clear-btn:hover {
          color: #0f172a;
        }

        /* Modern Table Styling */
        .table-responsive {
          overflow-x: auto;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }

        .bins-table {
          width: 100%;
          min-width: 820px;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13px;
          background: #ffffff;
        }

        .bins-table th {
          background: #f8fafc;
          color: #475569;
          font-weight: 700;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          padding: 12px 14px;
          border-bottom: 1.5px solid #e2e8f0;
          white-space: nowrap;
          text-align: left;
        }

        .bins-table td {
          padding: 13px 14px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          color: #1e293b;
        }

        .bins-table tr.table-row-item:hover td {
          background: #f8faff;
        }

        .bins-table tr.table-row-item:hover td:first-child {
          border-left: 3px solid #2563eb;
        }

        .bins-table tr:last-child td {
          border-bottom: none;
        }

        /* Handling Unit Capsule */
        .hu-id-capsule {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #eff6ff;
          border: 1px solid #dbeafe;
          padding: 4px 10px;
          border-radius: 8px;
          transition: all 0.15s ease;
        }

        .hu-id-capsule:hover {
          border-color: #bfdbfe;
          background: #dbeafe;
        }

        .hu-id-link {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-weight: 700;
          font-size: 13px;
          color: #1d4ed8;
          text-decoration: none;
          letter-spacing: 0.3px;
        }

        .hu-id-link:hover {
          text-decoration: underline;
        }

        .copy-icon-btn {
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 2px;
          display: inline-flex;
          align-items: center;
          transition: color 0.15s ease;
        }

        .copy-icon-btn:hover {
          color: #0f172a;
        }

        .bin-name-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 2px 7px;
          border-radius: 5px;
          font-size: 10.5px;
          font-weight: 700;
          color: #334155;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        /* Visual Compartment Matrix Dots Preview */
        .matrix-dots-row {
          display: flex;
          align-items: center;
          gap: 3px;
          margin-top: 5px;
        }

        .matrix-dot {
          width: 7px;
          height: 7px;
          border-radius: 2px;
          transition: all 0.15s ease;
        }

        .matrix-dot.occupied {
          background: #10b981;
        }

        .matrix-dot.empty {
          background: #e2e8f0;
        }

        /* Capacity Allocation Progress */
        .capacity-cell-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 125px;
        }

        .capacity-numbers-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 600;
        }

        .mini-track {
          width: 100%;
          height: 6px;
          background: #f1f5f9;
          border-radius: 9999px;
          overflow: hidden;
        }

        .mini-fill {
          height: 100%;
          border-radius: 9999px;
          transition: width 0.3s ease;
        }

        /* Action Buttons */
        :global(a.btn-view-details) {
          background: #ffffff !important;
          border: 1.5px solid #cbd5e1 !important;
          color: #334155 !important;
          padding: 7px 14px !important;
          border-radius: 8px !important;
          font-size: 12.5px !important;
          font-weight: 700 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          text-decoration: none !important;
          transition: all 0.15s ease !important;
          white-space: nowrap !important;
        }

        :global(a.btn-view-details:hover) {
          background: #f1f5f9 !important;
          border-color: #94a3b8 !important;
          color: #0f172a !important;
          text-decoration: none !important;
          transform: translateY(-1px) !important;
        }

        :global(a.btn-hu-put-shortcut) {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
          border: 1px solid #1d4ed8 !important;
          color: #ffffff !important;
          padding: 7px 14px !important;
          border-radius: 8px !important;
          font-size: 12.5px !important;
          font-weight: 700 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          text-decoration: none !important;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25) !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          white-space: nowrap !important;
        }

        :global(a.btn-hu-put-shortcut:hover) {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%) !important;
          color: #ffffff !important;
          text-decoration: none !important;
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35) !important;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        :global(.spin-animation) {
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      {/* Hero Header */}
      <div className="page-header-card">
        <div className="header-title-wrap">
          <div className="header-icon-box">
            <Boxes size={26} />
          </div>
          <div>
            <h1 className="page-title">Bins & Handling Units Master</h1>
            <p className="page-subtitle">
              Master catalog of physical handling units, bin specifications, capacity allocation, and bin registration.
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn-reload" onClick={handleRefresh} title="Sync latest status from server">
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
            Refresh
          </button>
          {isAdmin && (
            <button
              className="btn-manage-types"
              onClick={() => setIsManageTypesOpen(true)}
              title="Manage bin specifications and tray layouts"
            >
              <Sliders size={15} />
              <span>Manage Bin Types</span>
              <span className="bintypes-badge">{binTypes.length}</span>
            </button>
          )}
          {canPut && (
            <button className="btn-register-primary" onClick={() => setIsRegisterOpen(true)}>
              <PackagePlus size={16} /> Register New Bin
            </button>
          )}
        </div>
      </div>

      {/* Bin Specifications Banner */}
      <div className="specs-banner-card">
        <div className="specs-banner-header">
          <div className="d-flex align-items-center gap-2">
            <Layers size={17} className="text-primary" />
            <span className="specs-banner-title">Configured Bin Specifications</span>
            <span className="specs-count-pill">
              {binTypes.filter((t) => t.bin_name === 'CON_BINC' || t.bin_name === 'CON_BIND').length} Active
            </span>
          </div>
          {isAdmin && (
            <div className="d-flex align-items-center gap-2">
              <button
                className="btn-banner-action-secondary"
                onClick={() => setIsManageTypesOpen(true)}
                title="Open full specifications manager"
              >
                <Sliders size={13} />
                <span>Manage All</span>
              </button>
            </div>
          )}
        </div>

        {binTypes.filter((t) => t.bin_name === 'CON_BINC' || t.bin_name === 'CON_BIND').length === 0 ? (
          <div style={{ padding: '0.85rem', color: '#64748b', fontSize: '13px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            No bin specifications configured yet.
          </div>
        ) : (
          <div className="specs-chips-grid">
            {binTypes
              .filter((type) => type.bin_name === 'CON_BINC' || type.bin_name === 'CON_BIND')
              .map((type) => (
              <div key={type.id} className="spec-chip-card">
                <div className="spec-chip-main">
                  <div className="spec-chip-title-row">
                    <span className="spec-chip-name">{type.name}</span>
                    <span className="spec-chip-pps font-monospace">PPS: {type.bin_name}</span>
                  </div>
                  <div className="spec-chip-meta">
                    <span className="spec-slots-badge">{type.compartment_count} Slots</span>
                    {type.description && (
                      <span className="spec-desc-text" title={type.description}>
                        {type.description}
                      </span>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="spec-chip-admin-actions">
                    <button
                      className="btn-spec-chip-edit"
                      onClick={(e) => handleOpenEditType(type, e)}
                      title={`Edit ${type.name}`}
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      className="btn-spec-chip-delete"
                      onClick={(e) => handleOpenDeleteType(type, e)}
                      title={`Delete ${type.name}`}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Stats Cards */}
      <div className="stats-grid">
        {/* Total Bins */}
        <div
          className={`interactive-stat-card ${huStatusFilter === 'ALL' ? 'active-stat' : ''}`}
          onClick={() => {
            setStorageFilter('ALL');
            setHuStatusFilter('ALL');
          }}
          title="Click to show all registered bins"
        >
          <div className="stat-meta">
            <span className="stat-label">Total Bins</span>
            <span className="stat-value" style={{ color: '#0f172a' }}>
              {stats.total || totalItems}
            </span>
          </div>
          <div className="stat-icon-well" style={{ background: '#f1f5f9', color: '#475569' }}>
            <Boxes size={20} />
          </div>
        </div>

        {/* Empty */}
        <div
          className={`interactive-stat-card ${huStatusFilter === 'EMPTY' ? 'active-stat' : ''}`}
          onClick={() => setHuStatusFilter(huStatusFilter === 'EMPTY' ? 'ALL' : 'EMPTY')}
          title="Click to filter empty bins"
        >
          <div className="stat-meta">
            <span className="stat-label">Empty (0%)</span>
            <span className="stat-value" style={{ color: '#16a34a' }}>
              {stats.empty}
            </span>
          </div>
          <div className="stat-icon-well" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <Package size={20} />
          </div>
        </div>

        {/* Partial */}
        <div
          className={`interactive-stat-card ${huStatusFilter === 'PARTIALLY_FILLED' ? 'active-stat' : ''}`}
          onClick={() =>
            setHuStatusFilter(huStatusFilter === 'PARTIALLY_FILLED' ? 'ALL' : 'PARTIALLY_FILLED')
          }
          title="Click to filter partially filled bins"
        >
          <div className="stat-meta">
            <span className="stat-label">Partially Filled</span>
            <span className="stat-value" style={{ color: '#ea580c' }}>
              {stats.partial}
            </span>
          </div>
          <div className="stat-icon-well" style={{ background: '#fff7ed', color: '#ea580c' }}>
            <Package size={20} />
          </div>
        </div>

        {/* Full */}
        <div
          className={`interactive-stat-card ${huStatusFilter === 'FULL' ? 'active-stat' : ''}`}
          onClick={() => setHuStatusFilter(huStatusFilter === 'FULL' ? 'ALL' : 'FULL')}
          title="Click to filter full bins"
        >
          <div className="stat-meta">
            <span className="stat-label">Full (100%)</span>
            <span className="stat-value" style={{ color: '#059669' }}>
              {stats.full}
            </span>
          </div>
          <div className="stat-icon-well" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Package size={20} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-card">
        {/* Table Toolbar */}
        <div className="table-toolbar">
          <div className="toolbar-left-cluster">
            {/* HU Fill Status Filter */}
            <select
              className="select-filter-control"
              value={huStatusFilter}
              onChange={(e) => setHuStatusFilter(e.target.value as HUStatus | 'ALL')}
            >
              <option value="ALL">All Fill Levels</option>
              <option value="EMPTY">Only Empty (0%)</option>
              <option value="PARTIALLY_FILLED">Only Partially Filled</option>
              <option value="FULL">Only 100% Full</option>
            </select>

            {/* Sort Control */}
            <select
              className="select-filter-control"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              title="Sort table rows"
            >
              <option value="HU_ASC">Sort: Bin ID (A-Z)</option>
              <option value="HU_DESC">Sort: Bin ID (Z-A)</option>
              <option value="CAPACITY_DESC">Sort: Most Filled First</option>
              <option value="CAPACITY_ASC">Sort: Least Filled First</option>
              <option value="DATE_DESC">Sort: Newest Registered</option>
            </select>
          </div>

          <div className="toolbar-right-cluster">
            {/* Search Box */}
            <div className="search-box-wrapper">
              <Search size={14} className="search-icon-affix" />
              <input
                type="text"
                className="search-input-field"
                placeholder="Search Handling Unit ID or spec..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <span className="text-muted" style={{ fontSize: '12.5px', fontWeight: 600 }}>
              {sortedHUs.length} {sortedHUs.length === 1 ? 'bin' : 'bins'}
            </span>
          </div>
        </div>

        {/* Table Body */}
        {loading ? (
          <Loader message="Loading bins inventory..." />
        ) : sortedHUs.length === 0 ? (
          <EmptyState
            title="No Bins Found"
            description={
              searchQuery || storageFilter !== 'ALL' || huStatusFilter !== 'ALL'
                ? 'No bins match your current filters. Try resetting the filters or clearing search.'
                : 'No physical bins have been registered yet. Click "Register New Bin" above to add your first bin!'
            }
          />
        ) : (
          <div className="table-responsive">
            <table className="bins-table">
              <thead>
                <tr>
                  <th>
                    <div className="d-flex align-items-center gap-1">
                      <Barcode size={13} className="text-muted" />
                      <span>Handling Unit</span>
                    </div>
                  </th>
                  <th>
                    <div className="d-flex align-items-center gap-1">
                      <Layers size={13} className="text-muted" />
                      <span>Specification & PPS</span>
                    </div>
                  </th>
                  <th>
                    <div className="d-flex align-items-center gap-1">
                      <Boxes size={13} className="text-muted" />
                      <span>Slots</span>
                    </div>
                  </th>
                  <th>
                    <div className="d-flex align-items-center gap-1">
                      <PieChart size={13} className="text-muted" />
                      <span>Capacity Load</span>
                    </div>
                  </th>
                  <th>
                    <div className="d-flex align-items-center gap-1">
                      <CheckCircle2 size={13} className="text-muted" />
                      <span>HU Status</span>
                    </div>
                  </th>
                  <th>
                    <div className="d-flex align-items-center gap-1">
                      <User size={13} className="text-muted" />
                      <span>Registered Info</span>
                    </div>
                  </th>
                  <th style={{ textAlign: 'right' }}>
                    <div className="d-flex align-items-center justify-content-end gap-1">
                      <Zap size={13} className="text-muted" />
                      <span>Actions</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedHUs.map((hu) => {
                  const compartments = hu.compartments || [];
                  const total = compartments.length || hu.bin_type?.compartment_count || 15;
                  const occupied = compartments.filter((c) => c.status === 'OCCUPIED').length;
                  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;
                  const fillColor =
                    pct === 100 ? '#10b981' : pct > 0 ? '#2563eb' : '#cbd5e1';

                  const dotCount = Math.min(total, 15);
                  const occupiedCount = Math.min(occupied, dotCount);

                  return (
                    <tr key={hu.id} className="table-row-item">
                      {/* Handling Unit ID Capsule */}
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="hu-id-capsule">
                            <Barcode size={13} className="text-primary flex-shrink-0" />
                            <Link
                              href={`/app/bins/${hu.hu_id}`}
                              className="hu-id-link"
                              title="Open physical bin compartments"
                            >
                              {hu.hu_id}
                            </Link>
                          </div>
                          <button
                            className="copy-icon-btn"
                            onClick={(e) => handleCopyId(hu.hu_id, e)}
                            title="Copy Handling Unit ID"
                          >
                            {copiedHuId === hu.hu_id ? (
                              <Check size={12} className="text-success" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Bin Specification */}
                      <td>
                        <div className="d-flex flex-column gap-1">
                          <div className="d-flex align-items-center gap-1.5 flex-wrap">
                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                              {hu.bin_type?.name || `Type #${hu.bin_type_id}`}
                            </span>
                            {isAdmin && (
                              <span className="d-inline-flex align-items-center gap-1">
                                <button
                                  type="button"
                                  className="btn-table-spec-action btn-table-spec-edit"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditBinSpec(hu);
                                  }}
                                  title={`Edit specification for ${hu.hu_id}`}
                                >
                                  <Edit2 size={11} />
                                </button>
                                {occupied === 0 && (
                                  <button
                                    type="button"
                                    className="btn-table-spec-action btn-table-spec-delete"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDeleteBin(hu);
                                    }}
                                    title={`Delete empty bin ${hu.hu_id}`}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </span>
                            )}
                          </div>
                          <span className="bin-name-badge">
                            PPS: {hu.bin_type?.bin_name || 'CON_BINC'}
                          </span>
                        </div>
                      </td>

                      {/* Total Slots */}
                      <td>
                        <span style={{ fontWeight: 700, color: '#334155' }}>
                          {total} Slots
                        </span>
                      </td>

                      {/* Capacity Allocation with Mini Progress Bar & Dots Preview */}
                      <td>
                        <div className="capacity-cell-wrap">
                          <div className="capacity-numbers-row">
                            <span>
                              <strong style={{ color: occupied > 0 ? '#16a34a' : '#64748b' }}>
                                {occupied}
                              </strong>
                              <span className="text-muted"> / {total} filled</span>
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                color: pct === 100 ? '#15803d' : pct > 0 ? '#1d4ed8' : '#64748b',
                                fontWeight: 800,
                              }}
                            >
                              {pct}%
                            </span>
                          </div>
                          <div className="mini-track">
                            <div
                              className="mini-fill"
                              style={{ width: `${pct}%`, background: fillColor }}
                            />
                          </div>

                          {/* Visual Dots Preview */}
                          <div className="matrix-dots-row" title={`${occupied} of ${total} slots occupied`}>
                            {Array.from({ length: dotCount }).map((_, idx) => (
                              <div
                                key={idx}
                                className={`matrix-dot ${idx < occupiedCount ? 'occupied' : 'empty'}`}
                              />
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* HU Status */}
                      <td>
                        <HUStatusBadge status={hu.hu_status} />
                      </td>

                      {/* Registered By & Date */}
                      <td>
                        <div className="d-flex flex-column gap-1">
                          <span style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: 600 }}>
                            {hu.registered_by || 'Admin'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {formatDate(hu.created_at)}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                          <Link href={`/app/bins/${hu.hu_id}`} className="btn-view-details" title="Inspect bin compartments">
                            <Eye size={13} />
                            <span>View Layout</span>
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

        {/* Pagination */}
        <div className="mt-3">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              setPage(p);
              fetchHUs(p, storageFilter, huStatusFilter, searchQuery);
            }}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
          />
        </div>
      </div>

      {/* Edit Bin Specification Modal (Handling Unit) */}
      <EditBinSpecificationModal
        isOpen={isEditSpecOpen}
        onClose={() => setIsEditSpecOpen(false)}
        onSuccess={handleBinTypeMutated}
        hu={selectedHUForSpecEdit}
        binTypes={binTypes}
      />

      {/* Delete Bin Modal (Handling Unit) */}
      <DeleteBinModal
        isOpen={isDeleteHUOpen}
        onClose={() => setIsDeleteHUOpen(false)}
        onSuccess={handleBinTypeMutated}
        hu={selectedHUForDelete}
      />

      {/* Manage Bin Types Modal */}
      <ManageBinTypesModal
        isOpen={isManageTypesOpen}
        onClose={() => setIsManageTypesOpen(false)}
        binTypes={binTypes}
        onRefresh={handleBinTypeMutated}
      />

      {/* Bin Type Form Modal (Add / Edit) */}
      <BinTypeFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={handleBinTypeMutated}
        binTypeToEdit={binTypeToEdit}
      />

      {/* Delete Bin Type Confirmation Modal */}
      <DeleteBinTypeModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onSuccess={handleBinTypeMutated}
        binType={binTypeToDelete}
      />

      {/* Register New Bin Modal */}
      <RegisterBinModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
