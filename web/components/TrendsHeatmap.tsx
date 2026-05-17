'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Info } from 'lucide-react'
import { loadGoogleTrendsData } from '@/lib/dataLoader'

type TrendsHeatmapProps = {
  activeYear: number
}

type TrendsRow = {
  date: string
  ansiedade?: number
  depressao?: number
  saudeMental?: number
}

function toNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

export default function TrendsHeatmap({ activeYear }: TrendsHeatmapProps) {
  const [rows, setRows] = useState<TrendsRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = await loadGoogleTrendsData()
        if (cancelled) return
        const parsed = raw
          .map((row) => ({
            date: row.date ?? '',
            ansiedade: toNumber(row.ansiedade),
            depressao: toNumber(row.depressao),
            saudeMental: toNumber(row['saude mental'] ?? row.saudeMental ?? row.saude_mental),
          }))
          .filter((row) => row.date.length >= 10)
        setRows(parsed)
        setLoadError(null)
      } catch {
        if (!cancelled) setLoadError('Nao foi possivel carregar os dados de pesquisa do Google.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const activeRows = useMemo(() => rows.filter((row) => Number(row.date.slice(0, 4)) === activeYear), [activeYear, rows])
  const unavailable = activeYear < 2021

  const terms = useMemo(() => {
    const average = (values: Array<number | undefined>) => {
      const clean = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      if (!clean.length) return 0
      return clean.reduce((sum, value) => sum + value, 0) / clean.length
    }

    return [
      {
        term: 'Ansiedade',
        value: Math.round(average(activeRows.map((row) => row.ansiedade))),
        fill: 'linear-gradient(90deg, rgba(20,184,166,0.35), rgba(20,184,166,1))',
      },
      {
        term: 'Depressao',
        value: Math.round(average(activeRows.map((row) => row.depressao))),
        fill: 'linear-gradient(90deg, rgba(217,119,87,0.35), rgba(217,119,87,1))',
      },
      {
        term: 'Saude mental',
        value: Math.round(average(activeRows.map((row) => row.saudeMental))),
        fill: 'linear-gradient(90deg, rgba(20,184,166,0.35), rgba(217,119,87,0.92))',
      },
    ]
  }, [activeRows])

  return (
    <div className="grid min-h-full gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="relative rounded-lg border border-white/10 bg-[rgba(18,21,27,0.88)] p-5">
        <div className="mb-8">
          <div className="text-sm text-white/46">Popularidade de Procura no Google (0 a 100)</div>
          <h2 className="mt-1 font-serif text-3xl text-white">Como Portugal procura ajuda e palavras para o sofrimento</h2>
        </div>

        {loadError ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5 text-sm text-white/62">{loadError}</div>
        ) : (
          <div className="grid gap-8">
            {terms.map((term) => (
              <div key={term.term}>
                <div className="mb-3 flex items-start justify-between gap-5">
                  <div>
                    <div className="text-lg text-white">{term.term}</div>
                    <div className="mt-1 text-sm text-white/58">Popularidade de Procura no Google: {term.value}%</div>
                  </div>
                  <div className="group relative shrink-0">
                    <Info className="h-4 w-4 text-white/42" />
                    <div className="pointer-events-none absolute right-0 top-6 z-20 w-64 rounded-lg border border-white/10 bg-[#171920] p-3 text-xs leading-6 text-white/68 opacity-0 shadow-lg transition-opacity duration-300 group-hover:opacity-100">
                      Este valor representa o pico de pesquisas no Google em Portugal para este termo.
                    </div>
                  </div>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    key={`${term.term}-${activeYear}`}
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: unavailable ? '0%' : `${term.value}%` }}
                    transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                    style={{ background: term.fill }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {unavailable && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center rounded-lg border border-white/10 bg-[rgba(20,22,28,0.62)] p-8 backdrop-blur-xl"
          >
            <div className="max-w-xl text-center">
              <div className="font-serif text-3xl text-white">Dados nao disponiveis para este ano.</div>
              <p className="mt-4 text-base leading-8 text-white/70">
                O Google Trends comecou a registar estes termos com precisao em Portugal a partir de 2021.
              </p>
            </div>
          </motion.div>
        )}
      </section>

      <aside className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div className="text-sm text-white/46">Como ler esta vista</div>
        <p className="mt-4 text-base leading-7 text-white/68">
          Estas barras nao diagnosticam ninguem. Elas mostram quando mais pessoas procuraram palavras como ansiedade,
          depressao e saude mental no Google, numa escala simples de 0 a 100.
        </p>
      </aside>
    </div>
  )
}
