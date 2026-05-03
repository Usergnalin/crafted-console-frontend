import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ApiProvider } from './api/client.jsx'
import Login from './pages/login.jsx'
import Dashboard from './pages/dashboard.jsx'
import Legal from './pages/legal.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <ApiProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/legal" element={<Legal />} />
        </Routes>
      </ApiProvider>
    </BrowserRouter>
  )
}