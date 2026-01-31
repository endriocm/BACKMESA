const XLSX = require('xlsx')

const normalizeHeader = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '')

const toNumber = (value) => {
  if (value == null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = String(value).trim()
  if (!raw) return null
  let cleaned = raw.replace(/[^\d,.-]/g, '')
  if (!cleaned) return null
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (hasComma) {
    cleaned = cleaned.replace(/,/g, '.')
  }
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const parseDateBr = (value) => {
  if (!value) return ''
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10)
  if (typeof value === 'number' && XLSX?.SSF?.parse_date_code) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed?.y && parsed?.m && parsed?.d) {
      const date = new Date(parsed.y, parsed.m - 1, parsed.d)
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
    }
  }
  const raw = String(value).trim()
  const match = raw.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/)
  if (match) {
    const [, day, month, year] = match
    const date = new Date(Number(year), Number(month) - 1, Number(day))
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  return ''
}

const parseStructuredReceitas = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames.find((name) => String(name || '').trim() === 'Operações')
  if (!sheetName) {
    return { ok: false, error: { code: 'SHEET_NOT_FOUND', message: 'Sheet "Operações" nao encontrada.' } }
  }
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  const headers = rows.length ? Object.keys(rows[0] || {}) : []
  const headerMap = headers.reduce((acc, header) => {
    acc[normalizeHeader(header)] = header
    return acc
  }, {})

  const required = {
    codigoCliente: 'codigocliente',
    dataInclusao: 'datainclusao',
    estrutura: 'estrutura',
    ativo: 'ativo',
    fixing: 'fixing',
    comissao: 'comissao',
  }
  const missing = Object.values(required).filter((key) => !headerMap[key])
  if (missing.length) {
    return {
      ok: false,
      error: { code: 'MISSING_COLUMN', message: 'Colunas obrigatorias ausentes.', details: { missing, headers } },
    }
  }

  let rowsValid = 0
  let rowsSkipped = 0
  let totalCommission = 0
  const months = new Set()
  const entries = rows.map((row, index) => {
    const dataInclusao = parseDateBr(row[headerMap[required.dataInclusao]])
    const comissao = toNumber(row[headerMap[required.comissao]])
    if (!dataInclusao || comissao == null) {
      rowsSkipped += 1
      return null
    }
    rowsValid += 1
    totalCommission += comissao
    months.add(dataInclusao.slice(0, 7))
    return {
      id: `estr-${index}-${Date.now()}`,
      codigoCliente: String(row[headerMap[required.codigoCliente]] || '').trim(),
      dataEntrada: dataInclusao,
      estrutura: String(row[headerMap[required.estrutura]] || '').trim(),
      ativo: String(row[headerMap[required.ativo]] || '').trim(),
      vencimento: parseDateBr(row[headerMap[required.fixing]]) || '',
      comissao,
      origem: 'Estruturadas',
      source: 'import',
    }
  }).filter(Boolean)

  return {
    ok: true,
    entries,
    summary: {
      rowsRead: rows.length,
      rowsValid,
      rowsSkipped,
      totalCommission: Number(totalCommission.toFixed(2)),
      months: Array.from(months).sort(),
      sheetUsed: sheetName,
    },
  }
}

module.exports = { parseStructuredReceitas }
