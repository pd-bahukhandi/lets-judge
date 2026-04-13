import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LeaderboardPage from './pages/LeaderboardPage'
import AdminPage from './pages/AdminPage'
import './index.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/lets-judge">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute  requiredRole="judge">
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          {/* Public leaderboard (no login required) */}
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          {/* Default: public entry goes to leaderboard */}
          <Route path="*" element={<Navigate to="/leaderboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
