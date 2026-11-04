export type HUStatus = 'EMPTY' | 'PARTIALLY_FILLED' | 'FULL';
export type StorageStatus = 'DRAFT' | 'IN_KARDEX' | 'OUTSIDE_KARDEX';
export type LastTransaction = 'PUT' | 'MATERIAL_PICK' | 'HU_PICK';
export type TransactionStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED';
export type CompartmentStatus = 'OCCUPIED' | 'EMPTY';

export interface BinType {
  id: number;
  name: string;
  compartment_count: number;
  bin_name: string;
  description: string | null;
}

export interface Compartment {
  id: number;
  handling_unit_id: number;
  compartment_number: number;
  status: CompartmentStatus;
  serial_number: string | null;
  material_name: string | null;
  allocated_at: string | null;
  allocated_by: string | null;
  put?: any;
}

export interface HandlingUnit {
  id: number;
  hu_id: string;
  bin_type_id: number;
  hu_status: HUStatus;
  storage_status: StorageStatus;
  last_transaction: LastTransaction | null;
  transaction_status: TransactionStatus | null;
  registered_by: string;
  created_at: string;
  updated_at: string;
  bin_type?: BinType;
  compartments?: Compartment[];
}

export interface HUStats {
  total: number;
  inKardex: number;
  draft: number;
  outsideKardex: number;
  empty: number;
  partial: number;
  full: number;
}

export interface HUListResponse {
  data: HandlingUnit[];
  totalItems: number;
  totalPages: number;
  page: number;
  stats?: HUStats;
}

