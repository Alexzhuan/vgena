import { Outlet } from 'react-router-dom'
import { AnalysisSidebar } from './AnalysisSidebar'

export function AnalysisLayout() {
  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      <AnalysisSidebar />
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
