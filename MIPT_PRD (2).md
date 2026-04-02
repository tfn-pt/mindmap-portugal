# MindMap Portugal (MIPT) — AI Product Requirements Document
### Technical Viability Report & Zero-Bottleneck Roadmap
**Version:** 1.0 · **Authors:** Tiago Neto (54172), Simão Nambi (53558) · **Date:** May 2025  
**Classification:** Internal Working Document · UBI DV (IACD) 2025/26

---

## Executive Summary

> Portugal ranks **3rd in Europe for depression prevalence** (OCDE, 2023). 1.34 million citizens reported needing mental health support in the last year — half never sought it. The data to prove this exists across five public sources. No product has ever unified it into an accessible, interactive narrative.  
> MindMap PT closes that gap. This document defines what we build, how we build it, and every failure mode we anticipate before writing a single line of production code.

---

## Part 1 — Product Requirements Document (PRD)

### 1.1 Strategic Vision

| Dimension | Definition |
|-----------|------------|
| **Problem** | Mental health data in Portugal is fragmented across DGS PDFs, INE spreadsheets and PORDATA tables. No public-facing product unifies it. |
| **Solution** | An interactive dashboard + scrollytelling experience that makes Portugal's mental health crisis legible to any citizen, journalist or policymaker. |
| **Societal Challenge** | Portugal 2020 · Axis #1 — Saúde, Alterações Demográficas e Bem-Estar · Lines 1.1, 1.2, 1.4 |
| **Distribution** | Free, public URL (Streamlit Community Cloud). No login. No paywall. |
| **Sustainability** | Zero operational cost. GitHub Actions + Streamlit Cloud free tier. Monthly auto-update. |

### 1.2 Societal ROI Matrix

| Stakeholder | Problem Today | Value Delivered | Measurable Outcome |
|-------------|--------------|-----------------|-------------------|
| Citizens | Cannot easily find mental health access gaps in their region | Interactive district map with psychologist ratio | Informed decisions on care-seeking |
| Journalists / ONGs | Data exists only in 80-page PDFs | Download CSV button on every chart | Stories backed by verifiable, citable data |
| Policymakers | No regional granularity in national reports | District-level choropleth filterable by year | Budget allocation evidence base |
| Academia | No longitudinal public dataset crossing DGS + INE + Google Trends | METHODOLOGY.md + raw data on GitHub | Reproducible research baseline |

### 1.3 User Personas

#### Persona 1 — Ana, Jornalista de Investigação
```
Age: 34 · Org: Público / Expresso
Goal: Escrever um artigo sobre desertos de saúde mental no interior de Portugal.
Pain Point: Os dados da DGS estão num PDF de 80 páginas sem tabelas máquina-legíveis.
Needs from MIPT:
  - Mapa filtrado por distrito em < 3 cliques
  - Botão "Descarregar CSV" com fonte e ano documentados
  - Texto editorial que não implique causalidade (para não ser contraditada)
Success Metric: Cita o MIPT como fonte numa peça publicada.
```

#### Persona 2 — Rui, Decisor do Ministério da Saúde
```
Age: 52 · Org: SNS / DGS
Goal: Identificar os 5 distritos prioritários para alocação de psicólogos em 2026.
Pain Point: Os relatórios internos não têm granularidade regional comparativa.
Needs from MIPT:
  - Mapa coroplético com rácio psicólogos/10k hab por distrito e ano
  - Tabela ordenável com ranking nacional
  - Comparação com média europeia (Eurostat)
Success Metric: Referência ao produto numa decisão de política pública documentada.
```

#### Persona 3 — Beatriz, Coordenadora de ONG
```
Age: 41 · Org: APAV / Entreajuda
Goal: Demonstrar a magnitude do problema a potenciais financiadores.
Pain Point: Não tem capacidade técnica para construir visualizações próprias.
Needs from MIPT:
  - Visualizações embeddable (screenshot + URL)
  - Números contextualizados (Portugal vs. Europa)
  - Narrativa scrollytelling que conta a história completa
Success Metric: Usa o MIPT numa apresentação a financiadores ou parceiros.
```

#### Persona 4 — Miguel, Estudante de Ciência de Dados
```
Age: 21 · Org: Universidade
Goal: Aprender como cruzar fontes públicas para um projeto de portefólio.
Pain Point: Não sabe como aceder programaticamente a dados do INE ou PORDATA.
Needs from MIPT:
  - README com setup instructions
  - Código open-source no GitHub
  - METHODOLOGY.md com decisões documentadas
Success Metric: Fork do repositório e adaptação para outro tema.
```

### 1.4 Stack Técnica — Decisões e Racional

| Componente | Escolha | Alternativa Rejeitada | Racional |
|------------|---------|----------------------|----------|
| Language | Python 3.12 | R / Julia | Ecosystem mais rico para data + web |
| Dashboard | Streamlit 1.35 | Dash / Flask | Zero frontend knowledge required; free deploy |
| Visualizações | Plotly 5.x | matplotlib / Vega | Interativo, exportável, suporta WebGL |
| Mapas | Plotly Choropleth + GeoJSON | Folium / Leaflet | Integração nativa Plotly sem JS extra |
| Data Wrangling | pandas 2.2 + numpy 1.26 | polars | Familiaridade + ecosystem de integração |
| PDF Extraction | pdfplumber 0.11 | PyMuPDF / camelot | Melhor handling de tabelas em PDFs digitais |
| Trends API | pytrends 4.9 | Selenium scraping | Wrapper oficial mais estável |
| Automação | GitHub Actions | Airflow / Prefect | Gratuito; zero infra |
| Deploy | Streamlit Community Cloud | Render / Railway | Integração nativa GitHub; gratuito |
| Geospatial | geopandas 0.14 | arcpy | Open-source; integra com Plotly |
| Resiliência | tenacity 8.3 | manual retry | Exponential backoff com 3 linhas |
| Logging | loguru 0.7 | standard logging | Formatação estruturada; serialização JSON |

---

## Part 2 — Execution Roadmap (6 Weeks)

### Overview

```
Week 1-2  │  PHASE 1: Data Preparation    │  Owner: Simão
Week 3-4  │  PHASE 2: Core Visualizations │  Owner: TFN
Week 5    │  PHASE 3: Integration & Story  │  Owner: TFN + Simão
Week 6    │  PHASE 4: Deployment & QA     │  Owner: TFN + Simão
```

---

### Phase 1 — Data Preparation (Weeks 1–2) · Owner: Simão

#### 1A. Source Inventory & Access Audit

Before writing any transformation code, audit each source for extractability:

| Source | Access Method | Format | Reliability | Pre-work Required |
|--------|--------------|--------|-------------|-------------------|
| INE (ICOR) | Direct download URL | CSV / Excel | ✅ High | None |
| PORDATA | Manual download page | Excel (.xlsx) | ✅ High | One-click per table |
| DGS Relatórios | Embedded PDF tables | PDF (digital) | ⚠️ Medium | pdfplumber extraction + validation |
| Eurostat | REST API (JSON) | JSON → DataFrame | ✅ High | eurostat client config |
| Google Trends | pytrends (unofficial) | JSON → DataFrame | ⚠️ Medium | Rate limit handling |

#### 1B. Cleaning Strategy Per Dataset

**Dataset 1: INE ICOR (Depressão por Distrito)**
```python
# Known issues to handle:
# 1. Column headers span two rows in Excel export
# 2. District names use pre-2013 spellings (e.g. "Setúbal" vs "Setúbal")
# 3. Confidence intervals in separate columns named "IC_inf" / "IC_sup"
# 4. Suppressed values marked as "x" (sample too small) → must become NaN, never 0

cleaning_steps = [
    "skiprows=2 to skip merged header",
    "rename columns from positional to semantic",
    "replace 'x' with np.nan — CRITICAL: never impute",
    "standardize district names against INE DICO codebook",
    "assert n_distritos == 20 after cleaning",
    "store attrs: source, year, methodology_url",
]
```

**Dataset 2: PORDATA (Psicólogos/Habitante)**
```python
# Known issues:
# 1. Excel has multiple sheets — target sheet is "Municípios"
# 2. 2021 uses Census population (not estimate) — breaks series
# 3. Psychologists = "inscritos na OPP" (not SNS-only)

cleaning_steps = [
    "pd.read_excel(sheet_name='Municípios', header=3)",
    "melt from wide (years as columns) to long format",
    "flag ano==2021 as quebra_de_serie=True",
    "document OPP scope in METHODOLOGY.md",
    "calculate ratio: (psicologos / populacao) * 10_000",
    "assert ratio between 0 and 50 for all rows",
]
```

**Dataset 3: DGS PDF (Internamentos Psiquiátricos)**
```python
# This is the hardest extraction. Known issues:
# 1. Tables span multiple pages
# 2. Some editions use image-embedded tables (2009-2012) — not machine-readable
# 3. Column alignment shifts between annual editions
# 4. 2020 edition has COVID footnotes that corrupt table parsing

extraction_strategy = """
Step 1: Try pdfplumber.extract_tables() on target pages
Step 2: If table confidence < 0.8, fall back to pdfplumber.extract_text() + regex
Step 3: For 2009-2012 (image PDFs): use pre-compiled manual CSV in /data/raw/dgs_manual/
Step 4: Validate each year: internamentos must be positive, increasing trend ±30% max YoY
Step 5: Store raw PDF hash in manifest.json — detect future structural changes
"""
```

**Dataset 4: Eurostat (European Benchmark)**
```python
import eurostat

# Dataset code: hlth_sha11_hf (Health care expenditure by financing scheme)
# Dataset code: hlth_cd_acdr (Causes of death — mental disorders)

# Known issues:
# 1. Eurostat renames dataset codes periodically
# 2. Portugal data has 2-year lag vs. other countries
# 3. Some country codes changed post-Brexit (UK → GB)

fetch_strategy = """
cache_key = f"eurostat_{dataset_code}_{year}"
if not cache_exists(cache_key):
    df = eurostat.get_data_df(dataset_code, filter_pars={'geo': EU27_COUNTRIES})
    validate_schema(df)
    save_to_cache(cache_key, df, ttl_days=30)
"""
```

**Dataset 5: Google Trends (Behavioral Signal)**
```python
# THIS IS THE MOST FRAGILE SOURCE. Rules:
# 1. Index is RELATIVE (0-100), not absolute — must be documented everywhere
# 2. Results differ between sessions (Google normalizes differently)
# 3. pytrends is unofficial — Google can block without notice
# 4. Rate limit: ~10 requests/minute, ~100/hour

# Mitigation strategy:
mitigation = {
    "sleep": "time.sleep(1) between all requests",
    "cache": "TTL=7 days — never re-fetch if cache valid",
    "fallback": "pre-collected CSV in /data/raw/trends_backup/ for 2019-2024",
    "documentation": "Every chart must show 'Índice relativo — 100 = pico do período'",
    "scope": "Never use for absolute comparisons between districts",
}
```

#### 1C. Manifest & Data Lineage

Every file in `/data/raw/` must have an entry in `manifest.json`:
```json
{
  "ine_icor_2023.csv": {
    "md5": "a1b2c3d4e5f6...",
    "fetched_at": "2025-05-01T08:00:00Z",
    "source_url": "https://www.ine.pt/...",
    "license": "CC BY 4.0",
    "methodology_note": "ICOR 2023, módulo saúde mental, n=11.437"
  }
}
```

---

### Phase 2 — Core Visualizations (Weeks 3–4) · Owner: TFN

#### Visualization 1: Choropleth Map — "Mapa de Desertos"

**Technical Specification:**
```python
# src/viz/map_choropleth.py

def build_map(df: pd.DataFrame, 
              ano: int, 
              metrica: str,
              template: dict) -> go.Figure:
    """
    Inputs:
      - df: psicologos_ratio.csv filtered by ano + metrica
      - GeoJSON: 20 Portuguese districts (continental + islands)
    
    Design decisions:
      - Color scale: Blues (sequential, NOT diverging — no neutral midpoint exists)
      - Classification: Jenks Natural Breaks, 5 classes (mapclassify)
      - Missing data: #d4d4d4 (grey) with tooltip "Dados não disponíveis"
      - Projection: EPSG:4326 (WGS84)
    
    Integrity rules:
      - Legend must show absolute values, not just "high/low"
      - Source annotation mandatory in fig.layout.annotations
      - colorbar title must include unit: "Psicólogos / 10.000 hab"
    """
    fig = px.choropleth_mapbox(
        df, geojson=geojson, locations='cod_ine',
        featureidkey='properties.DICO',
        color='valor',
        color_continuous_scale='Blues',
        mapbox_style='carto-positron',
        zoom=5.5, center={'lat': 39.5, 'lon': -8.0},
        labels={'valor': 'Psicólogos / 10k hab'},
    )
    # Mandatory source annotation
    fig.add_annotation(
        text=f"Fonte: PORDATA, {ano} · Metodologia: METHODOLOGY.md",
        xref='paper', yref='paper', x=0, y=-0.05,
        showarrow=False, font=dict(size=9, color='grey')
    )
    return fig
```

**Acceptance Criteria:**
- [ ] Map renders all 20 districts (continental + Açores + Madeira)
- [ ] Missing districts shown in grey with explicit tooltip
- [ ] Source annotation visible on every render
- [ ] Year slider updates choropleth without full page reload
- [ ] Download CSV button present below map

---

#### Visualization 2: Dual-Axis Timeline — "A Crise de 2008"

**Technical Specification:**
```python
# src/viz/timeline.py

def build_dual_axis_chart(df: pd.DataFrame) -> go.Figure:
    """
    Two Y-axes: unemployment (left, blue) + psychiatric admissions (right, coral).
    
    CRITICAL INTEGRITY RULES:
    - Both series must use Okabe-Ito safe colors (#0072B2 + #D55E00)
    - Correlation coefficient shown as st.metric with tooltip 
      "Correlação de Pearson. Não implica causalidade."
    - Vertical dashed line at 2008 (crisis onset) with annotation
    - Series break in 2021 (COVID methodology change) must be visible as gap
    - Y-axis for admissions must NOT start at zero if range is tight —
      but truncation warning annotation is mandatory
    """
    fig = go.Figure()
    
    # Unemployment — left axis
    fig.add_trace(go.Scatter(
        x=df['ano'], y=df['desemprego_pct'],
        name='Taxa de Desemprego (%)',
        line=dict(color='#0072B2', width=2.5),
        yaxis='y1'
    ))
    
    # Psychiatric admissions — right axis
    fig.add_trace(go.Scatter(
        x=df['ano'], y=df['internamentos'],
        name='Internamentos psiq. / 100k hab',
        line=dict(color='#D55E00', width=2.5),
        yaxis='y2'
    ))
    
    # Annotate crisis onset
    fig.add_vline(x=2008, line_dash='dash', line_color='grey',
                  annotation_text='Início da crise', annotation_position='top right')
    
    # Annotate series breaks
    for ano in df[df['quebra_serie']]['ano']:
        fig.add_annotation(x=ano, y=df.loc[df.ano==ano,'internamentos'].iloc[0],
                           text='⚠️ Quebra metodológica', showarrow=True)
    return fig
```

---

#### Visualization 3: Regional Google Trends — "O que Portugal Pesquisa"

**Technical Specification:**
```python
# CRITICAL: Google Trends returns relative index. The chart MUST communicate this.

def build_trends_chart(df: pd.DataFrame, termo: str) -> go.Figure:
    """
    Heatmap: districts (y) × weeks (x) × search intensity (color).
    
    Mandatory disclaimer in chart title:
    f"Pesquisas por '{termo}' — Índice relativo (100 = semana de pico)"
    
    Color scale: YlOrRd (sequential, perceptually uniform)
    
    Never allow: side-by-side district comparison implying absolute difference.
    Districts can only be compared within the same chart (same normalization period).
    """
    fig = px.imshow(
        df.pivot(index='distrito', columns='semana', values='indice'),
        color_continuous_scale='YlOrRd',
        title=f"Pesquisas por '{termo}' — Índice relativo (100 = semana de pico)",
        labels={'color': 'Índice relativo (0–100)'},
        aspect='auto'
    )
    return fig
```

---

#### Visualization 4: Scrollytelling — "A História Completa"

**Architecture:**
```python
# pages/4_Historia_Completa.py
# Streamlit does not have native scroll events.
# Solution: st.session_state step counter + Previous/Next buttons
# Alternative (advanced): streamlit-scroll-navigation component

from src.narrative.scroll_states import STATES

step = st.session_state.get('scroll_step', 0)

col_text, col_viz = st.columns([1, 1.5])

with col_text:
    state = STATES[step]
    st.markdown(f"### {state.headline}")
    st.markdown(state.body)
    
    col_prev, col_next = st.columns(2)
    if col_prev.button("← Anterior") and step > 0:
        st.session_state.scroll_step = step - 1
        st.rerun()
    if col_next.button("Seguinte →") and step < len(STATES) - 1:
        st.session_state.scroll_step = step + 1
        st.rerun()

with col_viz:
    # Chart updates based on state — only highlighted districts shown in color
    fig = build_map_for_state(state)
    st.plotly_chart(fig, use_container_width=True)
    
    # Progress indicator
    st.progress((step + 1) / len(STATES), 
                text=f"Capítulo {step+1} de {len(STATES)}")
```

---

### Phase 3 — Integration & Storytelling (Week 5) · Owner: TFN + Simão

| Task | Owner | Output | Hours |
|------|-------|--------|-------|
| Integrate all loaders into app.py | Simão | Working multi-page app | 3h |
| Write editorial copy for all 4 pages | TFN | copy.py populated | 3h |
| Cross-review: TFN reads Simão's code | TFN | No causal claims in comments | 1h |
| Cross-review: Simão reads TFN's copy | Simão | All claims data-backed | 1h |
| Accessibility audit (contrast, tooltips) | TFN | WCAG AA compliance | 2h |
| METHODOLOGY.md complete | Both | Published in repo | 2h |
| README with setup + badges | Simão | CI badge green | 1h |

---

### Phase 4 — Deployment & QA (Week 6) · Owner: TFN + Simão

#### QA Protocol — Streamlit Community Cloud

```
PRE-DEPLOY CHECKLIST:
□ pytest: all tests passing, coverage > 80%
□ test_viz.py: y-axis zero check + source annotation check
□ requirements.txt: all versions pinned
□ .env.example: no real keys committed
□ manifest.json: MD5 for all raw files present
□ GitHub Actions: update_data.yml triggers on workflow_dispatch ✓

DEPLOY STEPS:
1. Push main branch → Streamlit Cloud auto-deploys
2. Wait for build log — verify no ImportError
3. First load test: cold start < 30s ✓
4. Navigation test: all 4 pages load without error
5. Download test: CSV download works on all pages
6. Mobile test: charts readable on 375px viewport

POST-DEPLOY:
□ Share URL with Prof. Fazendeiro for review
□ Test GitHub Actions manual trigger (workflow_dispatch)
□ Verify email notification on simulated failure
```

---

## Part 3 — Zero-Bottleneck Viability Report

### 3.1 Extraction Audit — Full Risk Assessment

#### DGS PDF Extraction

```
RISK LEVEL: HIGH
ROOT CAUSE: DGS publishes "Portugal — Saúde Mental em Números" as digitally-created 
PDFs but with inconsistent table structures between annual editions.

EXTRACTION STRATEGY:
├── Primary: pdfplumber.extract_tables() with lattice strategy
├── Fallback 1: pdfplumber.extract_text() + regex pattern matching
├── Fallback 2: Pre-compiled manual CSV for years with image-embedded tables
└── Detection: MD5 hash comparison — if hash changes, alert before extraction

CONCRETE FAILURE MODES:
┌─────────────────────────────────────────────────────────────────────┐
│ Failure Mode          │ Probability │ Fix                           │
├───────────────────────┼─────────────┼───────────────────────────────┤
│ Table spans 2 pages   │ High        │ page.extract_tables() across  │
│                       │             │ consecutive pages + merge     │
├───────────────────────┼─────────────┼───────────────────────────────┤
│ Image-embedded table  │ Medium      │ Fall back to manual CSV       │
│ (pre-2013 editions)   │             │ stored in /data/raw/dgs_manual│
├───────────────────────┼─────────────┼───────────────────────────────┤
│ Column count changes  │ Medium      │ Assert after extraction;      │
│ between editions      │             │ fail loudly, don't silently   │
│                       │             │ produce wrong data            │
├───────────────────────┼─────────────┼───────────────────────────────┤
│ DGS changes PDF URL   │ Low         │ Hardcode fallback URL list;   │
│                       │             │ alert if primary fails        │
└───────────────────────┴─────────────┴───────────────────────────────┘

VALIDATION AFTER EXTRACTION:
- Row count: expect 18-20 rows per year (one per district/ARS)
- Value range: internamentos/100k between 30 and 150 (historical range)
- Year continuity: no gaps of more than 2 years allowed
- Completeness: flag any district with > 3 missing years
```

#### Google Trends Extraction

```
RISK LEVEL: HIGH
ROOT CAUSE: pytrends is an unofficial wrapper. Google can block requests,
change response format, or deprecate the endpoint without notice.

CORE CONCEPTUAL RISK (more dangerous than technical):
The index is RELATIVE (0-100 per query, not across queries).
Misuse produces factually incorrect visualizations.

TECHNICAL MITIGATION:
from tenacity import retry, stop_after_attempt, wait_exponential
import time

@retry(stop=stop_after_attempt(3), 
       wait=wait_exponential(multiplier=1, min=2, max=30))
def fetch_trends(keywords: list[str], geo: str = 'PT') -> pd.DataFrame:
    pytrends = TrendReq(hl='pt-PT', tz=0, timeout=(10, 25))
    time.sleep(1)  # mandatory — avoid rate limit
    pytrends.build_payload(keywords, geo=geo, timeframe='2019-01-01 2024-12-31')
    return pytrends.interest_by_region(resolution='REGION', inc_low_vol=True)

CONCEPTUAL MITIGATION:
- df.attrs['unit'] = 'relative_index_0_100' — asserted in loader
- Every chart title: "Índice relativo — 100 = semana de pico do período"
- Never compare raw indices between districts in the same chart without note
- Backup CSV pre-collected manually: /data/raw/trends_backup/

CONTINGENCY (if pytrends completely fails):
- Use pre-collected CSVs — data valid through 2024
- Mark dashboard section as "Dados de 2019–2024 (actualização pausada)"
- Document in README — does not block deployment
```

---

### 3.2 Granularity Problem — Distrito vs. Concelho

```
PROBLEM STATEMENT:
DGS data is available at ARS (5 health regions) and district level (18-20 units).
PORDATA has some data at municipality (concelho) level (308 units).
INE ICOR is only available at NUTS II region level (7 units) for small samples.

This mismatch means we cannot build a single map using all sources at the same granularity.

DECISION MATRIX:
┌──────────────────────────────────────────────────────────────────────┐
│ Source         │ Granularity  │ Our Choice    │ Racional             │
├────────────────┼──────────────┼───────────────┼──────────────────────┤
│ PORDATA        │ Município    │ Distrito ✓    │ Aggregate up:        │
│                │ (308)        │ (18-20)       │ weighted mean by pop │
├────────────────┼──────────────┼───────────────┼──────────────────────┤
│ DGS            │ Distrito     │ Distrito ✓    │ Native granularity   │
│                │ (18-20)      │ (18-20)       │ — no change needed   │
├────────────────┼──────────────┼───────────────┼──────────────────────┤
│ INE ICOR       │ NUTS II      │ NUTS II ✓     │ Do NOT disaggregate  │
│                │ (7 regions)  │ (7 regions)   │ — statistical error  │
├────────────────┼──────────────┼───────────────┼──────────────────────┤
│ Google Trends  │ Região       │ Região ✓      │ Google's own         │
│                │ (7 regions)  │ (7 regions)   │ geographic unit      │
├────────────────┼──────────────┼───────────────┼──────────────────────┤
│ Eurostat       │ NUTS I       │ Country ✓     │ Benchmark only —     │
│                │ (country)    │               │ no regional needed   │
└──────────────────────────────────────────────────────────────────────┘

AGGREGATION CODE (PORDATA município → distrito):
def aggregate_to_distrito(df_mun: pd.DataFrame, 
                           df_pop: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate municipality-level data to district using population weights.
    NEVER use simple mean — small municipalities would distort results.
    """
    df = df_mun.merge(df_pop[['cod_mun','populacao']], on='cod_mun')
    df['distrito'] = df['cod_mun'].str[:2]  # first 2 digits = district code
    
    # Weighted mean by population
    result = (df.groupby(['distrito','ano'])
               .apply(lambda x: np.average(x['valor'], weights=x['populacao']))
               .reset_index(name='valor'))
    
    # Document the aggregation method
    result.attrs['aggregation'] = 'population_weighted_mean'
    result.attrs['note'] = 'Aggregated from município to distrito — see METHODOLOGY.md'
    return result

WHAT WE DOCUMENT IN METHODOLOGY.md:
"Visualização 1 (Mapa de Desertos) usa granularidade de Distrito (18-20 unidades).
Dados PORDATA ao nível de Município foram agregados por média ponderada pela população.
Dados INE ICOR são apresentados ao nível NUTS II (7 regiões) — não foram
desagregados para distrito pois isso introduziria erro estatístico."
```

---

### 3.3 Contingency Plans for Unstable APIs

| API | Instability Scenario | Contingency | Data Staleness Acceptable? |
|-----|---------------------|-------------|---------------------------|
| Google Trends | Rate limit / block | Pre-collected CSV 2019–2024 | Yes — behavioral trend, not vital statistic |
| Eurostat API | Endpoint deprecated | Switch to bulk download CSV | Yes — benchmark data, annual update sufficient |
| INE download | URL changed | Hardcoded fallback URL list + manual | Yes — historical data, < 1 year lag acceptable |
| PORDATA | Site restructure | Manual Excel download (15 min) | Yes — annual data |
| DGS PDF | New edition layout | Extract manually + add to /data/raw/dgs_manual/ | Yes — annual report |
| Streamlit Cloud | Service outage | N/A — monitor status.streamlit.io | Temporary outage only |

```python
# Universal contingency pattern used throughout:
def fetch_with_fallback(primary_fn, fallback_path: Path, source_name: str):
    try:
        result = primary_fn()
        logger.info(f"{source_name}: primary fetch successful")
        return result
    except Exception as e:
        logger.warning(f"{source_name}: primary failed ({e}). Using fallback.")
        if not fallback_path.exists():
            raise RuntimeError(f"Primary failed AND fallback missing: {source_name}")
        return pd.read_csv(fallback_path)
```

---

## Part 4 — Acceptance Criteria & Definition of Done

### DoD Per Work Block

#### Block 1: Data Engineering (Phase 1)
- [ ] All 5 sources fetched and stored in `/data/raw/` with MD5 in `manifest.json`
- [ ] `validate.py` exits with code 0 for all datasets
- [ ] No `NaN` values silently replaced — all suppressions documented
- [ ] `manifest.json` populated with source URL, license, fetch timestamp
- [ ] `METHODOLOGY.md` documents every cleaning decision made
- [ ] Unit tests pass: `pytest tests/test_validate.py -v` → 100% pass rate
- [ ] Google Trends backup CSV present in `/data/raw/trends_backup/`

#### Block 2: Core Visualizations (Phase 2)
- [ ] All 4 Plotly figures render without error in isolation
- [ ] `test_viz.py::test_yaxis_starts_at_zero_for_bar_charts` → PASS
- [ ] `test_viz.py::test_every_chart_has_source_annotation` → PASS
- [ ] `test_viz.py::test_colorscale_is_sequential_not_diverging` → PASS
- [ ] Okabe-Ito colors used in all multi-series charts
- [ ] Missing data shown as grey with tooltip, never as zero

#### Block 3: Integration & Storytelling (Phase 3)
- [ ] `streamlit run app.py` launches without ImportError
- [ ] All 4 `pages/` accessible via navigation
- [ ] `copy.py` reviewed: zero instances of "causa", "prova", "demonstra que"
- [ ] Every page has `st.download_button` for underlying CSV
- [ ] `warm_cache()` runs on boot without error
- [ ] WCAG AA contrast check passed for all text elements

#### Block 4: Deployment & QA (Phase 4)
- [ ] Streamlit Community Cloud URL live and accessible
- [ ] Cold start time < 30s (measured 3 times)
- [ ] `update_data.yml` triggered manually via `workflow_dispatch` → success
- [ ] `ci.yml` runs on push to main → green
- [ ] 18-point pre-launch checklist signed off by both authors
- [ ] `README.md` includes setup instructions, live URL, data sources
- [ ] `METHODOLOGY.md` published and linked from every page footer

---

## Dependency Graph

```
fetch.py
    └── validate.py
            └── transform.py
                    ├── loaders.py
                    │       ├── pages/1_Mapa_Desertos.py
                    │       ├── pages/2_Crise_2008.py
                    │       ├── pages/3_Portugal_Pesquisa.py
                    │       └── pages/4_Historia_Completa.py
                    └── tests/test_transform.py

theme.py ──────────── all pages (import at top)
copy.py ───────────── all pages (editorial text)
scroll_states.py ──── pages/4 only
geo.py ────────────── pages/1 only (GeoJSON)

GitHub Actions (update_data.yml):
    fetch.py → validate.py → transform.py → git commit → Streamlit redeploy
```

---

## Risk Register — Final

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|-------------|--------|------------|-------|
| R1 | DGS PDF structure changes | Medium | High | MD5 detection + fallback CSV | Simão |
| R2 | Google Trends rate limit | High | Medium | Pre-collected backup + tenacity | Simão |
| R3 | Causal claim in editorial copy | Low | High | Cross-review rule + test_viz.py | TFN |
| R4 | Granularity mismatch across sources | Certain | Medium | Documented aggregation strategy | Both |
| R5 | Streamlit Cloud sleep on first visit | Certain | Low | Loading message + documented in README | TFN |
| R6 | GitHub Actions silent failure | Low | High | Email notification in yml | Simão |
| R7 | INE methodology change mid-series | Low | High | quebra_serie flag + visual annotation | Simão |
| R8 | Choropleth misclassification distortion | Medium | High | Jenks + alternative tested + documented | TFN |

---

*Document version 1.0 — Last updated May 2025*  
*MindMap Portugal · TFN (54172) · Simão Nambi (53558) · UBI DV (IACD) 2025/26*
