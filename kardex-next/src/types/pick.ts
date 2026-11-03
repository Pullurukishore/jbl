import { FileRecord } from '@/types/files';

export type PickProcessStatus =
  | 'KANBAN-IN'
  | 'KANBAN-OUT'
  | 'KANBAN-RTN'
  | 'KANBAN_IN'
  | 'KANBAN_OUT'
  | 'KANBAN_RTN';

export interface Pick {
  id: number;
  model_number: string;
  quantity: number;
  process_status: PickProcessStatus | null;
  text_file_downloaded: boolean;
  entered_by: string;
  scanned_at: string;
  updated_at: string;
  text_file_id: number | null;
  pick_text_file?: FileRecord;
}
