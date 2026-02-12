import { NavLink } from 'react-router-dom'
import { Home, FileText, BarChart3, CheckCircle, ListChecks, ClipboardCheck, ShieldCheck } from 'lucide-react'
import clsx from 'clsx'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
}

const navItems: NavItem[] = [
  {
    to: '/analysis',
    icon: <Home className="w-5 h-5" />,
    label: '总览',
  },
  {
    to: '/analysis/results',
    icon: <FileText className="w-5 h-5" />,
    label: '标注结果',
  },
  {
    to: '/analysis/models',
    icon: <BarChart3 className="w-5 h-5" />,
    label: '模型分析',
  },
  {
    to: '/analysis/consistency',
    icon: <CheckCircle className="w-5 h-5" />,
    label: '一致性验证',
  },
  {
    to: '/analysis/qa',
    icon: <ClipboardCheck className="w-5 h-5" />,
    label: '标注质检',
  },
  {
    to: '/analysis/qc-results',
    icon: <ShieldCheck className="w-5 h-5" />,
    label: 'QC质检结果',
  },
]

export function AnalysisSidebar() {
  return (
    <aside className="w-64 min-w-64 bg-surface-900 border-r border-surface-700/50 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-surface-700/50">
        <NavLink to="/" className="flex flex-row items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 bg-gradient-to-br from-accent-400 to-accent-600 rounded-xl flex items-center justify-center shadow-lg shadow-accent-500/20">
            <ListChecks className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">标注分析</span>
        </NavLink>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/analysis'}
                className={({ isActive }) =>
                  clsx(
                    'flex flex-row items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                    isActive
                      ? 'bg-accent-500/15 text-accent-400 shadow-sm'
                      : 'text-surface-400 hover:bg-surface-800 hover:text-white'
                  )
                }
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* Back to Annotation */}
      <div className="p-4 border-t border-surface-700/50">
        <NavLink
          to="/"
          className="flex items-center gap-2 px-3 py-2 text-sm text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-colors"
        >
          <ListChecks className="w-4 h-4" />
          <span>返回标注平台</span>
        </NavLink>
      </div>
    </aside>
  )
}
