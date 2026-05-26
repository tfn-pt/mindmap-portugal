'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AreaChart, CalendarDays, LineChart } from 'lucide-react'
import { formatDecimal, formatInteger, loadParsedDashboardData, type DashboardMetricRow } from '@/lib/dashboardMetrics'

type DualTimelineProps = {
  activeYear: number
}

type Mode = 'lines' | 'area'
type Tab = 'demand' | 'regional'
type Pt = { x: number; y: number }
type NationalPoint = { year: number; consultas: number; spending: number | null }
type RegionalPoint = { year: number; region: string; consultas: number; index: number }

const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025] as const
const REGIONS = ['Norte', 'Centro', 'Lisboa e Vale do Tejo', 'Alentejo', 'Algarve'] as const
const REGION_COLORS: Record<string, string> = {
  Norte: '#14B8A6',
  Centro: '#A78BFA',
  'Lisboa e Vale do Tejo': '#D97757',
  Alentejo: '#F59E0B',
  Algarve: '#60A5FA',
}
const MARKERS = [
  { year: 2020, label: 'Pandemia COVID-19', color: '#F87171' },
  { year: 2022, label: 'Pos-pandemia', color: '#FBBF24' },
  { year: 2024, label: 'Novo plano saude mental', color: '#A78BFA' },
] as const

const DEMAND_NARRATIVES: Record<number, string> = {
  2018: 'Em 2018, ja havia muitas consultas em todo o pais.',
  2019: 'Em 2019, as consultas subiram e o gasto por pessoa tambem.',
  2020: 'Em 2020, a pandemia ajudou a fazer subir a procura por apoio.',
  2021: 'Em 2021, a procura continuou alta mesmo depois do pior da pandemia.',
  2022: 'Em 2022, o sistema continuou a receber muitas pessoas a pedir ajuda.',
  2023: 'Em 2023, a procura manteve-se forte e acima dos anos mais antigos.',
  2024: 'Em 2024, o gasto por pessoa voltou a subir e as consultas continuaram altas.',
  2025: 'Em 2025, vemos as consultas, mas o valor do Eurostat ainda nao foi publicado.',
}

const REGIONAL_NARRATIVES: Record<number, string> = {
  2018: 'Aqui todas as regioes comecam no mesmo ponto: 100.',
  2019: 'Em 2019, Norte e Centro sobem mais depressa do que as outras.',
  2020: 'Em 2020, o Norte acelera mais e o Algarve tambem recupera.',
  2021: 'Em 2021, o Alentejo comeca a ganhar velocidade.',
  2022: 'Em 2022, Norte e Alentejo continuam entre os que mais sobem.',
  2023: 'Em 2023, o Norte segue na frente e Lisboa e Vale do Tejo melhora.',
  2024: 'Em 2024, o Alentejo sobe ainda mais depressa.',
  2025: 'Em 2025, Alentejo e Norte aparecem como os que mais cresceram desde 2018.',
}

function smoothPath(items: Pt[]) {
  if (items.length < 2) return ''
  let d = `M ${items[0].x} ${items[0].y}`
  for (let i = 0; i < items.length - 1; i++) {
    const current = items[i]
    const next = items[i + 1]
    const prev = items[i - 1] ?? current
    const after = items[i + 2] ?? next
    const cp1x = current.x + (next.x - prev.x) / 6
    const cp1y = current.y + (next.y - prev.y) / 6
    const cp2x = next.x - (after.x - current.x) / 6
    const cp2y = next.y - (after.y - current.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`
  }
  return d
}

function areaPath(items: Pt[], baseline: number) {
  if (!items.length) return ''
  return `${smoothPath(items)} L ${items[items.length - 1].x} ${baseline} L ${items[0].x} ${baseline} Z`
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('pt-PT', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function normalize(value: number, min: number, max: number) {
  if (max <= min) return 0.5
  return (value - min) / (max - min)
}

function buildNationalSeries(rows: DashboardMetricRow[]) {
  const byYear = rows.reduce(
    (acc, row) => {
      if (!YEARS.includes(row.ano as (typeof YEARS)[number])) return acc
      if (!REGIONS.includes(row.regiao as (typeof REGIONS)[number])) return acc

      const year = row.ano
      acc[year] = acc[year] ?? { consultas: 0, spending: null }

      if (typeof row.consultas_sns === 'number') acc[year].consultas += row.consultas_sns
      if (typeof row.spending_eurostat === 'number' && row.spending_eurostat > 0 && acc[year].spending === null) {
        acc[year].spending = row.spending_eurostat
      }

      return acc
    },
    {} as Record<number, { consultas: number; spending: number | null }>
  )

  return YEARS.map((year) => ({
    year,
    consultas: byYear[year]?.consultas ?? 0,
    spending: byYear[year]?.spending ?? null,
  }))
}

function buildRegionalSeries(rows: DashboardMetricRow[]) {
  const consultationsByRegion = rows.reduce(
    (acc, row) => {
      if (!YEARS.includes(row.ano as (typeof YEARS)[number])) return acc
      if (!REGIONS.includes(row.regiao as (typeof REGIONS)[number])) return acc
      if (typeof row.consultas_sns !== 'number') return acc

      acc[row.regiao] = acc[row.regiao] ?? {}
      acc[row.regiao][row.ano] = (acc[row.regiao][row.ano] ?? 0) + row.consultas_sns
      return acc
    },
    {} as Record<string, Partial<Record<number, number>>>
  )

  return REGIONS.flatMap((region) => {
    const base = consultationsByRegion[region]?.[2018] ?? 0
    return YEARS.map((year) => {
      const consultas = consultationsByRegion[region]?.[year] ?? 0
      const index = base > 0 ? (consultas / base) * 100 : 100
      return { year, region, consultas, index }
    })
  })
}

export default function DualTimeline({ activeYear }: DualTimelineProps) {
  const [rows, setRows] = useState<DashboardMetricRow[]>([])
  const [mode, setMode] = useState<Mode>('lines')
  const [tab, setTab] = useState<Tab>('demand')
  const [showMarkers, setShowMarkers] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const parsed = await loadParsedDashboardData()
      if (!cancelled) setRows(parsed)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const width = 960
  const height = 430
  const left = 74
  const right = width - 74
  const top = 58
  const bottom = height - 50
  const innerWidth = right - left
  const innerHeight = bottom - top

  const nationalSeries = useMemo(() => buildNationalSeries(rows), [rows])
  const regionalSeries = useMemo(() => buildRegionalSeries(rows), [rows])

  const activeNational = useMemo(
    () => nationalSeries.find((point) => point.year === activeYear) ?? nationalSeries[nationalSeries.length - 1],
    [activeYear, nationalSeries]
  )

  const regionalByRegion = useMemo(
    () =>
      REGIONS.map((region) => ({
        region,
        color: REGION_COLORS[region],
        points: regionalSeries.filter((point) => point.region === region),
      })),
    [regionalSeries]
  )

  const activeRegional = useMemo(
    () => regionalSeries.filter((point) => point.year === activeYear),
    [activeYear, regionalSeries]
  )

  const fastestRegion = useMemo(() => {
    if (activeYear === 2018) return null
    return activeRegional.reduce<RegionalPoint | null>((best, point) => {
      if (!best || point.index > best.index) return point
      return best
    }, null)
  }, [activeRegional, activeYear])

  const xForIndex = (index: number) => left + (index / Math.max(YEARS.length - 1, 1)) * innerWidth
  const xForYear = (year: number) => xForIndex(Math.max(0, YEARS.indexOf(year as (typeof YEARS)[number])))

  const consultationValues = nationalSeries.map((point) => point.consultas)
  const spendingValues = nationalSeries.map((point) => point.spending).filter((value): value is number => value !== null)
  const consultationsMin = Math.min(...consultationValues)
  const consultationsMax = Math.max(...consultationValues)
  const spendingMin = Math.min(...spendingValues)
  const spendingMax = Math.max(...spendingValues)

  const consultationPoints = nationalSeries.map((point, index) => ({
    x: xForIndex(index),
    y: bottom - normalize(point.consultas, consultationsMin, consultationsMax) * innerHeight,
  }))

  const spendingPoints = nationalSeries.flatMap((point, index) =>
    point.spending === null
      ? []
      : [
          {
            x: xForIndex(index),
            y: bottom - normalize(point.spending, spendingMin, spendingMax) * innerHeight,
          },
        ]
  )

  const regionalIndexValues = regionalSeries.map((point) => point.index)
  const regionalMin = Math.min(...regionalIndexValues, 100)
  const regionalMax = Math.max(...regionalIndexValues, 100)

  const regionalChartLines = regionalByRegion.map(({ region, color, points }) => ({
    region,
    color,
    svgPoints: points.map((point, index) => ({
      x: xForIndex(index),
      y: bottom - normalize(point.index, regionalMin, regionalMax) * innerHeight,
    })),
    data: points,
  }))

  const activeIndex = Math.max(0, YEARS.indexOf(activeYear as (typeof YEARS)[number]))
  const activeConsultationPoint = consultationPoints[activeIndex] ?? consultationPoints[0]
  const activeSpending = activeNational?.spending ?? null
  const activeSpendingPoint =
    activeSpending === null
      ? null
      : {
          x: xForIndex(activeIndex),
          y: bottom - normalize(activeSpending, spendingMin, spendingMax) * innerHeight,
        }

  const demandNarrative = DEMAND_NARRATIVES[activeYear] ?? DEMAND_NARRATIVES[2025]
  const regionalNarrative = REGIONAL_NARRATIVES[activeYear] ?? REGIONAL_NARRATIVES[2025]

  return (
    <div className="grid min-h-full gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-white/10 bg-[rgba(18,21,27,0.88)] p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm text-white/46">Consultas e evolucao por regiao</div>
            <h2 className="mt-1 font-serif text-2xl text-white">O que subiu, onde subiu e quando</h2>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setTab('demand')}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:scale-105 ${
                tab === 'demand' ? 'border-[#14B8A6]/60 bg-[#14B8A6]/14 text-white' : 'border-white/10 bg-white/[0.03] text-white/58 hover:text-white'
              }`}
            >
              <LineChart className="h-4 w-4" />
              Consultas e gasto
            </button>
            <button
              onClick={() => setTab('regional')}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:scale-105 ${
                tab === 'regional' ? 'border-[#14B8A6]/60 bg-[#14B8A6]/14 text-white' : 'border-white/10 bg-white/[0.03] text-white/58 hover:text-white'
              }`}
            >
              <LineChart className="h-4 w-4" />
              Que regioes subiram mais
            </button>
            {tab === 'demand' && (
              <>
                <button
                  onClick={() => setMode('lines')}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:scale-105 ${
                    mode === 'lines' ? 'border-[#14B8A6]/60 bg-[#14B8A6]/14 text-white' : 'border-white/10 bg-white/[0.03] text-white/58 hover:text-white'
                  }`}
                >
                  <LineChart className="h-4 w-4" />
                  Linhas
                </button>
                <button
                  onClick={() => setMode('area')}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:scale-105 ${
                    mode === 'area' ? 'border-[#14B8A6]/60 bg-[#14B8A6]/14 text-white' : 'border-white/10 bg-white/[0.03] text-white/58 hover:text-white'
                  }`}
                >
                  <AreaChart className="h-4 w-4" />
                  Area
                </button>
              </>
            )}
            <button
              onClick={() => setShowMarkers((value) => !value)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:scale-105 ${
                showMarkers ? 'border-[#A78BFA]/60 bg-[#A78BFA]/14 text-white' : 'border-white/10 bg-white/[0.03] text-white/58 hover:text-white'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Momentos importantes
            </button>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap gap-4 text-sm text-white/68">
          {tab === 'demand' ? (
            <>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-8 rounded-full bg-[#14B8A6]" />
                Consultas no SNS
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-8 rounded-full bg-[#D97757]" />
                Gasto por pessoa (€)
              </div>
            </>
          ) : (
            REGIONS.map((region) => (
              <div key={region} className="flex items-center gap-2">
                <span className="h-1.5 w-8 rounded-full" style={{ backgroundColor: REGION_COLORS[region] }} />
                {region}
              </div>
            ))
          )}
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-h-[320px] w-full"
          role="img"
          aria-label={tab === 'demand' ? 'Consultas no SNS e gasto por pessoa em saude por ano' : 'Regioes que mais subiram nas consultas no SNS'}
        >
          <defs>
            <linearGradient id="dual-timeline-consultation-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(20,184,166,0.26)" />
              <stop offset="100%" stopColor="rgba(20,184,166,0.02)" />
            </linearGradient>
            <linearGradient id="dual-timeline-spending-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(217,119,87,0.28)" />
              <stop offset="100%" stopColor="rgba(217,119,87,0.02)" />
            </linearGradient>
          </defs>

          {[0, 1, 2, 3, 4].map((step) => {
            const y = top + step * (innerHeight / 4)
            return <line key={step} x1={left} x2={right} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 12" />
          })}

          <motion.g initial={{ opacity: 0 }} animate={{ opacity: showMarkers ? 1 : 0 }} transition={{ duration: 0.35 }}>
            {MARKERS.map((marker) => {
              const x = xForYear(marker.year)
              const pillWidth = marker.label.length * 6.1 + 18
              return (
                <g key={marker.year}>
                  <line
                    x1={x}
                    x2={x}
                    y1={top}
                    y2={bottom}
                    stroke={marker.color}
                    strokeOpacity="0.5"
                    strokeWidth="2"
                    strokeDasharray="4 8"
                  />
                  <g transform={`translate(${x - 10} ${top - 14}) rotate(-90)`}>
                    <rect width={pillWidth} height="20" rx="10" fill="rgba(12,13,18,0.92)" stroke={marker.color} strokeOpacity="0.5" />
                    <text x="10" y="13.5" fill={marker.color} fontSize="11">
                      {marker.label}
                    </text>
                  </g>
                </g>
              )
            })}
          </motion.g>

          {tab === 'demand' ? (
            <>
              {mode === 'area' && (
                <>
                  <motion.path
                    key={`area-consultas-${activeYear}`}
                    d={areaPath(consultationPoints, bottom)}
                    fill="url(#dual-timeline-consultation-area)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                  <motion.path
                    key={`area-spending-${activeYear}`}
                    d={areaPath(spendingPoints, bottom)}
                    fill="url(#dual-timeline-spending-area)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                </>
              )}

              <path d={smoothPath(consultationPoints)} fill="none" stroke="#14B8A6" strokeWidth="4" strokeLinecap="round" opacity="0.95" />
              {spendingPoints.length > 1 && <path d={smoothPath(spendingPoints)} fill="none" stroke="#D97757" strokeWidth="4" strokeLinecap="round" opacity="0.95" />}

              <motion.circle
                key={`consultas-${activeYear}`}
                cx={activeConsultationPoint.x}
                cy={activeConsultationPoint.y}
                r="8"
                fill="#14B8A6"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: [1, 1.2, 1], opacity: 1 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
                style={{ filter: 'drop-shadow(0 0 14px rgba(20,184,166,0.55))' }}
              />
              {activeSpendingPoint && (
                <motion.circle
                  key={`spending-${activeYear}`}
                  cx={activeSpendingPoint.x}
                  cy={activeSpendingPoint.y}
                  r="8"
                  fill="#D97757"
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: [1, 1.2, 1], opacity: 1 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
                  style={{ filter: 'drop-shadow(0 0 14px rgba(217,119,87,0.55))' }}
                />
              )}

              <text x={28} y={top - 12} fill="rgba(255,255,255,0.62)" fontSize="13">
                Consultas no SNS
              </text>
              <text x={width - 188} y={top - 12} fill="rgba(255,255,255,0.62)" fontSize="13">
                Gasto por pessoa (€)
              </text>
            </>
          ) : (
            <>
              {regionalChartLines.map(({ region, color, svgPoints }) => {
                const activePoint = svgPoints[activeIndex] ?? svgPoints[0]
                return (
                  <g key={region}>
                    <path d={smoothPath(svgPoints)} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" opacity="0.95" />
                    <motion.circle
                      key={`${region}-${activeYear}`}
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r="7"
                      fill={color}
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: [1, 1.2, 1], opacity: 1 }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
                      style={{ filter: `drop-shadow(0 0 14px ${color}99)` }}
                    />
                  </g>
                )
              })}

              <text x={28} y={top - 12} fill="rgba(255,255,255,0.62)" fontSize="13">
                Base 2018 = 100
              </text>
            </>
          )}

          {YEARS.map((year, index) => (
            <text
              key={year}
              x={xForIndex(index)}
              y={height - 28}
              textAnchor="middle"
              fill={year === activeYear ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.34)'}
              fontSize="13"
            >
              {year}
            </text>
          ))}
        </svg>
      </section>

      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-white/46">Resumo rapido de {activeYear}</div>
          <p className="mt-3 text-sm leading-6 text-white/70">{tab === 'demand' ? demandNarrative : regionalNarrative}</p>
        </div>

        <div className={`rounded-lg border p-5 ${tab === 'demand' ? 'border-[#14B8A6]/20 bg-[#14B8A6]/[0.06]' : 'border-white/10 bg-white/[0.04]'}`}>
          <div className="text-sm text-white/46">Consultas e gasto</div>
          <div className="mt-3 grid gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/34">Consultas no ano</div>
              <div className="mt-1 font-serif text-3xl text-[#14B8A6]">{formatInteger(activeNational?.consultas ?? 0)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/34">Gasto por pessoa</div>
              <div className="mt-1 font-serif text-3xl text-[#D97757]">
                {activeNational?.spending === null ? 'Ainda sem valor' : `${formatDecimal(activeNational.spending, 2)} €`}
              </div>
            </div>
          </div>
        </div>

        <div className={`rounded-lg border p-5 ${tab === 'regional' ? 'border-[#A78BFA]/20 bg-[#A78BFA]/[0.06]' : 'border-white/10 bg-white/[0.04]'}`}>
          <div className="text-sm text-white/46">Quem subiu mais depressa</div>
          {fastestRegion ? (
            <>
              <div className="mt-3 font-serif text-3xl text-white">{fastestRegion.region}</div>
              <div className="mt-2 text-sm leading-6 text-white/68">
                Em {activeYear}, esta regiao esta em {formatDecimal(fastestRegion.index, 1)}.
                Isso quer dizer {formatDecimal(fastestRegion.index - 100, 1)}% acima de 2018.
              </div>
              <div className="mt-2 text-sm text-white/50">{compactNumber(fastestRegion.consultas)} consultas nesse ano.</div>
            </>
          ) : (
            <div className="mt-3 text-sm leading-6 text-white/68">
              Em 2018, todas as regioes comecam iguais para ser facil comparar.
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
