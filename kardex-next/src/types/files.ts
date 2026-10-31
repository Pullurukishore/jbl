export interface FileRecord {
  id: number;
  name: string;
  size: number | null;
  type: string | null;
  path: string;
  created_by: string | null;
  updated_by: string | null;
  created_date_time: string;
  updated_date_time: string;
}
