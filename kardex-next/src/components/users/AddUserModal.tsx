'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiPost, apiPut } from '@/lib/api';
import { User, CreateUserPayload } from '@/types';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userToEdit?: User | null;
}

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userToEdit,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'USER'>('USER');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isEdit = !!userToEdit;

  useEffect(() => {
    if (isOpen) {
      if (userToEdit) {
        setFirstName(userToEdit.first_name || '');
        setLastName(userToEdit.last_name || '');
        setUserId(userToEdit.user_id || '');
        setEmail(userToEdit.email || '');
        setPassword('');
        setRole(userToEdit.role || 'USER');
      } else {
        setFirstName('');
        setLastName('');
        setUserId('');
        setEmail('');
        setPassword('');
        setRole('USER');
      }
      setErrorMsg('');
    }
  }, [isOpen, userToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !userId || (!isEdit && !password)) {
      setErrorMsg('First Name, User ID, and Password are required.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');

      if (isEdit && userToEdit) {
        await apiPost(`/user/update/${userToEdit.id}`, {
          first_name: firstName,
          last_name: lastName,
          user_id: userId,
          email,
          role,
        });

        if (password) {
          await apiPost('/user/change-password', {
            id: userToEdit.id,
            password,
          });
        }
      } else {
        const payload: CreateUserPayload = {
          first_name: firstName,
          last_name: lastName,
          user_id: userId,
          email,
          password,
          role,
        };
        await apiPost('/user/create', payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving user details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit User Details' : 'Create New User'}
      maxWidth="550px"
    >
      <form onSubmit={handleSubmit} className="user-form">
        <style jsx>{`
          .user-form {
            display: flex;
            flex-direction: column;
            gap: 1.15rem;
          }

          .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
          }

          .error-box {
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            color: #991b1b;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            font-size: 0.85rem;
          }

          .btn-submit {
            background-color: #0d6efd;
            color: #ffffff;
            border: none;
            padding: 0.75rem 1.25rem;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            margin-top: 0.5rem;
            transition: background-color 0.2s ease;
          }

          .btn-submit:hover:not(:disabled) {
            background-color: #0b5ed7;
          }

          .btn-submit:disabled {
            opacity: 0.65;
            cursor: not-allowed;
          }
        `}</style>

        {errorMsg && <div className="error-box">{errorMsg}</div>}

        <div className="grid-2">
          <div>
            <label className="form-label">First Name *</label>
            <input
              type="text"
              className="form-control"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Last Name</label>
            <input
              type="text"
              className="form-control"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid-2">
          <div>
            <label className="form-label">User ID *</label>
            <input
              type="text"
              className="form-control"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label">Role</label>
            <select
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value as 'ADMIN' | 'USER')}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
        </div>

        <div>
          <label className="form-label">Email Address</label>
          <input
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label">
            Password {isEdit ? '(Leave blank to keep unchanged)' : '*'}
          </label>
          <input
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={!isEdit}
          />
        </div>

        <button type="submit" className="btn-submit" disabled={loading}>
          {loading ? 'Saving User...' : isEdit ? 'Update User' : 'Create User'}
        </button>
      </form>
    </Modal>
  );
};
