import clsx from 'clsx'
import {
  ArrowLeftRight,
  Building2,
  Landmark,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Plus,
  Settings,
  Telescope,
  TrendingUp,
  Vault,
  Wrench,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AutoUpdate from './components/AutoUpdate'
import EntryHost from './components/EntryForm'
import { openEntry } from './components/entryStore'
import { ToastHost, toast } from './components/toast'
import { Button, IconButton } from './components/ui'
import { useModel, useSetting, useSnapshot } from './hooks/useData'
import { useDue } from './components/Due'
import { emptyData, urgentItems } from './lib/calc'
import { autoCuotaOps } from './lib/autoCuotas'
import { today } from './lib/dates'
import { apply, requestPersistence, setSetting, wipeAll } from './lib/repo'
import { seedFirstRun } from './lib/seed'
import { migratePrefs } from './lib/prefs'
import Dashboard from './pages/Dashboard'
import Movements from './pages/Movements'
import Properties from './pages/Properties'
import PropertyDetail from './pages/PropertyDetail'
import Expenses from './pages/Expenses'
import Investments from './pages/Investments'
import Patrimony from './pages/Patrimony'
import Profitability from './pages/Profitability'
import Pensions from './pages/Pensions'
import Projections from './pages/Projections'
import SettingsPage from './pages/Settings'

const NAV = [
  { to: '/', icon: LayoutDashboard, key: 'dashboard', end: true },
  { to: '/movimientos', icon: ArrowLeftRight, key: 'movements' },
  { to: '/propiedades', icon: Building2, key: 'properties' },
  { to: '/gastos', icon: Wrench, key: 'expenses' },
  { to: '/inversiones', icon: PiggyBank, key: 'investments' },
  { to: '/patrimonio', icon: Vault, key: 'patrimony' },
  { to: '/rentabilidad', icon: TrendingUp, key: 'profitability' },
  { to: '/jubilaciones', icon: Landmark, key: 'pensions' },
  { to: '/proyecciones', icon: Telescope, key: 'projections' },
] as const

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const urgent = urgentItems(useDue(useModel())).length
  const link = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-700/25 dark:text-brand-300'
        : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white',
    )
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, icon: Icon, key, ...rest }) => (
        <NavLink key={to} to={to} end={'end' in rest} className={link} onClick={onNavigate}>
          <Icon size={18} />
          {t(`nav.${key}`)}
          {key === 'expenses' && urgent > 0 && (
            <span className="ml-auto rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white" title={t('due.bannerTitle')}>
              {urgent}
            </span>
          )}
        </NavLink>
      ))}
      <div className="my-2 border-t border-ink-200 dark:border-ink-800" />
      <NavLink to="/ajustes" className={link} onClick={onNavigate}>
        <Settings size={18} />
        {t('nav.settings')}
      </NavLink>
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2 font-bold tracking-tight">
      <img src="./favicon.svg" alt="" className="h-7 w-7" />
      <span className="text-lg">Nuestros ingresos</span>
    </div>
  )
}

export default function App() {
  const { t } = useTranslation()
  const snap = useSnapshot()
  const demo = useSetting('demo', false)
  const [ready, setReady] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()

  useEffect(() => {
    seedFirstRun()
      .then(migratePrefs)
      .catch((e) => console.error('seed failed', e))
      .finally(() => setReady(true))
    void requestPersistence()
  }, [])

  // Auto cuotas: whenever data changes (new plan, restore, demo) or the app comes back into view
  // (it may have stayed open into a new day), record the cuotas whose charge day has arrived.
  const [wake, setWake] = useState(0)
  const posting = useRef(false)
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && setWake((n) => n + 1)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  useEffect(() => {
    if (!ready || !snap || posting.current) return
    const ops = autoCuotaOps({ ...emptyData(), plans: snap.plans, expenses: snap.expenses }, today())
    if (!ops.length) return
    posting.current = true
    const n = ops.filter((o) => o.op === 'put' && o.table === 'expenses').length
    apply(ops)
      .then(() => n && toast(t('plan.autoPosted', { count: n })))
      .catch((e) => console.error('auto cuotas failed', e))
      .finally(() => (posting.current = false))
  }, [ready, snap, wake, t])

  useEffect(() => {
    window.scrollTo(0, 0)
    setDrawer(false)
  }, [location.pathname])

  // "N" opens the loader on desktop (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        openEntry()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (!snap || !ready) return <div className="flex min-h-dvh items-center justify-center text-ink-500">{t('common.loading')}</div>

  const addButton = (
    <Button variant="primary" className="w-full justify-start" onClick={() => openEntry()}>
      <Plus size={18} />
      {t('entry.newTitle')}
      <kbd className="ml-auto hidden rounded bg-white/20 px-1.5 text-[11px] font-normal lg:inline">N</kbd>
    </Button>
  )

  return (
    <div className="min-h-dvh lg:flex">
      <AutoUpdate />

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-4 border-r border-ink-200 bg-white px-3 py-4 lg:flex dark:border-ink-800 dark:bg-ink-900">
        <div className="px-2">
          <Brand />
        </div>
        {addButton}
        <div className="flex-1 overflow-y-auto">
          <NavItems />
        </div>
        <p className="px-2 text-[11px] leading-snug text-ink-400">{t('app.localOnly')}</p>
      </aside>

      {/* Mobile header */}
      <header className="pt-safe sticky top-0 z-30 border-b border-ink-200 bg-ink-50/95 backdrop-blur lg:hidden dark:border-ink-800 dark:bg-ink-950/95">
        <div className="flex h-14 items-center justify-between px-2">
          <IconButton label={t('nav.menu')} onClick={() => setDrawer(true)}>
            <Menu size={22} />
          </IconButton>
          <Brand />
          <IconButton label={t('entry.newTitle')} onClick={() => openEntry()}>
            <Plus size={22} />
          </IconButton>
        </div>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="sheet-in pt-safe absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-4 bg-white px-3 py-4 shadow-2xl dark:bg-ink-900">
            <div className="flex items-center justify-between px-2">
              <Brand />
              <IconButton label={t('common.close')} onClick={() => setDrawer(false)}>
                <X size={20} />
              </IconButton>
            </div>
            {addButton}
            <div className="flex-1 overflow-y-auto">
              <NavItems onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        {demo && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-violet-600 px-4 py-2 text-center text-sm text-white">
            <span>{t('demo.banner')}</span>
            <button
              className="cursor-pointer font-semibold underline"
              onClick={async () => {
                if (!window.confirm(t('demo.clearConfirm'))) return
                await wipeAll()
                await seedFirstRun()
                await setSetting('demo', false)
              }}
            >
              {t('demo.clear')}
            </button>
          </div>
        )}
        <main className="page-in mx-auto w-full max-w-6xl px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pt-8" key={location.pathname.split('/')[1]}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/movimientos" element={<Movements />} />
            <Route path="/propiedades" element={<Properties />} />
            <Route path="/propiedades/:id" element={<PropertyDetail />} />
            <Route path="/gastos" element={<Expenses />} />
            <Route path="/inversiones" element={<Investments />} />
            <Route path="/patrimonio" element={<Patrimony />} />
            <Route path="/rentabilidad" element={<Profitability />} />
            <Route path="/jubilaciones" element={<Pensions />} />
            <Route path="/proyecciones" element={<Projections />} />
            <Route path="/ajustes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Phone FAB */}
      <button
        type="button"
        aria-label={t('entry.newTitle')}
        onClick={() => openEntry()}
        className="no-print fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-brand-600 text-white shadow-lg active:scale-95 lg:hidden dark:bg-brand-500"
      >
        <Plus size={26} />
      </button>

      <EntryHost />
      <ToastHost />
    </div>
  )
}
