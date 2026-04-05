import { Outlet } from 'react-router-dom'
import { AppNavbar } from './AppNavbar'

export function AppLayout() {
  return (
    <div className="shell-layout">
      <AppNavbar />
      <Outlet />
    </div>
  )
}
