'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { getUser, getToken, logout as authLogout } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  canPut: boolean;
  canPick: boolean;
  isLoading: boolean;
  logout: () => void | Promise<void>;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isAdmin: false,
  canPut: false,
  canPick: false,
  isLoading: true,
  logout: () => {},
  refreshAuth: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isAuth, setIsAuth] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshAuth = () => {
    const currentToken = getToken();
    const currentUser = getUser();
    setTokenState(currentToken);
    setUserState(currentUser);
    setIsAuth(!!currentToken);
  };

  useEffect(() => {
    refreshAuth();
    setIsLoading(false);
  }, []);

  const isAdmin = user?.role === 'ADMIN';
  const accessType = user?.access_type || 'BOTH';
  const canPut = isAdmin || accessType === 'PUT_ONLY' || accessType === 'BOTH';
  const canPick = isAdmin || accessType === 'PICK_ONLY' || accessType === 'BOTH';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: isAuth,
        isAdmin,
        canPut,
        canPick,
        isLoading,
        logout: authLogout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
