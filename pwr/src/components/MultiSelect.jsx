import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icons'

const buildLabel = (values, options, placeholder) => {
  if (!values?.length) return placeholder
  const labels = values
    .map((value) => options.find((opt) => opt.value === value)?.label || value)
    .filter(Boolean)
  if (labels.length <= 2) return labels.join(', ')
  return `${labels.length} selecionados`
}

const MultiSelect = ({
  value = [],
  options = [],
  onChange,
  placeholder = 'Selecionar',
  className = '',
  menuClassName = '',
}) => {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const label = useMemo(() => buildLabel(value, options, placeholder), [value, options, placeholder])

  useEffect(() => {
    const handleOutside = (event) => {
      if (!wrapRef.current || wrapRef.current.contains(event.target)) return
      setOpen(false)
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const toggleValue = (next) => {
    const exists = value.includes(next)
    const updated = exists ? value.filter((item) => item !== next) : [...value, next]
    onChange?.(updated)
  }

  return (
    <div className={`select-wrap ${className}`} ref={wrapRef}>
      <button
        className={`select-trigger ${open ? 'open' : ''}`}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <Icon name="arrow-down" size={14} />
      </button>
      {open ? (
        <div className={`select-menu ${menuClassName}`} role="listbox">
          {options.length ? (
            options.map((option) => {
              const checked = value.includes(option.value)
              return (
                <label key={`${option.value}`} className={`select-option ${checked ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              )
            })
          ) : (
            <div className="select-empty">Sem opcoes</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default MultiSelect
