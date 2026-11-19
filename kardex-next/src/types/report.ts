export type AgeBucket = '0-7' | '8-15' | '16-30' | '31-60' | '60+' | 'ALL';
export type KanbanSlaStatus = 'NORMAL' | 'ATTENTION' | 'WARNING' | 'OVERDUE' | 'ALL';

export interface OldestUnit {
  serial_number: string;
  model_number: string;
  scanned_at: string;
  age_days?: number;
  age_hours?: number;
  process_status?: string;
  dwell_days?: number;
  dwell_hours?: number;
}

export interface AgingStats {
  inventory: {
    totalActive: number;
    totalAvailable: number;
    totalHold: number;
    totalPicked: number;
    oldestUnit: OldestUnit | null;
    buckets: {
      '0-7': number;
      '8-15': number;
      '16-30': number;
      '31-60': number;
      '60+': number;
    };
  };
  kanban: {
    totalActive: number;
    returnsCount: number;
    oldestUnit: OldestUnit | null;
    sla: {
      normal: number;
      attention: number;
      warning: number;
      overdue: number;
    };
  };
}

export interface SerialAgingItem {
  id: number;
  serial_number: string;
  model_number: string;
  process_status: string;
  pick_status: string;
  pv_status: string;
  scanned_at: string;
  birth_date: string | null;
  scanned_by: string;
  hu_id: string | null;
  storage_status: string | null;
  compartment_number: number | null;
  kardex_age_days: number;
  kardex_age_hours: number;
  kardex_total_hours: number;
  birth_age_days: number | null;
  age_bucket: '0-7' | '8-15' | '16-30' | '31-60' | '60+';
  is_kanban?: boolean;
  kanban_dwell_hours?: number | null;
  kanban_dwell_days?: number | null;
  kanban_sla_status?: 'NORMAL' | 'ATTENTION' | 'WARNING' | 'OVERDUE' | null;
}

export interface KanbanAgingItem {
  id: number;
  serial_number: string;
  model_number: string;
  process_status: string;
  pick_status: string;
  pv_status: string;
  scanned_at: string;
  birth_date: string | null;
  scanned_by: string;
  hu_id: string | null;
  storage_status: string | null;
  compartment_number: number | null;
  dwell_days: number;
  dwell_hours: number;
  dwell_total_hours: number;
  birth_age_days: number | null;
  sla_status: 'NORMAL' | 'ATTENTION' | 'WARNING' | 'OVERDUE';
}

export interface SerialAgingResponse {
  data: SerialAgingItem[];
  totalItems: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface KanbanAgingResponse {
  data: KanbanAgingItem[];
  totalItems: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface ExportRecord {
  serial_number: string;
  model_number: string;
  hu_id: string;
  compartment_number: number | string;
  storage_status: string;
  process_status: string;
  pick_status: string;
  pv_status: string;
  scanned_at: string;
  birth_date: string;
  kardex_age_days: number;
  kardex_age_hours: number;
  kardex_total_hours: number;
  birth_age_days: number | string;
  age_bucket: string;
  sla_status: string;
  scanned_by: string;
}
