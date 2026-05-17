'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { formatDecimal, formatInteger, loadParsedDashboardData, type DashboardMetricRow } from '@/lib/dashboardMetrics'

type CapacityBalanceChartProps = {
  activeYear: number
}

export default function CapacityBalanceChart({ activeYear }: CapacityBalanceChartProps) {
  const [rows, setRows] = useState<DashboardMetricRow[]>([])

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

  const activeRows = useMemo(() => rows.filter((row) => row.ano === activeYear), [activeYear, rows])
  const maxConsultations = Math.max(1, ...activeRows.map((row) => row.consultas_sns ?? 0))

  return (
    <div className="grid min-h-full gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-white/10 bg-[rgba(18,21,27,0.88)] p-5">
        <div className="mb-8">
          <div className="text-sm text-white/46">Capacidade do SNS / Medicos e Psicologos Disponiveis</div>
          <h2 className="mt-1 font-serif text-3xl text-white">Onde a procura por apoio e maior</h2>
        </div>

        <div className="grid gap-6">
          {activeRows.map((row) => {
            const consultations = row.consultas_sns ?? 0
            const capacity = row.capic_sns ?? 0
            const ratio = capacity ? consultations / capacity : 0
            const width = `${(consultations / maxConsultations) * 100}%`
            const warm = ratio > 20

            return (
              <div key={`${row.regiao}-${activeYear}`}>
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-lg text-white">{row.regiao}</div>
                    <div className="mt-1 text-sm text-white/56">
                      {formatInteger(consultations)} consultas de saude mental
                    </div>
                  </div>
                  <div className={`text-right text-sm ${warm ? 'text-[#D97757]' : 'text-[#14B8A6]'}`}>
                    {capacity ? `${formatDecimal(ratio, 1)}x a capacidade disponivel` : 'sem capacidade registada'}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    key={`${row.regiao}-${activeYear}-bar`}
                    initial={{ width: 0 }}
                    animate={{ width }}
                    transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full"
                    style={{
                      background: warm
                        ? 'linear-gradient(90deg, rgba(217,119,87,0.34), rgba(217,119,87,0.98))'
                        : 'linear-gradient(90deg, rgba(20,184,166,0.34), rgba(20,184,166,0.98))',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <aside className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div className="text-sm text-white/46">Como ler esta vista</div>
        <p className="mt-4 text-base leading-7 text-white/68">
          Cada barra mostra o volume de consultas. A cor aquece quando a procura parece muito acima da capacidade
          disponivel de resposta do SNS, incluindo medicos e psicologos.
        </p>
      </aside>
    </div>
  )
}
