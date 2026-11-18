'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AddUserModal } from '@/components/users/AddUserModal';
import { Modal } from '@/components/shared/Modal';
import { Pagination } from '@/components/shared/Pagination';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { User, PaginatedResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  Copy,
  Check,
  X,
  Mail,
  Clock,
  AlertTriangle,
  Loader2,
  PackagePlus,
  PackageMinus,
  CheckCircle2,
  Key,
  Layers,
  Zap,
  User as UserIcon,
  Lock,
  Power,
  Activity,
} from 'lucide-react';

type RoleFilter = 'ALL' | 'ADMIN' | 'USER';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const DEFAULT_PAGE_SIZE = 25;

export default function UsersPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
    operators: 0,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  // Status toggle confirmation modal
  const [statusModalTarget, setStatusModalTarget] = useState<{
    user: User;
    nextStatus: boolean;
  } | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState('');

  // Delete confirmation modal (only available for inactive users)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchCounts = useCallback(async () => {
    try {
      const [allRes, activeRes, inactiveRes, adminRes, userRes] = await Promise.all([
        apiGet<PaginatedResponse<User>>('/user/get-all', { page: '1', size: '1' }),
        apiGet<PaginatedResponse<User>>('/user/get-all', {
          page: '1',
          size: '1',
          'is_active.equals': 'true',
        }),
        apiGet<PaginatedResponse<User>>('/user/get-all', {
          page: '1',
          size: '1',
          'is_active.equals': 'false',
        }),
        apiGet<PaginatedResponse<User>>('/user/get-all', {
          page: '1',
          size: '1',
          'role.equals': 'ADMIN',
        }),
        apiGet<PaginatedResponse<User>>('/user/get-all', {
          page: '1',
          size: '1',
          'role.equals': 'USER',
        }),
      ]);
      setStats({
        total: allRes.totalItems || 0,
        active: activeRes.totalItems || 0,
        inactive: inactiveRes.totalItems || 0,
        admins: adminRes.totalItems || 0,
        operators: userRes.totalItems || 0,
      });
    } catch {
      // ignore count refresh failures
    }
  }, []);

  const fetchUsers = useCallback(
    async (
      pageNum = page,
      currentSize = pageSize,
      role: RoleFilter = roleFilter,
      status: StatusFilter = statusFilter,
      search = searchQuery
    ) => {
      try {
        setLoading(true);
        const params: Record<string, string> = {
          page: String(pageNum),
          size: String(currentSize),
        };
        if (role !== 'ALL') {
          params['role.equals'] = role;
        }
        if (status === 'ACTIVE') {
          params['is_active.equals'] = 'true';
        } else if (status === 'INACTIVE') {
          params['is_active.equals'] = 'false';
        }
        if (search.trim()) {
          params.search = search.trim();
        }
        const res = await apiGet<PaginatedResponse<User>>('/user/get-all', params);
        setUsers(res.data || []);
        setTotalPages(res.totalPages || 1);
        setTotalItems(res.totalItems || 0);
        setPage(res.page || 1);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, roleFilter, statusFilter, searchQuery]
  );

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/error/403');
      return;
    }
    fetchCounts();
  }, [isAdmin, router, fetchCounts]);

  // Debounced search & filter reload
  useEffect(() => {
    if (!isAdmin) return;
    const timer = setTimeout(() => {
      fetchUsers(1, pageSize, roleFilter, statusFilter, searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [isAdmin, roleFilter, statusFilter, pageSize, searchQuery]);

  const handleCopyUserId = (idText: string) => {
    navigator.clipboard.writeText(idText);
    setCopiedId(idText);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleConfirmStatusChange = async () => {
    if (!statusModalTarget) return;
    try {
      setStatusUpdating(true);
      setStatusError('');
      await apiPost(`/user/toggle-status/${statusModalTarget.user.id}`, {
        is_active: statusModalTarget.nextStatus,
      });
      setStatusModalTarget(null);
      fetchUsers(page, pageSize, roleFilter, statusFilter, searchQuery);
      fetchCounts();
    } catch (err: any) {
      setStatusError(err.message || 'Failed to update account status.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      setDeleteError('');
      await apiDelete(`/user/delete/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchUsers(page, pageSize, roleFilter, statusFilter, searchQuery);
      fetchCounts();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete user.');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const getInitials = (u: User) => {
    const first = u.first_name?.[0] || u.user_id?.[0] || 'U';
    const last = u.last_name?.[0] || '';
    return `${first}${last}`.toUpperCase();
  };

  return (
    <div className="users-page-wrap">
      <style jsx>{`
        .users-page-wrap {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          width: 100%;
          max-width: 100%;
        }

        /* Header Card */
        .page-header-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.35rem 1.65rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header-title-wrap {
          display: flex;
          align-items: center;
          gap: 1.15rem;
        }

        .header-icon-box {
          width: 50px;
          height: 50px;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
          flex-shrink: 0;
        }

        .page-title {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.4px;
          line-height: 1.2;
        }

        .page-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 3px 0 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-reload {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #334155;
          padding: 8px 15px;
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

        .btn-add-user {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          color: #ffffff;
          padding: 8px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn-add-user:hover {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
        }

        /* 4 KPI Summary Cards */
        .users-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.85rem;
          width: 100%;
        }

        @media (max-width: 1024px) {
          .users-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .users-stats-grid {
            grid-template-columns: 1fr;
          }
        }

        .user-stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
          user-select: none;
        }

        .user-stat-card:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        .user-stat-card.active-card {
          border-color: #2563eb;
          background: #f8faff;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.22), 0 4px 12px rgba(37, 99, 235, 0.08);
        }

        .stat-top-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3.5px;
        }

        .stat-meta {
          display: flex;
          flex-direction: column;
        }

        .stat-label {
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 2px;
        }

        .stat-value {
          font-size: 26px;
          font-weight: 800;
          line-height: 1.1;
          font-variant-numeric: tabular-nums;
        }

        .stat-caption {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
          margin-top: 3px;
        }

        .stat-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 11px;
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
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          width: 100%;
        }

        .table-toolbar {
          padding: 1.1rem 1.4rem;
          border-bottom: 1.5px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          background: #ffffff;
        }

        .toolbar-left {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .pill-group {
          display: inline-flex;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 3px;
          gap: 3px;
        }

        .pill-btn {
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 12.5px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 7px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .pill-btn:hover {
          color: #0f172a;
          background: rgba(255, 255, 255, 0.85);
        }

        .pill-btn.active {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
        }

        .pill-btn.active-green {
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
          color: #ffffff;
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(22, 163, 74, 0.25);
        }

        .pill-btn.active-red {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: #ffffff;
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(220, 38, 38, 0.25);
        }

        .pill-count {
          font-size: 11px;
          font-weight: 800;
          padding: 1px 7px;
          border-radius: 9999px;
          background: rgba(15, 23, 42, 0.08);
        }

        .pill-btn.active .pill-count,
        .pill-btn.active-green .pill-count,
        .pill-btn.active-red .pill-count {
          background: rgba(255, 255, 255, 0.25);
          color: #ffffff;
        }

        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .search-wrap {
          position: relative;
          min-width: 270px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          height: 38px;
          padding: 0 32px 0 36px;
          border-radius: 9px;
          border: 1.5px solid #cbd5e1;
          background: #f8fafc;
          font-size: 13px;
          font-weight: 500;
          color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
        }

        .search-input:focus {
          background: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        }

        .search-clear {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3px;
          border-radius: 4px;
        }

        .search-clear:hover {
          color: #0f172a;
          background: #e2e8f0;
        }

        .users-counter-badge {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 700;
          color: #334155;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        /* High-End Enterprise Elevated Table (Zero Side Scroll) */
        .table-responsive {
          width: 100%;
          overflow-x: hidden;
          border-radius: 11px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        }

        .users-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13.5px;
          background: #ffffff;
          table-layout: fixed;
        }

        .users-table thead th {
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          color: #334155;
          font-weight: 800;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          padding: 13px 16px;
          border-bottom: 2px solid #e2e8f0;
          white-space: nowrap;
          text-align: left;
          user-select: none;
        }

        .users-table tbody td {
          padding: 12px 16px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          white-space: nowrap;
          color: #1e293b;
          height: 56px;
          transition: background 0.15s ease;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Subtle Alternating Zebra Striping */
        .users-table tbody tr:nth-child(even) td {
          background-color: #fafbfc;
        }

        /* Interactive Row Hover with Accent Bar */
        .users-table tbody tr:hover td {
          background-color: #f0f7ff !important;
        }

        .users-table tbody tr:hover td:first-child {
          border-left: 3.5px solid #2563eb;
        }

        .users-table tbody tr:last-child td {
          border-bottom: none;
        }

        /* Inactive row subtle styling */
        .users-table tbody tr.row-inactive td {
          background-color: #fafaf9;
        }

        /* Cell: User Identity */
        .user-identity-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 800;
          color: #ffffff;
          flex-shrink: 0;
          letter-spacing: 0.5px;
        }

        .user-avatar.admin {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.28);
        }

        .user-avatar.operator {
          background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
          box-shadow: 0 2px 6px rgba(13, 148, 136, 0.25);
        }

        .user-avatar.inactive {
          background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
          box-shadow: 0 2px 6px rgba(100, 116, 139, 0.2);
        }

        .user-full-name {
          font-weight: 800;
          color: #0f172a;
          font-size: 13.5px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .you-pill {
          font-size: 10px;
          font-weight: 800;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          padding: 1px 7px;
          border-radius: 9999px;
          letter-spacing: 0.3px;
        }

        .user-email-sub {
          font-size: 11.5px;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 2px;
        }

        /* Cell: User ID Capsule */
        .user-id-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%);
          border: 1.5px solid #bfdbfe;
          padding: 4px 10px;
          border-radius: 8px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12.5px;
          font-weight: 800;
          color: #1d4ed8;
          box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
          transition: all 0.15s ease;
        }

        .user-id-chip:hover {
          border-color: #93c5fd;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2);
        }

        .copy-btn {
          border: 1px solid #dbeafe;
          background: #ffffff;
          color: #64748b;
          padding: 3px;
          border-radius: 5px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .copy-btn:hover {
          color: #1d4ed8;
          border-color: #93c5fd;
          background: #eff6ff;
        }

        /* Role Badges */
        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3.5px 10px;
          border-radius: 7px;
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: 0.3px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .role-badge.admin {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .role-badge.operator {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        /* Status Badges */
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
        }

        .status-badge.active {
          background: #f0fdf4;
          color: #15803d;
          border: 1.5px solid #bbf7d0;
        }

        .status-badge.inactive {
          background: #fef2f2;
          color: #b91c1c;
          border: 1.5px solid #fecaca;
        }

        .status-dot-active {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #16a34a;
          box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.28);
          animation: pulseDot 2s infinite;
        }

        .status-dot-inactive {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #dc2626;
        }

        @keyframes pulseDot {
          0% {
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.5);
          }
          70% {
            box-shadow: 0 0 0 4px rgba(22, 163, 74, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
          }
        }

        /* Access Rights Badges */
        .access-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3.5px 9px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.3px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .access-badge.put {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .access-badge.pick {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .access-badge.both {
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
        }

        /* Actions */
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 11.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .action-btn.edit {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          color: #334155;
        }

        .action-btn.edit:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #1d4ed8;
          transform: translateY(-1px);
        }

        /* Deactivate Button (Active User -> Inactive) */
        .action-btn.deactivate {
          background: #fffbeb;
          border: 1px solid #fde68a;
          color: #b45309;
        }

        .action-btn.deactivate:hover:not(:disabled) {
          background: #fef3c7;
          border-color: #f59e0b;
          color: #92400e;
          transform: translateY(-1px);
        }

        .action-btn.deactivate:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #94a3b8;
        }

        /* Activate Button (Inactive User -> Active) */
        .action-btn.activate {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #15803d;
        }

        .action-btn.activate:hover:not(:disabled) {
          background: #dcfce7;
          border-color: #22c55e;
          color: #166534;
          transform: translateY(-1px);
        }

        .action-btn.activate:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #94a3b8;
        }

        /* Delete Button (Allowed ONLY when user is Inactive) */
        .action-btn.delete {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
        }

        .action-btn.delete:hover:not(:disabled) {
          background: #dc2626;
          border-color: #dc2626;
          color: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 2px 6px rgba(220, 38, 38, 0.25);
        }

        .action-btn.delete:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #94a3b8;
        }

        /* Locked Delete Button (Disabled when user is Active) */
        .action-btn.delete-locked {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #94a3b8;
          opacity: 0.55;
          cursor: not-allowed;
        }

        .action-btn.delete-locked:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #64748b;
        }

        .pagination-wrap {
          padding: 12px 18px;
          border-top: 1px solid #f1f5f9;
          background: #ffffff;
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

      {/* Header */}
      <div className="page-header-card">
        <div className="header-title-wrap">
          <div className="header-icon-box">
            <Users size={24} />
          </div>
          <div>
            <h1 className="page-title">User Management</h1>
            <p className="page-subtitle">
              Manage user accounts, toggle active/inactive status, assign roles, and station access rights.
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-reload"
            onClick={() => {
              fetchUsers(page, pageSize, roleFilter, statusFilter, searchQuery);
              fetchCounts();
            }}
            title="Refresh user list"
          >
            <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
            Refresh
          </button>
          <button
            type="button"
            className="btn-add-user"
            onClick={() => {
              setUserToEdit(null);
              setIsModalOpen(true);
            }}
          >
            <UserPlus size={15} />
            Add User
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="users-stats-grid">
        {/* Total Users */}
        <div
          className={`user-stat-card ${roleFilter === 'ALL' && statusFilter === 'ALL' ? 'active-card' : ''}`}
          onClick={() => {
            setRoleFilter('ALL');
            setStatusFilter('ALL');
          }}
          title="Click to view all accounts"
        >
          <div className="stat-top-bar" style={{ background: 'linear-gradient(90deg, #334155, #64748b)' }} />
          <div className="stat-meta">
            <div className="stat-label">Total Users</div>
            <div className="stat-value" style={{ color: '#0f172a' }}>
              {stats.total}
            </div>
            <div className="stat-caption">All registered accounts</div>
          </div>
          <div className="stat-icon-box" style={{ background: '#f1f5f9', color: '#334155' }}>
            <Users size={21} />
          </div>
        </div>

        {/* Active Users */}
        <div
          className={`user-stat-card ${statusFilter === 'ACTIVE' ? 'active-card' : ''}`}
          onClick={() => {
            setStatusFilter('ACTIVE');
            setRoleFilter('ALL');
          }}
          title="Click to filter active accounts"
        >
          <div className="stat-top-bar" style={{ background: 'linear-gradient(90deg, #16a34a, #4ade80)' }} />
          <div className="stat-meta">
            <div className="stat-label">Active Users</div>
            <div className="stat-value" style={{ color: '#15803d' }}>
              {stats.active}
            </div>
            <div className="stat-caption">Operational &amp; login enabled</div>
          </div>
          <div className="stat-icon-box" style={{ background: '#f0fdf4', color: '#16a34a' }}>
            <UserCheck size={21} />
          </div>
        </div>

        {/* Inactive Users */}
        <div
          className={`user-stat-card ${statusFilter === 'INACTIVE' ? 'active-card' : ''}`}
          onClick={() => {
            setStatusFilter('INACTIVE');
            setRoleFilter('ALL');
          }}
          title="Click to view inactive accounts eligible for deletion"
        >
          <div className="stat-top-bar" style={{ background: 'linear-gradient(90deg, #dc2626, #f87171)' }} />
          <div className="stat-meta">
            <div className="stat-label">Inactive Users</div>
            <div className="stat-value" style={{ color: '#b91c1c' }}>
              {stats.inactive}
            </div>
            <div className="stat-caption">Disabled • Eligible for delete</div>
          </div>
          <div className="stat-icon-box" style={{ background: '#fef2f2', color: '#dc2626' }}>
            <UserX size={21} />
          </div>
        </div>

        {/* Administrators */}
        <div
          className={`user-stat-card ${roleFilter === 'ADMIN' ? 'active-card' : ''}`}
          onClick={() => {
            setRoleFilter('ADMIN');
            setStatusFilter('ALL');
          }}
          title="Click to filter administrators"
        >
          <div className="stat-top-bar" style={{ background: 'linear-gradient(90deg, #2563eb, #60a5fa)' }} />
          <div className="stat-meta">
            <div className="stat-label">Administrators</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>
              {stats.admins}
            </div>
            <div className="stat-caption">Full system privileges</div>
          </div>
          <div className="stat-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <ShieldCheck size={21} />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="toolbar-left">
            {/* Role Filter Pills */}
            <div className="pill-group">
              {[
                { key: 'ALL' as const, label: 'All Roles', count: stats.total },
                { key: 'ADMIN' as const, label: 'Admins', count: stats.admins },
                { key: 'USER' as const, label: 'Operators', count: stats.operators },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`pill-btn ${roleFilter === tab.key ? 'active' : ''}`}
                  onClick={() => setRoleFilter(tab.key)}
                >
                  <span>{tab.label}</span>
                  <span className="pill-count">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Status Filter Pills */}
            <div className="pill-group">
              <button
                type="button"
                className={`pill-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setStatusFilter('ALL')}
              >
                <span>All Status</span>
              </button>
              <button
                type="button"
                className={`pill-btn ${statusFilter === 'ACTIVE' ? 'active-green' : ''}`}
                onClick={() => setStatusFilter('ACTIVE')}
              >
                <span>Active</span>
                <span className="pill-count">{stats.active}</span>
              </button>
              <button
                type="button"
                className={`pill-btn ${statusFilter === 'INACTIVE' ? 'active-red' : ''}`}
                onClick={() => setStatusFilter('INACTIVE')}
              >
                <span>Inactive</span>
                <span className="pill-count">{stats.inactive}</span>
              </button>
            </div>
          </div>

          <div className="toolbar-right">
            <div className="search-wrap">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search name, user ID, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="users-counter-badge">
              <Users size={14} className="text-primary" />
              <span>
                {totalItems} {totalItems === 1 ? 'user matching' : 'users matching'}
              </span>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          {loading ? (
            <Loader message="Loading users..." />
          ) : users.length === 0 ? (
            <EmptyState
              title="No users found"
              description={
                searchQuery
                  ? `No user accounts match "${searchQuery}". Check the query or clear search.`
                  : statusFilter !== 'ALL'
                  ? `No ${statusFilter.toLowerCase()} users found. Change the filter or add new accounts.`
                  : 'No users found for this filter. Click "Add User" to register an account.'
              }
            />
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>
                    <div className="d-flex align-items-center gap-1.5">
                      <UserIcon size={14} className="text-primary" />
                      <span>User</span>
                    </div>
                  </th>
                  <th style={{ width: '14%' }}>
                    <div className="d-flex align-items-center gap-1.5">
                      <Key size={14} className="text-slate-600" />
                      <span>User ID</span>
                    </div>
                  </th>
                  <th style={{ width: '11%' }}>
                    <div className="d-flex align-items-center gap-1.5">
                      <ShieldCheck size={14} className="text-slate-600" />
                      <span>Role</span>
                    </div>
                  </th>
                  <th style={{ width: '11%' }}>
                    <div className="d-flex align-items-center gap-1.5">
                      <Activity size={14} className="text-slate-600" />
                      <span>Status</span>
                    </div>
                  </th>
                  <th style={{ width: '13%' }}>
                    <div className="d-flex align-items-center gap-1.5">
                      <Layers size={14} className="text-slate-600" />
                      <span>Station Access</span>
                    </div>
                  </th>
                  <th style={{ width: '11%' }}>
                    <div className="d-flex align-items-center gap-1.5">
                      <Clock size={14} className="text-slate-600" />
                      <span>Created Date</span>
                    </div>
                  </th>
                  <th style={{ width: '18%', textAlign: 'right' }}>
                    <div className="d-flex align-items-center justify-content-end gap-1.5">
                      <Zap size={14} className="text-amber-600" />
                      <span>Actions</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  const isRoleAdmin = u.role === 'ADMIN';
                  const isActive = u.is_active !== false;
                  const fullName =
                    [u.first_name, u.last_name].filter(Boolean).join(' ') || u.user_id;

                  return (
                    <tr key={u.id} className={!isActive ? 'row-inactive' : ''}>
                      {/* User Profile */}
                      <td>
                        <div className="user-identity-cell">
                          <div
                            className={`user-avatar ${
                              !isActive ? 'inactive' : isRoleAdmin ? 'admin' : 'operator'
                            }`}
                          >
                            {getInitials(u)}
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div className="user-full-name text-truncate">
                              <span className="text-truncate">{fullName}</span>
                              {isSelf && <span className="you-pill">You</span>}
                            </div>
                            <div className="user-email-sub text-truncate">
                              <Mail size={11} className="text-muted flex-shrink-0" />
                              <span className="text-truncate">{u.email || 'No email provided'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* User ID */}
                      <td>
                        <div className="user-id-chip">
                          <span>{u.user_id}</span>
                          <button
                            type="button"
                            className="copy-btn"
                            onClick={() => handleCopyUserId(u.user_id)}
                            title="Copy User ID"
                          >
                            {copiedId === u.user_id ? (
                              <Check size={12} className="text-success" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td>
                        <span className={`role-badge ${isRoleAdmin ? 'admin' : 'operator'}`}>
                          {isRoleAdmin ? <ShieldCheck size={12} /> : <UserCheck size={12} />}
                          {isRoleAdmin ? 'ADMIN' : 'OPERATOR'}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td>
                        {isActive ? (
                          <span className="status-badge active" title="Account is active and operational">
                            <span className="status-dot-active" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="status-badge inactive" title="Account is deactivated (login blocked)">
                            <span className="status-dot-inactive" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* Station Access */}
                      <td>
                        {(() => {
                          const effectiveAccess = isRoleAdmin ? 'BOTH' : u.access_type || 'BOTH';
                          const badgeClass =
                            effectiveAccess === 'PUT_ONLY'
                              ? 'put'
                              : effectiveAccess === 'PICK_ONLY'
                              ? 'pick'
                              : 'both';
                          const IconComponent =
                            effectiveAccess === 'PUT_ONLY'
                              ? PackagePlus
                              : effectiveAccess === 'PICK_ONLY'
                              ? PackageMinus
                              : CheckCircle2;
                          const label =
                            effectiveAccess === 'PUT_ONLY'
                              ? 'PUT ONLY'
                              : effectiveAccess === 'PICK_ONLY'
                              ? 'PICK ONLY'
                              : 'PUT & PICK';
                          return (
                            <span className={`access-badge ${badgeClass}`}>
                              <IconComponent size={11} />
                              <span>{label}</span>
                            </span>
                          );
                        })()}
                      </td>

                      {/* Created Date */}
                      <td>
                        <span
                          className="d-inline-flex align-items-center gap-1 text-muted"
                          style={{ fontSize: '12px', fontWeight: 600 }}
                        >
                          <Clock size={12} />
                          {formatDate(u.created_at)}
                        </span>
                      </td>

                      {/* Actions Column */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="d-inline-flex align-items-center justify-content-end gap-1.5">
                          {/* 1. Edit Button */}
                          <button
                            type="button"
                            className="action-btn edit"
                            onClick={() => {
                              setUserToEdit(u);
                              setIsModalOpen(true);
                            }}
                            title="Edit user details and access rights"
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>

                          {/* 2. Active / Inactive Toggle Button */}
                          {isActive ? (
                            <button
                              type="button"
                              className="action-btn deactivate"
                              disabled={isSelf}
                              onClick={() => {
                                if (isSelf) return;
                                setStatusError('');
                                setStatusModalTarget({ user: u, nextStatus: false });
                              }}
                              title={
                                isSelf
                                  ? 'You cannot deactivate your own account'
                                  : 'Deactivate user account (sets to Inactive)'
                              }
                            >
                              <UserX size={12} />
                              <span>Deactivate</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="action-btn activate"
                              disabled={isSelf}
                              onClick={() => {
                                if (isSelf) return;
                                setStatusError('');
                                setStatusModalTarget({ user: u, nextStatus: true });
                              }}
                              title="Reactivate user account (sets to Active)"
                            >
                              <UserCheck size={12} />
                              <span>Activate</span>
                            </button>
                          )}

                          {/* 3. Delete Button: ONLY enabled if user is INACTIVE */}
                          {isActive ? (
                            <button
                              type="button"
                              className="action-btn delete-locked"
                              disabled={true}
                              title="Active user cannot be deleted. Set to Inactive first to enable deletion."
                            >
                              <Lock size={11} />
                              <span>Delete</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="action-btn delete"
                              disabled={isSelf}
                              onClick={() => {
                                if (isSelf) return;
                                setDeleteError('');
                                setDeleteTarget(u);
                              }}
                              title={
                                isSelf
                                  ? 'You cannot delete your own account'
                                  : 'Permanently delete this inactive user'
                              }
                            >
                              <Trash2 size={12} />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="pagination-wrap">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => fetchUsers(p, pageSize, roleFilter, statusFilter, searchQuery)}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              fetchUsers(1, newSize, roleFilter, statusFilter, searchQuery);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        </div>
      </div>

      {/* Add / Edit User Modal */}
      <AddUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchUsers(page, pageSize, roleFilter, statusFilter, searchQuery);
          fetchCounts();
        }}
        userToEdit={userToEdit}
      />

      {/* Account Status Confirmation Modal (Deactivate / Reactivate) */}
      {statusModalTarget && (
        <Modal
          isOpen={!!statusModalTarget}
          onClose={() => !statusUpdating && setStatusModalTarget(null)}
          title={
            <div
              className={`d-flex align-items-center gap-2 ${
                statusModalTarget.nextStatus ? 'text-success' : 'text-warning'
              }`}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: statusModalTarget.nextStatus ? '#f0fdf4' : '#fffbeb',
                  color: statusModalTarget.nextStatus ? '#16a34a' : '#d97706',
                  border: `1px solid ${statusModalTarget.nextStatus ? '#bbf7d0' : '#fde68a'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {statusModalTarget.nextStatus ? <UserCheck size={18} /> : <UserX size={18} />}
              </div>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: statusModalTarget.nextStatus ? '#15803d' : '#92400e',
                }}
              >
                {statusModalTarget.nextStatus ? 'Reactivate User Account' : 'Deactivate User Account'}
              </span>
            </div>
          }
          maxWidth="480px"
        >
          <div className="d-flex flex-column gap-3">
            <p className="text-muted mb-0" style={{ fontSize: '13.5px', lineHeight: 1.5 }}>
              Are you sure you want to{' '}
              <strong>{statusModalTarget.nextStatus ? 'reactivate' : 'deactivate'}</strong> user account{' '}
              <strong className="text-dark">
                {[statusModalTarget.user.first_name, statusModalTarget.user.last_name]
                  .filter(Boolean)
                  .join(' ') || statusModalTarget.user.user_id}
              </strong>{' '}
              (<span className="font-monospace text-primary">{statusModalTarget.user.user_id}</span>)?
            </p>

            {statusModalTarget.nextStatus ? (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#15803d',
                }}
              >
                ✓ <strong>Note:</strong> Reactivating this user will immediately restore their ability to log in and operate assigned Kardex stations.
              </div>
            ) : (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  color: '#92400e',
                }}
              >
                ⚠️ <strong>Important:</strong> Deactivating prevents the user from logging in or performing any station activities.
                <div style={{ marginTop: '5px', fontWeight: 600 }}>
                  Once deactivated, this account can be permanently deleted if needed, or reactivated later.
                </div>
              </div>
            )}

            {statusError && (
              <div className="alert alert-danger py-2 px-3 mb-0" style={{ fontSize: '12.5px' }}>
                {statusError}
              </div>
            )}

            <div className="d-flex justify-content-end gap-2 pt-2 border-top">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm px-3"
                onClick={() => setStatusModalTarget(null)}
                disabled={statusUpdating}
                style={{ fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn-sm px-3 d-inline-flex align-items-center gap-1.5 fw-bold ${
                  statusModalTarget.nextStatus ? 'btn-success' : 'btn-warning text-dark'
                }`}
                onClick={handleConfirmStatusChange}
                disabled={statusUpdating}
                style={{
                  boxShadow: statusModalTarget.nextStatus
                    ? '0 2px 6px rgba(22, 163, 74, 0.3)'
                    : '0 2px 6px rgba(217, 119, 6, 0.3)',
                }}
              >
                {statusUpdating ? (
                  <Loader2 size={14} className="spin-animation" />
                ) : statusModalTarget.nextStatus ? (
                  <UserCheck size={14} />
                ) : (
                  <UserX size={14} />
                )}
                <span>
                  {statusUpdating
                    ? 'Updating...'
                    : statusModalTarget.nextStatus
                    ? 'Confirm Activation'
                    : 'Confirm Deactivation'}
                </span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal (Inactive accounts only) */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => !deleting && setDeleteTarget(null)}
          title={
            <div className="d-flex align-items-center gap-2 text-danger">
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={18} />
              </div>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#991b1b' }}>
                Permanently Delete Inactive User
              </span>
            </div>
          }
          maxWidth="480px"
        >
          <div className="d-flex flex-column gap-3">
            <p className="text-muted mb-0" style={{ fontSize: '13.5px', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete inactive user account{' '}
              <strong className="text-dark">
                {[deleteTarget.first_name, deleteTarget.last_name].filter(Boolean).join(' ') ||
                  deleteTarget.user_id}
              </strong>{' '}
              (<span className="font-monospace text-primary">{deleteTarget.user_id}</span>)?
            </p>

            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#991b1b',
              }}
            >
              ⚠️ <strong>Permanent Action:</strong> This user account is currently <strong>INACTIVE</strong>. Deleting will permanently erase their record from the database. This cannot be undone.
            </div>

            {deleteError && (
              <div className="alert alert-danger py-2 px-3 mb-0" style={{ fontSize: '12.5px' }}>
                {deleteError}
              </div>
            )}

            <div className="d-flex justify-content-end gap-2 pt-2 border-top">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm px-3"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{ fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm px-3 d-inline-flex align-items-center gap-1.5 fw-bold"
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  background: '#dc2626',
                  borderColor: '#b91c1c',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                }}
              >
                {deleting ? <Loader2 size={14} className="spin-animation" /> : <Trash2 size={14} />}
                <span>{deleting ? 'Deleting...' : 'Confirm Permanent Delete'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
