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
  const { userKey, refreshTags } = useGlobalFilters()
  const [query, setQuery] = useState('')
  const [running, setRunning] = useState(false)
  const [payload, setPayload] = useState(() => loadTags(userKey))
  const [result, setResult] = useState(payload?.stats || null)

  useEffect(() => {
    const loaded = loadTags(userKey)
    setPayload(loaded)
    setResult(loaded?.stats || null)
  }, [userKey])

  const rows = useMemo(() => {
    const items = payload?.rows || []
    return items.filter((item) => {
      const input = query.toLowerCase()
      if (!input) return true
      return `${item.cliente} ${item.nomeCliente} ${item.assessor} ${item.broker}`.toLowerCase().includes(input)
    })
  }, [payload, query])

  const columns = useMemo(
    () => [
      { key: 'cliente', label: 'Codigo cliente', render: (row) => row.cliente || '—' },
      { key: 'nomeCliente', label: 'Nome do cliente', render: (row) => row.nomeCliente || row.cliente || '—' },
      { key: 'assessor', label: 'Assessor', render: (row) => row.assessor || '—' },
      { key: 'broker', label: 'Broker', render: (row) => row.broker || '—' },
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
      const saved = saveTags(userKey, parsed)
      setPayload(saved)
      setResult(saved?.stats || parsed.stats || null)
      refreshTags()
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
        </div>
        <div className="hierarchy-grid">
          {rows.map((item) => (
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
        <DataTable rows={rows} columns={columns} emptyMessage="Sem vinculos para exibir." />
      </section>
    </div>
  )
}

export default Tags
