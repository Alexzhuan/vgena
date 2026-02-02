import { useAnalysisStore } from '../../stores/analysisStore'
import { Loader2 } from 'lucide-react'

interface AnalysisHeaderProps {
  title: string
  subtitle?: string
}

export function AnalysisHeader({ title, subtitle }: AnalysisHeaderProps) {
  const { pairResults, scoreResults, isLoading } = useAnalysisStore()
  
  return (
    <header className="h-16 min-h-16 bg-surface-900/80 backdrop-blur-sm border-b border-surface-700 flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {subtitle && (
          <p className="text-sm text-surface-400">{subtitle}</p>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {/* Data status indicators */}
        <div className="flex items-center gap-4 text-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 text-surface-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>加载中...</span>
            </div>
          ) : (
            <>
              {pairResults && (
                <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-green-400 font-medium">
                    Pair: {pairResults.completed_samples} 样本
                  </span>
                </div>
              )}
              {scoreResults && (
                <div className="flex items-center gap-2 bg-sky-500/10 px-3 py-1.5 rounded-lg border border-sky-500/20">
                  <span className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
                  <span className="text-sky-400 font-medium">
                    Score: {scoreResults.completed_samples} 样本
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
