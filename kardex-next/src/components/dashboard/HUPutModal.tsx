'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/shared/Modal';
import { apiGet } from '@/lib/api';
import { HandlingUnit } from '@/types/hu';
import { RegisterBinModal } from '@/components/bins/RegisterBinModal';
import { SendToKardexModal } from '@/components/bins/SendToKardexModal';
import {
  PackagePlus,
  Send,
  Eye,
  Boxes,
  Plus,
  RefreshCw,
  AlertCircle,
  Search,
  ChevronDown,
  Check,
} from 'lucide-react';

interface HUPutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const HUPutModal: React.FC<HUPutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const router = useRouter();
  const [draftBins, setDraftBins] = useState<HandlingUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedHu, setSelectedHu] = useState<HandlingUnit | null>(null);

  // Searchable Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sub-modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isSendToKardexOpen, setIsSendToKardexOpen] = useState(false);

  const fetchDraftBins = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiGet<HandlingUnit[]>('/hu/draft');
      setDraftBins(data || []);
      if (data && data.length > 0) {
        setSelectedHu((prev) => {
          if (prev) {
            const found = data.find((b) => b.hu_id === prev.hu_id);
            return found || data[0];
          }
          return data[0];
        });
      } else {
        setSelectedHu(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load draft handling units');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDraftBins();
      setIsDropdownOpen(false);
      setSearchTerm('');
    }
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBins = useMemo(() => {
    if (!searchTerm.trim()) return draftBins;
    const q = searchTerm.toLowerCase().trim();
    return draftBins.filter((b) => {
      const matchId = b.hu_id.toLowerCase().includes(q);
      const matchType = b.bin_type?.name?.toLowerCase().includes(q);
      const matchPps = b.bin_type?.bin_name?.toLowerCase().includes(q);
      return matchId || matchType || matchPps;
    });
  }, [draftBins, searchTerm]);

  const handleOpenBinDetail = () => {
    if (!selectedHu) return;
    onClose();
    router.push(`/app/bins/${selectedHu.hu_id}`);
  };

  const occupiedCount = (selectedHu?.compartments || []).filter(
    (c) => c.status === 'OCCUPIED'
  ).length;

  return (
    <>
      <Modal
        isOpen={isOpen && !isRegisterOpen && !isSendToKardexOpen}
        onClose={onClose}
        title="Handling Unit PUT Workflow"
        maxWidth="620px"
      >
        <div>
          {/* Subtitle & Refresh Header */}
          <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>
              Select a floor handling unit to scan adapters or send directly to Kardex PPS.
            </p>
            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              onClick={fetchDraftBins}
              disabled={loading}
              title="Refresh draft bins"
            >
              <RefreshCw size={13} className={loading ? 'spin-animation' : ''} />
              Refresh
            </button>
          </div>

          {error && (
            <div className="alert alert-danger py-2 px-3 d-flex align-items-center gap-2 mb-3" style={{ fontSize: '13px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
              <div className="mt-2 text-muted" style={{ fontSize: '13px' }}>
                Loading draft handling units...
              </div>
            </div>
          ) : draftBins.length === 0 ? (
            <div className="text-center py-4 px-3 bg-light rounded-3 border">
              <Boxes size={38} className="text-muted mb-2" />
              <h6 className="fw-bold text-dark mb-1">No Draft Bins Available</h6>
              <p className="text-muted mb-3" style={{ fontSize: '13px' }}>
                All handling units are currently stored in Kardex or none have been registered yet.
              </p>
              <button
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                onClick={() => setIsRegisterOpen(true)}
              >
                <Plus size={15} /> Register New Bin
              </button>
            </div>
          ) : (
            <div>
              {/* Searchable Combobox Selection */}
              <div className="mb-4 position-relative" ref={dropdownRef}>
                <label className="form-label fw-bold" style={{ fontSize: '12px', color: '#475569' }}>
                  SELECT ACTIVE HANDLING UNIT (BIN)
                </label>

                <div className="d-flex gap-2">
                  {/* Combobox Trigger Field */}
                  <div className="position-relative flex-grow-1">
                    <button
                      type="button"
                      className="form-control text-start d-flex align-items-center justify-content-between"
                      style={{
                        padding: '9px 12px',
                        background: '#ffffff',
                        borderColor: isDropdownOpen ? '#3b82f6' : '#cbd5e1',
                        boxShadow: isDropdownOpen ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : 'none',
                        cursor: 'pointer',
                        minHeight: '42px',
                      }}
                      onClick={() => setIsDropdownOpen((prev) => !prev)}
                    >
                      {selectedHu ? (
                        <div className="d-flex align-items-center gap-2 overflow-hidden">
                          <span
                            className="badge bg-primary font-monospace"
                            style={{ fontSize: '12px', padding: '3px 8px' }}
                          >
                            {selectedHu.hu_id}
                          </span>
                          <span className="text-dark fw-semibold text-truncate" style={{ fontSize: '13px' }}>
                            {selectedHu.bin_type?.name || 'Bin'}
                          </span>
                          <span className="text-muted" style={{ fontSize: '12px' }}>
                            ({(selectedHu.compartments || []).filter((c) => c.status === 'OCCUPIED').length}/
                            {selectedHu.compartments?.length || selectedHu.bin_type?.compartment_count || 15} Loaded)
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '13px' }}>
                          Select or search a bin...
                        </span>
                      )}
                      <ChevronDown size={16} className="text-muted flex-shrink-0 ms-2" />
                    </button>

                    {/* Dropdown Menu Panel */}
                    {isDropdownOpen && (
                      <div
                        className="dropdown-menu show shadow-lg w-100 p-2 position-absolute"
                        style={{
                          top: '100%',
                          left: 0,
                          zIndex: 1050,
                          marginTop: '4px',
                          borderRadius: '10px',
                          border: '1.5px solid #cbd5e1',
                          maxHeight: '260px',
                          display: 'flex',
                          flexDirection: 'column',
                          background: '#ffffff',
                        }}
                      >
                        {/* Search Input Box */}
                        <div className="position-relative mb-2">
                          <Search
                            size={14}
                            className="position-absolute"
                            style={{ left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                          />
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Type to search bin ID or type..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                            style={{ paddingLeft: '32px', fontSize: '12.5px' }}
                          />
                        </div>

                        {/* Bins List */}
                        <div className="overflow-auto flex-grow-1" style={{ maxHeight: '190px' }}>
                          {filteredBins.length === 0 ? (
                            <div className="text-center py-3 text-muted" style={{ fontSize: '12.5px' }}>
                              No matching bins found
                            </div>
                          ) : (
                            filteredBins.map((bin) => {
                              const occ = (bin.compartments || []).filter((c) => c.status === 'OCCUPIED').length;
                              const tot = bin.compartments?.length || bin.bin_type?.compartment_count || 15;
                              const isSelected = selectedHu?.hu_id === bin.hu_id;

                              return (
                                <button
                                  key={bin.id}
                                  type="button"
                                  className={`dropdown-item d-flex align-items-center justify-content-between p-2 rounded-2 ${
                                    isSelected ? 'bg-primary-subtle text-primary fw-bold' : ''
                                  }`}
                                  style={{ cursor: 'pointer', fontSize: '13px' }}
                                  onClick={() => {
                                    setSelectedHu(bin);
                                    setIsDropdownOpen(false);
                                    setSearchTerm('');
                                  }}
                                >
                                  <div className="d-flex align-items-center gap-2">
                                    <span
                                      className="font-monospace fw-bold"
                                      style={{
                                        fontSize: '12px',
                                        background: isSelected ? '#2563eb' : '#f1f5f9',
                                        color: isSelected ? '#ffffff' : '#1e293b',
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      {bin.hu_id}
                                    </span>
                                    <span>{bin.bin_type?.name || 'Bin'}</span>
                                    <span className="text-muted" style={{ fontSize: '11.5px' }}>
                                      ({occ}/{tot} Loaded)
                                    </span>
                                  </div>

                                  {isSelected && <Check size={15} className="text-primary flex-shrink-0" />}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Register New Bin Shortcut */}
                  <button
                    className="btn btn-outline-primary d-flex align-items-center gap-1 flex-shrink-0"
                    onClick={() => setIsRegisterOpen(true)}
                    title="Register a new handling unit"
                    style={{ fontWeight: 600, fontSize: '13px' }}
                  >
                    <Plus size={15} /> New Bin
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="d-flex align-items-center justify-content-between gap-2 pt-3 border-top">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-primary d-flex align-items-center gap-2"
                    onClick={handleOpenBinDetail}
                    disabled={!selectedHu}
                  >
                    <Eye size={16} /> Open Bin & Scan Parts
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary d-flex align-items-center gap-2"
                    onClick={() => setIsSendToKardexOpen(true)}
                    disabled={!selectedHu || occupiedCount === 0}
                    title={occupiedCount === 0 ? 'Load at least one part into bin before sending' : 'Send bin to Kardex PPS'}
                  >
                    <Send size={16} /> Send Bin to Kardex PPS
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Register New Bin Submodal */}
      <RegisterBinModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onSuccess={() => {
          setIsRegisterOpen(false);
          fetchDraftBins();
        }}
      />

      {/* Send to Kardex Submodal */}
      {selectedHu && isSendToKardexOpen && (
        <SendToKardexModal
          isOpen={isSendToKardexOpen}
          onClose={() => setIsSendToKardexOpen(false)}
          onSuccess={() => {
            setIsSendToKardexOpen(false);
            onClose();
            onSuccess();
          }}
          hu={selectedHu}
        />
      )}
    </>
  );
};
