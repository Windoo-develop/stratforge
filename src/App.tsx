import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AppLayout } from './components/app/AppLayout'
import { RequireAnonymous, RequireAuth } from './components/routes/RequireAuth'
import { ConfirmEmailPage } from './pages/ConfirmEmailPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { TeamDashboardPage } from './pages/team/TeamDashboardPage'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />

        <Route element={<RequireAnonymous />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route path="/confirm-email" element={<ConfirmEmailPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/:profileId" element={<ProfilePage />} />
          <Route path="/team/:teamId" element={<Navigate to="roster" replace />} />
          <Route path="/team/:teamId/:section" element={<TeamDashboardPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
