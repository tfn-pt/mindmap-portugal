export const CINEMATIC_EASE = [0.22, 1, 0.36, 1] as const

export const CINEMATIC_DURATION = {
  fast: 0.55,
  base: 0.8,
  slow: 1.15,
} as const

export const SCROLL_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025] as const

export const MAP_SCROLL_STOPS = [
  {
    regionId: 'PT11',
    label: 'Norte',
    window: [0, 0.2] as const,
    dek: 'A pressão começa no litoral denso. Volume populacional e procura clínica puxam o primeiro foco da narrativa.',
  },
  {
    regionId: 'PT16',
    label: 'Centro',
    window: [0.2, 0.4] as const,
    dek: 'O eixo interior-litoral expõe assimetrias de acesso. O mapa deixa de ser geografia e passa a ser infraestrutura.',
  },
  {
    regionId: 'PT17',
    label: 'Lisboa e Vale do Tejo',
    window: [0.4, 0.62] as const,
    dek: 'Na capital, densidade, custo de vida e procura por resposta clínica comprimem o sistema.',
  },
  {
    regionId: 'PT18',
    label: 'Alentejo',
    window: [0.62, 0.82] as const,
    dek: 'O vazio territorial altera a leitura. Distância física e cobertura irregular moldam a experiência do cuidado.',
  },
  {
    regionId: 'PT15',
    label: 'Algarve',
    window: [0.82, 1] as const,
    dek: 'No sul, sazonalidade e pressão demográfica redesenham o padrão de procura e encerram a abertura cartográfica.',
  },
] as const
