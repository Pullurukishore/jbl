'use client';

import React from 'react';
import { HUStatus } from '@/types/hu';

export const HUStatusBadge: React.FC<{ status: HUStatus }> = ({ status }) => {
  const config: Record<HUStatus, { label: string; className: string }> = {
    FULL: { label: 'Full', className: 'bg-success' },
    PARTIALLY_FILLED: { label: 'Partial', className: 'bg-warning text-dark' },
    EMPTY: { label: 'Empty', className: 'bg-secondary' },
  };
  const { label, className } = config[status] || { label: status, className: 'bg-secondary' };
  return <span className={`badge ${className}`}>{label}</span>;
};

