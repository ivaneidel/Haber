import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { openEntry } from '../components/entryStore'
import { PensionForm } from '../components/forms'
import { Amt } from '../components/money'
import { Badge, Button, Card, Empty, IconButton, Note, PageHeader, SectionTitle, confirmAction } from '../components/ui'
import { useModel } from '../hooks/useData'
import { pensionStatus } from '../lib/calc'
import { monthLabel, thisMonth, today } from '../lib/dates'
import { pensionMonthlyAvg } from '../lib/projection'
import { remove } from '../lib/repo'
import type { Pension } from '../lib/types'
import { MovementList, movementRows } from './Movements'

export default function Pensions() {
  const { t, i18n } = useTranslation()
  const model = useModel()
  const [edit, setEdit] = useState<Pension | 'new' | null>(null)
  if (!model) return null
  const { data } = model
  const m = thisMonth()
  const year = today().slice(0, 4)
  const groups = [
    { key: 'current', title: t('pension.current'), items: data.pensions.filter((p) => pensionStatus(p, m) === 'current') },
    { key: 'future', title: t('pension.future'), items: data.pensions.filter((p) => pensionStatus(p, m) === 'future') },
  ]

  return (
    <>
      <PageHeader
        title={t('nav.pensions')}
        subtitle={t('pension.subtitle')}
        actions={
          <>
            <Button onClick={() => openEntry({ type: 'pension' })} disabled={!data.pensions.length}>
              <Plus size={16} />
              {t('pension.record')}
            </Button>
            <Button variant="primary" onClick={() => setEdit('new')}>
              <Plus size={16} />
              {t('pension.new')}
            </Button>
          </>
        }
      />
      <Note tone="est" className="mb-4">
        {t('pension.note')} <Link to="/proyecciones" className="underline">{t('pension.seeProjection')}</Link>
      </Note>

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.key}>
            <SectionTitle>{g.title}</SectionTitle>
            {g.items.length === 0 ? (
              <Empty>{g.key === 'current' ? t('pension.noneCurrent') : t('pension.noneFuture')}</Empty>
            ) : (
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {g.items
                  .sort((a, b) => a.startMonth.localeCompare(b.startMonth))
                  .map((p) => {
                    const received = data.incomes.filter((i) => i.pensionId === p.id)
                    const ytd = received.filter((i) => i.date.startsWith(year))
                    return (
                      <li key={p.id} className="py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 font-medium">
                              {p.name}
                              {p.amount ? p.confirmed ? <Badge tone="good">{t('pension.confirmedBadge')}</Badge> : <Badge tone="est">{t('pension.estimated')}</Badge> : <Badge tone="warn">{t('pension.noAmount')}</Badge>}
                            </div>
                            <div className="text-sm text-ink-500">
                              {p.holder && `${p.holder} · `}
                              {g.key === 'current' ? t('pension.since', { month: monthLabel(p.startMonth, i18n.language) }) : t('pension.from', { month: monthLabel(p.startMonth, i18n.language) })}
                            </div>
                            {p.notes && <div className="text-xs text-ink-400">{p.notes}</div>}
                          </div>
                          <div className="flex items-center">
                            <IconButton label={t('common.edit')} onClick={() => setEdit(p)}>
                              <Pencil size={14} />
                            </IconButton>
                            {received.length === 0 && (
                              <IconButton label={t('common.delete')} onClick={() => confirmAction(t('common.deleteConfirm')) && void remove('pensions', p.id)}>
                                <Trash2 size={14} />
                              </IconButton>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                          <div>
                            <div className="text-xs text-ink-500">{t('pension.monthly')}</div>
                            {p.amount ? <Amt value={p.amount} cur={p.currency} className="font-semibold" /> : '—'}
                          </div>
                          <div>
                            <div className="text-xs text-ink-500">{t('pension.monthlyAvg')}</div>
                            {p.amount ? <Amt value={pensionMonthlyAvg(p)} cur={p.currency} /> : '—'}
                          </div>
                          {g.key === 'current' && (
                            <div>
                              <div className="text-xs text-ink-500">{t('pension.receivedYear', { year })}</div>
                              <Amt value={ytd.reduce((s, i) => s + (i.currency === p.currency ? i.amount : 0), 0)} cur={p.currency} className="text-pos" />
                            </div>
                          )}
                        </div>
                        {g.key === 'current' && (
                          <Button size="sm" className="mt-2" onClick={() => openEntry({ type: 'pension', preset: { pensionId: p.id, amount: received.sort((a, b) => b.date.localeCompare(a.date))[0]?.amount ?? p.amount, currency: p.currency } })}>
                            {t('pension.record')}
                          </Button>
                        )}
                      </li>
                    )
                  })}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <SectionTitle>{t('pension.history')}</SectionTitle>
        <MovementList rows={movementRows(data, t).filter((r) => r.type === 'pension')} />
      </Card>

      {edit && <PensionForm pension={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  )
}
