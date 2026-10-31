'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AddUserModal } from '@/components/users/AddUserModal';
import { Pagination } from '@/components/shared/Pagination';
import { Loader } from '@/components/shared/Loader';
import { EmptyState } from '@/components/shared/EmptyState';
import { apiGet, apiDelete } from '@/lib/api';
import { User, PaginatedResponse } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { UserPlus, Edit, Trash2 } from 'lucide-react';

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  const fetchUsers = useCallback(async (pageNum = 1, currentSize = pageSize) => {
    try {
      setLoading(true);
      const res = await apiGet<PaginatedResponse<User>>('/user/get-all', {
        page: String(pageNum),
        size: String(currentSize),
      });
      setUsers(res.data || []);
      setTotalPages(res.totalPages || 1);
      setTotalItems(res.totalItems || 0);
      setPage(res.page || 1);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/error/403');
      return;
    }
    fetchUsers(1);
  }, [isAdmin, router, fetchUsers]);

  const handleDeleteUser = async (user: User) => {
    if (confirm(`Are you sure you want to delete user "${user.first_name} ${user.last_name || ''}"?`)) {
      try {
        await apiDelete(`/user/delete/${user.id}`);
        fetchUsers(page);
      } catch (err: any) {
        alert(err.message || 'Error deleting user');
      }
    }
  };

  return (
    <div className="row" style={{ padding: '18px 12px' }}>
      <style jsx>{`
        .table-card {
          border-radius: 12px;
          background-color: #fff !important;
          box-shadow: 0 1px 3px #0000001a;
          padding: 20px;
        }
        .table-card .title {
          margin: 9px 4px 15px;
        }
        .table-card .title h6 {
          font-weight: 700;
          font-size: 16px;
          color: #212529;
        }
        .add-btn {
          border-radius: 25px;
          font-size: 13px;
          font-weight: 600;
          padding: 6px 16px;
        }
        .table-card table thead th {
          font-size: 13px;
          color: #707070;
          background-color: #f8f9fa;
        }
        .table-card table tbody td {
          font-size: 13px;
          color: #212529;
          font-weight: 500;
          vertical-align: middle;
        }
        .btn-action-link {
          padding: 0px !important;
          font-size: 13px;
          color: #0d6efd;
          background: none;
          border: none;
          cursor: pointer;
        }
        .btn-action-link.danger {
          color: #dc3545;
          margin-left: 15px;
        }
      `}</style>

      <div className="card table-card">
        <div className="title d-flex justify-content-between align-items-center">
          <h6>User List</h6>

          <button
            className="add-btn btn btn-dark d-flex align-items-center gap-1"
            onClick={() => {
              setUserToEdit(null);
              setIsModalOpen(true);
            }}
          >
            Add User <UserPlus size={16} />
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <Loader message="Loading users..." />
          ) : users.length === 0 ? (
            <EmptyState title="No users found" description="Click 'Add User' to create the first user." />
          ) : (
            <table className="table table-hover table-bordered">
              <thead>
                <tr>
                  <th>User Id</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Role</th>
                  <th>Created By</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.user_id}</td>
                    <td>{u.first_name}</td>
                    <td>{u.last_name || '-'}</td>
                    <td>
                      <span className={`badge ${u.role === 'ADMIN' ? 'bg-danger' : 'bg-info'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      {u.created_user_first_name
                        ? `${u.created_user_first_name} ${u.created_user_last_name || ''}`
                        : u.created_by || 'SYSTEM'}
                    </td>
                    <td className="text-end">
                      <button
                        className="btn-action-link"
                        onClick={() => {
                          setUserToEdit(u);
                          setIsModalOpen(true);
                        }}
                      >
                        <Edit size={15} className="me-1" /> Edit
                      </button>
                      <button
                        className="btn-action-link danger"
                        onClick={() => handleDeleteUser(u)}
                      >
                        <Trash2 size={15} className="me-1" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-3">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => fetchUsers(p, pageSize)}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              fetchUsers(1, newSize);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      </div>

      <AddUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => fetchUsers(page)}
        userToEdit={userToEdit}
      />
    </div>
  );
}
