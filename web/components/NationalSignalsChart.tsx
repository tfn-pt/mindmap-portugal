'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import {
  formatDecimal,
  formatInteger,
  loadParsedDashboardData,
  type DashboardMetricRow,
} from '@/lib/dashboardMetrics'

// ─── Palette ──────────────────────────────────────────────────────────────────

const TEAL        = '#14B8A6'
const TERRA       = '#D97757'
const TEAL_GLOW   = 'rgba(20,184,166,0.35)'
const TERRA_GLOW  = 'rgba(217,119,87,0.35)'
const TEAL_GLASS  = 'rgba(20,184,166,0.08)'
const TERRA_GLASS = 'rgba(217,119,87,0.08)'
const SURFACE     = 'rgba(13,16,23,0.94)'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { activeYear: number }

type YearAggregate = {
  ano:         number
  consultas:   number | null   // SUM  consultas_sns
  capic:       number | null   // SUM  capic_sns
  ase_pct:     number | null   // AVG  ase_percent_min_educ
  retencao:    number | null   // AVG  retencao_min_educ
  google:      number | null   // AVG  google_interest_score
  spending:    number | null   // AVG  spending_eurostat
  prevalencia: number | null   // AVG  prevalencia_ine
  ansiedade:   number | null   // AVG  ansiedade_2024_ine
}

type InsightCardConfig = {
  id:      string
  label:   string
  source:  string
  display: string
  color:   string
  glass:   string
  glow:    string
  icon:    string
  barPct?: number
}

// ─── Strict numeric helpers ───────────────────────────────────────────────────
// These are the root fix for the "string concatenation" bug.
// We ALWAYS call Number() and then guard against NaN / Infinity / zero.

/** Parse a raw value to a finite positive number, or null. */
function parseNum(raw: unknown): number | null {
  const n = Number(raw)
  if (!isFinite(n) || isNaN(n) || n <= 0) return null
  return n
}

/** Sum an array of raw values; returns null when no valid numbers exist. */
function strictSum(rows: DashboardMetricRow[], key: keyof DashboardMetricRow): number | null {
  let total = 0
  let count = 0
  for (const row of rows) {
    const n = parseNum(row[key])
    if (n !== null) { total += n; count++ }
  }
  return count > 0 ? total : null
}

/** Average an array of raw values; returns null when no valid numbers exist. */
function strictAvg(rows: DashboardMetricRow[], key: keyof DashboardMetricRow): number | null {
  let total = 0
  let count = 0
  for (const row of rows) {
    const n = parseNum(row[key])
    if (n !== null) { total += n; count++ }
  }
  return count > 0 ? total / count : null
}

function buildAggregates(rows: DashboardMetricRow[]): YearAggregate[] {
  const byYear = new Map<number, DashboardMetricRow[]>()
  for (const row of rows) {
    const yr     = Number(row.ano)
    if (!isFinite(yr)) continue
    const bucket = byYear.get(yr) ?? []
    bucket.push(row)
    byYear.set(yr, bucket)
  }
  return Array.from(byYear.entries())
    .map(([ano, bucket]) => ({
      ano,
      consultas:   strictSum(bucket, 'consultas_sns'),
      capic:       strictSum(bucket, 'capic_sns'),
      ase_pct:     strictAvg(bucket, 'ase_percent_min_educ'),
      retencao:    strictAvg(bucket, 'retencao_min_educ'),
      google:      strictAvg(bucket, 'google_interest_score'),
      spending:    strictAvg(bucket, 'spending_eurostat'),
      prevalencia: strictAvg(bucket, 'prevalencia_ine'),
      ansiedade:   strictAvg(bucket, 'ansiedade_2024_ine'),
    }))
    .sort((a, b) => a.ano - b.ano)
}

// ─── Editorial year insights ──────────────────────────────────────────────────

function getYearInsight(year: number): string {
  if (year <= 2019) {
    return 'O investimento público mantém-se estável, mas os primeiros sinais de pressão escolar começam a emergir nas regiões periféricas — um alerta silencioso que os dados educativos já registam.'
  }
  if (year <= 2021) {
    return 'O choque pandémico agrava drasticamente a procura oculta no Google, evidenciando uma crise silenciosa que o SNS tenta absorver com recursos desenhados para um mundo diferente.'
  }
  if (year <= 2023) {
    return 'A capacidade do SNS atinge o limite histórico. A prevalência de ansiedade dispara entre os jovens, exigindo uma reestruturação urgente da rede de apoio psicológico no território.'
  }
  return 'Novos estudos do INE revelam o verdadeiro impacto da crise na juventude portuguesa, forçando um aumento imperativo no orçamento do Estado destinado à saúde mental.'
}

// ─── Animated counter ────────────────────────────────────────────────────────

function AnimatedNumber({
  target,
  format,
  color,
  className = '',
  reduced,
}: {
  target:    number
  format:    (v: number) => string
  color:     string
  className?: string
  reduced:   boolean
}) {
  const spring  = useSpring(reduced ? target : 0, { stiffness: 55, damping: 17, mass: 0.9 })
  const display = useTransform(spring, v => format(Math.round(v)))
  useEffect(() => { spring.set(target) }, [target, spring])
  return <motion.span className={className} style={{ color }}>{display}</motion.span>
}

// ─── Rounded-right rect SVG path ─────────────────────────────────────────────

function rrPath(x: number, y: number, w: number, h: number): string {
  if (w <= 0) return ''
  const r  = h / 2
  const rr = Math.max(0, Math.min(r, w - r))
  if (w <= r * 2) {
    return `M${x + r} ${y} A${r} ${r} 0 0 1 ${x + r} ${y + h} L${x} ${y + h} L${x} ${y}Z`
  }
  return (
    `M${x + r} ${y}` +
    ` L${x + w - rr} ${y}` +
    ` A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}` +
    ` L${x + r} ${y + h}` +
    ` A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  )
}

// ─── National Pulse dual-track SVG ───────────────────────────────────────────

function NationalPulse({
  consultas,
  capic,
  maxC,
  maxK,
  reduced,
}: {
  consultas: number
  capic:     number
  maxC:      number
  maxK:      number
  reduced:   boolean
}) {
  const W = 560; const TH = 20; const GAP = 24

  const tCW = Math.max(0, (consultas / Math.max(1, maxC)) * (W - 2))
  const tKW = Math.max(0, (capic     / Math.max(1, maxK)) * (W - 2))

  const sCW = useSpring(reduced ? tCW : 0, { stiffness: 46, damping: 16 })
  const sKW = useSpring(reduced ? tKW : 0, { stiffness: 46, damping: 16 })
  useEffect(() => { sCW.set(tCW) }, [tCW, sCW])
  useEffect(() => { sKW.set(tKW) }, [tKW, sKW])

  const cPath = useTransform(sCW, w => rrPath(1, 0,        w, TH))
  const kPath = useTransform(sKW, w => rrPath(1, TH + GAP, w, TH))
  const cx    = useTransform(sCW, w => Math.max(7, w))
  const kx    = useTransform(sKW, w => Math.max(7, w))
  const totalH = TH * 2 + GAP

  return (
    <svg
      viewBox={`0 0 ${W} ${totalH}`}
      className="w-full"
      style={{ height: 'auto', maxHeight: 72 }}
      aria-hidden
    >
      <defs>
        <filter id="gt"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="gr"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="lgt" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%"   stopColor={TEAL}  stopOpacity="0.22"/>
          <stop offset="100%" stopColor={TEAL}  stopOpacity="1"/>
        </linearGradient>
        <linearGradient id="lgr" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%"   stopColor={TERRA} stopOpacity="0.22"/>
          <stop offset="100%" stopColor={TERRA} stopOpacity="1"/>
        </linearGradient>
      </defs>

      {/* Ghost background tracks */}
      <path d={rrPath(1, 0,        W - 2, TH)} fill="rgba(20,184,166,0.06)"/>
      <path d={rrPath(1, TH + GAP, W - 2, TH)} fill="rgba(217,119,87,0.06)"/>

      {/* Animated fills */}
      <motion.path d={cPath} fill="url(#lgt)" filter="url(#gt)"/>
      <motion.path d={kPath} fill="url(#lgr)" filter="url(#gr)"/>

      {/* Leading-edge dots */}
      <motion.circle cy={TH / 2}           r={5.5} fill={TEAL}  style={{ cx }} filter="url(#gt)"/>
      <motion.circle cy={TH + GAP + TH / 2} r={5.5} fill={TERRA} style={{ cx: kx }} filter="url(#gr)"/>
    </svg>
  )
}

// ─── Insight Card — only mounts if value is present and non-zero ──────────────

function InsightCard({ cfg, reduced }: { cfg: InsightCardConfig; reduced: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 12 }}
      transition={reduced ? { duration: 0 } : { duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border p-4"
      style={{
        background:  cfg.glass,
        borderColor: `${cfg.color}28`,
        boxShadow:   `0 0 0 1px ${cfg.color}12, 0 10px 36px rgba(0,0,0,0.38)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-3xl"
        style={{ background: cfg.glow, opacity: 0.42 }}
      />

      <div className="relative flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span
            className="rounded-full px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.24em]"
            style={{ background: `${cfg.color}18`, color: `${cfg.color}CC` }}
          >
            {cfg.source}
          </span>
          <span className="text-[1.1rem] leading-none">{cfg.icon}</span>
        </div>

        <p className="text-[12px] leading-snug text-white/62">{cfg.label}</p>

        <p
          className="font-mono text-[1.85rem] font-semibold tabular-nums leading-none"
          style={{ color: cfg.color }}
        >
          {cfg.display}
        </p>

        {cfg.barPct != null && (
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              key={cfg.id + '-bar'}
              initial={{ width: '0%' }}
              animate={{ width: `${cfg.barPct}%` }}
              transition={reduced ? { duration: 0 } : { duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${cfg.color}44, ${cfg.color})`,
                boxShadow:  `0 0 8px ${cfg.glow}`,
              }}
            />
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Spark strip ─────────────────────────────────────────────────────────────

function SparkStrip({
  aggregates, activeYear, maxC, maxK,
}: {
  aggregates: YearAggregate[]
  activeYear: number
  maxC: number
  maxK: number
}) {
  const MAX_H = 34
  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-0.5">
      {aggregates.map(a => {
        const active = a.ano === activeYear
        const cH = Math.round(Math.min(1, (a.consultas ?? 0) / Math.max(1, maxC)) * MAX_H)
        const kH = Math.round(Math.min(1, (a.capic     ?? 0) / Math.max(1, maxK)) * MAX_H)
        return (
          <div
            key={a.ano}
            className={`flex shrink-0 flex-col items-center gap-1 transition-opacity duration-300 ${
              active ? 'opacity-100' : 'opacity-[0.18] hover:opacity-45'
            }`}
          >
            <div className="flex items-end gap-[3px]">
              <div className="w-[5px] rounded-sm" style={{ height: `${Math.max(3, cH)}px`, background: TEAL }}/>
              <div className="w-[5px] rounded-sm" style={{ height: `${Math.max(3, kH)}px`, background: TERRA }}/>
            </div>
            <span className={`font-mono text-[8.5px] tabular-nums transition-colors duration-300 ${active ? 'text-white/70' : 'text-white/22'}`}>
              {a.ano}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NationalSignalsChart({ activeYear }: Props) {
  const reduced = useReducedMotion() ?? false
  const [rows, setRows] = useState<DashboardMetricRow[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const data = await loadParsedDashboardData()
      if (!cancelled) setRows(data)
    })()
    return () => { cancelled = true }
  }, [])

  const aggregates = useMemo(() => buildAggregates(rows), [rows])

  const active = useMemo(
    () => aggregates.find(a => a.ano === activeYear) ?? aggregates[aggregates.length - 1] ?? null,
    [aggregates, activeYear],
  )

  // Global maxima (from strictly-parsed data, never NaN)
  const maxC   = useMemo(() => Math.max(1, ...aggregates.map(a => a.consultas   ?? 0)), [aggregates])
  const maxK   = useMemo(() => Math.max(1, ...aggregates.map(a => a.capic       ?? 0)), [aggregates])
  const maxAse = useMemo(() => Math.max(1, ...aggregates.map(a => a.ase_pct     ?? 0)), [aggregates])
  const maxRet = useMemo(() => Math.max(1, ...aggregates.map(a => a.retencao    ?? 0)), [aggregates])
  const maxG   = useMemo(() => Math.max(1, ...aggregates.map(a => a.google      ?? 0)), [aggregates])

  // Gap narrative
  const gapLabel = useMemo(() => {
    if (!active || active.consultas == null || active.capic == null) return null
    const ratio = active.capic / Math.max(1, active.consultas)
    if (ratio < 0.4) return 'A capacidade instalada cobre menos de metade das consultas pedidas.'
    if (ratio < 0.7) return 'A resposta pública acompanha, mas a pressão sobre o sistema é elevada.'
    if (ratio < 1.0) return 'O sistema aproxima-se do equilíbrio — ainda há lista de espera.'
    return 'A capacidade supera a procura registada neste ano.'
  }, [active])

  // Editorial insight for the active year
  const yearInsight = getYearInsight(activeYear)

  // Build insight cards — ONLY for non-null, non-zero values
  const insightCards = useMemo<InsightCardConfig[]>(() => {
    if (!active) return []
    const cards: InsightCardConfig[] = []

    if (active.ase_pct != null) {
      cards.push({
        id:     `ase-${activeYear}`,
        label:  'Vulnerabilidade Escolar',
        source: 'Min. Educação',
        display: `${formatDecimal(active.ase_pct, 1)}%`,
        color:  TEAL,
        glass:  TEAL_GLASS,
        glow:   TEAL_GLOW,
        icon:   '🎒',
        barPct: Math.round((active.ase_pct / maxAse) * 100),
      })
    }

    if (active.retencao != null) {
      cards.push({
        id:     `ret-${activeYear}`,
        label:  'Impacto: Chumbos Escolares',
        source: 'Min. Educação',
        display: `${formatDecimal(active.retencao, 1)}%`,
        color:  TERRA,
        glass:  TERRA_GLASS,
        glow:   TERRA_GLOW,
        icon:   '📉',
        barPct: Math.round((active.retencao / maxRet) * 100),
      })
    }

    if (active.spending != null) {
      cards.push({
        id:     `spend-${activeYear}`,
        label:  'Orçamento de Estado (Saúde Mental)',
        source: 'Eurostat',
        display: `${formatDecimal(active.spending, 2)} €`,
        color:  TEAL,
        glass:  TEAL_GLASS,
        glow:   TEAL_GLOW,
        icon:   '🏛️',
      })
    }

    if (active.google != null) {
      cards.push({
        id:     `goog-${activeYear}`,
        label:  'Procura Silenciosa no Google',
        source: 'Google Trends',
        display: formatInteger(active.google),
        color:  TERRA,
        glass:  TERRA_GLASS,
        glow:   TERRA_GLOW,
        icon:   '🔍',
        barPct: Math.round((active.google / maxG) * 100),
      })
    }

    if (active.prevalencia != null || active.ansiedade != null) {
      const primary  = active.prevalencia ?? active.ansiedade!
      const hasBoth  = active.prevalencia != null && active.ansiedade != null
      const sublabel = hasBoth
        ? `Prevalência ${formatDecimal(active.prevalencia!, 1)}% · Ansiedade ${formatDecimal(active.ansiedade!, 1)}%`
        : 'Censos Nacionais de Prevalência'
      cards.push({
        id:     `ine-${activeYear}`,
        label:  sublabel,
        source: 'INE',
        display: `${formatDecimal(primary, 1)}%`,
        color:  TEAL,
        glass:  TEAL_GLASS,
        glow:   TEAL_GLOW,
        icon:   '📊',
      })
    }

    return cards
  }, [active, activeYear, maxAse, maxRet, maxG])

  const loading  = rows.length === 0
  const hasPulse = active && (active.consultas != null || active.capic != null)

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full flex-col gap-5 overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════════
          HERO — National Pulse
      ══════════════════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden rounded-2xl border border-white/[0.07] p-6"
        style={{
          background: SURFACE,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Ambient mesh */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 55% 50% at 8% 0%, #14B8A6, transparent),' +
              'radial-gradient(ellipse 40% 40% at 92% 100%, #D97757, transparent)',
          }}
        />
        {/* Grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px),' +
              'repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px)',
          }}
        />

        <div className="relative">

          {/* Header */}
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.34em] text-white/28">
                Pulso Nacional · Portugal
              </p>
              <AnimatePresence mode="wait">
                <motion.h2
                  key={`h-${activeYear}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-1 font-serif text-[1.85rem] leading-tight text-white/95"
                >
                  A Procura e a Resposta em{' '}
                  <span style={{ color: TEAL }}>{activeYear}</span>
                </motion.h2>
              </AnimatePresence>
            </div>

            {/* Big stat pair */}
            <AnimatePresence mode="wait">
              {active && (
                <motion.div
                  key={`sp-${activeYear}`}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={reduced ? { duration: 0 } : { duration: 0.45 }}
                  className="flex items-start gap-5"
                >
                  {active.consultas != null ? (
                    <div className="text-right">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: `${TEAL}90` }}>
                        A Procura
                      </p>
                      <AnimatedNumber
                        target={active.consultas}
                        format={formatInteger}
                        color={TEAL}
                        className="font-mono text-[1.55rem] tabular-nums leading-none"
                        reduced={reduced}
                      />
                      <p className="text-[8.5px] text-white/25">consultas SNS</p>
                    </div>
                  ) : (
                    <div className="text-right opacity-30">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">A Procura</p>
                      <p className="font-mono text-[1.55rem] leading-none text-white/30">—</p>
                      <p className="text-[8.5px] text-white/20">Dados não disponíveis</p>
                    </div>
                  )}

                  {active.capic != null ? (
                    <div className="text-right">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: `${TERRA}90` }}>
                        A Resposta
                      </p>
                      <AnimatedNumber
                        target={active.capic}
                        format={formatInteger}
                        color={TERRA}
                        className="font-mono text-[1.55rem] tabular-nums leading-none"
                        reduced={reduced}
                      />
                      <p className="text-[8.5px] text-white/25">capacidade CAPIC</p>
                    </div>
                  ) : (
                    <div className="text-right opacity-30">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">A Resposta</p>
                      <p className="font-mono text-[1.55rem] leading-none text-white/30">—</p>
                      <p className="text-[8.5px] text-white/20">Dados não disponíveis</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dual-track pulse */}
          {loading && (
            <p className="py-6 text-[12px] italic text-white/22">A carregar dados…</p>
          )}

          {!loading && hasPulse && (
            <>
              <div className="mb-2.5 flex items-center gap-5">
                <div className="flex items-center gap-1.5">
                  <div className="h-[7px] w-[7px] rounded-full" style={{ background: TEAL }}/>
                  <span className="text-[9.5px] text-white/38">Consultas SNS</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-[7px] w-[7px] rounded-full" style={{ background: TERRA }}/>
                  <span className="text-[9.5px] text-white/38">Capacidade CAPIC</span>
                </div>
              </div>

              <NationalPulse
                key={`pulse-${activeYear}`}
                consultas={active!.consultas ?? 0}
                capic={active!.capic ?? 0}
                maxC={maxC}
                maxK={maxK}
                reduced={reduced}
              />

              <AnimatePresence mode="wait">
                {gapLabel && (
                  <motion.p
                    key={`gap-${activeYear}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={reduced ? { duration: 0 } : { delay: 0.85, duration: 0.4 }}
                    className="mt-3 text-[12px] italic leading-relaxed text-white/35"
                  >
                    {gapLabel}
                  </motion.p>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Spark strip */}
          {aggregates.length > 1 && (
            <div className="mt-6 border-t border-white/[0.05] pt-4">
              <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.3em] text-white/18">
                Série Histórica
              </p>
              <SparkStrip aggregates={aggregates} activeYear={activeYear} maxC={maxC} maxK={maxK}/>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          EDITORIAL — "Insight do Ano" — changes with activeYear
      ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`insight-${activeYear}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={reduced ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-2xl border border-white/[0.07] p-5"
          style={{ background: 'rgba(255,255,255,0.018)' }}
        >
          {/* Left accent bar */}
          <div
            className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l-2xl"
            style={{ background: `linear-gradient(to bottom, ${TEAL}, ${TERRA})` }}
          />

          <div className="pl-4">
            <p className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.3em] text-white/28">
              Insight do Ano · {activeYear}
            </p>
            <p className="text-[13px] leading-[1.8] text-white/58">{yearInsight}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════
          INSIGHT CARDS — fluid, fully unmount when value is null/zero
      ══════════════════════════════════════════════════════════════════ */}
      <motion.div layout className="flex flex-wrap gap-4">
        <AnimatePresence mode="popLayout">
          {insightCards.map(cfg => (
            <motion.div
              key={cfg.id}
              layout
              className="w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] xl:w-[calc(25%-12px)]"
            >
              <InsightCard cfg={cfg} reduced={reduced}/>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

    </div>
  )
}