'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { DataTable, Column } from '@/components/shared/DataTable';
import { apiPost } from '@/lib/api';
import { Log, PaginatedResponse } from '@/types';

interface PartScanLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serialNumber?: string;
  modelNumber?: string;
}

export const PartScanLogsModal: React.FC<PartScanLogsModalProps> = ({
  isOpen,
  onClose,
  serialNumber,
  modelNumber,
}) => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchLogs(1);
    }
  }, [isOpen, serialNumber, modelNumber]);

  const fetchLogs = async (pageNum: number) => {
    try {
      setLoading(true);
      const res = await apiPost<PaginatedResponse<Log>>('/log/get-all-for-part', {
        serialNumber,
        modelNumber,
        page: pageNum,
        size: 10,
      });

      setLogs(res.data || []);
      setTotalPages(res.totalPages || 1);
      setTotalItems(res.totalItems || 0);
      setPage(res.page || 1);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<Log>[] = [
    {
      header: 'Entity / Serial',
      accessor: 'entity_number',
    },
    {
      header: 'Process Type',
      render: (r) => (
        <span className={`badge ${r.log_type === 'PUT_PROCESS' ? 'badge-info' : 'badge-warning'}`}>
          {r.log_type}
        </span>
      ),
    },
    {
      header: 'Activity',
      accessor: 'activity',
    },
    {
      header: 'Status',
      render: (r) => (
        <span className={`badge ${r.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}`}>
          {r.status}
        </span>
      ),
    },
    {
      header: 'Message',
      render: (r) => r.message || '-',
    },
    {
      header: 'Date & Time',
      render: (r) => new Date(r.log_date_time).toLocaleString(),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Full Scan History (${serialNumber || modelNumber || 'Part'})`}
      maxWidth="850px"
    >
      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={(p) => fetchLogs(p)}
        emptyTitle="No scan logs found"
        emptyDescription="No scan activities logged for this serial or model number."
      />
    </Modal>
  );
};
