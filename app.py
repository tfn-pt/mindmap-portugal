import streamlit as st
import pandas as pd
import plotly.express as px
import json

# ── Configuracao da pagina ──────────────────────────────────────────
st.set_page_config(
    page_title="MindMap Portugal",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ── CSS ─────────────────────────────────────────────────────────────
st.markdown("""
    <style>
        .metric-card {
            background-color: #1e1e2e;
            border-left: 3px solid #4f8ef7;
            padding: 1rem 1.5rem;
            border-radius: 6px;
            margin-bottom: 1rem;
        }
        .metric-card .label { font-size: 0.8rem; color: #aaa; margin-bottom: 0.2rem; }
        .metric-card .value { font-size: 2rem; font-weight: 700; color: #ffffff; }
        .metric-card .source { font-size: 0.72rem; color: #666; margin-top: 0.3rem; }
        .insight-box {
            background-color: #1a1a2e;
            border: 1px solid #2a2a4a;
            border-radius: 6px;
            padding: 1rem 1.2rem;
            margin-bottom: 0.8rem;
        }
        .insight-box .title { font-size: 0.85rem; font-weight: 600; color: #c0c8ff; margin-bottom: 0.3rem; }
        .insight-box .value { font-size: 0.8rem; color: #aab; }
        .insight-box .source { font-size: 0.7rem; color: #555; margin-top: 0.4rem; }
    </style>
""", unsafe_allow_html=True)

# ── GeoJSON NUTS II Portugal — embutido ────────────────────────────
GEOJSON_PT = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {"id": "PT11", "na": "Norte"},
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-8.2, 42.15], [-6.18, 42.15], [-6.18, 41.5],
          [-6.5, 41.0],  [-7.0, 40.95], [-7.5, 41.1],
          [-8.0, 41.1],  [-8.65, 41.85],[-8.2, 42.15]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {"id": "PT16", "na": "Centro"},
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-8.0, 41.1],  [-7.5, 41.1],  [-7.0, 40.95],
          [-6.5, 41.0],  [-6.18, 41.5], [-6.18, 40.0],
          [-7.0, 39.7],  [-7.5, 39.7],  [-8.5, 40.0],
          [-8.9, 40.5],  [-8.65, 41.0], [-8.0, 41.1]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {"id": "PT17", "na": "Lisboa e Vale do Tejo"},
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-8.5, 40.0],  [-7.5, 39.7],  [-7.0, 39.7],
          [-6.18, 40.0], [-6.18, 39.0], [-7.0, 38.9],
          [-8.0, 38.9],  [-9.0, 38.5],  [-9.5, 38.7],
          [-9.5, 39.2],  [-9.0, 39.5],  [-8.5, 40.0]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {"id": "PT18", "na": "Alentejo"},
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-8.0, 38.9],  [-7.0, 38.9],  [-6.18, 39.0],
          [-6.18, 38.0], [-7.0, 37.5],  [-7.5, 37.5],
          [-8.0, 37.8],  [-8.0, 38.9]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": {"id": "PT15", "na": "Algarve"},
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-8.0, 37.8],  [-7.5, 37.5],  [-7.0, 37.5],
          [-6.18, 38.0], [-7.0, 37.0],  [-7.5, 37.0],
          [-8.5, 37.0],  [-9.0, 37.2],  [-8.8, 37.5],
          [-8.0, 37.8]
        ]]
      }
    }
  ]
}

REGIAO_PARA_NUTS2 = {
    "Norte":                 "PT11",
    "Centro":                "PT16",
    "Lisboa e Vale do Tejo": "PT17",
    "Alentejo":              "PT18",
    "Algarve":               "PT15",
}

# ── Carregar dados ──────────────────────────────────────────────────
@st.cache_data
def load_data():
    return pd.read_csv("data/processed/dashboard_main.csv")

@st.cache_data
def load_insights():
    with open("data/processed/study_insights.json", "r", encoding="utf-8") as f:
        return json.load(f)

df = load_data()
insights = load_insights()

# ── Funcao: mapa coroplético ────────────────────────────────────────
def build_mapa(df_input, height=500, show_colorbar=True):
    df_m = df_input.copy()
    df_m["nuts2_id"] = df_m["regiao"].map(REGIAO_PARA_NUTS2)
    df_m = df_m.dropna(subset=["nuts2_id"])

    fig = px.choropleth(
        df_m,
        geojson=GEOJSON_PT,
        locations="nuts2_id",
        featureidkey="properties.id",
        color="consultas_sns",
        color_continuous_scale="Blues",
        hover_name="regiao",
        hover_data={"consultas_sns": True, "nuts2_id": False},
        labels={"consultas_sns": "Consultas SNS"}
    )
    fig.update_geos(fitbounds="locations", visible=False, bgcolor="rgba(0,0,0,0)")
    fig.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font_color="#cccccc",
        margin=dict(l=0, r=0, t=10, b=10),
        height=height,
        coloraxis_showscale=show_colorbar,
        coloraxis_colorbar=dict(title="Consultas", len=0.7) if show_colorbar else {}
    )
    return fig

# ── Sidebar ─────────────────────────────────────────────────────────
st.sidebar.title("MindMap Portugal")
st.sidebar.markdown("*A Crise Silenciosa em Numeros*")
st.sidebar.divider()

pagina = st.sidebar.radio(
    "Navegar",
    ["Inicio", "Mapa de Desertos", "A Crise em Dados",
     "O que Portugal Pesquisa", "A Historia Completa"]
)

st.sidebar.divider()
st.sidebar.caption("Fontes: SNS · INE · Eurostat · Google Trends · ERS")
st.sidebar.caption("UBI · Visualizacao de Dados 2025/26")


# ════════════════════════════════════════════════════════════════════
# PAGINA 1 — INICIO
# ════════════════════════════════════════════════════════════════════
if pagina == "Inicio":

    st.title("MindMap Portugal")
    st.subheader("A Crise Silenciosa em Numeros")
    st.markdown("---")

    col1, col2, col3 = st.columns(3)
    consultas_total = int(df[df["ano"] == df["ano"].max()]["consultas_sns"].sum())
    consultas_fmt = f"{consultas_total:,}".replace(",", " ")

    with col1:
        st.markdown("""
            <div class="metric-card">
                <div class="label">Portugueses com sofrimento psicologico</div>
                <div class="value">1,07 M</div>
                <div class="source">Fonte: INE · Inquerito Nacional de Saude 2023</div>
            </div>
        """, unsafe_allow_html=True)
    with col2:
        st.markdown("""
            <div class="metric-card">
                <div class="label">Com sintomas de ansiedade (2024)</div>
                <div class="value">32%</div>
                <div class="source">Fonte: INE · Destaque Abril 2025</div>
            </div>
        """, unsafe_allow_html=True)
    with col3:
        st.markdown(f"""
            <div class="metric-card">
                <div class="label">Consultas SNS saude mental (ultimo ano)</div>
                <div class="value">{consultas_fmt}</div>
                <div class="source">Fonte: SNS · Portal Transparencia</div>
            </div>
        """, unsafe_allow_html=True)

    st.markdown("---")
    st.subheader("O que os dados revelam")
    cols = st.columns(2)
    for i, insight in enumerate(insights[:6]):
        with cols[i % 2]:
            st.markdown(f"""
                <div class="insight-box">
                    <div class="title">{insight['facto']}</div>
                    <div class="value">{insight['valor']}</div>
                    <div class="source">{insight['fonte']} · {insight['data_publicacao']}</div>
                </div>
            """, unsafe_allow_html=True)


# ════════════════════════════════════════════════════════════════════
# PAGINA 2 — MAPA DE DESERTOS
# ════════════════════════════════════════════════════════════════════
elif pagina == "Mapa de Desertos":

    st.title("Mapa de Desertos de Saude Mental")
    st.markdown("Distribuicao de consultas de saude mental por regiao NUTS II.")
    st.markdown("---")

    anos_disponiveis = sorted(df["ano"].unique().tolist())
    ano_sel = st.select_slider("Selecionar ano", options=anos_disponiveis, value=max(anos_disponiveis))
    df_ano = df[df["ano"] == ano_sel].copy()

    col_mapa, col_tabela = st.columns([2, 1])

    with col_mapa:
        fig_mapa = build_mapa(df_ano, height=500)
        fig_mapa.add_annotation(
            text="Fonte: SNS · Portal Transparencia · NUTS II Portugal",
            xref="paper", yref="paper", x=0, y=-0.04,
            showarrow=False, font=dict(size=9, color="grey")
        )
        st.plotly_chart(fig_mapa, use_container_width=True)

    with col_tabela:
        st.markdown("### Ranking")
        ranking = df_ano[["regiao", "consultas_sns"]].sort_values("consultas_sns", ascending=False).reset_index(drop=True)
        ranking.index += 1
        ranking.columns = ["Regiao", "Consultas"]
        ranking["Consultas"] = ranking["Consultas"].apply(lambda x: f"{int(x):,}".replace(",", " "))
        st.dataframe(ranking, use_container_width=True)

        fig_bar = px.bar(
            df_ano.sort_values("consultas_sns", ascending=True),
            x="consultas_sns", y="regiao", orientation="h",
            color="consultas_sns", color_continuous_scale="Blues",
            labels={"consultas_sns": "Consultas", "regiao": ""}
        )
        fig_bar.update_layout(
            coloraxis_showscale=False,
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            font_color="#cccccc", margin=dict(l=0, r=0, t=10, b=0), height=200
        )
        st.plotly_chart(fig_bar, use_container_width=True)

        st.download_button(
            "Descarregar CSV",
            df_ano.to_csv(index=False).encode("utf-8"),
            f"consultas_saude_mental_{ano_sel}.csv",
            "text/csv"
        )


# ════════════════════════════════════════════════════════════════════
# PAGINA 3 — A CRISE EM DADOS
# ════════════════════════════════════════════════════════════════════
elif pagina == "A Crise em Dados":

    st.title("A Evolucao da Crise")
    st.markdown("Consultas de saude mental no SNS ao longo dos anos, por regiao.")
    st.markdown("---")

    regioes = st.multiselect(
        "Selecionar regioes",
        options=df["regiao"].unique().tolist(),
        default=df["regiao"].unique().tolist()
    )
    df_filtrado = df[df["regiao"].isin(regioes)]

    fig = px.line(
        df_filtrado, x="ano", y="consultas_sns", color="regiao", markers=True,
        title="Consultas SNS de Saude Mental (2018–2025)",
        labels={"consultas_sns": "Consultas", "ano": "Ano", "regiao": "Regiao"},
        color_discrete_sequence=px.colors.qualitative.Safe
    )
    fig.update_layout(
        xaxis=dict(tickmode="linear", dtick=1, tickformat="d"),
        plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)", font_color="#cccccc"
    )
    fig.add_annotation(text="Fonte: SNS · Portal Transparencia · INE",
        xref="paper", yref="paper", x=0, y=-0.12, showarrow=False, font=dict(size=9, color="grey"))
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")
    st.subheader("Despesa em Saude Mental — Portugal vs. Europa")

    df_euro = df.groupby("ano")["spending_eurostat"].first().reset_index()
    df_euro = df_euro[df_euro["spending_eurostat"].notna()]

    if not df_euro.empty:
        fig2 = px.bar(df_euro, x="ano", y="spending_eurostat",
            title="Despesa em Saude Mental por ano (Eurostat)",
            labels={"spending_eurostat": "Despesa (EUR per capita)", "ano": "Ano"},
            color_discrete_sequence=["#4f8ef7"])
        fig2.update_layout(
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)",
            font_color="#cccccc", xaxis=dict(tickmode="linear", dtick=1, tickformat="d"))
        fig2.add_annotation(text="Fonte: Eurostat · hlth_sha11",
            xref="paper", yref="paper", x=0, y=-0.12, showarrow=False, font=dict(size=9, color="grey"))
        st.plotly_chart(fig2, use_container_width=True)

    st.download_button("Descarregar dados completos",
        df.to_csv(index=False).encode("utf-8"), "mindmap_dados_completos.csv", "text/csv")


# ════════════════════════════════════════════════════════════════════
# PAGINA 4 — O QUE PORTUGAL PESQUISA
# ════════════════════════════════════════════════════════════════════
elif pagina == "O que Portugal Pesquisa":

    st.title("O que Portugal Pesquisa")
    st.markdown("Indice relativo de pesquisas Google por termos de saude mental.")
    st.caption("Indice normalizado: 100 = ano com valor mais alto do periodo.")
    st.warning("Este indice e relativo, nao absoluto. Os valores foram normalizados para escala 0–100 por regiao.")
    st.markdown("---")

    df_trends = df[df["google_interest_score"].notna()].copy()

    if df_trends.empty:
        st.info("Dados de Google Trends nao disponiveis neste dataset.")
    else:
        df_trends["ano"] = df_trends["ano"].astype(int)
        for regiao in df_trends["regiao"].unique():
            mask = df_trends["regiao"] == regiao
            max_val = df_trends.loc[mask, "google_interest_score"].max()
            if max_val > 0:
                df_trends.loc[mask, "google_interest_score"] = (
                    df_trends.loc[mask, "google_interest_score"] / max_val * 100
                )

        fig = px.line(df_trends, x="ano", y="google_interest_score", color="regiao", markers=True,
            title="Interesse relativo em Saude Mental por Regiao — Indice 0 a 100",
            labels={"google_interest_score": "Indice relativo (0–100)", "ano": "Ano", "regiao": "Regiao"},
            color_discrete_sequence=px.colors.qualitative.Safe)
        fig.update_layout(
            yaxis=dict(range=[0, 110]),
            xaxis=dict(tickmode="linear", dtick=1, tickformat="d"),
            plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)", font_color="#cccccc")
        fig.add_annotation(text="Fonte: Google Trends via pytrends · Indice relativo normalizado por regiao",
            xref="paper", yref="paper", x=0, y=-0.12, showarrow=False, font=dict(size=9, color="grey"))
        st.plotly_chart(fig, use_container_width=True)
        st.caption(f"Dados disponiveis para {df_trends['regiao'].nunique()} regiao(oes).")


# ════════════════════════════════════════════════════════════════════
# PAGINA 5 — A HISTORIA COMPLETA
# ════════════════════════════════════════════════════════════════════
elif pagina == "A Historia Completa":

    st.title("A Historia Completa")
    st.markdown("---")

    CAPITULOS = [
        {
            "titulo": "O Pais que nao se ve",
            "texto": ("Portugal tem **1,07 milhoes de pessoas** com sofrimento psicologico provavel. "
                      "Metade nunca pediu ajuda. Os dados existem — dispersos em PDFs, folhas de calculo "
                      "e APIs. Ninguem os tinha cruzado num unico produto acessivel."),
            "viz": "kpi"
        },
        {
            "titulo": "Lisboa concentra tudo",
            "texto": ("A regiao de **Lisboa e Vale do Tejo** concentra a maioria das consultas de saude "
                      "mental do SNS. O Alentejo e o Algarve ficam sistematicamente para tras — "
                      "ano apos ano. O interior e o sul sao os grandes desertos do sistema."),
            "viz": "mapa"
        },
        {
            "titulo": "A tendencia nao para",
            "texto": ("As consultas tem crescido cerca de +5% ao ano em psiquiatria e +12% em psicologia. "
                      "O sistema esta a ser pressionado — mas de forma desigual entre regioes."),
            "viz": "linha"
        },
        {
            "titulo": "O que os dados nao mostram",
            "texto": ("32% da populacao adulta reportou sintomas de ansiedade em 2024. "
                      "39% das primeiras consultas hospitalares de psiquiatria excederam o tempo maximo "
                      "de resposta garantido. 66% das consultas estao concentradas em Lisboa."),
            "viz": "insights"
        },
    ]

    if "scroll_step" not in st.session_state:
        st.session_state.scroll_step = 0

    step = st.session_state.scroll_step
    capitulo = CAPITULOS[step]
    col_txt, col_viz = st.columns([1, 1.5])

    with col_txt:
        st.markdown(f"### {capitulo['titulo']}")
        st.markdown(capitulo["texto"])
        st.markdown("")
        col_prev, col_next = st.columns(2)
        if col_prev.button("Anterior") and step > 0:
            st.session_state.scroll_step = step - 1
            st.rerun()
        if col_next.button("Seguinte") and step < len(CAPITULOS) - 1:
            st.session_state.scroll_step = step + 1
            st.rerun()
        st.progress((step + 1) / len(CAPITULOS), text=f"Capitulo {step + 1} de {len(CAPITULOS)}")

    with col_viz:
        df_ultimo = df[df["ano"] == df["ano"].max()]

        if capitulo["viz"] == "kpi":
            st.metric("Pessoas com sofrimento psicologico", "1,07 M")
            st.metric("Com sintomas de ansiedade", "32%")
            st.metric("Consultas SNS (ultimo ano)",
                      f"{int(df_ultimo['consultas_sns'].sum()):,}".replace(",", " "))

        elif capitulo["viz"] == "mapa":
            fig_m = build_mapa(df_ultimo, height=350, show_colorbar=False)
            st.plotly_chart(fig_m, use_container_width=True)

        elif capitulo["viz"] == "linha":
            fig = px.line(df, x="ano", y="consultas_sns", color="regiao", markers=True,
                color_discrete_sequence=px.colors.qualitative.Safe,
                labels={"consultas_sns": "Consultas", "ano": "Ano", "regiao": "Regiao"})
            fig.update_layout(margin=dict(t=20),
                xaxis=dict(tickmode="linear", dtick=1, tickformat="d"),
                plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)", font_color="#cccccc")
            st.plotly_chart(fig, use_container_width=True)

        elif capitulo["viz"] == "insights":
            for insight in insights[3:6]:
                st.markdown(f"""
                    <div class="insight-box">
                        <div class="title">{insight['facto']}</div>
                        <div class="value">{insight['valor']}</div>
                        <div class="source">{insight['fonte']} · {insight['data_publicacao']}</div>
                    </div>
                """, unsafe_allow_html=True)