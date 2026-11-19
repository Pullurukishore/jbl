import { FileRecord } from '@/types/files';
import { Pick } from '@/types/pick';

export type PVStatus = 'PASS' | 'FAIL';
export type ProcessStatus =
  | 'KANBAN-IN'
  | 'KANBAN-OUT'
  | 'KANBAN-RTN'
  | 'KANBAN_IN'
  | 'KANBAN_OUT'
  | 'KANBAN_RTN';
export type PickStatus = 'AVAILABLE' | 'PICKED' | 'HOLD';

export interface Put {
  id: number;
  serial_number: string;
  birth_date: string | null;
  pv_status: PVStatus | null;
  process_status: ProcessStatus | null;
  model_number: string;
  text_file_downloaded: boolean;
  scanned_by: string;
  pick_status: PickStatus;
  scanned_at: string;
  pick_id: number | null;
  text_file_id: number | null;
  po_file_id: number | null;
  handling_unit_id?: number | null;
  compartment_id?: number | null;
  // Joined fields
  handling_unit?: {
    id: number;
    hu_id: string;
    status: string;
    storage_status?: string;
    hu_status?: string;
    capacity: number;
    bin_type?: {
      id: number;
      name: string;
      compartments: number;
    };
  };
  compartment?: {
    id: number;
    compartment_number: number;
    status: string;
  };
  user_first_name?: string;
  user_last_name?: string;
  user_id?: string;
  pick?: Pick;
  put_text_file?: FileRecord;
  put_po_file?: FileRecord;
}

export interface PutSearchParams {
  search?: string;
  isExport?: boolean;
  page?: number;
  size?: number;
  sort?: [string, string];
  startDate?: string;
  endDate?: string;
}

export interface FindByModelAndQtyParams {
  partNumber: string;
  quantity: number;
  page?: number;
  size?: number;
}
