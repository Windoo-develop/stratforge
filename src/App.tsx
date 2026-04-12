import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AppLayout } from './components/app/AppLayout'
import { RequireAdmin, RequireAdvanced, RequireAnonymous, RequireAuth } from './components/routes/RequireAuth'
import { AdminPage } from './pages/AdminPage'
import { ConfirmEmailPage } from './pages/ConfirmEmailPage'
import { DmPage } from './pages/DmPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegisterPage } from './pages/RegisterPage'
import { SupportPage } from './pages/SupportPage'
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
          <Route path="/support" element={<SupportPage />} />
          <Route path="/team/:teamId" element={<Navigate to="roster" replace />} />
          <Route path="/team/:teamId/:section" element={<TeamDashboardPage />} />
        </Route>

        <Route element={<RequireAdvanced />}>
          <Route path="/dm" element={<DmPage />} />
        </Route>

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
