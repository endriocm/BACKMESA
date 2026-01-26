import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import ToastProvider from './components/ToastProvider'
import { useHashRoute } from './hooks/useHashRoute'
import { routeTitles } from './data/navigation'
import Dashboard from './pages/Dashboard'
import RevenueStructured from './pages/RevenueStructured'
import RevenueBovespa from './pages/RevenueBovespa'
import RevenueBmf from './pages/RevenueBmf'
import RevenueManual from './pages/RevenueManual'
import Vencimento from './pages/Vencimento'
import Tags from './pages/Tags'
import NotFound from './pages/NotFound'

const routeMap = {
  '/': Dashboard,
  '/receita/estruturadas': RevenueStructured,
  '/receita/bovespa': RevenueBovespa,
  '/receita/bmf': RevenueBmf,
  '/receita/manual': RevenueManual,
  '/vencimento': Vencimento,
  '/tags': Tags,
}

const crumbLookup = {
  receita: 'Receita',
  estruturadas: 'Estruturadas',
  bovespa: 'Bovespa',
  bmf: 'BMF',
  manual: 'Manual',
  vencimento: 'Vencimento',
  tags: 'Tags e Vinculos',
}

const resolvePath = (path) => {
  if (path === '/receita') return '/receita/estruturadas'
  return path
}

function App() {
  const { path, navigate } = useHashRoute('/')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const resolvedPath = resolvePath(path)
  const CurrentPage = routeMap[resolvedPath] || NotFound

  useEffect(() => {
    if (path !== resolvedPath) {
      navigate(resolvedPath)
    }
  }, [path, resolvedPath, navigate])

  const title = routeTitles[resolvedPath] || 'Painel'
  const breadcrumbs = useMemo(() => {
    if (resolvedPath === '/') return ['Dashboard']
    return resolvedPath
      .split('/')
      .filter(Boolean)
      .map((segment) => crumbLookup[segment] || segment)
  }, [resolvedPath])

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar
          currentPath={resolvedPath}
          onNavigate={() => setSidebarOpen(false)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="app-main">
          <Topbar
            title={title}
            breadcrumbs={breadcrumbs}
            onToggleSidebar={() => setSidebarOpen(true)}
            currentPath={resolvedPath}
          />
          <main className="page-content">
            <CurrentPage />
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}

export default App
