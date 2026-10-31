export interface User {
  id: number;
  first_name: string;
  last_name: string;
  role: 'ADMIN' | 'USER';
  user_id: string;
  email: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  created_user_first_name?: string;
  created_user_last_name?: string;
  created_user_id?: string;
}

export interface LoginPayload {
  user_id: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: User & { id_token: string };
}

export interface CreateUserPayload {
  first_name: string;
  last_name: string;
  role: 'ADMIN' | 'USER';
  user_id: string;
  email?: string;
  password: string;
}

export interface UpdateUserPayload {
  first_name?: string;
  last_name?: string;
  role?: 'ADMIN' | 'USER';
  user_id?: string;
  email?: string;
}

export interface ChangePasswordPayload {
  id: number;
  password: string;
}
