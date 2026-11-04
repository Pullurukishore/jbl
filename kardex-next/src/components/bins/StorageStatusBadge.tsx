'use client';

import React from 'react';
import { StorageStatus } from '@/types/hu';

export const StorageStatusBadge: React.FC<{ status: StorageStatus }> = ({ status }) => {
  const config: Record<StorageStatus, { label: string; className: string }> = {
    IN_KARDEX: { label: 'In Kardex', className: 'bg-primary' },
    OUTSIDE_KARDEX: { label: 'Outside Kardex', className: 'bg-warning text-dark' },
    DRAFT: { label: 'Draft', className: 'bg-secondary' },
  };
  const { label, className } = config[status] || { label: status, className: 'bg-secondary' };
  return <span className={`badge ${className}`}>{label}</span>;
};

