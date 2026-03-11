import { useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, getStoredAuth, setStoredAuth, clearStoredAuth } from './hooks/use-auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { Reviews } from './pages/Reviews';
import { Settings } from './pages/Settings';

function App() {
  const [authState, setAuthState] = useState(getStoredAuth);

  const login = useCallback((token: string, refreshToken: string, admin: { id: string; email: string; company_name: string }) => {
    setStoredAuth(token, refreshToken, admin);
    setAuthState({ admin, isAuthenticated: true });
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setAuthState({ admin: null, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      <Routes>
        <Route path="/login" element={
          authState.isAuthenticated ? <Navigate to="/" /> : <Login />
        } />
        <Route path="/register" element={
          authState.isAuthenticated ? <Navigate to="/" /> : <Register />
        } />
        <Route element={
          authState.isAuthenticated ? <Layout /> : <Navigate to="/login" />
        }>
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </AuthContext.Provider>
  );
}

export default App;
