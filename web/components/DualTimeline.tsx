'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AreaChart, LineChart } from 'lucide-react'
import { formatInteger } from '@/lib/dashboardMetrics'

type DualTimelineProps = {
  activeYear: number
}

type Mode = 'lines' | 'area'
type Point = {
  year: number
  unemployment: number
  consultations: number
  narrative: string
}

const points: Point[] = [
  { year: 2018, unemployment: 6.9, consultations: 6800, narrative: 'Em 2018, a procura por apoio estava mais contida, mas ja era uma necessidade real para milhares de pessoas.' },
  { year: 2019, unemployment: 6.5, consultations: 7100, narrative: 'Em 2019, a economia parecia mais estavel, mas a procura por consultas de saude mental continuou a crescer.' },
  { year: 2020, unemployment: 8.2, consultations: 12400, narrative: 'Em 2020, a pandemia fez subir o desemprego e aumentou fortemente a procura por apoio psicologico e medico.' },
  { year: 2021, unemployment: 7.0, consultations: 11700, narrative: 'Em 2021, mesmo com alguma recuperacao, muitas pessoas continuaram a precisar de acompanhamento.' },
  { year: 2022, unemployment: 6.1, consultations: 11200, narrative: 'Em 2022, o desemprego desceu, mas o efeito emocional acumulado ainda se via nas consultas.' },
  { year: 2023, unemployment: 6.5, consultations: 12000, narrative: 'Em 2023, a procura manteve-se elevada, mostrando que bem-estar emocional nao recupera de um dia para o outro.' },
  { year: 2024, unemployment: 6.1, consultations: 13500, narrative: 'Em 2024, a distancia entre estabilidade economica e sofrimento emocional tornou-se mais visivel.' },
  { year: 2025, unemployment: 6.0, consultations: 13900, narrative: 'Em 2025, a serie sugere uma necessidade persistente de apoio, mesmo com desemprego moderado.' },
]

type Pt = { x: number; y: number }

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

export default function DualTimeline({ activeYear }: DualTimelineProps) {
  const [mode, setMode] = useState<Mode>('lines')
  const width = 960
  const height = 540
  const left = 70
  const right = width - 70
  const top = 70
  const bottom = height - 70
  const innerWidth = right - left
  const innerHeight = bottom - top

  const maxUnemployment = Math.max(...points.map((point) => point.unemployment))
  const maxConsultations = Math.max(...points.map((point) => point.consultations))
  const activePoint = useMemo(() => points.find((point) => point.year === activeYear) ?? points[points.length - 1], [activeYear])

  const unemploymentPoints = points.map((point, index) => ({
    x: left + (index / (points.length - 1)) * innerWidth,
    y: bottom - (point.unemployment / maxUnemployment) * innerHeight,
  }))

  const consultationPoints = points.map((point, index) => ({
    x: left + (index / (points.length - 1)) * innerWidth,
    y: bottom - (point.consultations / maxConsultations) * innerHeight,
  }))

  const activeIndex = points.findIndex((point) => point.year === activeYear)
  const activeUnemploymentPoint = unemploymentPoints[activeIndex] ?? unemploymentPoints[0]
  const activeConsultationPoint = consultationPoints[activeIndex] ?? consultationPoints[0]
  const unemploymentPath = smoothPath(unemploymentPoints)
  const consultationPath = smoothPath(consultationPoints)

  return (
    <div className="grid min-h-full gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-white/10 bg-[rgba(18,21,27,0.88)] p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm text-white/46">Historico de Crises: Desemprego vs Consultas</div>
            <h2 className="mt-1 font-serif text-3xl text-white">Quando a vida aperta, a procura por apoio sobe</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('lines')}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:scale-105 ${
                mode === 'lines' ? 'border-[#14B8A6]/60 bg-[#14B8A6]/14 text-white' : 'border-white/10 bg-white/[0.03] text-white/58 hover:text-white'
              }`}
            >
              <LineChart className="h-4 w-4" />
              Grafico de linhas interativo
            </button>
            <button
              onClick={() => setMode('area')}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:scale-105 ${
                mode === 'area' ? 'border-[#14B8A6]/60 bg-[#14B8A6]/14 text-white' : 'border-white/10 bg-white/[0.03] text-white/58 hover:text-white'
              }`}
            >
              <AreaChart className="h-4 w-4" />
              Grafico de area sobreposta
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-5 text-sm text-white/68">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-8 rounded-full bg-[#14B8A6]" />
            Desemprego
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-8 rounded-full bg-[#D97757]" />
            Consultas de saude mental
          </div>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} className="min-h-[420px] w-full" role="img" aria-label="Historico de desemprego e consultas de saude mental">
          <defs>
            <linearGradient id="consultationArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(217,119,87,0.30)" />
              <stop offset="100%" stopColor="rgba(217,119,87,0.02)" />
            </linearGradient>
            <linearGradient id="unemploymentArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(20,184,166,0.28)" />
              <stop offset="100%" stopColor="rgba(20,184,166,0.02)" />
            </linearGradient>
          </defs>

          {[0, 1, 2, 3, 4].map((step) => {
            const y = top + step * (innerHeight / 4)
            return <line key={step} x1={left} x2={right} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 12" />
          })}

          {mode === 'area' && (
            <>
              <motion.path key={`area-u-${activeYear}`} d={areaPath(unemploymentPoints, bottom)} fill="url(#unemploymentArea)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
              <motion.path key={`area-c-${activeYear}`} d={areaPath(consultationPoints, bottom)} fill="url(#consultationArea)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
            </>
          )}

          <path d={unemploymentPath} fill="none" stroke="#14B8A6" strokeWidth="4" strokeLinecap="round" opacity="0.36" />
          <path d={consultationPath} fill="none" stroke="#D97757" strokeWidth="4" strokeLinecap="round" opacity="0.38" />

          <motion.circle
            key={`u-${activeYear}`}
            cx={activeUnemploymentPoint.x}
            cy={activeUnemploymentPoint.y}
            r="8"
            fill="#14B8A6"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: [1, 1.2, 1], opacity: 1 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
            style={{ filter: 'drop-shadow(0 0 14px rgba(20,184,166,0.55))' }}
          />
          <motion.circle
            key={`c-${activeYear}`}
            cx={activeConsultationPoint.x}
            cy={activeConsultationPoint.y}
            r="8"
            fill="#D97757"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: [1, 1.2, 1], opacity: 1 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
            style={{ filter: 'drop-shadow(0 0 14px rgba(217,119,87,0.55))' }}
          />

          {points.map((point, index) => (
            <text key={point.year} x={unemploymentPoints[index].x} y={height - 28} textAnchor="middle" fill={point.year === activeYear ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.34)'} fontSize="13">
              {point.year}
            </text>
          ))}
        </svg>
      </section>

      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-white/46">O que aconteceu em {activeYear}</div>
          <p className="mt-4 text-base leading-7 text-white/70">{activePoint.narrative}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-white/46">Desemprego</div>
          <div className="mt-2 font-serif text-3xl text-[#14B8A6]">{activePoint.unemployment.toFixed(1)}%</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-white/46">Consultas de saude mental</div>
          <div className="mt-2 font-serif text-3xl text-[#D97757]">{formatInteger(activePoint.consultations)}</div>
        </div>
      </aside>
    </div>
  )
}
