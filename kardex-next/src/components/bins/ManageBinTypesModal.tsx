'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { BinType } from '@/types/hu';
import { BinTypeFormModal } from './BinTypeFormModal';
import { DeleteBinTypeModal } from './DeleteBinTypeModal';
import {
  Layers,
  Edit2,
  Trash2,
  Plus,
  Package,
  Search,
  X,
  Hash,
  Tag,
} from 'lucide-react';

interface ManageBinTypesModalProps {
  isOpen: boolean;
  onClose: () => void;
  binTypes: BinType[];
  onRefresh: () => void;
}

export const ManageBinTypesModal: React.FC<ManageBinTypesModalProps> = ({
  isOpen,
  onClose,
  binTypes,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [binTypeToEdit, setBinTypeToEdit] = useState<BinType | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [binTypeToDelete, setBinTypeToDelete] = useState<BinType | null>(null);

  const filtered = binTypes.filter((bt) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      bt.name.toLowerCase().includes(q) ||
      bt.bin_name.toLowerCase().includes(q) ||
      (bt.description && bt.description.toLowerCase().includes(q))
    );
  });

  const handleOpenAdd = () => {
    setBinTypeToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (bt: BinType) => {
    setBinTypeToEdit(bt);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (bt: BinType) => {
    setBinTypeToDelete(bt);
    setIsDeleteOpen(true);
  };

  const handleFormSuccess = () => {
    onRefresh();
  };

  const handleDeleteSuccess = () => {
    onRefresh();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="d-flex align-items-center gap-3">
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 3px 8px rgba(37, 99, 235, 0.25)',
                flexShrink: 0,
              }}
            >
              <Layers size={19} />
            </div>
            <div>
              <div style={{ fontSize: '16.5px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' }}>
                Bin Specifications & Types
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                Configure physical tray profiles, compartment counts, and Kardex PPS codes
              </div>
            </div>
          </div>
        }
        maxWidth="720px"
        footer={
          <div className="d-flex justify-content-between align-items-center w-100">
            <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
              {binTypes.length} {binTypes.length === 1 ? 'type' : 'types'} configured
            </span>
            <button type="button" className="btn-cancel" onClick={onClose}>
              Close
            </button>
          </div>
        }
      >
        <div className="manage-bintypes-content">
          <style jsx>{`
            .manage-bintypes-content {
              display: flex;
              flex-direction: column;
              gap: 1.15rem;
              padding: 4px 0;
            }

            .toolbar-row {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              flex-wrap: wrap;
            }

            .search-box {
              position: relative;
              flex: 1;
              min-width: 200px;
            }

            .search-input {
              width: 100%;
              padding: 7px 32px 7px 32px;
              font-size: 13px;
              border-radius: 8px;
              border: 1.5px solid #e2e8f0;
              background: #f8fafc;
              outline: none;
              transition: all 0.15s ease;
            }

            .search-input:focus {
              background: #ffffff;
              border-color: #2563eb;
              box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
            }

            .search-icon {
              position: absolute;
              left: 10px;
              top: 50%;
              transform: translateY(-50%);
              color: #94a3b8;
              pointer-events: none;
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
            }

            .btn-add-type {
              background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
              border: none;
              color: #ffffff;
              padding: 8px 16px;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 700;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              cursor: pointer;
              box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
              transition: all 0.15s ease;
            }

            .btn-add-type:hover {
              transform: translateY(-1px);
              box-shadow: 0 4px 10px rgba(37, 99, 235, 0.35);
            }

            .types-list {
              display: flex;
              flex-direction: column;
              gap: 9px;
              max-height: 420px;
              overflow-y: auto;
              padding-right: 4px;
            }

            .type-item-card {
              background: #ffffff;
              border: 1.5px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px 14px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              transition: all 0.15s ease;
            }

            .type-item-card:hover {
              border-color: #cbd5e1;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            }

            .type-main-info {
              display: flex;
              flex-direction: column;
              gap: 4px;
              min-width: 0;
            }

            .type-header-row {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-wrap: wrap;
            }

            .type-name-text {
              font-size: 13.5px;
              font-weight: 700;
              color: #0f172a;
            }

            .type-pps-badge {
              background: #eff6ff;
              border: 1px solid #bfdbfe;
              color: #1d4ed8;
              font-size: 11px;
              font-weight: 700;
              padding: 2px 7px;
              border-radius: 5px;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }

            .type-meta-row {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 12px;
              color: #64748b;
              flex-wrap: wrap;
            }

            .type-slots-badge {
              background: #f1f5f9;
              border: 1px solid #e2e8f0;
              color: #334155;
              font-size: 11px;
              font-weight: 700;
              padding: 1px 7px;
              border-radius: 5px;
            }

            .action-buttons-group {
              display: flex;
              align-items: center;
              gap: 6px;
              flex-shrink: 0;
            }

            .btn-action-edit {
              background: #ffffff;
              border: 1px solid #cbd5e1;
              color: #2563eb;
              padding: 6px 12px;
              border-radius: 7px;
              font-size: 12px;
              font-weight: 700;
              display: inline-flex;
              align-items: center;
              gap: 5px;
              cursor: pointer;
              transition: all 0.15s ease;
            }

            .btn-action-edit:hover {
              background: #eff6ff;
              border-color: #93c5fd;
              transform: translateY(-1px);
            }

            .btn-action-delete {
              background: #ffffff;
              border: 1px solid #fecaca;
              color: #dc2626;
              padding: 6px 12px;
              border-radius: 7px;
              font-size: 12px;
              font-weight: 700;
              display: inline-flex;
              align-items: center;
              gap: 5px;
              cursor: pointer;
              transition: all 0.15s ease;
            }

            .btn-action-delete:hover {
              background: #fef2f2;
              border-color: #f87171;
              transform: translateY(-1px);
            }

            .empty-state-box {
              padding: 2.5rem 1rem;
              text-align: center;
              background: #f8fafc;
              border: 1px dashed #cbd5e1;
              border-radius: 10px;
              color: #64748b;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 8px;
            }
          `}</style>

          <div className="toolbar-row">
            <div className="search-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search specifications by name or PPS code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="search-clear"
                  onClick={() => setSearch('')}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button className="btn-add-type" onClick={handleOpenAdd}>
              <Plus size={15} /> Add Bin Type
            </button>
          </div>

          <div className="types-list">
            {filtered.length === 0 ? (
              <div className="empty-state-box">
                <Package size={28} className="text-muted" />
                <span style={{ fontSize: '13.5px', fontWeight: 600 }}>
                  {search ? 'No bin specifications match your search.' : 'No bin specifications found.'}
                </span>
                <span style={{ fontSize: '12px' }}>
                  Click &ldquo;Add Bin Type&rdquo; above to create a new specification.
                </span>
              </div>
            ) : (
              filtered.map((bt) => (
                <div key={bt.id} className="type-item-card">
                  <div className="type-main-info">
                    <div className="type-header-row">
                      <span className="type-name-text">{bt.name}</span>
                      <span className="type-pps-badge">PPS: {bt.bin_name}</span>
                      <span className="type-slots-badge">{bt.compartment_count} Slots</span>
                    </div>
                    {bt.description && (
                      <div className="type-meta-row">
                        <span>{bt.description}</span>
                      </div>
                    )}
                  </div>

                  <div className="action-buttons-group">
                    <button
                      className="btn-action-edit"
                      onClick={() => handleOpenEdit(bt)}
                      title={`Edit ${bt.name}`}
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      className="btn-action-delete"
                      onClick={() => handleOpenDelete(bt)}
                      title={`Delete ${bt.name}`}
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Sub-modals for Add / Edit and Delete */}
      <BinTypeFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleFormSuccess}
        binTypeToEdit={binTypeToEdit}
      />

      <DeleteBinTypeModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onSuccess={handleDeleteSuccess}
        binType={binTypeToDelete}
      />
    </>
  );
};
