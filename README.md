#  MindMap Portugal

> **Diagnóstico Nacional de Saúde Mental 2026**  
> Pipeline de dados auditável · Dashboard interativo · Rastreabilidade total

<div align="center">

[![Production](https://img.shields.io/badge/deploy-vercel-black?logo=vercel)](https://mindmap-portugal.vercel.app)
[![Pipeline](https://img.shields.io/badge/fase%201-concluída-22c55e)](#pipeline-de-dados)
[![Python](https://img.shields.io/badge/python-3.11%2B-3b82f6?logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/licença-académica-f59e0b)](#)

https://github.com/tfn-pt/mindmap-portugal/assets/demo/Screen_Recording_2026-05-18_at_15_02_20.mov

</div>

---

## Sobre o Projeto

O **MindMap Portugal** é um dashboard de análise de saúde mental em Portugal, desenvolvido no âmbito da Unidade Curricular de Extração e Transformação de Dados (ETD) da Universidade da Beira Interior.

O projeto integra dados de **6 fontes oficiais** (SNS, INE, DGS, Eurostat, InfoEscolas, Google Trends), com rastreabilidade completa desde a ingestão bruta até à visualização final, e disponibiliza um frontend cinematic com mapas interativos e visualizações temporais.

**Deploy em produção:** [mindmap-portugal.vercel.app](https://mindmap-portugal.vercel.app)

---

## Índice

- [Fontes de Dados](#fontes-de-dados)
- [Arquitetura](#arquitetura)
- [Pipeline de Dados](#pipeline-de-dados)
- [Estrutura do Repositório](#estrutura-do-repositório)
- [Instalação e Execução](#instalação-e-execução)
- [Dashboard Web](#dashboard-web)
- [Rastreabilidade e Contrato de Dados](#rastreabilidade-e-contrato-de-dados)
- [Equipa](#equipa)

---

## Fontes de Dados

| Fonte | Ficheiro Raw | Conteúdo | Fiabilidade |
|---|---|---|---|
| **SNS Transparência** | `sns_consultas.json` | Consultas mensais de psicologia | 🟢 Alta |
| **SNS Transparência** | `sns_capic.json` | Chamadas CAPIC (linha de crise) | 🟢 Alta |
| **INE** | `ine_icor_2023.csv` | Prevalência de doenças crónicas | 🟢 Alta |
| **INE (PDF)** | `04DiaMS*.pdf` | Destaque Dia Mundial da Saúde 2025 | 🟢 Alta |
| **DGS** | `dgs_saude_mental_em_numeros_2015.pdf` | Saúde Mental em Números 2015 | 🟢 Alta |
| **ERS (PDF)** | `estudo_saude_mental_*.pdf` | Estudo acesso hospitalar SNS (2023) | 🟢 Alta |
| **Eurostat** | `eurostat_hlth_sha11_hf_pt.json` | Despesa em saúde mental (PT, API) | 🟢 Alta |
| **InfoEscolas** | `InfoEscolas2024_Secundario_CH_DadosPorRegiao.xlsx` | ASE e retenção por região NUTS II | 🟡 Média-Alta |
| **Google Trends** | `google_trends_saude_mental_pt.csv` | Interesse em "depressão", "ansiedade", "saúde mental" | 🟡 Média |

### Principais Indicadores (2024)

- **32,0%** da população com sintomas de ansiedade generalizada *(INE, abril 2025)*
- **28,7%** com limitações nas atividades habituais por razões de saúde *(INE)*
- **43** hospitais SNS com consultas de psiquiatria; **39** com consultas de psicologia *(ERS, 2023)*
- **39%** das primeiras consultas de psiquiatria excederam o TMRG no 1S2023 *(ERS)*
- Consultas de psicologia SNS cresceram a uma taxa de **+12% ao ano** entre 2018–2022 *(ERS)*

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        FASE 1 – INGESTÃO                        │
│                                                                 │
│  SNS API ──┐                                                    │
│  Eurostat ─┤                                                    │
│  Google    ├──► fetcher.py ──► data/raw/  ──► manifest.json     │
│  Trends ───┤    (retry +        (PDFs,         (MD5 + lineage)  │
│  DGS PDF ──┘     MD5 check)     JSON, CSV,                      │
│                                 XLSX)                           │
└─────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FASE 2 – TRANSFORMAÇÃO                     │
│                                                                 │
│  data/raw/ ──► transformer.py ──► data/processed/              │
│                 (normalização,      dashboard_main.parquet       │
│                  canonicalização,   dashboard_main.csv           │
│                  médias ponderadas, study_insights.json          │
│                  validação PDF)     data_lineage.json            │
└─────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       FASE 3 – DASHBOARD                        │
│                                                                 │
│  data/processed/ ──► Next.js 15 (web/)  ──► Vercel             │
│                       InteractiveMap                            │
│                       DualTimeline                              │
│                       NationalSignalsChart                      │
│                       TrendsHeatmap                             │
│                       CapacityBalanceChart                      │
│                       CinematicCanvas                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pipeline de Dados

### Fase 1 — Extração (`src/data/fetcher.py`)

O fetcher implementa um catálogo de fontes declarativo com suporte a dois handlers:

- **`http`** — download com streaming, retry exponencial (3 tentativas, espera 1–8 s), gravação atómica via ficheiro temporário, validação MD5 opcional
- **`google_trends`** — ingestão via `pytrends` com `time.sleep(1)` entre requests (compliance com rate-limit), filtragem da coluna `isPartial`

Após cada ingestão bem-sucedida, é atualizado o `manifest.json` com:

```json
{
  "filename": "sns_consultas.json",
  "md5_hash": "a1b2c3...",
  "fetched_at": "2026-03-20T14:30:00+00:00",
  "source_url": "https://transparencia.sns.gov.pt/..."
}
```

**Executar a extração:**

```bash
python -m src.data.fetcher
```

### Fase 2 — Transformação (`src/data/transformer.py`)

O transformer produz um `dashboard_main.parquet` com as seguintes colunas canónicas:

| Coluna | Fonte | Tipo |
|---|---|---|
| `ano` | todas | int |
| `regiao` | todas | str (NUTS II) |
| `consultas_sns` | SNS Transparência | float |
| `capic_sns` | SNS Transparência | float |
| `prevalencia_ine` | INE / ICor | float |
| `ansiedade_2024_ine` | INE PDF | float |
| `ase_percent_min_educ` | InfoEscolas | float |
| `retencao_min_educ` | InfoEscolas | float |
| `google_interest_score` | Google Trends | float |
| `spending_eurostat` | Eurostat | float |

O pipeline inclui validação de evidências PDF (asserções de texto extraído), canonicalização de regiões para NUTS II, médias ponderadas por grupo, e um **contrato de dados** que falha o build se as colunas do dashboard e do lineage não coincidirem exatamente.

**Executar a transformação:**

```bash
python -m src.data.transformer
```

---

## Estrutura do Repositório

```
mindmap-portugal/
├── data/
│   ├── raw/                    # Dados brutos (gitignored, exceto samples)
│   │   ├── backup/             # Backups HTTP
│   │   └── trends_backup/      # Backups Google Trends
│   ├── processed/              # Artefactos prontos para o dashboard
│   │   ├── dashboard_main.parquet
│   │   ├── dashboard_main.csv
│   │   ├── study_insights.json
│   │   └── data_lineage.json
│   └── manifest.json           # Registo MD5 + lineage de cada ficheiro raw
│
├── src/
│   ├── data/
│   │   ├── fetcher.py          # Pipeline de extração (HTTP + Google Trends)
│   │   └── transformer.py      # Pipeline de transformação + contrato de dados
│   └── utils/
│       └── hashing.py          # Utilitário MD5
│
├── web/                        # Frontend Next.js 15 + Tailwind + TypeScript
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── CapacityBalanceChart.tsx
│   │   ├── CinematicCanvas.tsx
│   │   ├── DualTimeline.tsx
│   │   ├── InteractiveMap.tsx
│   │   ├── NationalSignalsChart.tsx
│   │   ├── NeuralBackground.tsx
│   │   └── TrendsHeatmap.tsx
│   └── lib/
│       ├── geo/                # GeoJSON Portugal NUTS II
│       ├── animationConfig.ts
│       ├── accessibility.ts
│       ├── dashboardMetrics.ts
│       ├── dataLoader.ts
│       └── motion.ts
│
├── app.py                      # App Streamlit (legado / análise exploratória)
├── requirements.txt            # Dependências Python
├── .env.example                # Template de variáveis de ambiente
└── README.md
```

---

## Instalação e Execução

### Pré-requisitos

- Python 3.11+
- Node.js 20+
- Git

### 1. Clonar o repositório

```bash
git clone https://github.com/tfn-pt/mindmap-portugal.git
cd mindmap-portugal
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Preencher SNS_API_KEY (opcional — a pipeline funciona sem chave para endpoints públicos)
```

### 3. Instalar dependências Python

```bash
pip install -r requirements.txt
```

### 4. Correr o pipeline completo

```bash
# Extração
python -m src.data.fetcher

# Transformação
python -m src.data.transformer
```

Os artefactos processados ficam disponíveis em `data/processed/`.

### 5. Iniciar o frontend (desenvolvimento)

```bash
cd web
npm install
npm run dev
# → http://localhost:3000
```

### 6. App Streamlit (opcional)

```bash
streamlit run app.py
```

---

## Dashboard Web

O frontend em Next.js 15 apresenta os dados através de seis componentes principais:

| Componente | Descrição |
|---|---|
| `InteractiveMap` | Mapa coroplético interativo de Portugal (NUTS II) com drill-down por região |
| `DualTimeline` | Linha temporal dupla comparando indicadores clínicos e comportamentais |
| `NationalSignalsChart` | Painel de sinais nacionais com sparklines e variações YoY |
| `TrendsHeatmap` | Heatmap de interesse Google Trends por termo e mês |
| `CapacityBalanceChart` | Gráfico de equilíbrio oferta/procura nos serviços SNS |
| `CinematicCanvas` | Canvas animado de fundo com efeito neural / partículas |

**Deploy automático** via Vercel a cada push para `main`.

---

## Rastreabilidade e Contrato de Dados

Cada ficheiro raw tem um registo no `manifest.json` com hash MD5, timestamp UTC e URL de origem.

O `data_lineage.json` produzido pelo transformer mapeia cada coluna do dashboard à sua fonte primária, ficheiro de origem, score de fiabilidade e data da última atualização.

O `assert_source_contract()` garante que o build falha se:
- Existir qualquer coluna no dashboard sem lineage correspondente
- Existir qualquer entrada de lineage que referencie um ficheiro inexistente em disco

Esta abordagem garante **rastreabilidade total** conforme os requisitos do PRD 1.x e 2.x do projeto.

---

## Equipa

Projeto desenvolvido no âmbito da UC de **Extração e Transformação de Dados**  
Universidade da Beira Interior · Licenciatura em Inteligência Artificial e Ciência de Dados

| Membro | GitHub |
|---|---|
| Simão | [@simaonambi](https://github.com/simaonambi) |
| Tiago | [@tfn-pt](https://github.com/tfn-pt) |


---

<div align="center">

**Fase 1 – Ingestão concluída**  
Dados processados com rastreabilidade total (INE, SNS, InfoEscolas, DGS, ERS, Eurostat, Google Trends)

</div>
