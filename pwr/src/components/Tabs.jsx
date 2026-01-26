const Tabs = ({ tabs, active, onChange }) => {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          className={`tab ${active === tab.value ? 'active' : ''}`}
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default Tabs
