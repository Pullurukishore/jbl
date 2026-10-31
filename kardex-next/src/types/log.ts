export type LogStatus = 'SUCCESS' | 'FAILED';
export type LogType = 'PUT_PROCESS' | 'PICK_PROCESS';
export type PutActivity = 'FETCH_DETAILS' | 'CHECK_STATUS' | 'PASS_FAIL' | 'FIND_CSV' | 'FIND_MODEL' | 'MODEL_FOUND/NOTFOUND' | 'CHECKING_AVAILABILITY' | 'FILE_GENERATED';
export type PickActivity = 'FETCH_DETAILS' | 'CHECK_QTY' | 'CHECK_STATUS' | 'FILE_GENERATED';

export interface Log {
  id: number;
  entity_number: string;
  activity: string;
  title: string | null;
  status: LogStatus;
  message: string | null;
  log_date_time: string;
  logged_by: string;
  process_id: string;
  log_type: LogType;
  put_id: number | null;
  pick_id: number | null;
  // Joined fields
  user_first_name?: string;
  user_last_name?: string;
  user_id?: string;
  // SSE specific
  completed?: boolean;
  success?: boolean;
}

export interface GetLogsByPartParams {
  serialNumber?: string;
  modelNumber?: string;
  log_type?: LogType;
  page?: number;
  size?: number;
  sort?: [string, string];
}

export interface ChartDataParams {
  status: LogStatus;
  page?: number;
  size?: number;
}
