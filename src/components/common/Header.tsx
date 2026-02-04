import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAnnotationStore } from '../../stores/annotationStore'
import type { SampleStatus } from '../../stores/annotationStore'
import { downloadJSON } from '../../utils'
import { ConfirmDialog } from './ConfirmDialog'
import { 
  Download, 
  FolderOpen, 
  ChevronLeft, 
  ChevronRight,
  ListChecks,
  ChevronDown,
  Check,
  HelpCircle,
  BarChart3,
  Search,
  X,
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
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

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

  // Focus search input when panel opens
  useEffect(() => {
    if (isPanelOpen && searchInputRef.current) {
      // Small delay to ensure panel is rendered
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }, [isPanelOpen])

  // Open panel and focus search with keyboard shortcut
  const openPanelWithSearch = useCallback(() => {
    setIsPanelOpen(true)
    // Focus will be handled by the useEffect above
  }, [])

  // Keyboard shortcut: Ctrl/Cmd + K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // Allow Escape to close panel even in search input
        if (e.key === 'Escape' && isPanelOpen) {
          setIsPanelOpen(false)
          setSearchQuery('')
        }
        return
      }

      // Ctrl/Cmd + K to open search panel
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (taskPackage) {
          openPanelWithSearch()
        }
      }

      // Escape to close panel
      if (e.key === 'Escape' && isPanelOpen) {
        setIsPanelOpen(false)
        setSearchQuery('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPanelOpen, taskPackage, openPanelWithSearch])

  // Check if there are any issues that should trigger export warning
  const getExportWarnings = () => {
    const warnings: string[] = []
    
    // Check for pending samples (not completed)
    if (stats.pending > 0) {
      warnings.push(`${stats.pending} 条未完成`)
    }
    
    // Check for modified samples (edited but not saved)
    if (stats.modified > 0) {
      warnings.push(`${stats.modified} 条已修改未保存`)
    }
    
    // Check for doubtful samples
    if (stats.doubtful > 0) {
      warnings.push(`${stats.doubtful} 条存疑`)
    }
    
    return warnings
  }

  const handleExport = () => {
    if (!taskPackage) return
    
    const warnings = getExportWarnings()
    
    // If there are any warnings, show confirmation dialog
    if (warnings.length > 0) {
      setIsExportDialogOpen(true)
      return
    }
    
    // No warnings, export directly
    doExport()
  }

  const doExport = () => {
    if (!taskPackage) return
    const data = exportResults()
    const filename = `annotation_${taskPackage.task_id}_${new Date().toISOString().split('T')[0]}.json`
    downloadJSON(data, filename)
  }

  const handleConfirmExport = () => {
    setIsExportDialogOpen(false)
    doExport()
  }

  const handleCancelExport = () => {
    setIsExportDialogOpen(false)
  }

  const getExportDialogMessage = () => {
    const warnings = getExportWarnings()
    if (warnings.length === 0) return ''
    
    return `当前任务存在以下问题：\n\n• ${warnings.join('\n• ')}\n\n建议先保存所有标注再导出。确定要继续导出吗？`
  }

  const handleSampleClick = (index: number) => {
    goToSample(index)
    setIsPanelOpen(false)
  }

  const handleCloseTask = () => {
    setIsCloseDialogOpen(true)
  }

  const handleConfirmClose = () => {
    setIsCloseDialogOpen(false)
    clearTaskPackage()
  }

  const handleCancelClose = () => {
    setIsCloseDialogOpen(false)
  }

  const getCloseDialogMessage = () => {
    const warnings: string[] = []
    
    if (stats.pending > 0) {
      warnings.push(`${stats.pending} 条未完成`)
    }
    if (stats.modified > 0) {
      warnings.push(`${stats.modified} 条已修改未保存`)
    }
    if (stats.doubtful > 0) {
      warnings.push(`${stats.doubtful} 条存疑`)
    }
    
    if (warnings.length > 0) {
      return `当前任务存在以下问题：\n\n• ${warnings.join('\n• ')}\n\n建议先导出结果再关闭，以免丢失标注进度。`
    }
    return '确定要关闭当前任务吗？'
  }

  // Get sample_id for a given index
  const getSampleId = (index: number): string => {
    if (!taskPackage || index < 0 || index >= taskPackage.samples.length) return ''
    return taskPackage.samples[index].sample_id
  }

  // Check if sample_id matches search query (case-insensitive fuzzy match)
  const matchesSearch = (sampleId: string): boolean => {
    if (!searchQuery.trim()) return true
    return sampleId.toLowerCase().includes(searchQuery.toLowerCase().trim())
  }

  // Get filtered sample indices based on selected tab AND search query
  const getFilteredIndices = (): number[] => {
    if (!taskPackage) return []
    
    const indices: number[] = []
    for (let i = 0; i < taskPackage.samples.length; i++) {
      const status = getSampleStatus(i)
      const sampleId = getSampleId(i)
      
      // First filter by status tab
      const matchesStatus = filterTab === 'all' || filterTab === status
      
      // Then filter by search query
      const matchesSearchQuery = matchesSearch(sampleId)
      
      if (matchesStatus && matchesSearchQuery) {
        indices.push(i)
      }
    }
    return indices
  }

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  // Clear search
  const clearSearch = () => {
    setSearchQuery('')
    searchInputRef.current?.focus()
  }

  // Handle Enter key in search to jump to first result
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const filtered = getFilteredIndices()
      if (filtered.length > 0) {
        handleSampleClick(filtered[0])
      }
    }
    if (e.key === 'Escape') {
      setIsPanelOpen(false)
      setSearchQuery('')
    }
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
                {/* Search Box */}
                <div className="p-3 border-b border-surface-700">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="搜索 sample_id..."
                      className="w-full pl-9 pr-8 py-2 bg-surface-900 border border-surface-600 rounded-lg text-sm
                                 placeholder:text-surface-500 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 
                                 transition-colors outline-none"
                    />
                    {searchQuery && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-surface-700 text-surface-400 hover:text-surface-200 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <div className="mt-2 text-xs text-surface-500">
                      找到 <span className="text-accent-400 font-medium">{filteredIndices.length}</span> 个匹配结果
                      {filteredIndices.length > 0 && <span className="ml-1">• 按 Enter 跳转到第一个</span>}
                    </div>
                  )}
                </div>

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
                      {searchQuery ? (
                        <>未找到匹配 "<span className="text-accent-400">{searchQuery}</span>" 的样本</>
                      ) : (
                        <>暂无{filterTab === 'completed' ? '已完成' : filterTab === 'doubtful' ? '存疑' : filterTab === 'pending' ? '未完成' : ''}样本</>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-10 gap-1.5">
                      {filteredIndices.map((index) => {
                        const status = getSampleStatus(index)
                        const sampleId = getSampleId(index)
                        const isCurrent = index === currentSampleIndex
                        const statusLabel = status === 'completed' ? '已完成' : status === 'doubtful' ? '存疑' : '未完成'
                        return (
                          <button
                            key={index}
                            onClick={() => handleSampleClick(index)}
                            className={getStatusStyle(status, isCurrent)}
                            title={`#${index + 1} | ${sampleId}\n状态: ${statusLabel}`}
                          >
                            {index + 1}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Quick Stats Footer */}
                <div className="px-3 py-2 border-t border-surface-700 bg-surface-850 text-xs text-surface-500 flex items-center justify-between">
                  <span>悬停查看 sample_id • 点击跳转</span>
                  <kbd className="px-1.5 py-0.5 bg-surface-700 rounded text-surface-400 font-mono">⌘K</kbd>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              to="/analysis"
              className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors"
              title="标注分析"
            >
              <BarChart3 className="w-5 h-5" />
            </Link>
            
            <button
              onClick={handleExport}
              disabled={stats.completed === 0}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-600 hover:bg-accent-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">导出结果</span>
            </button>
            
            <button
              onClick={handleCloseTask}
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
        <div className="ml-auto flex items-center gap-4">
          <span className="text-sm text-surface-500">请加载任务包开始标注</span>
          <Link
            to="/analysis"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white text-sm font-medium transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            <span>标注分析</span>
          </Link>
        </div>
      )}

      {/* Close task confirmation dialog */}
      <ConfirmDialog
        isOpen={isCloseDialogOpen}
        title="关闭任务"
        message={getCloseDialogMessage()}
        confirmText="确认关闭"
        cancelText="取消关闭"
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
        variant="warning"
      />

      {/* Export confirmation dialog */}
      <ConfirmDialog
        isOpen={isExportDialogOpen}
        title="导出确认"
        message={getExportDialogMessage()}
        confirmText="继续导出"
        cancelText="返回保存"
        onConfirm={handleConfirmExport}
        onCancel={handleCancelExport}
        variant="warning"
      />
    </header>
  )
}
