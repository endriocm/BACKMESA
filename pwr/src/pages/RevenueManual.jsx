import { useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import DataTable from '../components/DataTable'
import Badge from '../components/Badge'
import { formatCurrency, formatDate } from '../utils/format'
import { useToast } from '../hooks/useToast'
import { useGlobalFilters } from '../contexts/GlobalFilterContext'
import { enrichRow } from '../services/tags'
import { appendManualRevenue, loadManualRevenue } from '../services/revenueStore'

const RevenueManual = () => {
  const { notify } = useToast()
  const { selectedBroker, tagsIndex } = useGlobalFilters()
  const [entries, setEntries] = useState(() => loadManualRevenue())
  const [form, setForm] = useState({
    data: '2026-01-26',
    origem: 'Bovespa',
    cliente: '',
    assessor: '',
    ativo: '',
    valor: '',
  })

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!form.origem || !form.cliente || !form.assessor || !form.ativo || !form.valor) {
      notify('Preencha todos os campos obrigatorios.', 'warning')
      return
    }
    const next = {
      id: `mn-${Date.now()}`,
      data: form.data,
      origem: form.origem,
      cliente: form.cliente,
      assessor: form.assessor,
      ativo: form.ativo,
      valor: Number(form.valor),
      status: 'ok',
    }
    const nextEntries = appendManualRevenue(next)
    setEntries(nextEntries)
    notify('Lancamento manual registrado.', 'success')
    setForm((prev) => ({ ...prev, cliente: '', assessor: '', ativo: '', valor: '' }))
  }

  const columns = useMemo(
    () => [
      { key: 'data', label: 'Data', render: (row) => formatDate(row.data) },
      { key: 'cliente', label: 'Cliente', render: (row) => row.nomeCliente || row.cliente },
      { key: 'assessor', label: 'Assessor' },
      { key: 'broker', label: 'Broker', render: (row) => row.broker || '—' },
      { key: 'ativo', label: 'Ativo' },
      { key: 'valor', label: 'Valor', render: (row) => formatCurrency(row.valor) },
      { key: 'status', label: 'Status', render: () => <Badge tone="green">OK</Badge> },
    ],
    [],
  )

  const rows = useMemo(() => {
    return entries
      .map((entry) => enrichRow(entry, tagsIndex))
      .filter((entry) => {
        if (selectedBroker.length && !selectedBroker.includes(String(entry.broker || '').trim())) return false
        return true
      })
  }, [entries, selectedBroker, tagsIndex])

  return (
    <div className="page">
      <PageHeader
        title="Receita Manual"
        subtitle="Lancamentos precisos com confirmacao inteligente."
        meta={[{ label: 'Periodo selecionado', value: 'Jan 2026' }, { label: 'Entradas', value: entries.length }]}
        actions={[{ label: 'Exportar', icon: 'download', variant: 'btn-secondary' }]}
      />

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Novo lancamento</h3>
            <p className="muted">Revise os dados antes de confirmar.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Tipo
            <select className="input" value={form.origem} onChange={handleChange('origem')}>
              <option value="Bovespa">Bovespa</option>
              <option value="BMF">BMF</option>
              <option value="Estruturadas">Estruturadas</option>
            </select>
          </label>
          <label>
            Data
            <input className="input" type="date" value={form.data} onChange={handleChange('data')} />
          </label>
          <label>
            Cliente
            <input className="input" placeholder="Cliente" value={form.cliente} onChange={handleChange('cliente')} />
          </label>
          <label>
            Assessor
            <input className="input" placeholder="Assessor" value={form.assessor} onChange={handleChange('assessor')} />
          </label>
          <label>
            Ativo
            <input className="input" placeholder="Ativo" value={form.ativo} onChange={handleChange('ativo')} />
          </label>
          <label>
            Valor
            <input className="input" type="number" placeholder="Valor" value={form.valor} onChange={handleChange('valor')} />
          </label>
          <div className="form-confirm">
            <div>
              <strong>Confirmacao</strong>
              <p className="muted">Voce esta lancando {form.valor || '0'} para {form.cliente || 'cliente'} em {form.data}.</p>
            </div>
            <button className="btn btn-primary" type="submit">Confirmar lancamento</button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h3>Historico recente</h3>
            <p className="muted">Ultimos lancamentos manuais.</p>
          </div>
        </div>
        <DataTable rows={rows} columns={columns} emptyMessage="Sem lancamentos manuais." />
      </section>
    </div>
  )
}

export default RevenueManual
