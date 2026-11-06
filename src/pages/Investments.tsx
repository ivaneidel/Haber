import { CalendarClock, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { openEntry } from '../components/entryStore'
import { CloseInvestmentForm, InvestmentForm } from '../components/forms'
import { Amt, CurBadge } from '../components/money'
import { Badge, Button, Card, Empty, IconButton, Note, PageHeader, SectionTitle, Segmented, confirmAction } from '../components/ui'
import { useModel } from '../hooks/useData'
import { capitalSummary, expectedInterest, upcomingMaturities, yieldsOf } from '../lib/calc'
import { dateLabel, today } from '../lib/dates'
import { formatPct } from '../lib/money'
import { apply, deleteInvestment, putOp, remove } from '../lib/repo'
import type { Currency, Investment } from '../lib/types'

export default function Investments() {
  const { t, i18n } = useTranslation()
  const model = useModel()
  const [edit, setEdit] = useState<Investment | 'new' | null>(null)
  const [preset, setPreset] = useState<Partial<Investment> | undefined>()
  const [closing, setClosing] = useState<Investment | null>(null)
  const [tab, setTab] = useState<'active' | 'closed'>('active')
  const [open, setOpen] = useState<string | null>(null)
  if (!model) return null
  const { data, prefs } = model
  const year = today().slice(0, 4)
  const list = data.investments
    .filter((i) => (tab === 'active' ? i.status === 'active' : i.status !== 'active'))
    .sort((a, b) => (tab === 'active' ? (a.maturityDate ?? '9999').localeCompare(b.maturityDate ?? '9999') : (b.closeDate ?? '').localeCompare(a.closeDate ?? '')))
  const maturities = upcomingMaturities(data)
  const curs: Currency[] = ['ARS', 'USD']

  return (
    <>
      <PageHeader
        title={t('nav.investments')}
        subtitle={t('inv.subtitle')}
        actions={
          <>
            <Button onClick={() => openEntry({ type: 'yield' })} disabled={!data.investments.length}>
              <Plus size={16} />
              {t('inv.recordYield')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setPreset(undefined)
                setEdit('new')
              }}
            >
              <Plus size={16} />
              {t('inv.new')}
            </Button>
          </>
        }
      />
      <Note className="mb-4">{t('inv.capitalVsYield')}</Note>

      <div className="grid gap-4 lg:grid-cols-2">
        {curs.map((cur) => {
          const s = capitalSummary(data, cur)
          const ytd = data.yields.filter((y) => y.currency === cur && y.date.startsWith(year)).reduce((a, y) => a + y.amount, 0)
          return (
            <Card key={cur}>
              <SectionTitle>
                <span className="flex items-center gap-2">
                  {t('inv.summary')} <CurBadge cur={cur} />
                </span>
              </SectionTitle>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Stat label={t('inv.placed')} value={<Amt value={s.placed} cur={cur} />} hint={t('inv.placedHint')} />
                <Stat label={t('inv.available')} value={<Amt value={s.available} cur={cur} tone />} hint={t('inv.availableHint')} />
                <Stat label={t('inv.investedTotal')} value={<Amt value={s.investedTotal} cur={cur} />} hint={t('inv.investedTotalHint')} />
                <Stat label={t('inv.yieldsYear', { year })} value={<Amt value={ytd} cur={cur} className="text-pos" />} />
                <Stat label={t('inv.yieldsAll')} value={<Amt value={s.yields} cur={cur} className="text-pos" />} hint={t('inv.yieldsAllHint')} />
                <Stat label={t('inv.capitalResult')} value={<Amt value={s.capitalResult} cur={cur} tone sign />} hint={t('inv.capitalResultHint')} />
              </dl>
            </Card>
          )
        })}
      </div>

      {maturities.length > 0 && (
        <Card className="mt-4">
          <SectionTitle>
            <span className="flex items-center gap-2">
              <CalendarClock size={16} />
              {t('inv.maturities')}
            </span>
          </SectionTitle>
          <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
            {maturities.map((i) => {
              const exp = expectedInterest(i)
              const overdue = i.maturityDate! < today()
              return (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <strong className="font-medium">{dateLabel(i.maturityDate, i18n.language)}</strong> · {i.name} · <Amt value={i.capital} cur={i.currency} />
                    {exp !== null && (
                      <span className="text-ink-500">
                        {' '}
                        · {t('inv.expected')} <Amt value={exp} cur={i.currency} />
                      </span>
                    )}
                    {overdue && (
                      <Badge tone="warn">
                        {t('inv.maturedPending')}
                      </Badge>
                    )}
                  </span>
                  <Button size="sm" onClick={() => setClosing(i)}>
                    {t('inv.close')}
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <div className="mt-6 mb-3 flex items-center justify-between gap-2">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: t('inv.tabActive', { count: data.investments.filter((i) => i.status === 'active').length }) },
            { value: 'closed', label: t('inv.tabClosed', { count: data.investments.filter((i) => i.status !== 'active').length }) },
          ]}
        />
      </div>
      <Card>
        {list.length === 0 ? (
          <Empty>{tab === 'active' ? t('inv.noneActive') : t('inv.noneClosed')}</Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="text-left text-xs text-ink-500">
                <tr>
                  <th className="w-6" />
                  <th className="py-2 pr-2 font-medium">{t('inv.name')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('inv.capital')}</th>
                  <th className="px-2 py-2 font-medium">{t('inv.dates')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('xl.rate')}</th>
                  <th className="px-2 py-2 text-right font-medium">{t('inv.yieldsReceived')}</th>
                  <th className="px-2 py-2 font-medium">{t('inv.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((i) => {
                  const ys = yieldsOf(data, i.id)
                  const ysum = ys.reduce((a, y) => a + y.amount, 0)
                  const isOpen = open === i.id
                  return (
                    <Fragment key={i.id}>
                      <tr className="border-t border-ink-100 dark:border-ink-800">
                        <td>
                          {ys.length > 0 && (
                            <IconButton label={t('inv.showYields')} onClick={() => setOpen(isOpen ? null : i.id)} className="h-7 w-7">
                              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </IconButton>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <div className="font-medium">{i.name}</div>
                          <div className="text-xs text-ink-500">
                            {i.type}
                            {i.institution && ` · ${i.institution}`}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <Amt value={i.capital} cur={i.currency} className="font-medium" />
                            <CurBadge cur={i.currency} />
                          </span>
                          {i.status !== 'active' && i.recovered != null && (
                            <div className="text-xs text-ink-500">
                              {t('inv.recoveredShort')} <Amt value={i.recovered} cur={i.currency} />
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs whitespace-nowrap text-ink-600 dark:text-ink-300">
                          {dateLabel(i.startDate, i18n.language)}
                          {i.maturityDate && ` → ${dateLabel(i.maturityDate, i18n.language)}`}
                          {i.closeDate && i.closeDate !== i.maturityDate && <div>{t('inv.closedOn', { date: dateLabel(i.closeDate, i18n.language) })}</div>}
                        </td>
                        <td className="px-2 py-2 text-right tnum">{i.rate ? formatPct(i.rate, i18n.language) : '—'}</td>
                        <td className="px-2 py-2 text-right">
                          <Amt value={ysum} cur={i.currency} className="text-pos" />
                        </td>
                        <td className="px-2 py-2">
                          <Badge tone={i.status === 'active' ? 'good' : 'neutral'}>{t(`inv.status_${i.status}`)}</Badge>
                        </td>
                        <td className="py-1 text-right whitespace-nowrap">
                          {i.status === 'active' && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => openEntry({ type: 'yield', preset: { investmentId: i.id, currency: i.currency } })}>
                                {t('inv.yieldShort')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setClosing(i)}>
                                {t('inv.close')}
                              </Button>
                            </>
                          )}
                          {i.status !== 'active' && (
                            <Button size="sm" variant="ghost" onClick={() => void reopen(i)}>
                              {t('inv.reopen')}
                            </Button>
                          )}
                          <IconButton label={t('common.edit')} onClick={() => setEdit(i)}>
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton label={t('common.delete')} onClick={() => confirmAction(t('inv.deleteConfirm')) && void deleteInvestment(data, i.id)}>
                            <Trash2 size={14} />
                          </IconButton>
                        </td>
                      </tr>
                      {isOpen &&
                        ys.map((y) => (
                          <tr key={y.id} className="bg-ink-50 text-xs dark:bg-ink-800/40">
                            <td />
                            <td className="py-1.5 pr-2 text-ink-500" colSpan={4}>
                              {dateLabel(y.date, i18n.language)} · {t('entry.yield')}
                              {y.toCapital && ` · ${t('mov.reinvested')}`}
                              {y.notes && ` · ${y.notes}`}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <Amt value={y.amount} cur={y.currency} />
                            </td>
                            <td />
                            <td className="text-right">
                              <IconButton label={t('common.edit')} className="h-7 w-7" onClick={() => openEntry({ edit: { table: 'yields', row: y } })}>
                                <Pencil size={12} />
                              </IconButton>
                              <IconButton label={t('common.delete')} className="h-7 w-7" onClick={() => confirmAction(t('common.deleteConfirm')) && void remove('yields', y.id)}>
                                <Trash2 size={12} />
                              </IconButton>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {edit && <InvestmentForm data={data} prefs={prefs} inv={edit === 'new' ? undefined : edit} preset={preset} onClose={() => setEdit(null)} />}
      {closing && (
        <CloseInvestmentForm
          inv={closing}
          onClose={() => setClosing(null)}
          onRenew={(p) => {
            setPreset(p)
            setTimeout(() => setEdit('new'), 0)
          }}
        />
      )}
    </>
  )
}

async function reopen(i: Investment) {
  await apply([putOp('investments', { ...i, status: 'active', closeDate: undefined, recovered: null })])
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div title={hint}>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="text-base font-semibold">{value}</dd>
      {hint && <dd className="text-[11px] leading-tight text-ink-400">{hint}</dd>}
    </div>
  )
}
