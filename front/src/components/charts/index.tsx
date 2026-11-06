import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { cn } from '@/utils/cn'

/* Palette alignée sur l'identité — jamais de couleurs par défaut Recharts. */
export const CHART_COLORS = ['#0E4D45', '#C8963E', '#157A6E', '#D6AC5F', '#6FB0A3', '#A87A2C']

const axisStyle = {
  fontSize: 11,
  fontFamily: 'JetBrains Mono, monospace',
  fill: 'rgb(var(--content-subtle))',
}

function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-lift">
      <p className="mb-1.5 font-mono text-2xs uppercase tracking-[0.14em] text-content-subtle">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey ?? entry.name} className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color ?? entry.fill }} />
          <span className="text-content-muted capitalize">{entry.name}</span>
          <span className="ml-auto font-mono font-semibold text-content">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </p>
      ))}
    </div>
  )
}

export function TrendChart({
  data, keys, height = 260, formatter, className,
}: {
  data: Array<Record<string, any>>
  keys: Array<{ key: string; label: string; color?: string }>
  height?: number
  formatter?: (value: number) => string
  className?: string
}) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            {keys.map((item, index) => (
              <linearGradient key={item.key} id={`grad-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color ?? CHART_COLORS[index]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={item.color ?? CHART_COLORS[index]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="rgb(var(--line))" vertical={false} />
          <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={46} />
          <Tooltip content={<ChartTooltip formatter={formatter} />} />
          {keys.map((item, index) => (
            <Area
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={item.color ?? CHART_COLORS[index]}
              strokeWidth={2.2}
              fill={`url(#grad-${item.key})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ColumnChart({
  data, xKey, keys, height = 260, className,
}: {
  data: Array<Record<string, any>>
  xKey: string
  keys: Array<{ key: string; label: string; color?: string }>
  height?: number
  className?: string
}) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="rgb(var(--line))" vertical={false} />
          <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={46} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--surface-2))' }} />
          {keys.map((item, index) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              fill={item.color ?? CHART_COLORS[index]}
              radius={[6, 6, 0, 0]}
              maxBarSize={38}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DonutChart({
  data, height = 260, className,
}: {
  data: Array<{ name: string; value: number; color?: string }>
  height?: number
  className?: string
}) {
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="56%"
            outerRadius="82%"
            paddingAngle={3}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ color: 'rgb(var(--content-muted))', fontSize: 12 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SparkLine({
  data, dataKey, color = CHART_COLORS[0], height = 44,
}: {
  data: Array<Record<string, any>>
  dataKey: string
  color?: string
  height?: number
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
