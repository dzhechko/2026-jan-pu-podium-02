import { createContext, useContext } from 'react';

interface Admin {
  id: string;
  email: string;
  company_name: string;
}

interface AuthContextType {
  admin: Admin | null;
  login: (token: string, refreshToken: string, admin: Admin) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  admin: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function getStoredAuth(): { admin: Admin | null; isAuthenticated: boolean } {
  const token = localStorage.getItem('token');
  const adminStr = localStorage.getItem('admin');

  if (!token || !adminStr) {
    return { admin: null, isAuthenticated: false };
  }

  try {
    return { admin: JSON.parse(adminStr), isAuthenticated: true };
  } catch {
    return { admin: null, isAuthenticated: false };
  }
}

export function setStoredAuth(token: string, refreshToken: string, admin: Admin) {
  localStorage.setItem('token', token);
  localStorage.setItem('refresh_token', refreshToken);
  localStorage.setItem('admin', JSON.stringify(admin));
}

export function clearStoredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('admin');
}
