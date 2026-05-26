"""
app.py — MindMap Portugal · Versão SOTA
Arquitectura: app.py · theme.py · viz_factory.py
Animações · Scrollytelling · Linked Highlighting · Okabe-Ito · WCAG AA
"""

import streamlit as st
import pandas as pd
import json

# ── Configuração da página (DEVE ser a primeira chamada) ─────────────
st.set_page_config(
    page_title="MindMap Portugal",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Design system e fábrica de gráficos ─────────────────────────────
from theme import get_css
from viz_factory import (
    build_mapa,
    build_mapa_scrolly,
    build_linha_animada,
    build_barras,
    build_despesa_eurostat,
    build_google_trends,
)

# ── Injectar CSS ─────────────────────────────────────────────────────
st.markdown(get_css(), unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════
# DADOS
# ════════════════════════════════════════════════════════════════════

@st.cache_data(show_spinner=False)
def load_data() -> pd.DataFrame:
    return pd.read_csv("data/processed/dashboard_main.csv")


@st.cache_data(show_spinner=False)
def load_insights() -> list:
    with open("data/processed/study_insights.json", "r", encoding="utf-8") as f:
        return json.load(f)


# Carregar com contentor fixo para evitar flicker
_data_placeholder = st.empty()
with _data_placeholder.container():
    df = load_data()
    insights = load_insights()
_data_placeholder.empty()


# ════════════════════════════════════════════════════════════════════
# SESSION STATE — sincronização global de filtros
# ════════════════════════════════════════════════════════════════════

def _init_state():
    """Inicializa todo o estado global na primeira execução."""
    defaults = {
        "pagina":           "Início",
        "ano_sel":          int(df["ano"].max()),
        "regioes_sel":      df["regiao"].unique().tolist(),
        "highlighted_reg":  None,
        "scroll_step":      0,
        # Garante que filtros da pág. 2 persistem ao voltar à pág. 3
        "ano_mapa":         int(df["ano"].max()),
        "regioes_linha":    df["regiao"].unique().tolist(),
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

_init_state()


# ════════════════════════════════════════════════════════════════════
# SIDEBAR
# ════════════════════════════════════════════════════════════════════

with st.sidebar:
    st.markdown("""
        <div style="padding:0.5rem 0 1rem">
            <span style="font-size:1.8rem">🧠</span>
            <span style="font-family:'DM Serif Display',serif;font-size:1.25rem;
                         color:#e8eaf6;margin-left:0.5rem;vertical-align:middle">
                MindMap Portugal
            </span>
            <div style="font-size:0.75rem;color:#9fa8da;margin-top:0.3rem;
                        font-style:italic;margin-left:0.2rem">
                A Crise Silenciosa em Números
            </div>
        </div>
    """, unsafe_allow_html=True)

    st.divider()

    pagina = st.radio(
        "Navegar",
        ["Início", "Mapa de Desertos", "A Crise em Dados",
         "O que Portugal Pesquisa", "A História Completa"],
        index=["Início", "Mapa de Desertos", "A Crise em Dados",
               "O que Portugal Pesquisa", "A História Completa"].index(
                   st.session_state["pagina"]
               ),
        label_visibility="collapsed",
    )
    # Sincronizar navegação no session_state
    if pagina != st.session_state["pagina"]:
        st.session_state["pagina"] = pagina

    st.divider()
    st.caption("Fontes: SNS · INE · Eurostat · Google Trends · ERS")
    st.caption("UBI · Visualização de Dados 2025/26")


# ════════════════════════════════════════════════════════════════════
# UTILITÁRIOS DE UI
# ════════════════════════════════════════════════════════════════════

def page_header(title: str, subtitle: str = ""):
    st.markdown(f"""
        <div class="page-header">
            <h1>{title}</h1>
            {"<div class='subtitle'>" + subtitle + "</div>" if subtitle else ""}
        </div>
        <hr/>
    """, unsafe_allow_html=True)


def metric_card(label: str, value: str, source: str = "", delay: str = "0s") -> str:
    return f"""
        <div class="metric-card" style="animation-delay:{delay}">
            <div class="label">{label}</div>
            <div class="value">{value}</div>
            {"<div class='source'>" + source + "</div>" if source else ""}
        </div>
    """


def insight_card(facto: str, valor: str, fonte: str, data: str, delay: str = "0s") -> str:
    return f"""
        <div class="insight-box" style="animation-delay:{delay}">
            <div class="title">{facto}</div>
            <div class="value">{valor}</div>
            <div class="source">{fonte} · {data}</div>
        </div>
    """


# ════════════════════════════════════════════════════════════════════
# PÁGINA 1 — INÍCIO
# ════════════════════════════════════════════════════════════════════

if pagina == "Início":

    page_header(
        "MindMap Portugal",
        "Dados abertos sobre saúde mental — uma crise invisível"
    )

    # ── KPI cards com fade-in escalonado ────────────────────────────
    consultas_total = int(df[df["ano"] == df["ano"].max()]["consultas_sns"].sum())
    consultas_fmt   = f"{consultas_total:,}".replace(",", "\u00a0")

    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown(metric_card(
            "Portugueses com sofrimento psicológico",
            "1,07 M",
            "INE · Inquérito Nacional de Saúde 2023",
            delay="0.05s"
        ), unsafe_allow_html=True)
    with col2:
        st.markdown(metric_card(
            "Com sintomas de ansiedade (2024)",
            "32%",
            "INE · Destaque Abril 2025",
            delay="0.15s"
        ), unsafe_allow_html=True)
    with col3:
        st.markdown(metric_card(
            "Consultas SNS saúde mental (último ano)",
            consultas_fmt,
            "SNS · Portal Transparência",
            delay="0.25s"
        ), unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Insights ────────────────────────────────────────────────────
    st.markdown("""
        <div style="font-family:'DM Serif Display',serif;font-size:1.3rem;
                    color:#e8eaf6;margin-bottom:0.8rem">
            O que os dados revelam
        </div>
    """, unsafe_allow_html=True)

    cols = st.columns(2)
    for i, ins in enumerate(insights[:6]):
        with cols[i % 2]:
            st.markdown(insight_card(
                ins["facto"], ins["valor"], ins["fonte"],
                ins["data_publicacao"], delay=f"{0.05 + i * 0.08:.2f}s"
            ), unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════
# PÁGINA 2 — MAPA DE DESERTOS
# ════════════════════════════════════════════════════════════════════

elif pagina == "Mapa de Desertos":

    page_header(
        "Mapa de Desertos de Saúde Mental",
        "Distribuição de consultas por região NUTS II — deslize o slider para explorar os anos"
    )

    anos_disponiveis = sorted(df["ano"].unique().tolist())

    # Usar st.empty() para contentor fixo: evita scroll-to-top no slider
    controls_slot  = st.empty()
    map_slot       = st.empty()
    sidebar_slot   = st.empty()

    with controls_slot.container():
        ano_sel = st.select_slider(
            "Selecionar ano",
            options=anos_disponiveis,
            value=st.session_state["ano_mapa"],
            key="_slider_ano_mapa",
        )
        # Sincronizar no session_state global
        st.session_state["ano_mapa"] = ano_sel

    df_ano = df[df["ano"] == ano_sel].copy()

    with map_slot.container():
        col_mapa, col_tabela = st.columns([2, 1])

        with col_mapa:
            fig_mapa = build_mapa(df_ano, height=500)
            fig_mapa.add_annotation(
                text="Fonte: SNS · Portal Transparência · NUTS II Portugal",
                xref="paper", yref="paper", x=0, y=-0.04,
                showarrow=False, font=dict(size=9, color="#616d8a")
            )
            st.plotly_chart(fig_mapa, use_container_width=True, key=f"mapa_{ano_sel}")

        with col_tabela:
            st.markdown("""
                <div style="font-family:'DM Serif Display',serif;font-size:1.1rem;
                            color:#e8eaf6;margin-bottom:0.5rem">Ranking</div>
            """, unsafe_allow_html=True)

            ranking = (
                df_ano[["regiao", "consultas_sns"]]
                .sort_values("consultas_sns", ascending=False)
                .reset_index(drop=True)
            )
            ranking.index += 1
            ranking.columns = ["Região", "Consultas"]
            ranking["Consultas"] = ranking["Consultas"].apply(
                lambda x: f"{int(x):,}".replace(",", "\u00a0")
            )
            st.dataframe(ranking, use_container_width=True, height=200)

            st.markdown("<br>", unsafe_allow_html=True)

            # Barras com linked highlight (region = None por omissão)
            fig_bar = build_barras(df_ano, height=200)
            st.plotly_chart(fig_bar, use_container_width=True, key=f"bar_{ano_sel}")

            st.download_button(
                "⬇ Descarregar CSV",
                df_ano.to_csv(index=False).encode("utf-8"),
                f"consultas_saude_mental_{ano_sel}.csv",
                "text/csv",
            )


# ════════════════════════════════════════════════════════════════════
# PÁGINA 3 — A CRISE EM DADOS
# ════════════════════════════════════════════════════════════════════

elif pagina == "A Crise em Dados":

    page_header(
        "A Evolução da Crise",
        "Prima ▶ Play para animar a série temporal — ou use o slider para explorar ano a ano"
    )

    # Multiselect sincronizado com session_state
    regioes = st.multiselect(
        "Selecionar regiões",
        options=df["regiao"].unique().tolist(),
        default=st.session_state["regioes_linha"],
        key="_ms_regioes_linha",
    )
    st.session_state["regioes_linha"] = regioes if regioes else df["regiao"].unique().tolist()

    # Contentor fixo: evita flicker ao mudar selecção
    chart_slot = st.empty()
    with chart_slot.container():
        fig_linha = build_linha_animada(df, regioes=st.session_state["regioes_linha"], height=460)
        st.plotly_chart(fig_linha, use_container_width=True, key="linha_animada")

    st.markdown("<hr/>", unsafe_allow_html=True)

    st.markdown("""
        <div style="font-family:'DM Serif Display',serif;font-size:1.2rem;
                    color:#e8eaf6;margin-bottom:0.4rem">
            Despesa em Saúde Mental — Portugal vs. Europa
        </div>
    """, unsafe_allow_html=True)

    despesa_slot = st.empty()
    with despesa_slot.container():
        fig_despesa = build_despesa_eurostat(df, height=360)
        if fig_despesa.data:
            st.plotly_chart(fig_despesa, use_container_width=True, key="despesa")
        else:
            st.info("Dados Eurostat não disponíveis neste dataset.")

    st.download_button(
        "⬇ Descarregar dados completos",
        df.to_csv(index=False).encode("utf-8"),
        "mindmap_dados_completos.csv",
        "text/csv",
    )


# ════════════════════════════════════════════════════════════════════
# PÁGINA 4 — O QUE PORTUGAL PESQUISA
# ════════════════════════════════════════════════════════════════════

elif pagina == "O que Portugal Pesquisa":

    page_header(
        "O que Portugal Pesquisa",
        "Índice relativo de pesquisas Google por termos de saúde mental (normalizado 0–100)"
    )

    st.info(
        "⚠️  Índice normalizado: 100 = ano com valor mais alto do período. "
        "Os valores são relativos, não absolutos."
    )

    df_trends = df[df["google_interest_score"].notna()].copy()

    if df_trends.empty:
        st.warning("Dados de Google Trends não disponíveis neste dataset.")
    else:
        trends_slot = st.empty()
        with trends_slot.container():
            fig_trends = build_google_trends(df_trends, height=440)
            st.plotly_chart(fig_trends, use_container_width=True, key="google_trends")

        st.caption(
            f"Dados disponíveis para {df_trends['regiao'].nunique()} região(ões)."
        )


# ════════════════════════════════════════════════════════════════════
# PÁGINA 5 — A HISTÓRIA COMPLETA (Scrollytelling)
# ════════════════════════════════════════════════════════════════════

elif pagina == "A História Completa":

    CAPITULOS = [
        {
            "titulo": "O País que não se vê",
            "corpo": (
                "Portugal tem <strong>1,07 milhões de pessoas</strong> com sofrimento psicológico "
                "provável. Metade nunca pediu ajuda. Os dados existem — dispersos em PDFs, "
                "folhas de cálculo e APIs. Ninguém os tinha cruzado num único produto acessível."
            ),
            "viz": "kpi",
            "mapa_chapter": 0,
        },
        {
            "titulo": "Lisboa concentra tudo",
            "corpo": (
                "A região de <strong>Lisboa e Vale do Tejo</strong> concentra a maioria das consultas "
                "de saúde mental do SNS. O Alentejo e o Algarve ficam sistematicamente para trás — "
                "ano após ano. O interior e o sul são os grandes desertos do sistema."
            ),
            "viz": "mapa",
            "mapa_chapter": 1,   # zoom sobre Lisboa
        },
        {
            "titulo": "A tendência não para",
            "corpo": (
                "As consultas têm crescido cerca de <strong>+5% ao ano</strong> em psiquiatria "
                "e <strong>+12%</strong> em psicologia. O sistema está a ser pressionado — "
                "mas de forma desigual entre regiões."
            ),
            "viz": "linha",
            "mapa_chapter": 2,
        },
        {
            "titulo": "O que os dados não mostram",
            "corpo": (
                "<strong>32%</strong> da população adulta reportou sintomas de ansiedade em 2024. "
                "<strong>39%</strong> das primeiras consultas hospitalares de psiquiatria excederam "
                "o tempo máximo de resposta garantido. "
                "<strong>66%</strong> das consultas estão concentradas em Lisboa."
            ),
            "viz": "insights",
            "mapa_chapter": 3,
        },
    ]

    total_caps = len(CAPITULOS)
    step = st.session_state["scroll_step"]
    cap  = CAPITULOS[step]

    # ── Layout: painel esquerdo (texto) + direito (visualização) ────
    col_txt, col_viz = st.columns([1, 1.6], gap="large")

    with col_txt:
        st.markdown(f"""
            <div class="chapter-panel">
                <div class="chapter-number">Capítulo {step + 1} de {total_caps}</div>
                <div class="chapter-title">{cap['titulo']}</div>
                <div class="chapter-body">{cap['corpo']}</div>
            </div>
        """, unsafe_allow_html=True)

        st.markdown("<br>", unsafe_allow_html=True)

        # Navegação
        nav_prev, nav_next = st.columns(2)
        with nav_prev:
            if st.button("← Anterior", disabled=(step == 0), use_container_width=True):
                st.session_state["scroll_step"] = step - 1
                st.rerun()
        with nav_next:
            if st.button("Seguinte →", disabled=(step == total_caps - 1), use_container_width=True):
                st.session_state["scroll_step"] = step + 1
                st.rerun()

        st.markdown("<br>", unsafe_allow_html=True)
        st.progress((step + 1) / total_caps)

    # ── Visualização direita ─────────────────────────────────────────
    with col_viz:
        df_ultimo = df[df["ano"] == df["ano"].max()]

        # Contentor fixo para evitar salto de página
        viz_slot = st.empty()

        with viz_slot.container():

            if cap["viz"] == "kpi":
                consultas_u = int(df_ultimo["consultas_sns"].sum())
                st.markdown(metric_card(
                    "Pessoas com sofrimento psicológico", "1,07 M",
                    "INE · 2023", "0.1s"
                ), unsafe_allow_html=True)
                st.markdown(metric_card(
                    "Com sintomas de ansiedade", "32%",
                    "INE · 2025", "0.2s"
                ), unsafe_allow_html=True)
                st.markdown(metric_card(
                    "Consultas SNS (último ano)",
                    f"{consultas_u:,}".replace(",", "\u00a0"),
                    "SNS · Portal Transparência", "0.3s"
                ), unsafe_allow_html=True)

            elif cap["viz"] == "mapa":
                # Mapa com zoom dinâmico via Mapbox (scrollytelling)
                try:
                    fig_m = build_mapa_scrolly(df_ultimo, chapter=cap["mapa_chapter"], height=400)
                    st.plotly_chart(fig_m, use_container_width=True, key=f"scrolly_mapa_{step}")
                except Exception:
                    # Fallback para choropleth simples se Mapbox não estiver disponível
                    fig_m = build_mapa(df_ultimo, height=380, show_colorbar=False)
                    st.plotly_chart(fig_m, use_container_width=True, key=f"scrolly_mapa_fb_{step}")

            elif cap["viz"] == "linha":
                fig_l = build_linha_animada(df, height=400)
                st.plotly_chart(fig_l, use_container_width=True, key=f"scrolly_linha_{step}")

            elif cap["viz"] == "insights":
                for i, ins in enumerate(insights[3:6]):
                    st.markdown(insight_card(
                        ins["facto"], ins["valor"], ins["fonte"],
                        ins["data_publicacao"], delay=f"{i * 0.1:.1f}s"
                    ), unsafe_allow_html=True)