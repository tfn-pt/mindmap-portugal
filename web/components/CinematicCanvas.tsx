'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Activity, HeartPulse, LineChart, Map, Search, ShieldCheck } from 'lucide-react'
import CapacityBalanceChart from '@/components/CapacityBalanceChart'
import DualTimeline from '@/components/DualTimeline'
import InteractiveMap from '@/components/InteractiveMap'
import NationalSignalsChart from '@/components/NationalSignalsChart'
import NeuralBackground from '@/components/NeuralBackground'
import TrendsHeatmap from '@/components/TrendsHeatmap'

const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025] as const
const VIEWS = [
  { id: 'map', label: 'Mapa de apoio', icon: Map },
  { id: 'timeline', label: 'Historico de crises', icon: LineChart },
  { id: 'trends', label: 'Procuras no Google', icon: Search },
  { id: 'capacity', label: 'Capacidade do SNS', icon: ShieldCheck },
  { id: 'signals', label: 'Sinais nacionais', icon: Activity },
] as const

type ActiveView = (typeof VIEWS)[number]['id']

function ViewContent({ activeView, activeYear }: { activeView: ActiveView; activeYear: number }) {
  switch (activeView) {
    case 'map':
      return <InteractiveMap activeYear={activeYear} />
    case 'timeline':
      return <DualTimeline activeYear={activeYear} />
    case 'trends':
      return <TrendsHeatmap activeYear={activeYear} />
    case 'capacity':
      return <CapacityBalanceChart activeYear={activeYear} />
    case 'signals':
      return <NationalSignalsChart activeYear={activeYear} />
    default:
      return null
  }
}

export default function CinematicCanvas() {
  const [activeYear, setActiveYear] = useState<number>(2023)
  const [activeView, setActiveView] = useState<ActiveView>('map')

  const activeLabel = useMemo(() => VIEWS.find((view) => view.id === activeView)?.label ?? 'Mapa de apoio', [activeView])

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0C0D12] text-white">
      <NeuralBackground />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_18%_12%,rgba(20,184,166,0.08),transparent_28%),radial-gradient(circle_at_84%_80%,rgba(217,119,87,0.08),transparent_26%),linear-gradient(180deg,rgba(12,13,18,0.78),rgba(15,16,21,0.98))]" />

      <header className="relative z-20 px-4 pt-4 md:px-8 md:pt-6">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-5 rounded-lg border border-white/10 bg-[rgba(27,29,36,0.72)] px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-2xl md:px-7">
          <div className="min-w-[230px]">
            <div className="flex items-center gap-3 font-serif text-2xl text-white md:text-3xl">
              <HeartPulse className="h-6 w-6 text-[#14B8A6]" />
              MindMap Portugal
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.26em] text-white/42">saude mental, apoio e bem-estar</div>
          </div>

          <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Escolher visualizacao">
            {VIEWS.map((view) => {
              const Icon = view.icon
              const isActive = view.id === activeView
              return (
                <button
                  key={view.id}
                  onClick={() => setActiveView(view.id)}
                  className={`group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-300 hover:scale-105 md:px-4 ${
                    isActive
                      ? 'border-[#14B8A6]/60 bg-[#F4EEE8] text-[#0F1015] shadow-[0_0_0_4px_rgba(20,184,166,0.10)]'
                      : 'border-white/10 bg-white/[0.03] text-white/64 hover:border-[#14B8A6]/40 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                  <span>{view.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex h-[calc(100vh-86px)] min-h-0 px-4 pb-32 pt-4 md:px-8 md:pb-36">
        <div className="mx-auto flex h-full w-full max-w-[1680px] min-h-0 flex-col rounded-lg border border-white/10 bg-[rgba(20,22,28,0.54)] p-3 shadow-[0_30px_120px_rgba(0,0,0,0.20)] backdrop-blur-sm">
          <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012))] p-4">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.26em] text-white/40">Saude mental em Portugal</div>
                <div className="mt-1 font-serif text-2xl text-white md:text-3xl">{activeLabel}</div>
              </div>
              <p className="max-w-md text-right text-sm leading-6 text-white/58">
                Uma leitura visual sobre consultas, procura por ajuda, pressao regional e capacidade de resposta do SNS.
              </p>
            </div>

            <div className="relative min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(16,18,24,0.76)] p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="min-h-full w-full"
                >
                  <ViewContent activeView={activeView} activeYear={activeYear} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-8 left-1/2 z-30 w-[min(920px,calc(100vw-2rem))] -translate-x-1/2">
        <div className="rounded-lg border border-white/10 bg-[rgba(27,29,36,0.78)] px-5 py-4 shadow-[0_20px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.26em] text-white/42">Ano em foco</div>
              <div className="mt-1 font-serif text-2xl text-white">{activeYear}</div>
            </div>
            <div className="text-right text-sm text-white/56">Arraste para ver como os dados mudam no tempo.</div>
          </div>
          <input
            type="range"
            min={2018}
            max={2025}
            step={1}
            value={activeYear}
            onChange={(event) => setActiveYear(Number(event.target.value))}
            className="year-slider w-full cursor-pointer"
            aria-label="Selecionar ano"
          />
          <div className="mt-3 flex justify-between text-[11px] tracking-[0.18em] text-white/36">
            {YEARS.map((year) => (
              <span key={year}>{year}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
