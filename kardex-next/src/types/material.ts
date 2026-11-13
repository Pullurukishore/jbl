export type MaterialStockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface MaterialStats {
  totalMaterials: number;
  totalAvailable: number;
  totalHold: number;
  totalPicked: number;
  totalUnits: number;
  activeBinsCount: number;
}

export interface MaterialSummaryItem {
  model_number: string;
  total_count: number;
  available_count: number;
  hold_count: number;
  picked_count: number;
  hu_count?: number;
  handling_units?: string[];
  last_scanned_at: string;
  first_scanned_at: string;
  status: MaterialStockStatus;
}

export interface MaterialSummaryResponse {
  data: MaterialSummaryItem[];
  totalItems: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface MaterialBinUnit {
  serial_number: string;
  compartment_number: number | string;
  pick_status: string;
  pv_status: string;
}

export interface MaterialBinLocation {
  hu_id: string;
  storage_status: string;
  hu_status: string;
  units: MaterialBinUnit[];
}

export interface MaterialSerialItem {
  id: number;
  serial_number: string;
  pv_status: string;
  process_status: string;
  pick_status: string;
  scanned_by: string;
  scanned_at: string;
  birth_date: string | null;
  hu_id: string | null;
  compartment_number: number | null;
}

export interface MaterialDetailResponse {
  model_number: string;
  total_count: number;
  available_count: number;
  hold_count: number;
  picked_count: number;
  locations: MaterialBinLocation[];
  serials_sample: MaterialSerialItem[];
}

export interface MaterialSerialsResponse {
  data: MaterialSerialItem[];
  totalItems: number;
  totalPages: number;
  page: number;
  size: number;
}

