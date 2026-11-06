import { CloudDownload, Download, FileSpreadsheet, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { RateForm } from '../components/forms'
import { toast } from '../components/toast'
import { Button, Card, Field, IconButton, Input, Note, PageHeader, SectionTitle, Segmented, Select, Table, td, tdNum, th, thNum } from '../components/ui'
import { useModel } from '../hooks/useData'
import { useTheme, type Theme } from '../hooks/useTheme'
import { setLang, type Lang } from '../i18n'
import { downloadBackup, isBackup, restoreBackup } from '../lib/backup'
import { exportXLSX } from '../lib/export'
import { API_SERIES, fetchToday, importHistory } from '../lib/fx'
import { dateLabel } from '../lib/dates'
import { formatRate } from '../lib/money'
import { savePrefs, type Prefs } from '../lib/prefs'
import { isEmpty, remove, store, wipeAll } from '../lib/repo'
import { loadDemo, seedFirstRun } from '../lib/seed'

type ListKey = 'methods' | 'fixedCategories' | 'installmentCategories' | 'eventualCategories' | 'channels' | 'investmentTypes'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const model = useModel()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const [rateForm, setRateForm] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [empty, setEmpty] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void isEmpty().then(setEmpty)
  }, [model?.data])
  useEffect(() => {
    const id = location.hash.replace('#', '')
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [location.hash])

  if (!model) return null
  const { prefs, data, book } = model
  const seriesRates = data.rates.filter((r) => r.series === prefs.fx.series).sort((a, b) => b.date.localeCompare(a.date))
  const allSeries = [...new Set([...prefs.rateSeries, ...data.rates.map((r) => r.series)])]
  const firstRecord = [...data.incomes, ...data.expenses, ...data.sales, ...data.yields].map((x) => x.date).sort()[0]
  const histFrom = firstRecord && firstRecord < '2020-01-01' ? firstRecord.slice(0, 7) + '-01' : '2020-01-01'

  const run = async (key: string, fn: () => Promise<string>) => {
    setBusy(key)
    try {
      toast(await fn())
    } catch (e) {
      console.error(e)
      toast(t('settings.networkError'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader title={t('nav.settings')} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle>{t('settings.appearance')}</SectionTitle>
          <div className="space-y-4">
            <Field label={t('settings.theme')}>
              <Segmented<Theme>
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'system', label: t('settings.themeSystem') },
                  { value: 'light', label: t('settings.themeLight') },
                  { value: 'dark', label: t('settings.themeDark') },
                ]}
              />
            </Field>
            <Field label={t('settings.language')}>
              <Segmented<Lang>
                value={i18n.language.startsWith('en') ? 'en' : 'es'}
                onChange={setLang}
                options={[
                  { value: 'es', label: 'Español' },
                  { value: 'en', label: 'English' },
                ]}
              />
            </Field>
          </div>
        </Card>

        <Card id="datos" className="scroll-mt-20">
          <SectionTitle>{t('settings.data')}</SectionTitle>
          <Note className="mb-3">{t('settings.localNote')}</Note>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void exportXLSX(data, prefs.fx, t)}>
              <FileSpreadsheet size={16} />
              {t('settings.exportExcel')}
            </Button>
            <Button onClick={() => void downloadBackup()}>
              <Download size={16} />
              {t('settings.backup')}
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={16} />
              {t('settings.restore')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  const json = JSON.parse(await f.text())
                  if (!isBackup(json)) return toast(t('settings.badBackup'))
                  if (!window.confirm(t('settings.restoreConfirm', { date: dateLabel(json.exportedAt.slice(0, 10), i18n.language) }))) return
                  await restoreBackup(json)
                  toast(t('settings.restored'))
                } catch {
                  toast(t('settings.badBackup'))
                }
              }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
            {empty && (
              <Button
                onClick={async () => {
                  await loadDemo()
                  toast(t('demo.loaded'))
                }}
              >
                {t('demo.load')}
              </Button>
            )}
            <Button
              variant="danger"
              onClick={async () => {
                if (!window.confirm(t('settings.wipeConfirm1'))) return
                if (window.prompt(t('settings.wipeConfirm2')) !== t('settings.wipeWord')) return
                await wipeAll()
                await seedFirstRun()
                toast(t('settings.wiped'))
              }}
            >
              <Trash2 size={16} />
              {t('settings.wipe')}
            </Button>
          </div>
          {empty && <p className="mt-2 text-xs text-ink-500">{t('demo.explain')}</p>}
        </Card>

        <Card id="tc" className="scroll-mt-20 xl:col-span-2">
          <SectionTitle>{t('fx.title')}</SectionTitle>
          <p className="mb-3 text-sm text-ink-600 dark:text-ink-300">{t('fx.explain')}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('fx.seriesUsed')}>
              <Select value={prefs.fx.series} onChange={(e) => void savePrefs({ fx: { ...prefs.fx, series: e.target.value } })}>
                {allSeries.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </Field>
            <Field label={t('fx.criterion')} hint={t(`fx.criterion_${prefs.fx.criterion}_hint`)}>
              <Segmented
                value={prefs.fx.criterion}
                onChange={(v) => void savePrefs({ fx: { ...prefs.fx, criterion: v } })}
                options={[
                  { value: 'historical', label: t('fx.criterion_historical') },
                  { value: 'latest', label: t('fx.criterion_latest') },
                ]}
              />
            </Field>
          </div>
          <div className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-sm dark:bg-ink-800/50">
            {book.latest
              ? t('fx.latestIs', { series: book.series, rate: formatRate(book.latest.value, i18n.language), date: dateLabel(book.latest.date, i18n.language), count: book.rates.length })
              : t('fx.noRates', { series: prefs.fx.series })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => setRateForm(true)}>
              <Plus size={16} />
              {t('fx.newRate')}
            </Button>
            <Button disabled={busy !== null} onClick={() => void run('today', async () => t('fx.todayDone', { count: (await fetchToday()).length }))}>
              <RefreshCw size={16} className={busy === 'today' ? 'animate-spin' : ''} />
              {t('fx.fetchToday')}
            </Button>
            {API_SERIES[prefs.fx.series] && (
              <Button disabled={busy !== null} onClick={() => void run('hist', async () => t('fx.histDone', { count: await importHistory(prefs.fx.series, histFrom), series: prefs.fx.series }))}>
                <CloudDownload size={16} className={busy === 'hist' ? 'animate-pulse' : ''} />
                {t('fx.importHistory', { series: prefs.fx.series, from: dateLabel(histFrom, i18n.language) })}
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-500">{t('fx.sources')}</p>
          {seriesRates.length > 0 && (
            <div className="mt-4">
              <Table
                head={
                  <tr>
                    <th className={th}>{t('form.date')}</th>
                    <th className={thNum}>{t('fx.value')}</th>
                    <th className={th}>{t('fx.source')}</th>
                    <th />
                  </tr>
                }
              >
                {seriesRates.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td className={td}>{dateLabel(r.date, i18n.language)}</td>
                    <td className={tdNum}>$ {formatRate(r.value, i18n.language)}</td>
                    <td className={td + ' text-ink-500'}>{r.source === 'manual' ? t('fx.manual') : r.source}</td>
                    <td className="text-right">
                      <IconButton label={t('common.delete')} className="h-7 w-7" onClick={() => void remove('rates', r.id)}>
                        <X size={12} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </Table>
              {seriesRates.length > 8 && <p className="mt-1 text-xs text-ink-500">{t('fx.more', { count: seriesRates.length - 8 })}</p>}
            </div>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle>{t('settings.lists')}</SectionTitle>
          <p className="mb-3 text-sm text-ink-500">{t('settings.listsHint')}</p>
          <div className="grid gap-5 md:grid-cols-2">
            {(['methods', 'fixedCategories', 'eventualCategories', 'installmentCategories', 'channels', 'investmentTypes'] as ListKey[]).map((k) => (
              <ListEditor key={k} k={k} prefs={prefs} />
            ))}
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <SectionTitle>{t('settings.about')}</SectionTitle>
          <p className="text-sm text-ink-600 dark:text-ink-300">{t('settings.aboutText')}</p>
          <p className="mt-2 text-xs text-ink-400">
            {t('settings.version')}: {__APP_VERSION__} · {t('settings.storage')}: {store.kind}
          </p>
        </Card>
      </div>
      {rateForm && <RateForm prefs={prefs} onClose={() => setRateForm(false)} />}
    </>
  )
}

function ListEditor({ k, prefs }: { k: ListKey; prefs: Prefs }) {
  const { t } = useTranslation()
  const [v, setV] = useState('')
  const list = prefs[k]
  const add = () => {
    const x = v.trim()
    if (!x || list.some((y) => y.toLowerCase() === x.toLowerCase())) return setV('')
    void savePrefs({ [k]: [...list, x] } as Partial<Prefs>)
    setV('')
  }
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium">{t(`settings.list_${k}`)}</div>
      <div className="flex flex-wrap gap-1.5">
        {list.map((x) => (
          <span key={x} className="inline-flex items-center gap-1 rounded-full bg-ink-100 py-1 pr-1 pl-2.5 text-sm dark:bg-ink-800">
            {x}
            <button
              type="button"
              aria-label={`${t('common.delete')} ${x}`}
              className="cursor-pointer rounded-full p-0.5 text-ink-500 hover:bg-ink-200 hover:text-ink-800 dark:hover:bg-ink-700 dark:hover:text-white"
              onClick={() => void savePrefs({ [k]: list.filter((y) => y !== x) } as Partial<Prefs>)}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={t('settings.addItem')} className="flex-1" />
        <Button type="submit" size="sm" disabled={!v.trim()}>
          <Plus size={14} />
        </Button>
      </form>
    </div>
  )
}

