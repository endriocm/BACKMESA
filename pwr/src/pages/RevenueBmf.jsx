import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import SyncPanel from '../components/SyncPanel'
import DataTable from '../components/DataTable'
import Badge from '../components/Badge'
import Icon from '../components/Icons'
import { receitaEntries, receitaResumo } from '../data/revenue'
import { formatCurrency, formatDate } from '../utils/format'
import { useGlobalFilters } from '../contexts/GlobalFilterContext'
import { enrichRow } from '../services/tags'

const RevenueBmf = () => {
  const { selectedBroker, tagsIndex } = useGlobalFilters()
  const [filters, setFilters] = useState({ search: '', ativo: '' })

  const rows = useMemo(() => {
    return receitaEntries
      .filter((entry) => entry.origem === 'BMF')
      .map((entry) => enrichRow(entry, tagsIndex))
      .filter((entry) => {
        const query = filters.search.toLowerCase()
        if (query && !`${entry.cliente} ${entry.nomeCliente || ''} ${entry.ativo}`.toLowerCase().includes(query)) return false
        if (selectedBroker.length && !selectedBroker.includes(String(entry.broker || '').trim())) return false
        if (filters.ativo && entry.ativo !== filters.ativo) return false
        return true
      })
  }, [filters, selectedBroker, tagsIndex])

  const columns = useMemo(
    () => [
      { key: 'data', label: 'Data', render: (row) => formatDate(row.data) },
      { key: 'cliente', label: 'Cliente', render: (row) => row.nomeCliente || row.cliente },
      { key: 'assessor', label: 'Assessor' },
      { key: 'broker', label: 'Broker', render: (row) => row.broker || '—' },
      { key: 'ativo', label: 'Contrato' },
      {
        key: 'status',
        label: 'Status',
        render: (row) => <Badge tone={row.status === 'ok' ? 'green' : 'amber'}>{row.status === 'ok' ? 'OK' : 'Aviso'}</Badge>,
      },
      { key: 'valor', label: 'Valor', render: (row) => formatCurrency(row.valor) },
    ],
    [],
  )

  return (
    <div className="page">
      <PageHeader
        title="Receita BMF"
        subtitle="Monitoramento de contratos futuros e consolidacao automatica."
        meta={[
          { label: 'Periodo selecionado', value: 'Jan 2026' },
          { label: 'Ultima sync', value: receitaResumo.ultimaSync },
          { label: 'Total do mes', value: formatCurrency(3120000) },
        ]}
        actions={[{ label: 'Importar', icon: 'upload' }, { label: 'Exportar', icon: 'download', variant: 'btn-secondary' }]}
      />

      <SyncPanel label="Importacao BMF" helper="Carregue arquivos e consolide contratos futuros." />

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Entradas BMF</h3>
            <p className="muted">{rows.length} registros ativos.</p>
          </div>
          <div className="panel-actions">
            <div className="search-pill">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder="Buscar cliente ou contrato"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
            </div>
          </div>
        </div>
        <div className="filter-grid">
          <input
            className="input"
            placeholder="Contrato"
            value={filters.ativo}
            onChange={(event) => setFilters((prev) => ({ ...prev, ativo: event.target.value }))}
          />
        </div>
        <DataTable rows={rows} columns={columns} emptyMessage="Sem dados BMF." />
      </section>
    </div>
  )
}

export default RevenueBmf
