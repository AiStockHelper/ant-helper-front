import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { LoginPage, SignupPage } from '@/features/auth/AuthPages'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ChatPage } from '@/features/chat/ChatPage'
import { PortfolioPage } from '@/features/portfolio/PortfolioPage'
import { AccountsPage } from '@/features/accounts/AccountsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat/:conversationId?" element={<ChatPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  )
}
