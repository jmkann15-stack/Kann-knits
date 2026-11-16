import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { SettingsProvider, useSettings } from './lib/settings'
import { initStorage } from './lib/storage'
import { TabBar } from './components/TabBar'
import { Onboarding } from './screens/Onboarding'
import { GalleryScreen } from './screens/Gallery'
import { BackupScreen } from './screens/Backup'
import { DesignNewScreen, DesignsScreen } from './screens/Designs'
import { DesignEditorScreen } from './screens/DesignEditor'
import { StashDetailScreen, StashFormScreen, StashScreen } from './screens/Stash'
import { ProjectsScreen } from './screens/Projects'
import { ProjectFormScreen } from './screens/ProjectForm'
import { ProjectDetailScreen } from './screens/ProjectDetail'
import { CounterScreen } from './screens/CounterScreen'
import { AboutScreen, FamilyScreen, InstallScreen, ProjectTypesScreen, SettingsScreen } from './screens/Settings'

/** Scroll to top on navigation (but keep position when filtering via ?f=). */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollTo, and an
    // effect must return nothing (or a cleanup function).
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function Routed() {
  const { pathname } = useLocation()
  // The row counter is full-screen: no tab bar to tap by accident.
  if (/^\/projects\/[^/]+\/counter$/.test(pathname)) {
    return (
      <Routes>
        <Route path="/projects/:id/counter" element={<CounterScreen />} />
      </Routes>
    )
  }
  // The design editor needs the whole screen too.
  if (/^\/designs\/[^/]+$/.test(pathname) && pathname !== '/designs/new') {
    return (
      <Routes>
        <Route path="/designs/:id" element={<DesignEditorScreen />} />
      </Routes>
    )
  }
  return (
    <>
      {/* Bottom padding leaves room for the fixed tab bar + iPhone home indicator. */}
      <main className="mx-auto min-h-dvh max-w-xl pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Routes>
          <Route path="/" element={<ProjectsScreen />} />
          <Route path="/projects/new" element={<ProjectFormScreen />} />
          <Route path="/projects/:id" element={<ProjectDetailScreen />} />
          <Route path="/projects/:id/edit" element={<ProjectFormScreen />} />
          <Route path="/designs" element={<DesignsScreen />} />
          <Route path="/designs/new" element={<DesignNewScreen />} />
          <Route path="/gallery" element={<GalleryScreen />} />
          <Route path="/stash" element={<StashScreen />} />
          <Route path="/stash/new" element={<StashFormScreen />} />
          <Route path="/stash/:id" element={<StashDetailScreen />} />
          <Route path="/stash/:id/edit" element={<StashFormScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/settings/family" element={<FamilyScreen />} />
          <Route path="/settings/types" element={<ProjectTypesScreen />} />
          <Route path="/settings/about" element={<AboutScreen />} />
          <Route path="/settings/backup" element={<BackupScreen />} />
          <Route path="/install" element={<InstallScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </>
  )
}

function Shell() {
  const { onboarded, largerText } = useSettings()

  useEffect(() => {
    document.documentElement.classList.toggle('larger-text', largerText)
  }, [largerText])

  if (!onboarded) return <Onboarding />

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routed />
    </BrowserRouter>
  )
}

export default function App() {
  useEffect(() => {
    initStorage()
  }, [])
  return (
    <SettingsProvider fallback={<div className="min-h-dvh bg-cream" />}>
      <Shell />
    </SettingsProvider>
  )
}
