import { debugLog } from './debug'

const STORAGE_PREFIX = 'pwr.tags.'
const TAGS_VERSION = 1
const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs'

const buildKey = (userKey) => `${STORAGE_PREFIX}${userKey}`

const normalizeKey = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '')

const normalizeValue = (value) => {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  return String(value).trim()
}

const toArrayBuffer = async (input) => {
  if (!input) return null
  if (input instanceof ArrayBuffer) return input
  if (ArrayBuffer.isView(input)) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
  }
  if (typeof input.arrayBuffer === 'function') {
    return input.arrayBuffer()
  }
  return null
}

const getValue = (row, keys, fallback) => {
  if (row) {
    for (const key of keys) {
      if (row[key] != null && row[key] !== '') return row[key]
    }
  }
  if (fallback != null && fallback !== '') return fallback
  return null
}

const CLIENTE_KEYS = ['cliente', 'codcliente', 'codigocliente', 'codigo', 'codigodocliente', 'conta', 'numerodaconta']
const ASSESSOR_KEYS = ['assessor', 'consultor', 'assessorresponsavel']
const BROKER_KEYS = ['broker', 'corretora', 'canaldeorigem', 'canal', 'origem']
const NOME_CLIENTE_KEYS = ['nomecliente', 'nomedocliente', 'razaosocial', 'clientenome']

const isHeaderRow = (cliente, assessor, broker, nomeCliente) => {
  const header = [cliente, assessor, broker, nomeCliente]
    .filter(Boolean)
    .map((item) => normalizeKey(item))
  return header.includes('cliente') && (header.includes('assessor') || header.includes('broker') || header.includes('nomecliente'))
}

const normalizeTagKey = (value) => {
  const raw = normalizeValue(value)
  if (!raw) return ''
  return normalizeKey(raw)
}

const looksLikeCode = (value) => {
  const raw = normalizeValue(value)
  if (!raw) return false
  return /^\d+$/.test(raw)
}

export const parseTagsXlsx = async (input) => {
  const buffer = await toArrayBuffer(input)
  if (!buffer) throw new Error('buffer-invalid')
  const XLSX = await import(/* @vite-ignore */ XLSX_URL)
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames?.[0]
  if (!sheetName) throw new Error('sheet-missing')
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const rowOffset = rawRows.length > rows.length ? 1 : 0

  const parsedRows = []
  const seen = new Set()
  const stats = { importados: 0, duplicados: 0, rejeitados: 0, avisos: 0 }

  rows.forEach((row, index) => {
    const normalizedRow = Object.keys(row).reduce((acc, key) => {
      acc[normalizeKey(key)] = row[key]
      return acc
    }, {})
    const fallbackRow = rawRows[rowOffset + index] || []

    const cliente = normalizeValue(getValue(normalizedRow, CLIENTE_KEYS, fallbackRow[0]))
    const assessor = normalizeValue(getValue(normalizedRow, ASSESSOR_KEYS, fallbackRow[1]))
    const broker = normalizeValue(getValue(normalizedRow, BROKER_KEYS, fallbackRow[2]))
    const nomeCliente = normalizeValue(getValue(normalizedRow, NOME_CLIENTE_KEYS, fallbackRow[3]))

    if (isHeaderRow(cliente, assessor, broker, nomeCliente)) return
    if (!cliente && !nomeCliente) {
      stats.rejeitados += 1
      return
    }

    const key = normalizeTagKey(cliente || nomeCliente)
    if (!key) {
      stats.rejeitados += 1
      return
    }
    if (seen.has(key)) {
      stats.duplicados += 1
      return
    }
    seen.add(key)
    if (!assessor || !broker) stats.avisos += 1

    parsedRows.push({
      cliente: cliente || '',
      assessor: assessor || '',
      broker: broker || '',
      nomeCliente: nomeCliente || '',
    })
  })

  stats.importados = parsedRows.length

  debugLog('tags.import.parse', { total: parsedRows.length, duplicados: stats.duplicados, rejeitados: stats.rejeitados })

  return {
    version: TAGS_VERSION,
    importedAt: Date.now(),
    rows: parsedRows,
    stats,
    source: 'xlsx',
    sheetName,
  }
}

export const saveTags = (userKey, payload) => {
  if (!userKey || !payload) return null
  const stored = {
    version: payload.version || TAGS_VERSION,
    importedAt: payload.importedAt || Date.now(),
    rows: payload.rows || [],
    stats: payload.stats || null,
    source: payload.source || 'unknown',
    sheetName: payload.sheetName || null,
  }
  try {
    localStorage.setItem(buildKey(userKey), JSON.stringify(stored))
  } catch {
    return null
  }
  debugLog('tags.import.saved', { total: stored.rows.length })
  return stored
}

export const loadTags = (userKey) => {
  if (!userKey) return null
  let raw = null
  try {
    raw = localStorage.getItem(buildKey(userKey))
  } catch {
    raw = null
  }
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const clearTags = (userKey) => {
  if (!userKey) return
  try {
    localStorage.removeItem(buildKey(userKey))
  } catch {
    // noop
  }
}

export const buildTagIndex = (payload) => {
  const rows = Array.isArray(payload?.rows) ? payload.rows : []
  const byCliente = new Map()
  const byNome = new Map()
  const brokers = new Set()

  rows.forEach((row) => {
    if (row?.broker) brokers.add(row.broker)
    const clienteKey = normalizeTagKey(row?.cliente)
    if (clienteKey && !byCliente.has(clienteKey)) byCliente.set(clienteKey, row)
    const nomeKey = normalizeTagKey(row?.nomeCliente)
    if (nomeKey && !byNome.has(nomeKey)) byNome.set(nomeKey, row)
  })

  return {
    rows,
    byCliente,
    byNome,
    brokers: Array.from(brokers).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  }
}

export const enrichRow = (row, tagIndex) => {
  if (!row || !tagIndex) return row
  const rawCode = row.codigoCliente || row.clienteCodigo || row.codCliente || row.cliente
  const codeKey = normalizeTagKey(rawCode)
  const nameKey = normalizeTagKey(row.nomeCliente || row.cliente)
  const tag = (codeKey && tagIndex.byCliente?.get(codeKey)) || (nameKey && tagIndex.byNome?.get(nameKey))
  if (!tag) return row

  const next = { ...row }
  if (tag.assessor) next.assessor = tag.assessor
  if (tag.broker) next.broker = tag.broker
  if (tag.nomeCliente) next.nomeCliente = tag.nomeCliente
  if (tag.cliente && !next.codigoCliente) next.codigoCliente = tag.cliente

  if (!next.cliente || looksLikeCode(next.cliente)) {
    next.cliente = tag.nomeCliente || tag.cliente || next.cliente
  }

  return next
}

export const normalizeTagLookup = (value) => normalizeTagKey(value)
