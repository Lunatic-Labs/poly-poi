import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import Dashboard from "./pages/admin/Dashboard";
import Login from "./pages/admin/Login";
import Onboarding from "./pages/admin/Onboarding";
import VisitorApp from "./pages/visitor/VisitorApp";

function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center text-gray-500">
      <p>Page not found</p>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Visitor app */}
        <Route path="/app/:slug" element={<VisitorApp />} />

        {/* Admin portal */}
        <Route path="/admin/login" element={<Login />} />
        <Route
          path="/admin/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        {/* Root */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
