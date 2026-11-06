import { Building2, Home, TrendingUp, Users } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { ColumnChart, DonutChart, TrendChart } from '@/components/charts'
import { usePlatformStats } from '@/hooks/useQueries'
import { cityDistribution, platformGrowth, portfolioBreakdown, revenueSeries } from '@/mocks/data'
import { formatNumber } from '@/utils/format'

/** Statistiques consolidées de la plateforme. */
export function StatisticsPage() {
  const { data } = usePlatformStats()

  return (
    <div>
      <PageHeader
        eyebrow="Pilotage"
        title="Statistiques"
        description="Croissance des agences, du catalogue et de la base d'utilisateurs."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Utilisateurs" value={formatNumber(data?.users)} icon={<Users className="h-4 w-4" />} delta={18} hint="sur douze mois" accent index={0} />
        <StatCard label="Agences" value={formatNumber(data?.agencies)} icon={<Building2 className="h-4 w-4" />} delta={12} index={1} />
        <StatCard label="Biens référencés" value={formatNumber(data?.properties)} icon={<Home className="h-4 w-4" />} delta={9} index={2} />
        <StatCard label="Agences actives" value={formatNumber(data?.agencies_active)} icon={<TrendingUp className="h-4 w-4" />} hint={`${formatNumber(data?.agencies_pending)} en attente`} index={3} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Croissance" title="Utilisateurs et agences" subtitle="Douze derniers mois" />
          <div className="p-4">
            <TrendChart
              data={platformGrowth}
              keys={[
                { key: 'utilisateurs', label: 'Utilisateurs' },
                { key: 'agences', label: 'Agences', color: '#C8963E' },
              ]}
              height={280}
            />
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Transactions" title="Ventes et locations par mois" />
          <div className="p-4">
            <TrendChart
              data={revenueSeries}
              keys={[
                { key: 'ventes', label: 'Ventes' },
                { key: 'locations', label: 'Locations', color: '#C8963E' },
              ]}
              height={280}
            />
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Territoire" title="Répartition des biens par ville" />
          <div className="p-4">
            <ColumnChart data={cityDistribution} xKey="city" keys={[{ key: 'biens', label: 'Biens' }]} height={280} />
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Catalogue" title="Répartition par type de bien" />
          <div className="p-4">
            <DonutChart data={portfolioBreakdown} height={280} />
          </div>
        </Card>
      </div>
    </div>
  )
}
