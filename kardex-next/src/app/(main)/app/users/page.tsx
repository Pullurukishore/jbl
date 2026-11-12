'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { AddUserModal } from '@/components/users/AddUserModal';
import { Modal } from '@/components/shared/Modal';
import { Pagination } from '@/components/shared/Pagination';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import { apiGet, apiDelete } from '@/lib/api';
import { User, PaginatedResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  ShieldCheck,
  UserCheck,
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
} from 'lucide-react';

type RoleFilter = 'ALL' | 'ADMIN' | 'USER';

export default function UsersPage() {
  const { isAdmin, user: currentUser } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [roleCounts, setRoleCounts] = useState({ total: 0, admins: 0, operators: 0 });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchCounts = useCallback(async () => {
    try {
      const [allRes, adminRes, userRes] = await Promise.all([
        apiGet<PaginatedResponse<User>>('/user/get-all', { page: '1', size: '1' }),
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
      setRoleCounts({
        total: allRes.totalItems || 0,
        admins: adminRes.totalItems || 0,
        operators: userRes.totalItems || 0,
      });
    } catch {
      // ignore count refresh failures
    }
  }, []);

  const fetchUsers = useCallback(
    async (pageNum = 1, currentSize = pageSize, role: RoleFilter = roleFilter) => {
      try {
        setLoading(true);
        const params: Record<string, string> = {
          page: String(pageNum),
          size: String(currentSize),
        };
        if (role !== 'ALL') {
          params['role.equals'] = role;
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
    [pageSize, roleFilter]
  );

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/error/403');
      return;
    }
    fetchCounts();
  }, [isAdmin, router, fetchCounts]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers(1, pageSize, roleFilter);
  }, [isAdmin, roleFilter, pageSize, fetchUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
      return (
        u.user_id?.toLowerCase().includes(q) ||
        fullName.includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const handleCopyUserId = (idText: string) => {
    navigator.clipboard.writeText(idText);
    setCopiedId(idText);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      setDeleteError('');
      await apiDelete(`/user/delete/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchUsers(page, pageSize, roleFilter);
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
        }

        /* Header Card */
        .page-header-card {
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1.25rem 1.5rem;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.03);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header-title-wrap {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .header-icon-box {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.28);
          flex-shrink: 0;
        }

        .page-title {
          font-size: 20px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.3px;
        }

        .page-subtitle {
          font-size: 13px;
          color: #64748b;
          margin: 2px 0 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .btn-reload {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #475569;
          padding: 7px 14px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-reload:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        .btn-add-user {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          color: #ffffff;
          padding: 8px 18px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.28);
          transition: all 0.18s ease;
        }

        .btn-add-user:hover {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.36);
        }

        /* 3 Role Summary Cards */
        .users-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        @media (max-width: 767px) {
          .users-stats-grid {
            grid-template-columns: 1fr;
          }
        }

        .user-stat-card {
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: all 0.18s ease;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }

        .user-stat-card:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 8px 18px -6px rgba(15, 23, 42, 0.1);
        }

        .user-stat-card.active-card {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.14);
        }

        .stat-top-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
        }

        .stat-label {
          font-size: 11.5px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }

        .stat-value {
          font-size: 26px;
          font-weight: 800;
          line-height: 1.1;
          margin-top: 4px;
          font-variant-numeric: tabular-nums;
        }

        .stat-caption {
          font-size: 11px;
          color: #94a3b8;
          font-weight: 600;
          margin-top: 2px;
        }

        .stat-icon-box {
          width: 42px;
          height: 42px;
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
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.03);
          overflow: hidden;
        }

        .table-toolbar {
          padding: 14px 18px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          background: #fafbfc;
        }

        .role-pill-group {
          display: inline-flex;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          padding: 3px;
          gap: 2px;
        }

        .role-pill-btn {
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

        .role-pill-btn:hover {
          color: #0f172a;
          background: rgba(255, 255, 255, 0.75);
        }

        .role-pill-btn.active {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          font-weight: 700;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
        }

        .pill-count {
          font-size: 11px;
          padding: 1px 6px;
          border-radius: 9999px;
          background: rgba(15, 23, 42, 0.08);
        }

        .role-pill-btn.active .pill-count {
          background: rgba(255, 255, 255, 0.22);
          color: #ffffff;
        }

        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .search-wrap {
          position: relative;
          min-width: 240px;
        }

        .search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 6px 30px 6px 32px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          font-size: 12.5px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .search-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.14);
        }

        .search-clear {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 2px;
          display: flex;
        }

        .users-table {
          width: 100%;
          border-collapse: collapse;
        }

        .users-table thead th {
          background: #f8fafc;
          padding: 11px 16px;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        .users-table tbody td {
          padding: 12px 16px;
          font-size: 13px;
          color: #1e293b;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }

        .users-table tbody tr:hover {
          background: #f8fafc;
        }

        .users-table tbody tr:last-child td {
          border-bottom: none;
        }

        .user-identity-cell {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12.5px;
          font-weight: 800;
          color: #ffffff;
          flex-shrink: 0;
        }

        .user-avatar.admin {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
        }

        .user-avatar.operator {
          background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
          box-shadow: 0 2px 6px rgba(13, 148, 136, 0.22);
        }

        .user-full-name {
          font-weight: 700;
          color: #0f172a;
          font-size: 13.5px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .you-pill {
          font-size: 10px;
          font-weight: 700;
          background: #eff6ff;
          color: #2563eb;
          border: 1px solid #bfdbfe;
          padding: 1px 6px;
          border-radius: 9999px;
        }

        .user-email-sub {
          font-size: 11.5px;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 1px;
        }

        .user-id-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          padding: 4px 9px;
          border-radius: 7px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12.5px;
          font-weight: 700;
          color: #0f172a;
        }

        .copy-btn {
          border: none;
          background: transparent;
          color: #94a3b8;
          padding: 1px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
        }

        .copy-btn:hover {
          color: #2563eb;
        }

        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11.5px;
          font-weight: 700;
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

        .access-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.25px;
        }

        .access-badge.put {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }

        .access-badge.pick {
          background: #fef3c7;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .access-badge.both {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .action-btn.edit {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #334155;
        }

        .action-btn.edit:hover {
          background: #eff6ff;
          border-color: #93c5fd;
          color: #1d4ed8;
        }

        .action-btn.delete {
          background: #fff5f5;
          border: 1px solid #fecaca;
          color: #dc2626;
        }

        .action-btn.delete:hover {
          background: #dc2626;
          border-color: #dc2626;
          color: #ffffff;
        }

        .pagination-wrap {
          padding: 12px 18px;
          border-top: 1px solid #f1f5f9;
          background: #fafbfc;
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
            <Users size={22} />
          </div>
          <div>
            <h1 className="page-title">User Management</h1>
            <p className="page-subtitle">
              Manage operator accounts, administrator roles, and system access.
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-reload"
            onClick={() => {
              fetchUsers(page, pageSize, roleFilter);
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

      {/* Role Summary Strip */}
      <div className="users-stats-grid">
        <div
          className={`user-stat-card ${roleFilter === 'ALL' ? 'active-card' : ''}`}
          onClick={() => setRoleFilter('ALL')}
        >
          <div className="stat-top-bar" style={{ background: 'linear-gradient(90deg, #334155, #64748b)' }} />
          <div>
            <div className="stat-label">Total Users</div>
            <div className="stat-value" style={{ color: '#0f172a' }}>
              {roleCounts.total}
            </div>
            <div className="stat-caption">All registered accounts</div>
          </div>
          <div className="stat-icon-box" style={{ background: '#f1f5f9', color: '#334155' }}>
            <Users size={20} />
          </div>
        </div>

        <div
          className={`user-stat-card ${roleFilter === 'ADMIN' ? 'active-card' : ''}`}
          onClick={() => setRoleFilter('ADMIN')}
        >
          <div className="stat-top-bar" style={{ background: 'linear-gradient(90deg, #2563eb, #60a5fa)' }} />
          <div>
            <div className="stat-label">Administrators</div>
            <div className="stat-value" style={{ color: '#2563eb' }}>
              {roleCounts.admins}
            </div>
            <div className="stat-caption">Full system access</div>
          </div>
          <div className="stat-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <ShieldCheck size={20} />
          </div>
        </div>

        <div
          className={`user-stat-card ${roleFilter === 'USER' ? 'active-card' : ''}`}
          onClick={() => setRoleFilter('USER')}
        >
          <div className="stat-top-bar" style={{ background: 'linear-gradient(90deg, #0d9488, #2dd4bf)' }} />
          <div>
            <div className="stat-label">Operators</div>
            <div className="stat-value" style={{ color: '#0f766e' }}>
              {roleCounts.operators}
            </div>
            <div className="stat-caption">Floor scan &amp; Kardex ops</div>
          </div>
          <div className="stat-icon-box" style={{ background: '#f0fdfa', color: '#0d9488' }}>
            <UserCheck size={20} />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="role-pill-group">
            {[
              { key: 'ALL' as const, label: 'All Users', count: roleCounts.total },
              { key: 'ADMIN' as const, label: 'Admins', count: roleCounts.admins },
              { key: 'USER' as const, label: 'Operators', count: roleCounts.operators },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`role-pill-btn ${roleFilter === tab.key ? 'active' : ''}`}
                onClick={() => setRoleFilter(tab.key)}
              >
                <span>{tab.label}</span>
                <span className="pill-count">{tab.count}</span>
              </button>
            ))}
          </div>

          <div className="toolbar-right">
            <div className="search-wrap">
              <Search size={14} className="search-icon" />
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
                  <X size={13} />
                </button>
              )}
            </div>

            <span className="text-muted" style={{ fontSize: '12px', fontWeight: 600 }}>
              {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <Loader message="Loading users..." />
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              title="No users found"
              description={
                searchQuery
                  ? 'No users match your search on this page.'
                  : 'Click "Add User" to create the first user account.'
              }
            />
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>User ID</th>
                  <th>Role</th>
                  <th>Access</th>
                  <th>Created By</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  const isRoleAdmin = u.role === 'ADMIN';
                  const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.user_id;
                  const creatorName = u.created_user_first_name
                    ? `${u.created_user_first_name} ${u.created_user_last_name || ''}`.trim()
                    : u.created_by || 'SYSTEM';

                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-identity-cell">
                          <div className={`user-avatar ${isRoleAdmin ? 'admin' : 'operator'}`}>
                            {getInitials(u)}
                          </div>
                          <div>
                            <div className="user-full-name">
                              <span>{fullName}</span>
                              {isSelf && <span className="you-pill">You</span>}
                            </div>
                            <div className="user-email-sub">
                              <Mail size={11} />
                              <span>{u.email || 'No email provided'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

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

                      <td>
                        <span className={`role-badge ${isRoleAdmin ? 'admin' : 'operator'}`}>
                          {isRoleAdmin ? <ShieldCheck size={12} /> : <UserCheck size={12} />}
                          {isRoleAdmin ? 'ADMIN' : 'OPERATOR'}
                        </span>
                      </td>

                      <td>
                        {(() => {
                          const effectiveAccess = isRoleAdmin ? 'BOTH' : (u.access_type || 'BOTH');
                          const badgeClass =
                            effectiveAccess === 'PUT_ONLY'
                              ? 'put'
                              : effectiveAccess === 'PICK_ONLY'
                              ? 'pick'
                              : 'both';
                          const label =
                            effectiveAccess === 'PUT_ONLY'
                              ? 'PUT ONLY'
                              : effectiveAccess === 'PICK_ONLY'
                              ? 'PICK ONLY'
                              : 'PUT & PICK';
                          return <span className={`access-badge ${badgeClass}`}>{label}</span>;
                        })()}
                      </td>

                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{creatorName}</span>
                      </td>

                      <td>
                        <span
                          className="d-inline-flex align-items-center gap-1 text-muted"
                          style={{ fontSize: '12px', fontWeight: 500 }}
                        >
                          <Clock size={12} />
                          {formatDate(u.created_at)}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="d-inline-flex align-items-center gap-2">
                          <button
                            type="button"
                            className="action-btn edit"
                            onClick={() => {
                              setUserToEdit(u);
                              setIsModalOpen(true);
                            }}
                          >
                            <Edit3 size={13} />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="action-btn delete"
                            onClick={() => {
                              setDeleteError('');
                              setDeleteTarget(u);
                            }}
                          >
                            <Trash2 size={13} />
                            Delete
                          </button>
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
            onPageChange={(p) => fetchUsers(p, pageSize, roleFilter)}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              fetchUsers(1, newSize, roleFilter);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      </div>

      {/* Add / Edit User Modal */}
      <AddUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchUsers(page, pageSize, roleFilter);
          fetchCounts();
        }}
        userToEdit={userToEdit}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => !deleting && setDeleteTarget(null)}
          title={
            <div className="d-flex align-items-center gap-2 text-danger">
              <AlertTriangle size={18} />
              <span>Delete User Account</span>
            </div>
          }
          maxWidth="440px"
        >
          <div>
            <p className="text-muted mb-3" style={{ fontSize: '13.5px' }}>
              Are you sure you want to delete{' '}
              <strong className="text-dark">
                {[deleteTarget.first_name, deleteTarget.last_name].filter(Boolean).join(' ') ||
                  deleteTarget.user_id}
              </strong>{' '}
              (<span className="font-monospace">{deleteTarget.user_id}</span>)? This action cannot be undone.
            </p>

            {deleteError && (
              <div className="alert alert-danger py-2 px-3 mb-3" style={{ fontSize: '12.5px' }}>
                {deleteError}
              </div>
            )}

            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm px-3"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm px-3 d-inline-flex align-items-center gap-1 fw-bold"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 size={14} className="spin-animation" /> : <Trash2 size={14} />}
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
