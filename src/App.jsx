import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';

import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import SyncProvider from "@/lib/SyncProvider";
import { DataProvider } from "./lib/DataProvider";

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Teams from './pages/Teams';
import Members from './pages/Members';
import Workspace from './pages/Workspace';
import CalendarPage from './pages/CalendarPage';
import MapPage from './pages/MapPage';
import Settings from './pages/Settings';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GoogleAuthCallback from './pages/GoogleAuthCallback';
import SetupPage from './pages/SplashScreen';


// 🔒 Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

// 🔐 Role Guard
const RoleProtectedRoute = ({ children }) => {
  const { hasFullAccess } = useAuth();

  if (!hasFullAccess) {
    return <Navigate to="/not-found" replace />;
  }

  return children;
};

// 🧩 PRIVATE OUTLET (IMPORTANT)
function PrivateOutlet() {
  return <Outlet />;
}


function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <AuthProvider>
        <Router>
          <Routes>

            {/* ========================= PUBLIC ========================= */}
            <Route path="/auth" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/auth/google/callback" element={<GoogleAuthCallback />} />

            {/* ========================= PRIVATE ROOT ========================= */}
            <Route
              element={
                <ProtectedRoute>
                  <SyncProvider>
                    <DataProvider>
                      <PrivateOutlet />
                    </DataProvider>
                  </SyncProvider>
                </ProtectedRoute>
              }
            >

              {/* SETUP */}
              <Route path="/setup" element={<SetupPage />} />

              {/* APP */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="workspace" element={ <Workspace /> } />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="map" element={<MapPage />} />
                <Route path="settings" element={<Settings />} />

                <Route
                  path="teams"
                  element={
                    <RoleProtectedRoute>
                      <Teams />
                    </RoleProtectedRoute>
                  }
                />

                <Route
                  path="members"
                  element={
                    <RoleProtectedRoute>
                      <Members />
                    </RoleProtectedRoute>
                  }
                />
              </Route>
            </Route>

            {/* ========================= FALLBACK ========================= */}
            <Route path="*" element={<PageNotFound />} />

          </Routes>
        </Router>

        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
