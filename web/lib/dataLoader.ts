/**
 * Data loading utilities for MindMap Portugal
 * Auto-detects European (;) and Standard (,) CSV formats.
 */

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

export async function fetchCSVData(filename: string): Promise<string> {
  const response = await fetch(`/data/${filename}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${filename}: ${response.statusText}`)
  }
  return response.text()
}

export async function fetchJSONData(filename: string): Promise<unknown> {
  const response = await fetch(`/data/${filename}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${filename}: ${response.statusText}`)
  }
  return response.json()
}

// ─── Robust Auto-Detecting CSV Parser ──────────────────────────────────────────

export function parseCSV(csvString: string): Record<string, string>[] {
  const normalized = csvString.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  
  // AUTO-DETECT DELIMITER: Look at the first line to see what separator it uses.
  const firstLine = normalized.split('\n')[0] || ''
  const delimiter = firstLine.includes(';') ? ';' : ','

  const rows = tokenizeCSV(normalized, delimiter)

  if (rows.length < 2) return []

  const headers = rows[0].map(h => h.trim())
  const result: Record<string, string>[] = []

  for (let i = 1; i < rows.length; i++) {
    if (rows[i].length === 1 && rows[i][0] === '') continue

    const obj: Record<string, string> = {}
    headers.forEach((header, idx) => {
      obj[header] = rows[i][idx]?.trim() ?? ''
    })
    result.push(obj)
  }

  return result
}

function tokenizeCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        cell += ch
        i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
      } else if (ch === delimiter) { // <--- SMART DELIMITER INJECTED HERE
        row.push(cell)
        cell = ''
        i++
      } else if (ch === '\n') {
        row.push(cell)
        cell = ''
        rows.push(row)
        row = []
        i++
      } else {
        cell += ch
        i++
      }
    }
  }

  row.push(cell)
  rows.push(row)

  return rows
}

// ─── Domain loaders ────────────────────────────────────────────────────────────

export async function loadDashboardData(): Promise<Record<string, string>[]> {
  try {
    const csv = await fetchCSVData('dashboard_main.csv')
    return parseCSV(csv)
  } catch (error) {
    console.error('Error loading dashboard data:', error)
    return []
  }
}

export async function loadStudyInsights(): Promise<unknown> {
  try {
    return await fetchJSONData('study_insights.json')
  } catch (error) {
    console.error('Error loading study insights:', error)
    return null
  }
}

export async function loadGoogleTrendsData(): Promise<Record<string, string>[]> {
  try {
    const csv = await fetchCSVData('google_trends_saude_mental_pt.csv')
    return parseCSV(csv)
  } catch (error) {
    console.error('Error loading Google Trends data:', error)
    return []
  }
}

// ─── Number helpers ─────────────────────────────────────────────────────────────

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000)     return (num / 1_000).toFixed(1) + 'K'
  return num.toString()
}

export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return 0
  return ((newValue - oldValue) / oldValue) * 100
}

export function normalizeToPercentage(value: number, min: number, max: number): number {
  if (max === min) return 0
  return ((value - min) / (max - min)) * 100
}