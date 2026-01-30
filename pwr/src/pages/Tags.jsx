import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import SyncPanel from '../components/SyncPanel'
import DataTable from '../components/DataTable'
import Icon from '../components/Icons'
import { formatDate } from '../utils/format'
import { parseTagsXlsx, loadTags, saveTags } from '../services/tags'
import { useGlobalFilters } from '../contexts/GlobalFilterContext'
import { useToast } from '../hooks/useToast'

const Tags = () => {
  const { notify } = useToast()
  const { userKey, refreshTags, selectedBroker } = useGlobalFilters()
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState(false)
  const [payload, setPayload] = useState(null)
  const [result, setResult] = useState(null)
  const [page, setPage] = useState(1)
  const pageSize = 200

  useEffect(() => {
    let active = true
    const load = async () => {
      const loaded = await loadTags(userKey)
      if (!active) return
      setPayload(loaded)
      setResult(loaded?.stats || null)
      setPage(1)
    }
    load()
    return () => {
      active = false
    }
  }, [userKey])

  const rows = useMemo(() => {
    const items = (payload?.rows || []).map((item, index) => (
      item.id ? item : { ...item, id: item.cliente || item.nomeCliente || `row-${index}` }
    ))
    return items.filter((item) => {
      const input = query.toLowerCase()
      if (selectedBroker && item.broker !== selectedBroker) return false
      if (!input) return true
      return `${item.cliente} ${item.nomeCliente} ${item.assessor} ${item.broker}`.toLowerCase().includes(input)
    })
  }, [payload, query, selectedBroker])

  const totalRows = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pageEnd = Math.min(pageStart + pageSize, totalRows)
  const pagedRows = rows.slice(pageStart, pageEnd)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const assessorRows = useMemo(() => {
    const map = new Map()
    rows.forEach((item) => {
      const assessor = item.assessor || 'Sem assessor'
      const broker = item.broker || 'Sem broker'
      const key = `${assessor}|||${broker}`
      const existing = map.get(key) || { id: key, assessor, broker, total: 0 }
      existing.total += 1
      map.set(key, existing)
    })
    return Array.from(map.values()).sort((a, b) => {
      if (a.broker === b.broker) return a.assessor.localeCompare(b.assessor, 'pt-BR')
      return a.broker.localeCompare(b.broker, 'pt-BR')
    })
  }, [rows])

  const columns = useMemo(
    () => [
      { key: 'cliente', label: 'Codigo cliente', render: (row) => row.cliente || '—' },
      { key: 'nomeCliente', label: 'Nome do cliente', render: (row) => row.nomeCliente || row.cliente || '—' },
      { key: 'assessor', label: 'Assessor', render: (row) => row.assessor || '—' },
      { key: 'broker', label: 'Broker', render: (row) => row.broker || '—' },
    ],
    [],
  )

  const assessorColumns = useMemo(
    () => [
      { key: 'assessor', label: 'Assessor' },
      { key: 'broker', label: 'Broker' },
      { key: 'total', label: 'Qtd clientes' },
    ],
    [],
  )

  const lastImportedAt = payload?.importedAt ? formatDate(new Date(payload.importedAt)) : '—'

  const handleSync = async (file) => {
    if (!file) {
      notify('Selecione o Tags.xlsx.', 'warning')
      return
    }
    setRunning(true)
    try {
      const parsed = await parseTagsXlsx(file)
      const saved = await saveTags(userKey, parsed)
      const nextPayload = saved || parsed
      setPayload(nextPayload)
      setResult(nextPayload?.stats || parsed.stats || null)
      await refreshTags()
      window.dispatchEvent(new CustomEvent('pwr:tags-updated', { detail: { userKey } }))
      notify('Tags importadas com sucesso.', 'success')
    } catch {
      notify('Falha ao importar Tags.xlsx.', 'warning')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Tags e Vinculos"
        subtitle="Hierarquia Cliente -> Assessor -> Broker com visibilidade total."
        meta={[
          { label: 'Total vinculos', value: payload?.rows?.length || 0 },
          { label: 'Ultima sync', value: lastImportedAt },
          { label: 'Avisos', value: result?.avisos ?? 0 },
        ]}
        actions={[{ label: 'Atualizar vinculos', icon: 'sync' }]}
      />

      <SyncPanel
        label="Sincronizacao de Vinculos"
        helper="Importe o Tags.xlsx para atualizar as tags reais."
        onSync={handleSync}
        running={running}
        result={result}
        accept=".xlsx,.xls"
      />

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Mapa de hierarquia</h3>
            <p className="muted">Visualizacao clara do relacionamento.</p>
          </div>
          <div className="panel-actions">
            <div className="muted">
              Mostrando {totalRows ? pageStart + 1 : 0}-{pageEnd} de {totalRows}
            </div>
          </div>
        </div>
        <div className="hierarchy-grid">
          {pagedRows.map((item) => (
            <div key={`${item.cliente}-${item.assessor}`} className="hierarchy-card">
              <div className="hierarchy-tier">
                <span>Cliente</span>
                <strong>{item.nomeCliente || item.cliente || '—'}</strong>
                {item.cliente ? <small className="muted">Codigo {item.cliente}</small> : null}
              </div>
              <div className="hierarchy-tier">
                <span>Assessor</span>
                <strong>{item.assessor || '—'}</strong>
              </div>
              <div className="hierarchy-tier">
                <span>Broker</span>
                <strong>{item.broker || '—'}</strong>
              </div>
            </div>
          ))}
        </div>
        {totalPages > 1 ? (
          <div className="panel-actions">
            <button className="btn btn-secondary" type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage <= 1}>
              Anterior
            </button>
            <span className="muted">Pagina {safePage} de {totalPages}</span>
            <button className="btn btn-secondary" type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage >= totalPages}>
              Proxima
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Vinculos detalhados</h3>
            <p className="muted">Impacto direto nos filtros e atribuicao de receita.</p>
          </div>
          <div className="panel-actions">
            <div className="search-pill">
              <Icon name="search" size={16} />
              <input type="search" placeholder="Buscar" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>
        </div>
        <DataTable rows={pagedRows} columns={columns} emptyMessage="Sem vinculos para exibir." />
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Tabela de assessores</h3>
            <p className="muted">Agregado por assessor e broker.</p>
          </div>
        </div>
        <DataTable rows={assessorRows} columns={assessorColumns} emptyMessage="Sem assessores para exibir." />
      </section>
    </div>
  )
}

export default Tags
