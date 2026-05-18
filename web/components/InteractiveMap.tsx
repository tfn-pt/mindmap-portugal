// web/components/InteractiveMap.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion, Variants } from 'framer-motion'
import { BarChart3, MapIcon, Minus, Plus } from 'lucide-react'
import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo'
import portugalNuts2 from '@/lib/geo/portugal-nuts2.json'
import { formatInteger, loadParsedDashboardData, type DashboardMetricRow } from '@/lib/dashboardMetrics'

// ─── Types ────────────────────────────────────────────────────────────────────

type InteractiveMapProps = {
  activeYear: number
}

type ViewMode = 'map' | 'bars'

type Nuts2Properties = { nuts_id: string; name: string }
type Nuts2Feature = { type: 'Feature'; geometry: unknown; properties: Nuts2Properties }
type Nuts2Collection = { type: 'FeatureCollection'; features: Nuts2Feature[] }

// ─── Constants ────────────────────────────────────────────────────────────────

const MAINLAND_IDS = new Set(['PT11', 'PT16', 'PT17', 'PT18', 'PT15'])

const REGIAO_TO_NUTS2: Record<string, string> = {
  Norte: 'PT11',
  Centro: 'PT16',
  'Lisboa e Vale do Tejo': 'PT17',
  Alentejo: 'PT18',
  Algarve: 'PT15',
}

const NUTS2_POPULATION: Record<string, number> = {
  PT11: 3_673_861,
  PT16: 2_264_956,
  PT17: 2_921_564,
  PT18: 716_994,
  PT15: 484_122,
}

/** SVG canvas dimensions – tall aspect keeps Portugal's proportions faithful. */
const SVG_W = 760
const SVG_H = 920

/** Zoom bounds */
const ZOOM_MIN = 1
const ZOOM_MAX = 2.5
const ZOOM_STEP = 0.3

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ─── Framer Motion Variants ───────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: { staggerChildren: 0.04, staggerDirection: -1 },
  },
}

const barRowVariants: Variants = {
  hidden: { opacity: 0, x: -18 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    x: -12,
    transition: { duration: 0.3, ease: [0.55, 0, 1, 0.45] },
  },
}

const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -6,
    transition: { duration: 0.35, ease: [0.55, 0, 1, 0.45] },
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InteractiveMap({ activeYear }: InteractiveMapProps) {
  const prefersReducedMotion = useReducedMotion()

  // Data
  const [rows, setRows] = useState<DashboardMetricRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  // UI state
  const [selectedRegion, setSelectedRegion] = useState<string>('PT17')
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [isZooming, setIsZooming] = useState<boolean>(false)

  // Tooltip
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)

  // ── GeoJSON setup ──────────────────────────────────────────────────────────

  const source = portugalNuts2 as unknown as Nuts2Collection

  const mainlandFeatures = useMemo(
    () => source.features.filter((f) => MAINLAND_IDS.has(f.properties.nuts_id)),
    [source.features],
  )

  const mainlandCollection = useMemo<Nuts2Collection>(
    () => ({ type: 'FeatureCollection', features: mainlandFeatures }),
    [mainlandFeatures],
  )

  // ── Projection & path ─────────────────────────────────────────────────────

  const projection = useMemo(
    () => geoMercator().fitSize([SVG_W, SVG_H], mainlandCollection as unknown as GeoPermissibleObjects),
    [mainlandCollection],
  )

  const pathFn = useMemo(() => geoPath(projection), [projection])

  // ── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const parsed = await loadParsedDashboardData()
        if (!cancelled) {
          setRows(parsed)
          setLoadError(null)
        }
      } catch {
        if (!cancelled) setLoadError('Não foi possível carregar os dados das consultas de Saúde Mental.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Region data derivation ────────────────────────────────────────────────

  const regionData = useMemo(
    () =>
      mainlandFeatures.map((feature) => {
        const nutsId = feature.properties.nuts_id
        const row = rows.find((r) => r.ano === activeYear && REGIAO_TO_NUTS2[r.regiao] === nutsId)
        const consultations = row?.consultas_sns ?? 0
        const population = NUTS2_POPULATION[nutsId] ?? 0
        const perPeople = consultations && population ? (consultations / population) * 10_000 : 0
        return { nutsId, name: feature.properties.name, feature, consultations, perPeople }
      }),
    [activeYear, mainlandFeatures, rows],
  )

  const maxPerPeople = Math.max(1, ...regionData.map((r) => r.perPeople))
  const selected = regionData.find((r) => r.nutsId === selectedRegion) ?? regionData[0]
  const hovered = hoveredRegion ? regionData.find((r) => r.nutsId === hoveredRegion) : null

  // O(1) lookup map — avoids O(n²) in the render loop
  const regionLookup = useMemo(
    () => new Map(regionData.map((r) => [r.nutsId, r])),
    [regionData],
  )

  // ── Zoom: SVG-space camera transform ─────────────────────────────────────
  //
  // Correct GIS camera model — three-step transform:
  //   1. Move region centre to origin:  translate(-cx, -cy)
  //   2. Scale:                         scale(s)
  //   3. Move result to SVG centre:     translate(SVG_W/2, SVG_H/2)
  //
  // Written as a single SVG transform string applied to <motion.g>.
  // NO transformOrigin — that was the root cause of coordinate drift.
  // NO separate x/y/scale animate props — those fight SVG coordinate space.

  // No click-to-zoom — map stays at full overview always
  const zoomTransform = `translate(0 0) scale(1)`

  // ── Interactions ──────────────────────────────────────────────────────────

  const selectRegion = (nutsId: string) => {
    setSelectedRegion(nutsId)
  }

  const nudgeZoom = (delta: number) => {
    setIsZooming(true)
    setZoomLevel((prev) => clamp(prev + delta, ZOOM_MIN, ZOOM_MAX))
    setTimeout(() => setIsZooming(false), 800)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid min-h-full gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ── Main panel ──────────────────────────────────────────────────── */}
      <section
        className="
          relative flex min-h-[560px] flex-col overflow-hidden
          rounded-2xl border border-white/10
          bg-[rgba(14,17,24,0.92)]
          p-5
          shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_64px_rgba(0,0,0,0.55)]
          backdrop-blur-xl
        "
      >
        {/* Header */}
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/40">
              Consultas de apoio à Saúde Mental (Psicologia e Psiquiatria) por cada 10&nbsp;000 pessoas
            </p>
            <h2 className="mt-1.5 font-serif text-[1.9rem] leading-tight text-white/95">
              Portugal continental em{' '}
              <span className="text-[#14B8A6]">{activeYear}</span>
            </h2>
          </div>

          {/* View toggle */}
          <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                { mode: 'map' as ViewMode, Icon: MapIcon, label: 'Mapa' },
                { mode: 'bars' as ViewMode, Icon: BarChart3, label: 'Gráfico' },
              ] as const
            ).map(({ mode, Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`
                  flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium
                  transition-all duration-300
                  ${
                    viewMode === mode
                      ? 'bg-[#14B8A6]/15 text-white shadow-[inset_0_0_0_1px_rgba(20,184,166,0.4)]'
                      : 'text-white/50 hover:text-white/80'
                  }
                `}
                aria-pressed={viewMode === mode}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* View panels */}
        <div className="relative flex-1 overflow-hidden rounded-xl">
          <AnimatePresence mode="wait" initial={false}>
            {viewMode === 'map' ? (
              <motion.div
                key="map"
                variants={panelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="
                  absolute inset-0 flex items-center justify-center
                  bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(20,184,166,0.07),transparent)]
                "
              >
                {/* Zoom controls */}
                <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
                  {[
                    { label: 'Aproximar', icon: Plus, delta: ZOOM_STEP },
                    { label: 'Afastar', icon: Minus, delta: -ZOOM_STEP },
                  ].map(({ label, icon: Icon, delta }) => (
                    <motion.button
                      key={label}
                      onClick={() => nudgeZoom(delta)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.94 }}
                      className="
                        rounded-lg border border-white/10 bg-white/[0.06]
                        p-2 text-white/60 backdrop-blur-xl
                        transition-colors duration-200
                        hover:border-[#14B8A6]/50 hover:text-white
                      "
                      aria-label={label}
                    >
                      <Icon className="h-4 w-4" />
                    </motion.button>
                  ))}
                </div>

                {/* Hover tooltip */}
                <AnimatePresence>
                  {hovered && (
                    <motion.div
                      key={hovered.nutsId}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.2 }}
                      className="
                        pointer-events-none absolute left-3 top-3 z-10
                        max-w-[220px] rounded-xl border border-white/10
                        bg-[rgba(14,17,24,0.88)] px-3.5 py-2.5 backdrop-blur-xl
                      "
                    >
                      <p className="text-[11px] font-semibold text-white/90">{hovered.name}</p>
                      <p className="mt-0.5 text-[10px] text-[#14B8A6]/90">
                        {hovered.perPeople
                          ? `${formatInteger(Math.round(hovered.perPeople))} / 10 000 hab.`
                          : 'Sem dados'}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* SVG map – fills the available panel area; viewBox keeps Portugal's
                    proportions and SVG scales down to fit — no clipping. */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <svg
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    className="h-full w-full"
                    style={{ maxHeight: '100%', maxWidth: '100%' }}
                    shapeRendering="geometricPrecision"
                    role="img"
                    aria-label="Mapa de Portugal continental por regiões – consultas de Saúde Mental"
                  >
                    <motion.g
                      animate={{ transform: zoomTransform }}
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { duration: 0.75, ease: [0.22, 1, 0.36, 1] }
                      }
                    >
                      {regionData.map((region) => {
                        const isSelected = region.nutsId === selectedRegion
                        const isHovered = region.nutsId === hoveredRegion
                        const intensity = region.perPeople
                          ? 0.15 + (region.perPeople / maxPerPeople) * 0.82
                          : 0.07

                        return (
                          <motion.path
                            key={region.nutsId}
                            d={pathFn(region.feature as unknown as GeoPermissibleObjects) ?? ''}
                            fill={isSelected ? '#D97757' : '#14B8A6'}
                            stroke={
                              isSelected
                                ? 'rgba(245,240,232,0.9)'
                                : isHovered
                                  ? 'rgba(20,184,166,0.9)'
                                  : 'rgba(255,255,255,0.15)'
                            }
                            initial={false}
                            animate={{
                              fillOpacity: isHovered && !isSelected ? Math.min(1, intensity + 0.18) : intensity,
                              strokeWidth: isSelected ? 2.8 : isHovered ? 1.8 : 0.9,
                            }}
                            transition={{
                              duration: prefersReducedMotion ? 0 : 0.55,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            style={{
                              pointerEvents: 'none',
                              filter: isZooming
                                ? 'none'
                                : isSelected
                                  ? 'drop-shadow(0 0 20px rgba(217,119,87,0.42))'
                                  : isHovered
                                    ? 'drop-shadow(0 0 10px rgba(20,184,166,0.3))'
                                    : 'none',
                            }}
                          />
                        )
                      })}

                      {/* Invisible hit-area layer — stable pointer events, unaffected by
                          visual animations. Larger strokeWidth catches thin-border regions. */}
                      {regionData.map((region) => (
                        <path
                          key={`hit-${region.nutsId}`}
                          d={pathFn(region.feature as unknown as GeoPermissibleObjects) ?? ''}
                          fill="transparent"
                          stroke="transparent"
                          strokeWidth={12}
                          onClick={() => selectRegion(region.nutsId)}
                          onMouseEnter={() => setHoveredRegion(region.nutsId)}
                          onMouseLeave={() => setHoveredRegion(null)}
                          onFocus={() => setHoveredRegion(region.nutsId)}
                          onBlur={() => setHoveredRegion(null)}
                          className="outline-none"
                          tabIndex={0}
                          role="button"
                          aria-label={`${region.name} – ${region.perPeople ? formatInteger(Math.round(region.perPeople)) + ' consultas por 10 000 pessoas' : 'sem dados'}`}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </motion.g>
                  </svg>
                </div>
              </motion.div>
            ) : (
              /* ── Bar chart (premium data art) ─────────────────────────────── */
              <motion.div
                key="bars"
                variants={panelVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute inset-0 overflow-y-auto"
              >
                <motion.ul
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex h-full flex-col justify-center gap-0 px-2 py-4"
                  role="list"
                >
                  {regionData
                    .slice()
                    .sort((a, b) => b.perPeople - a.perPeople)
                    .map((region, i) => {
                      const pct = (region.perPeople / maxPerPeople) * 100
                      const isSelected = region.nutsId === selectedRegion
                      const rank = i + 1

                      return (
                        <motion.li
                          key={region.nutsId}
                          variants={barRowVariants}
                          layout
                          className="group relative"
                        >
                          <button
                            onClick={() => selectRegion(region.nutsId)}
                            className={`
                              w-full rounded-xl px-4 py-3.5 text-left
                              transition-all duration-300
                              ${isSelected ? 'bg-white/[0.055]' : 'hover:bg-white/[0.03]'}
                            `}
                          >
                            {/* Row header */}
                            <div className="mb-2.5 flex items-baseline justify-between gap-4">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Rank badge */}
                                <span
                                  className={`
                                    flex h-5 w-5 shrink-0 items-center justify-center
                                    rounded-full text-[10px] font-bold
                                    ${isSelected ? 'bg-[#D97757]/20 text-[#D97757]' : 'bg-white/[0.06] text-white/35'}
                                  `}
                                >
                                  {rank}
                                </span>
                                <span
                                  className={`
                                    truncate text-[15px] font-medium leading-snug
                                    ${isSelected ? 'text-white' : 'text-white/75 group-hover:text-white/90'}
                                    transition-colors duration-200
                                  `}
                                >
                                  {region.name}
                                </span>
                              </div>

                              <div className="shrink-0 text-right">
                                <span
                                  className={`
                                    text-[13px] font-semibold tabular-nums
                                    ${isSelected ? 'text-[#D97757]' : 'text-white/55'}
                                    transition-colors duration-200
                                  `}
                                >
                                  {region.perPeople
                                    ? formatInteger(Math.round(region.perPeople))
                                    : '—'}
                                </span>
                                <span className="ml-1 text-[10px] text-white/28">/ 10k</span>
                              </div>
                            </div>

                            {/* Bar track */}
                            <div className="relative h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
                              {/* Background glow track */}
                              <div
                                className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                style={{
                                  background:
                                    'linear-gradient(90deg, transparent, rgba(20,184,166,0.08))',
                                }}
                              />
                              {/* Animated fill */}
                              <motion.div
                                key={`${region.nutsId}-${activeYear}-bar`}
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: `${pct}%`, opacity: 1 }}
                                transition={{
                                  width: {
                                    duration: prefersReducedMotion ? 0 : 0.9,
                                    ease: [0.22, 1, 0.36, 1],
                                    delay: prefersReducedMotion ? 0 : i * 0.06,
                                  },
                                  opacity: { duration: 0.3, delay: prefersReducedMotion ? 0 : i * 0.06 },
                                }}
                                className="absolute inset-y-0 left-0 rounded-full"
                                style={{
                                  background: isSelected
                                    ? 'linear-gradient(90deg, rgba(217,119,87,0.55), rgba(217,119,87,1))'
                                    : 'linear-gradient(90deg, rgba(20,184,166,0.35), rgba(20,184,166,0.95))',
                                  boxShadow: isSelected
                                    ? '0 0 8px rgba(217,119,87,0.5)'
                                    : '0 0 6px rgba(20,184,166,0.35)',
                                }}
                              />
                            </div>
                          </button>

                          {/* Subtle divider – hidden on last */}
                          {i < regionData.length - 1 && (
                            <div className="mx-4 h-px bg-white/[0.035]" />
                          )}
                        </motion.li>
                      )
                    })}
                </motion.ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        {/* Selected region card */}
        <motion.div
          key={`region-${selectedRegion}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="
            rounded-2xl border border-white/10
            bg-[rgba(14,17,24,0.88)]
            p-5
            shadow-[0_0_0_1px_rgba(255,255,255,0.03)]
            backdrop-blur-xl
          "
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/38">
            Região selecionada
          </p>
          <h3 className="mt-2.5 font-serif text-[1.75rem] leading-tight text-white/95">
            {selected?.name ?? 'Portugal continental'}
          </h3>

          {/* Per-10k metric */}
          <div className="mt-5 flex items-end gap-2">
            <span className="font-serif text-[2.4rem] leading-none text-[#14B8A6]">
              {selected?.perPeople ? formatInteger(Math.round(selected.perPeople)) : '—'}
            </span>
            <span className="mb-1 text-sm text-white/38 leading-snug">
              por cada<br />10 000 hab.
            </span>
          </div>

          <p className="mt-3.5 text-[13.5px] leading-7 text-white/60">
            {selected?.perPeople
              ? `${formatInteger(Math.round(selected.perPeople))} consultas dedicadas à Saúde Mental por cada 10 000 pessoas neste ano.`
              : 'Sem leitura consolidada para este ano.'}
          </p>

          {/* Intensity bar */}
          {selected?.perPeople ? (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-[10px] text-white/30">
                <span>Intensidade relativa</span>
                <span>{Math.round((selected.perPeople / maxPerPeople) * 100)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  key={`intensity-${selectedRegion}-${activeYear}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${(selected.perPeople / maxPerPeople) * 100}%` }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full rounded-full bg-gradient-to-r from-[#14B8A6]/50 to-[#14B8A6]"
                />
              </div>
            </div>
          ) : null}
        </motion.div>

        {/* Total consultations card */}
        <motion.div
          key={`total-${selectedRegion}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="
            rounded-2xl border border-white/10
            bg-[rgba(14,17,24,0.88)]
            p-5
            shadow-[0_0_0_1px_rgba(255,255,255,0.03)]
            backdrop-blur-xl
          "
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/38">
            Apoio registado
          </p>
          <motion.div
            key={`consultations-${selectedRegion}-${activeYear}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-2.5 font-serif text-[2.4rem] leading-none tracking-tight text-[#D97757]"
          >
            {selected ? formatInteger(selected.consultations) : '0'}
          </motion.div>
          <p className="mt-3 text-[13px] leading-6 text-white/55">
            Total de consultas de apoio Psicológico e Psiquiátrico realizadas no SNS para esta região.
          </p>
        </motion.div>

        {/* Context card */}
        <div
          className="
            rounded-2xl border border-white/[0.07]
            bg-white/[0.025]
            p-5
          "
        >
          <p className="text-[13px] leading-7 text-white/48">
            O mapa mostra apenas Portugal continental para dar mais espaço visual a quem procura apoio
            no território principal. A intensidade das cores representa a pressão relativa de acesso,
            não um julgamento sobre qualquer região.
          </p>
        </div>

        {/* Error state */}
        <AnimatePresence>
          {loadError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5"
            >
              <p className="text-[13px] text-red-400/80">{loadError}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    </div>
  )
}