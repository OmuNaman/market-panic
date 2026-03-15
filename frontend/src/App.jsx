import { Routes, Route, Navigate } from 'react-router-dom'
import JoinPage from './pages/JoinPage'
import DashboardPage from './pages/DashboardPage'
import ControlPage from './pages/ControlPage'

export default function App() {
  return (
    <Routes>
      <Route path="/join" element={<JoinPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/control" element={<ControlPage />} />
      <Route path="*" element={<Navigate to="/join" replace />} />
    </Routes>
  )
}
