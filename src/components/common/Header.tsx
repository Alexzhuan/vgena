import { useState, useRef, useEffect } from 'react'
import { useAnnotationStore } from '../../stores/annotationStore'
import type { SampleStatus } from '../../stores/annotationStore'
import { downloadJSON } from '../../utils'
import { 
  Download, 
  FolderOpen, 
  ChevronLeft, 
  ChevronRight,
  ListChecks,
  ChevronDown,
  Check,
  HelpCircle,
} from 'lucide-react'
import clsx from 'clsx'

type FilterTab = 'all' | 'completed' | 'doubtful' | 'pending'

export function Header() {
  const { 
    taskPackage, 
    currentSampleIndex, 
    clearTaskPackage,
    goToNextSample,
    goToPrevSample,
    goToSample,
    getCompletionStats,
    getSampleStatus,
    exportResults,
  } = useAnnotationStore()

  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const panelRef = useRef<HTMLDivElement>(null)

  const stats = getCompletionStats()

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsPanelOpen(false)
      }
    }

    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPanelOpen])

  const handleExport = () => {
    if (!taskPackage) return
    const data = exportResults()
    const filename = `annotation_${taskPackage.task_id}_${new Date().toISOString().split('T')[0]}.json`
    downloadJSON(data, filename)
  }

  const handleSampleClick = (index: number) => {
    goToSample(index)
    setIsPanelOpen(false)
  }

  // Get filtered sample indices based on selected tab
  const getFilteredIndices = (): number[] => {
    if (!taskPackage) return []
    
    const indices: number[] = []
    for (let i = 0; i < taskPackage.samples.length; i++) {
      const status = getSampleStatus(i)
      if (filterTab === 'all') {
        indices.push(i)
      } else if (filterTab === status) {
        indices.push(i)
      }
    }
    return indices
  }

  // Count samples by status
  const getCounts = () => {
    if (!taskPackage) return { all: 0, completed: 0, doubtful: 0, pending: 0 }
    
    let completed = 0
    let doubtful = 0
    let pending = 0
    
    for (let i = 0; i < taskPackage.samples.length; i++) {
      const status = getSampleStatus(i)
      if (status === 'completed') completed++
      else if (status === 'doubtful') doubtful++
      else pending++
    }
    
    return {
      all: taskPackage.samples.length,
      completed,
      doubtful,
      pending,
    }
  }

  const counts = getCounts()
  const filteredIndices = getFilteredIndices()

  // Get status color and icon for a sample
  const getStatusStyle = (status: SampleStatus, isCurrent: boolean) => {
    const base = 'w-8 h-7 rounded text-xs font-medium flex items-center justify-center transition-all cursor-pointer hover:scale-105'
    
    if (isCurrent) {
      return clsx(base, 'ring-2 ring-accent-400 ring-offset-1 ring-offset-surface-900')
    }
    
    switch (status) {
      case 'completed':
        return clsx(base, 'bg-green-600/30 text-green-400 hover:bg-green-600/40')
      case 'doubtful':
        return clsx(base, 'bg-amber-600/30 text-amber-400 hover:bg-amber-600/40')
      default:
        return clsx(base, 'bg-surface-700 text-surface-400 hover:bg-surface-600')
    }
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

          {/* Progress - Clickable to open panel */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className={clsx(
                'flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors',
                isPanelOpen ? 'bg-surface-700' : 'hover:bg-surface-800'
              )}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400 font-medium">{stats.completed}</span>
                </span>
                <span className="flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 font-medium">{stats.doubtful}</span>
                </span>
                <span className="text-surface-500">/ {stats.total}</span>
              </div>
              
              <div className="w-20 h-1.5 bg-surface-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-accent-500 to-green-500 transition-all duration-300"
                  style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                />
              </div>
              
              <ChevronDown className={clsx(
                'w-4 h-4 text-surface-400 transition-transform',
                isPanelOpen && 'rotate-180'
              )} />
            </button>

            {/* Progress Grid Panel */}
            {isPanelOpen && (
              <div className="absolute top-full right-0 mt-2 w-96 bg-surface-800 border border-surface-600 rounded-xl shadow-xl z-50 overflow-hidden">
                {/* Filter Tabs */}
                <div className="flex border-b border-surface-700">
                  {[
                    { key: 'all', label: '全部', count: counts.all },
                    { key: 'completed', label: '已完成', count: counts.completed, color: 'text-green-400' },
                    { key: 'doubtful', label: '存疑', count: counts.doubtful, color: 'text-amber-400' },
                    { key: 'pending', label: '未完成', count: counts.pending, color: 'text-surface-400' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setFilterTab(tab.key as FilterTab)}
                      className={clsx(
                        'flex-1 px-2 py-2 text-xs font-medium transition-colors',
                        filterTab === tab.key
                          ? 'bg-surface-700 text-surface-100'
                          : 'text-surface-400 hover:text-surface-200 hover:bg-surface-750'
                      )}
                    >
                      <span className={tab.color}>{tab.count}</span>
                      <span className="ml-1">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 px-3 py-2 border-b border-surface-700 text-xs">
                  <span className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-600/30" />
                    <span className="text-surface-400">已完成</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-amber-600/30" />
                    <span className="text-surface-400">存疑</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-surface-700" />
                    <span className="text-surface-400">未完成</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded ring-2 ring-accent-400" />
                    <span className="text-surface-400">当前</span>
                  </span>
                </div>

                {/* Sample Grid */}
                <div className="max-h-48 overflow-y-auto p-3">
                  {filteredIndices.length === 0 ? (
                    <div className="text-center text-surface-500 py-4 text-sm">
                      暂无{filterTab === 'completed' ? '已完成' : filterTab === 'doubtful' ? '存疑' : filterTab === 'pending' ? '未完成' : ''}样本
                    </div>
                  ) : (
                    <div className="grid grid-cols-10 gap-1.5">
                      {filteredIndices.map((index) => {
                        const status = getSampleStatus(index)
                        const isCurrent = index === currentSampleIndex
                        return (
                          <button
                            key={index}
                            onClick={() => handleSampleClick(index)}
                            className={getStatusStyle(status, isCurrent)}
                            title={`样本 ${index + 1} - ${status === 'completed' ? '已完成' : status === 'doubtful' ? '存疑' : '未完成'}`}
                          >
                            {index + 1}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Quick Stats Footer */}
                <div className="px-3 py-2 border-t border-surface-700 bg-surface-850 text-xs text-surface-500">
                  点击样本编号可快速跳转
                </div>
              </div>
            )}
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
