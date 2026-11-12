'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/shared/Modal';
import { apiPost } from '@/lib/api';
import { User, CreateUserPayload, AccessType } from '@/types';
import { PackagePlus, PackageMinus, Layers, ShieldCheck } from 'lucide-react';

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
  const [accessType, setAccessType] = useState<AccessType>('BOTH');
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
        setAccessType(userToEdit.role === 'ADMIN' ? 'BOTH' : userToEdit.access_type || 'BOTH');
      } else {
        setFirstName('');
        setLastName('');
        setUserId('');
        setEmail('');
        setPassword('');
        setRole('USER');
        setAccessType('BOTH');
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

    const effectiveAccess: AccessType = role === 'ADMIN' ? 'BOTH' : accessType;

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
          access_type: effectiveAccess,
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
          access_type: effectiveAccess,
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

          .access-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
          }

          .access-card {
            border: 1.5px solid #e2e8f0;
            background: #ffffff;
            border-radius: 10px;
            padding: 10px;
            cursor: pointer;
            transition: all 0.15s ease;
            text-align: left;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .access-card:hover {
            border-color: #cbd5e1;
            background: #f8fafc;
          }

          .access-card.selected {
            border-color: #2563eb;
            background: #eff6ff;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.16);
          }

          .access-card-title {
            font-size: 12.5px;
            font-weight: 700;
            color: #0f172a;
            display: flex;
            align-items: center;
            gap: 6px;
          }

          .access-card.selected .access-card-title {
            color: #1d4ed8;
          }

          .access-card-sub {
            font-size: 11px;
            color: #64748b;
            line-height: 1.25;
          }

          .admin-access-note {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1e40af;
            border-radius: 9px;
            padding: 9px 12px;
            font-size: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
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
              onChange={(e) => {
                const nextRole = e.target.value as 'ADMIN' | 'USER';
                setRole(nextRole);
                if (nextRole === 'ADMIN') setAccessType('BOTH');
              }}
            >
              <option value="USER">USER (Operator)</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
        </div>

        <div>
          <label className="form-label">Operation Access</label>
          {role === 'ADMIN' ? (
            <div className="admin-access-note">
              <ShieldCheck size={16} />
              <span>Administrators automatically have full PUT &amp; PICK access.</span>
            </div>
          ) : (
            <div className="access-grid">
              {[
                {
                  key: 'PUT_ONLY' as const,
                  title: 'PUT Only',
                  sub: 'Scan & load bins into Kardex',
                  icon: <PackagePlus size={14} />,
                },
                {
                  key: 'PICK_ONLY' as const,
                  title: 'PICK Only',
                  sub: 'Scan & pick parts from Kardex',
                  icon: <PackageMinus size={14} />,
                },
                {
                  key: 'BOTH' as const,
                  title: 'PUT & PICK',
                  sub: 'Full PUT and PICK operations',
                  icon: <Layers size={14} />,
                },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`access-card ${accessType === opt.key ? 'selected' : ''}`}
                  onClick={() => setAccessType(opt.key)}
                >
                  <div className="access-card-title">
                    {opt.icon}
                    <span>{opt.title}</span>
                  </div>
                  <div className="access-card-sub">{opt.sub}</div>
                </button>
              ))}
            </div>
          )}
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
