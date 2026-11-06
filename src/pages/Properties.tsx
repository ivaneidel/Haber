import { Building2, MapPin, Plus, User } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PropertyForm } from '../components/forms'
import { Amt, Multi, ViewSwitch } from '../components/money'
import { Badge, Button, Card, Empty, PageHeader, Toggle } from '../components/ui'
import { useModel } from '../hooks/useData'
import { currentValuation, filterFlows, totals } from '../lib/calc'
import { dateLabel, today } from '../lib/dates'
import type { Property } from '../lib/types'

export function contractBadge(p: Property, t: (k: string, o?: Record<string, unknown>) => string) {
  if (p.soldAt) return <Badge>{t('property.sold')}</Badge>
  if (p.archived) return <Badge>{t('property.archived')}</Badge>
  if (!p.contractEnd) return null
  const days = (Date.parse(p.contractEnd) - Date.parse(today())) / 86_400_000
  if (days < 0) return <Badge tone="bad">{t('property.contractExpired')}</Badge>
  if (days <= 90) return <Badge tone="warn">{t('property.contractEndsSoon', { days: Math.ceil(days) })}</Badge>
  return null
}

export default function Properties() {
  const { t, i18n } = useTranslation()
  const model = useModel()
  const [editing, setEditing] = useState<Property | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  if (!model) return null
  const { data, flows, lenses } = model
  const year = today().slice(0, 4)
  const list = data.properties.filter((p) => showArchived || !p.archived)
  const archivedCount = data.properties.filter((p) => p.archived).length

  return (
    <>
      <PageHeader
        title={t('nav.properties')}
        subtitle={t('property.subtitle')}
        actions={
          <>
            <ViewSwitch model={model} />
            <Button variant="primary" onClick={() => setEditing('new')}>
              <Plus size={16} />
              {t('property.new')}
            </Button>
          </>
        }
      />
      {list.length === 0 ? (
        <Card>
          <Empty
            action={
              <Button variant="primary" onClick={() => setEditing('new')}>
                <Plus size={16} />
                {t('property.new')}
              </Button>
            }
          >
            {t('property.none')}
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const yearFlows = filterFlows(flows, { from: `${year}-01`, to: `${year}-12`, propertyId: p.id })
            const v = currentValuation(data, p.id)
            return (
              <Link
                key={p.id}
                to={`/propiedades/${p.id}`}
                className="flex flex-col rounded-2xl border border-ink-200/80 bg-white p-4 transition-colors hover:border-brand-400 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-brand-600"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Building2 size={18} className="shrink-0 text-brand-600 dark:text-brand-400" />
                    <h3 className="truncate font-semibold">{p.name}</h3>
                  </div>
                  {contractBadge(p, t)}
                </div>
                {(p.address || p.city) && (
                  <p className="mt-1 flex items-center gap-1 truncate text-sm text-ink-500">
                    <MapPin size={13} />
                    {[p.address, p.city].filter(Boolean).join(', ')}
                  </p>
                )}
                {p.tenant && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-500">
                    <User size={13} />
                    {p.tenant}
                    {p.contractEnd && <span className="text-ink-400"> · {t('property.until', { date: dateLabel(p.contractEnd, i18n.language) })}</span>}
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-ink-100 pt-3 text-sm dark:border-ink-800">
                  <div>
                    <div className="text-xs text-ink-500">{t('property.collectedYear', { year })}</div>
                    <Multi lenses={lenses} get={(l) => totals(yearFlows, l).rent} size="sm" />
                  </div>
                  <div>
                    <div className="text-xs text-ink-500">{t('property.netYear', { year })}</div>
                    <Multi lenses={lenses} get={(l) => totals(yearFlows, l).realEstateNet} size="sm" tone />
                  </div>
                  <div>
                    <div className="text-xs text-ink-500">{t('property.refRent')}</div>
                    {p.refRent ? <Amt value={p.refRent} cur={p.refRentCurrency} className="text-sm" /> : <span className="text-ink-400">—</span>}
                  </div>
                  <div>
                    <div className="text-xs text-ink-500">{t('property.marketValue')}</div>
                    {v ? <Amt value={v.value} cur={v.currency} className="text-sm" /> : <span className="text-ink-400">—</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {archivedCount > 0 && (
        <div className="mt-4 max-w-xs">
          <Toggle checked={showArchived} onChange={setShowArchived} label={t('property.showArchived', { count: archivedCount })} />
        </div>
      )}
      {editing && <PropertyForm data={data} property={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
