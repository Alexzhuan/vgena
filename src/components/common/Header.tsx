import { useAnnotationStore } from '../../stores/annotationStore'
import { downloadJSON } from '../../utils'
import { 
  Download, 
  FolderOpen, 
  ChevronLeft, 
  ChevronRight,
  ListChecks,
} from 'lucide-react'

export function Header() {
  const { 
    taskPackage, 
    currentSampleIndex, 
    clearTaskPackage,
    goToNextSample,
    goToPrevSample,
    getCompletionStats,
    exportResults,
  } = useAnnotationStore()

  const stats = getCompletionStats()

  const handleExport = () => {
    if (!taskPackage) return
    const data = exportResults()
    const filename = `annotation_${taskPackage.task_id}_${new Date().toISOString().split('T')[0]}.json`
    downloadJSON(data, filename)
  }

  return (
    <header className="h-14 bg-surface-900 border-b border-surface-700 flex items-center px-4 gap-4">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
          <ListChecks className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-lg hidden sm:block">视频标注平台</span>
      </div>

      {/* Task info */}
      {taskPackage && (
        <>
          <div className="h-6 w-px bg-surface-700" />
          
          <div className="flex items-center gap-2 text-sm">
            <span className="text-surface-400">任务:</span>
            <span className="font-mono text-accent-400">{taskPackage.task_id}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-0.5 rounded bg-surface-800 text-surface-300 text-xs uppercase font-medium">
              {taskPackage.mode === 'pair' ? '对比模式' : '打分模式'}
            </span>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={goToPrevSample}
              disabled={currentSampleIndex === 0}
              className="p-1.5 rounded-lg hover:bg-surface-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="上一个 (←)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="px-3 py-1 bg-surface-800 rounded-lg text-sm font-mono">
              <span className="text-accent-400">{currentSampleIndex + 1}</span>
              <span className="text-surface-500"> / </span>
              <span className="text-surface-300">{taskPackage.samples.length}</span>
            </div>
            
            <button
              onClick={goToNextSample}
              disabled={currentSampleIndex === taskPackage.samples.length - 1}
              className="p-1.5 rounded-lg hover:bg-surface-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="下一个 (→)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="text-sm">
              <span className="text-surface-400">完成: </span>
              <span className="text-success font-medium">{stats.completed}</span>
              <span className="text-surface-500"> / {stats.total}</span>
            </div>
            
            <div className="w-24 h-1.5 bg-surface-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-accent-500 to-success transition-all duration-300"
                style={{ width: `${(stats.completed / stats.total) * 100}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={stats.completed === 0}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">导出结果</span>
            </button>
            
            <button
              onClick={clearTaskPackage}
              className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors"
              title="关闭任务"
            >
              <FolderOpen className="w-5 h-5" />
            </button>
          </div>
        </>
      )}

      {/* Empty state */}
      {!taskPackage && (
        <div className="ml-auto text-sm text-surface-500">
          请加载任务包开始标注
        </div>
      )}
    </header>
  )
}
