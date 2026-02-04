import { useState, useCallback, useMemo } from 'react'
import { AnalysisHeader, VideoCompare } from '../../components/analysis'
import { ImageModal } from '../../components/common'
import { useQAStore } from '../../stores/qaStore'
import { DIMENSION_LABELS, DIMENSIONS } from '../../types'
import type { 
  QAPairSampleResult, 
  QAScoreSampleResult,
  QAPairStats,
  QAScoreStats,
  QAScoreDimensionMismatch,
  QAPairDimensionMismatch,
} from '../../types/analysis'
import type { Dimension } from '../../types'
import { getProblemLevelLabel } from '../../utils/analysis/qa'
import { 
  Upload, 
  X, 
  FileCheck, 
  Trash2, 
  Play, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Search,
  Image,
  Users,
  ChevronDown,
} from 'lucide-react'
import clsx from 'clsx'

export function AnalysisQA() {
  const {
    mode,
    goldenFileInfo,
    annotatorFileInfos,
    qaPairStats,
    qaScoreStats,
    isLoading,
    error,
    hasGoldenSet,
    hasAnnotatorData,
    canCalculateQA,
    setMode,
    loadGoldenSet,
    loadAnnotatorResults,
    calculateQA,
    clearAll,
    clearGoldenSet,
    clearAnnotatorData,
    // Annotator selection
    selectedAnnotatorId,
    annotatorIds,
    setSelectedAnnotatorId,
    getFilteredPairStats,
    getFilteredScoreStats,
  } = useQAStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPairSample, setSelectedPairSample] = useState<QAPairSampleResult | null>(null)
  const [selectedScoreSample, setSelectedScoreSample] = useState<QAScoreSampleResult | null>(null)
  const [showAnnotatorDropdown, setShowAnnotatorDropdown] = useState(false)
  
  // Get filtered stats based on selected annotator
  const filteredPairStats = getFilteredPairStats()
  const filteredScoreStats = getFilteredScoreStats()

  // File drop handlers
  const handleGoldenFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.json')) {
      const text = await file.text()
      const content = JSON.parse(text)
      loadGoldenSet(content, file.name)
    }
  }, [loadGoldenSet])

  const handleAnnotatorFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'))
    const parsedFiles = await Promise.all(
      files.map(async (file) => {
        const text = await file.text()
        const content = JSON.parse(text)
        return { content, fileName: file.name }
      })
    )
    loadAnnotatorResults(parsedFiles)
  }, [loadAnnotatorResults])

  const handleGoldenFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.name.endsWith('.json')) {
      const text = await file.text()
      const content = JSON.parse(text)
      loadGoldenSet(content, file.name)
    }
    e.target.value = ''
  }, [loadGoldenSet])

  const handleAnnotatorFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.name.endsWith('.json'))
    const parsedFiles = await Promise.all(
      files.map(async (file) => {
        const text = await file.text()
        const content = JSON.parse(text)
        return { content, fileName: file.name }
      })
    )
    loadAnnotatorResults(parsedFiles)
    e.target.value = ''
  }, [loadAnnotatorResults])

  const stats = mode === 'pair' ? qaPairStats : qaScoreStats

  return (
    <div className="flex flex-col h-full bg-surface-950">
      <AnalysisHeader title="标注质检" subtitle="Golden Set 与标注结果一致性检查" />
      
      <div className="flex-1 overflow-auto p-6">
        {/* Mode Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex bg-surface-900 rounded-xl p-1 border border-surface-800">
            <button
              onClick={() => setMode('pair')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                mode === 'pair'
                  ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              Pair 模式
            </button>
            <button
              onClick={() => setMode('score')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                mode === 'score'
                  ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              Score 模式
            </button>
          </div>

          {(hasGoldenSet() || hasAnnotatorData()) && (
            <button
              onClick={clearAll}
              className="flex items-center gap-2 px-4 py-2 text-sm text-surface-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              清空所有
            </button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Section */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Golden Set Upload */}
          <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-800 bg-surface-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <FileCheck className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="font-semibold text-white">Golden Set (标准答案)</h3>
              </div>
              {goldenFileInfo && (
                <button
                  onClick={clearGoldenSet}
                  className="text-surface-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="p-5">
              {goldenFileInfo ? (
                <div className="flex items-center gap-3 p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{goldenFileInfo.name}</p>
                    <p className="text-xs text-surface-400">{goldenFileInfo.sampleCount} 个样本</p>
                  </div>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-surface-700 rounded-xl cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleGoldenFileDrop}
                >
                  <Upload className="w-8 h-8 text-surface-500 mb-2" />
                  <span className="text-sm text-surface-400">拖拽或点击上传 Golden Set</span>
                  <span className="text-xs text-surface-500 mt-1">支持 .json 文件</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleGoldenFileSelect}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Annotator Results Upload */}
          <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-800 bg-surface-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
                  <FileCheck className="w-4 h-4 text-sky-400" />
                </div>
                <h3 className="font-semibold text-white">标注员结果</h3>
              </div>
              {annotatorFileInfos.length > 0 && (
                <button
                  onClick={clearAnnotatorData}
                  className="text-surface-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="p-5">
              {annotatorFileInfos.length > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {annotatorFileInfos.map((info, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-3 p-3 bg-sky-500/10 rounded-lg border border-sky-500/20"
                    >
                      <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{info.name}</p>
                        <p className="text-xs text-surface-400">
                          {info.sampleCount} 样本 · {info.annotatorId}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-surface-700 rounded-xl cursor-pointer hover:border-sky-500/50 hover:bg-sky-500/5 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleAnnotatorFileDrop}
                >
                  <Upload className="w-8 h-8 text-surface-500 mb-2" />
                  <span className="text-sm text-surface-400">拖拽或点击上传标注结果</span>
                  <span className="text-xs text-surface-500 mt-1">支持多个 .json 文件</span>
                  <input
                    type="file"
                    accept=".json"
                    multiple
                    className="hidden"
                    onChange={handleAnnotatorFileSelect}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Calculate Button */}
        {canCalculateQA() && !stats && (
          <div className="mb-6 flex justify-center">
            <button
              onClick={calculateQA}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-accent-600 hover:bg-accent-500 disabled:bg-surface-700 text-white rounded-xl font-medium transition-colors"
            >
              <Play className="w-5 h-5" />
              {isLoading ? '计算中...' : '开始质检'}
            </button>
          </div>
        )}

        {/* QA Results */}
        {stats && (
          <>
            {/* Annotator Selector */}
            {annotatorIds.length > 0 && (
              <div className="mb-6 flex items-center gap-4">
                <div className="flex items-center gap-2 text-surface-400">
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-medium">标注员筛选：</span>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowAnnotatorDropdown(!showAnnotatorDropdown)}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm hover:bg-surface-700 transition-colors min-w-[160px]"
                  >
                    <span className={selectedAnnotatorId ? 'text-cyan-400 font-medium' : 'text-surface-300'}>
                      {selectedAnnotatorId || '全部标注员'}
                    </span>
                    <ChevronDown className={clsx('w-4 h-4 text-surface-400 transition-transform', showAnnotatorDropdown && 'rotate-180')} />
                  </button>
                  
                  {showAnnotatorDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-20 py-1 max-h-60 overflow-y-auto">
                      <button
                        onClick={() => { setSelectedAnnotatorId(null); setShowAnnotatorDropdown(false) }}
                        className={clsx(
                          'w-full px-4 py-2 text-left text-sm hover:bg-surface-700 transition-colors',
                          !selectedAnnotatorId ? 'text-accent-400 font-medium bg-surface-700/50' : 'text-surface-300'
                        )}
                      >
                        全部标注员
                      </button>
                      {annotatorIds.map(id => (
                        <button
                          key={id}
                          onClick={() => { setSelectedAnnotatorId(id); setShowAnnotatorDropdown(false) }}
                          className={clsx(
                            'w-full px-4 py-2 text-left text-sm hover:bg-surface-700 transition-colors',
                            selectedAnnotatorId === id ? 'text-cyan-400 font-medium bg-surface-700/50' : 'text-surface-300'
                          )}
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {selectedAnnotatorId && (
                  <span className="text-xs text-surface-500">
                    当前查看 <span className="text-cyan-400">{selectedAnnotatorId}</span> 的质检结果
                  </span>
                )}
              </div>
            )}
            
            {mode === 'pair' && filteredPairStats && (
              <PairQAResults 
                stats={filteredPairStats} 
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSelectSample={setSelectedPairSample}
                showAnnotatorTable={!selectedAnnotatorId}
              />
            )}
            {mode === 'score' && filteredScoreStats && (
              <ScoreQAResults 
                stats={filteredScoreStats}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSelectSample={setSelectedScoreSample}
                showAnnotatorTable={!selectedAnnotatorId}
              />
            )}
          </>
        )}

        {/* Match Rules Explanation */}
        {!stats && (
          <div className="mt-6 bg-surface-900 rounded-2xl border border-surface-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">质检规则说明</h3>
            
            <div className="grid grid-cols-2 gap-6">
              {mode === 'pair' ? (
                <>
                  <div className="bg-surface-800/30 rounded-xl p-4 border border-surface-700/50">
                    <h4 className="font-semibold text-green-400 mb-3">Hard Match（严格模式）</h4>
                    <p className="text-sm text-surface-300">
                      所有 5 个维度的 comparison 结果必须与 Golden Set 完全一致
                    </p>
                    <p className="text-xs text-surface-500 mt-2">
                      示例：Golden Set 为 A&gt;B，标注结果也必须为 A&gt;B
                    </p>
                  </div>
                  <div className="bg-surface-800/30 rounded-xl p-4 border border-surface-700/50">
                    <h4 className="font-semibold text-sky-400 mb-3">Soft Match（维度一致率）</h4>
                    <p className="text-sm text-surface-300">
                      计算 5 个维度中有多少维度与 Golden Set 一致
                    </p>
                    <p className="text-xs text-surface-500 mt-2">
                      示例：5 个维度中 4 个一致 → Soft Match = 80%
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-surface-800/30 rounded-xl p-4 border border-surface-700/50">
                    <h4 className="font-semibold text-green-400 mb-3">Hard Match（严格模式）</h4>
                    <p className="text-sm text-surface-300">
                      所有 5 个维度的分数必须与 Golden Set 完全相同
                    </p>
                    <p className="text-xs text-surface-500 mt-2">
                      示例：Golden Set 为 4 分，标注结果也必须为 4 分
                    </p>
                  </div>
                  <div className="bg-surface-800/30 rounded-xl p-4 border border-surface-700/50">
                    <h4 className="font-semibold text-sky-400 mb-3">Soft Match（问题等级一致）</h4>
                    <p className="text-sm text-surface-300">
                      问题等级相同即算一致：5分=无问题，3-4分=次要问题，1-2分=主要问题
                    </p>
                    <p className="text-xs text-surface-500 mt-2">
                      示例：Golden Set 为 4 分（minor），标注 3 分（minor）→ 一致
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modals */}
      {selectedPairSample && (
        <PairSampleDetailModal
          sample={selectedPairSample}
          onClose={() => setSelectedPairSample(null)}
        />
      )}
      {selectedScoreSample && (
        <ScoreSampleDetailModal
          sample={selectedScoreSample}
          onClose={() => setSelectedScoreSample(null)}
        />
      )}
    </div>
  )
}

// Pair QA Results Component
interface PairQAResultsProps {
  stats: QAPairStats
  searchQuery: string
  setSearchQuery: (q: string) => void
  onSelectSample: (s: QAPairSampleResult) => void
  showAnnotatorTable?: boolean
}

function PairQAResults({ stats, searchQuery, setSearchQuery, onSelectSample, showAnnotatorTable = true }: PairQAResultsProps) {
  const [selectedDimension, setSelectedDimension] = useState<Dimension | 'all'>('all')
  
  // Filter dimension mismatches based on search and dimension filter
  const filteredDimensionMismatches = useMemo(() => {
    let filtered = stats.dimensionMismatches
    
    // Filter by dimension
    if (selectedDimension !== 'all') {
      filtered = filtered.filter(s => s.dimension === selectedDimension)
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(s => 
        s.sampleId.toLowerCase().includes(query) ||
        s.annotatorId.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }, [stats.dimensionMismatches, selectedDimension, searchQuery])
  
  // Calculate per-annotator stats for selected dimension
  const dimensionAnnotatorStats = useMemo(() => {
    if (selectedDimension === 'all') {
      return stats.byAnnotator
    }
    
    // Calculate stats for the selected dimension
    const annotatorMap: Record<string, { total: number; matchCount: number }> = {}
    
    stats.allSampleResults.forEach(sample => {
      const annotatorId = sample.annotatorId
      if (!annotatorMap[annotatorId]) {
        annotatorMap[annotatorId] = { total: 0, matchCount: 0 }
      }
      
      const dimResult = sample.dimensionResults.find(d => d.dimension === selectedDimension)
      if (dimResult) {
        annotatorMap[annotatorId].total++
        if (dimResult.isMatch) {
          annotatorMap[annotatorId].matchCount++
        }
      }
    })
    
    // Convert to the same format as stats.byAnnotator
    const result: Record<string, { total: number; avgSoftMatchRate: number }> = {}
    Object.entries(annotatorMap).forEach(([annotatorId, data]) => {
      result[annotatorId] = {
        total: data.total,
        avgSoftMatchRate: data.total > 0 ? data.matchCount / data.total : 0
      }
    })
    
    return result
  }, [stats.allSampleResults, stats.byAnnotator, selectedDimension])

  return (
    <>
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="总样本数"
          value={stats.totalSamples}
          color="surface"
        />
        <StatCard
          title="Hard Match 数量"
          value={stats.hardMatchCount}
          subtitle={`${(stats.hardMatchRate * 100).toFixed(1)}%`}
          color="green"
        />
        <StatCard
          title="平均维度一致率"
          value={`${(stats.avgSoftMatchRate * 100).toFixed(1)}%`}
          color="sky"
        />
        <StatCard
          title="不一致样本"
          value={stats.mismatchedSamples.length}
          color="red"
        />
      </div>

      {/* Dimension Breakdown */}
      <div className="bg-surface-900 rounded-2xl border border-surface-800 mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-800 bg-surface-900/50">
          <h2 className="text-lg font-semibold text-white">分维度一致率</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-5 gap-4">
            {DIMENSIONS.map((dim) => {
              const dimStats = stats.byDimension[dim]
              return (
                <div
                  key={dim}
                  className={clsx(
                    'bg-surface-800/50 rounded-xl p-4 cursor-pointer transition-all border',
                    selectedDimension === dim 
                      ? 'ring-2 ring-accent-500 border-accent-500/50' 
                      : 'border-surface-700/50 hover:bg-surface-800 hover:border-surface-600'
                  )}
                  onClick={() => setSelectedDimension(selectedDimension === dim ? 'all' : dim)}
                >
                  <div className="text-sm text-surface-400 mb-2 font-medium">
                    {DIMENSION_LABELS[dim]}
                  </div>
                  <div className={clsx(
                    'text-2xl font-bold mb-1',
                    dimStats.matchRate >= 0.8 ? 'text-green-400' :
                    dimStats.matchRate >= 0.6 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {(dimStats.matchRate * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-surface-500">
                    {dimStats.matchCount} / {dimStats.total}
                  </div>
                  <div className="mt-3 h-2 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all',
                        dimStats.matchRate >= 0.8 ? 'bg-green-500' :
                        dimStats.matchRate >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
                      )}
                      style={{ width: `${dimStats.matchRate * 100}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Annotator Breakdown - only show when viewing all annotators */}
      {showAnnotatorTable && Object.keys(dimensionAnnotatorStats).length > 1 && (
        <div className="bg-surface-900 rounded-2xl border border-surface-800 mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-800 bg-surface-900/50">
            <h2 className="text-lg font-semibold text-white">
              分标注人员统计
              {selectedDimension !== 'all' && (
                <span className="text-sm font-normal text-surface-400 ml-2">
                  （{DIMENSION_LABELS[selectedDimension]}）
                </span>
              )}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-surface-400 text-sm border-b border-surface-800 bg-surface-900/30">
                  <th className="px-6 py-4 font-medium">标注人员</th>
                  <th className="px-6 py-4 font-medium">样本数</th>
                  <th className="px-6 py-4 font-medium">
                    {selectedDimension === 'all' ? '平均维度一致率' : '一致率'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/50">
                {Object.entries(dimensionAnnotatorStats).map(([annotatorId, annotatorStats]) => (
                  <tr key={annotatorId} className="hover:bg-surface-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-cyan-400">{annotatorId}</td>
                    <td className="px-6 py-4 text-surface-300">{annotatorStats.total}</td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'font-medium',
                        annotatorStats.avgSoftMatchRate >= 0.8 ? 'text-green-400' :
                        annotatorStats.avgSoftMatchRate >= 0.6 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {(annotatorStats.avgSoftMatchRate * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mismatched Samples - Per Dimension */}
      <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-900/50 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-white">
            不一致样本列表
            {selectedDimension !== 'all' && (
              <span className="text-sm font-normal text-surface-400 ml-2">
                （筛选：{DIMENSION_LABELS[selectedDimension]}）
              </span>
            )}
            <span className="text-sm font-normal text-surface-400 ml-2">
              （共 {filteredDimensionMismatches.length} 条）
            </span>
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              placeholder="搜索 Sample ID 或标注人员..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500 w-56"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-surface-400 text-sm border-b border-surface-800 bg-surface-900/30">
                <th className="px-4 py-4 font-medium">Sample ID</th>
                <th className="px-4 py-4 font-medium">标注人员</th>
                <th className="px-4 py-4 font-medium">Model A</th>
                <th className="px-4 py-4 font-medium">Model B</th>
                <th className="px-4 py-4 font-medium">维度</th>
                <th className="px-4 py-4 font-medium">Golden</th>
                <th className="px-4 py-4 font-medium">标注</th>
                <th className="px-4 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/50">
              {filteredDimensionMismatches.slice(0, 100).map((item, idx) => (
                <tr key={`${item.sampleId}-${item.dimension}-${idx}`} className="hover:bg-surface-800/30 transition-colors">
                  <td className="px-4 py-4">
                    <span className="text-sm text-white font-medium truncate block max-w-[180px]" title={item.sampleId}>
                      {item.sampleId}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-cyan-400 font-medium">{item.annotatorId}</td>
                  <td className="px-4 py-4 text-sm text-accent-400">{item.videoAModel || '-'}</td>
                  <td className="px-4 py-4 text-sm text-orange-400">{item.videoBModel || '-'}</td>
                  <td className="px-4 py-4 text-sm text-surface-200 font-medium">{DIMENSION_LABELS[item.dimension]}</td>
                  <td className="px-4 py-4">
                    <span className={clsx(
                      'px-2.5 py-1 rounded-lg text-sm font-bold',
                      item.goldenComparison === 'A>B' ? 'bg-green-500/15 text-green-400' :
                      item.goldenComparison === 'A<B' ? 'bg-red-500/15 text-red-400' :
                      'bg-surface-700 text-surface-400'
                    )}>
                      {item.goldenComparison}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={clsx(
                      'px-2.5 py-1 rounded-lg text-sm font-bold',
                      item.annotatorComparison === 'A>B' ? 'bg-green-500/15 text-green-400' :
                      item.annotatorComparison === 'A<B' ? 'bg-red-500/15 text-red-400' :
                      'bg-surface-700 text-surface-400'
                    )}>
                      {item.annotatorComparison}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => {
                        // Find the full sample result to show in modal
                        const fullSample = stats.allSampleResults.find(
                          s => s.sampleId === item.sampleId && s.annotatorId === item.annotatorId
                        )
                        if (fullSample) {
                          onSelectSample(fullSample)
                        }
                      }}
                      className="px-3 py-1.5 bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium rounded-lg"
                    >
                      详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredDimensionMismatches.length === 0 && (
            <div className="p-12 text-center text-surface-500">
              {stats.dimensionMismatches.length === 0 ? '所有维度均一致！' : '没有找到匹配的结果'}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Score QA Results Component
interface ScoreQAResultsProps {
  stats: QAScoreStats
  searchQuery: string
  setSearchQuery: (q: string) => void
  onSelectSample: (s: QAScoreSampleResult) => void
  showAnnotatorTable?: boolean
}

function ScoreQAResults({ stats, searchQuery, setSearchQuery, onSelectSample, showAnnotatorTable = true }: ScoreQAResultsProps) {
  const [selectedDimension, setSelectedDimension] = useState<Dimension | 'all'>('all')
  
  // Filter dimension mismatches based on search and dimension filter
  const filteredDimensionMismatches = useMemo(() => {
    let filtered = stats.dimensionMismatches
    
    // Filter by dimension
    if (selectedDimension !== 'all') {
      filtered = filtered.filter(s => s.dimension === selectedDimension)
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(s => 
        s.sampleId.toLowerCase().includes(query) ||
        s.annotatorId.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }, [stats.dimensionMismatches, selectedDimension, searchQuery])
  
  // Calculate per-annotator stats for selected dimension
  const dimensionAnnotatorStats = useMemo(() => {
    if (selectedDimension === 'all') {
      return stats.byAnnotator
    }
    
    // Calculate stats for the selected dimension
    const annotatorMap: Record<string, { total: number; exactMatchCount: number; levelMatchCount: number }> = {}
    
    stats.allSampleResults.forEach(sample => {
      const annotatorId = sample.annotatorId
      if (!annotatorMap[annotatorId]) {
        annotatorMap[annotatorId] = { total: 0, exactMatchCount: 0, levelMatchCount: 0 }
      }
      
      const dimResult = sample.dimensionResults.find(d => d.dimension === selectedDimension)
      if (dimResult) {
        annotatorMap[annotatorId].total++
        if (dimResult.isExactMatch) {
          annotatorMap[annotatorId].exactMatchCount++
        }
        if (dimResult.isLevelMatch) {
          annotatorMap[annotatorId].levelMatchCount++
        }
      }
    })
    
    // Convert to the same format as stats.byAnnotator
    const result: Record<string, { total: number; avgExactMatchRate: number; avgLevelMatchRate: number }> = {}
    Object.entries(annotatorMap).forEach(([annotatorId, data]) => {
      result[annotatorId] = {
        total: data.total,
        avgExactMatchRate: data.total > 0 ? data.exactMatchCount / data.total : 0,
        avgLevelMatchRate: data.total > 0 ? data.levelMatchCount / data.total : 0
      }
    })
    
    return result
  }, [stats.allSampleResults, stats.byAnnotator, selectedDimension])

  return (
    <>
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <StatCard
          title="总样本数"
          value={stats.totalSamples}
          color="surface"
        />
        <StatCard
          title="Hard Match"
          value={stats.hardMatchCount}
          subtitle={`${(stats.hardMatchRate * 100).toFixed(1)}%`}
          color="green"
        />
        <StatCard
          title="Soft Match"
          value={stats.softMatchCount}
          subtitle={`${(stats.softMatchRate * 100).toFixed(1)}%`}
          color="sky"
        />
        <StatCard
          title="平均 Hard Match"
          value={`${(stats.avgExactMatchRate * 100).toFixed(1)}%`}
          color="amber"
        />
        <StatCard
          title="平均 Soft Match"
          value={`${(stats.avgLevelMatchRate * 100).toFixed(1)}%`}
          color="purple"
        />
      </div>

      {/* Dimension Breakdown */}
      <div className="bg-surface-900 rounded-2xl border border-surface-800 mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-800 bg-surface-900/50">
          <h2 className="text-lg font-semibold text-white">分维度一致率</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-5 gap-4">
            {DIMENSIONS.map((dim) => {
              const dimStats = stats.byDimension[dim]
              return (
                <div
                  key={dim}
                  className={clsx(
                    'bg-surface-800/50 rounded-xl p-4 cursor-pointer transition-all border',
                    selectedDimension === dim 
                      ? 'ring-2 ring-accent-500 border-accent-500/50' 
                      : 'border-surface-700/50 hover:bg-surface-800 hover:border-surface-600'
                  )}
                  onClick={() => setSelectedDimension(selectedDimension === dim ? 'all' : dim)}
                >
                  <div className="text-sm text-surface-400 mb-2 font-medium">
                    {DIMENSION_LABELS[dim]}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-surface-500 mb-1">Hard Match</div>
                      <div className={clsx(
                        'text-lg font-bold',
                        dimStats.exactMatchRate >= 0.8 ? 'text-green-400' :
                        dimStats.exactMatchRate >= 0.6 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {(dimStats.exactMatchRate * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-surface-500 mb-1">Soft Match</div>
                      <div className={clsx(
                        'text-lg font-bold',
                        dimStats.levelMatchRate >= 0.8 ? 'text-green-400' :
                        dimStats.levelMatchRate >= 0.6 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {(dimStats.levelMatchRate * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-surface-500 mt-2">
                    {dimStats.exactMatchCount} / {dimStats.total}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Annotator Breakdown - only show when viewing all annotators */}
      {showAnnotatorTable && Object.keys(dimensionAnnotatorStats).length > 1 && (
        <div className="bg-surface-900 rounded-2xl border border-surface-800 mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-800 bg-surface-900/50">
            <h2 className="text-lg font-semibold text-white">
              分标注人员统计
              {selectedDimension !== 'all' && (
                <span className="text-sm font-normal text-surface-400 ml-2">
                  （{DIMENSION_LABELS[selectedDimension]}）
                </span>
              )}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-surface-400 text-sm border-b border-surface-800 bg-surface-900/30">
                  <th className="px-6 py-4 font-medium">标注人员</th>
                  <th className="px-6 py-4 font-medium">样本数</th>
                  <th className="px-6 py-4 font-medium">
                    {selectedDimension === 'all' ? '平均 Hard Match' : 'Hard Match'}
                  </th>
                  <th className="px-6 py-4 font-medium">
                    {selectedDimension === 'all' ? '平均 Soft Match' : 'Soft Match'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/50">
                {Object.entries(dimensionAnnotatorStats).map(([annotatorId, annotatorStats]) => (
                  <tr key={annotatorId} className="hover:bg-surface-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-cyan-400">{annotatorId}</td>
                    <td className="px-6 py-4 text-surface-300">{annotatorStats.total}</td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'font-medium',
                        annotatorStats.avgExactMatchRate >= 0.8 ? 'text-green-400' :
                        annotatorStats.avgExactMatchRate >= 0.6 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {(annotatorStats.avgExactMatchRate * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'font-medium',
                        annotatorStats.avgLevelMatchRate >= 0.8 ? 'text-green-400' :
                        annotatorStats.avgLevelMatchRate >= 0.6 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {(annotatorStats.avgLevelMatchRate * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mismatched Samples - Per Dimension */}
      <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-900/50 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-white">
            不一致样本列表
            {selectedDimension !== 'all' && (
              <span className="text-sm font-normal text-surface-400 ml-2">
                （筛选：{DIMENSION_LABELS[selectedDimension]}）
              </span>
            )}
            <span className="text-sm font-normal text-surface-400 ml-2">
              （共 {filteredDimensionMismatches.length} 条）
            </span>
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              placeholder="搜索 Sample ID 或标注人员..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-800 border border-surface-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500 w-56"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-surface-400 text-sm border-b border-surface-800 bg-surface-900/30">
                <th className="px-4 py-4 font-medium">Sample ID</th>
                <th className="px-4 py-4 font-medium">标注人员</th>
                <th className="px-4 py-4 font-medium">模型</th>
                <th className="px-4 py-4 font-medium">维度</th>
                <th className="px-4 py-4 font-medium">Golden Score</th>
                <th className="px-4 py-4 font-medium">标注 Score</th>
                <th className="px-4 py-4 font-medium">分差</th>
                <th className="px-4 py-4 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800/50">
              {filteredDimensionMismatches.slice(0, 100).map((item, idx) => {
                const scoreDiff = item.annotatorScore - item.goldenScore
                return (
                  <tr key={`${item.sampleId}-${item.dimension}-${idx}`} className="hover:bg-surface-800/30 transition-colors">
                    <td className="px-4 py-4">
                      <span className="text-sm text-white font-medium truncate block max-w-[180px]" title={item.sampleId}>
                        {item.sampleId}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-cyan-400 font-medium">{item.annotatorId}</td>
                    <td className="px-4 py-4 text-sm text-accent-400">{item.videoModel || '-'}</td>
                    <td className="px-4 py-4 text-sm text-surface-200 font-medium">{DIMENSION_LABELS[item.dimension]}</td>
                    <td className="px-4 py-4">
                      <span className={clsx('text-xl font-bold', getScoreColor(item.goldenScore))}>
                        {item.goldenScore}
                      </span>
                      <span className="text-xs text-surface-500 ml-1">
                        ({getProblemLevelLabel(item.goldenLevel)})
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx('text-xl font-bold', getScoreColor(item.annotatorScore))}>
                        {item.annotatorScore}
                      </span>
                      <span className="text-xs text-surface-500 ml-1">
                        ({getProblemLevelLabel(item.annotatorLevel)})
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx(
                        'font-mono font-bold',
                        scoreDiff > 0 ? 'text-green-400' :
                        scoreDiff < 0 ? 'text-red-400' :
                        'text-surface-500'
                      )}>
                        {scoreDiff > 0 ? '+' : ''}{scoreDiff}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => {
                          // Find the full sample result to show in modal
                          const fullSample = stats.allSampleResults.find(
                            s => s.sampleId === item.sampleId && s.annotatorId === item.annotatorId
                          )
                          if (fullSample) {
                            onSelectSample(fullSample)
                          }
                        }}
                        className="px-3 py-1.5 bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium rounded-lg"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {filteredDimensionMismatches.length === 0 && (
            <div className="p-12 text-center text-surface-500">
              {stats.dimensionMismatches.length === 0 ? '所有维度均一致！' : '没有找到匹配的结果'}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Stat Card Component
interface StatCardProps {
  title: string
  value: number | string
  subtitle?: string
  color: 'surface' | 'green' | 'sky' | 'red' | 'amber' | 'cyan' | 'purple'
}

function StatCard({ title, value, subtitle, color }: StatCardProps) {
  const colorClasses = {
    surface: 'bg-surface-900 border-surface-800',
    green: 'bg-green-500/10 border-green-500/20',
    sky: 'bg-sky-500/10 border-sky-500/20',
    red: 'bg-red-500/10 border-red-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20',
    cyan: 'bg-cyan-500/10 border-cyan-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
  }

  const valueColors = {
    surface: 'text-white',
    green: 'text-green-400',
    sky: 'text-sky-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
  }

  return (
    <div className={clsx('rounded-2xl border p-5', colorClasses[color])}>
      <p className="text-surface-400 text-sm mb-1">{title}</p>
      <p className={clsx('text-3xl font-bold', valueColors[color])}>{value}</p>
      {subtitle && (
        <p className="text-sm text-surface-500 mt-1">{subtitle}</p>
      )}
    </div>
  )
}

// Pair Sample Detail Modal
interface PairSampleDetailModalProps {
  sample: QAPairSampleResult
  onClose: () => void
}

function PairSampleDetailModal({ sample, onClose }: PairSampleDetailModalProps) {
  const [showImageModal, setShowImageModal] = useState(false)
  
  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-surface-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-surface-800">
          <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-900/80">
            <div>
              <h2 className="text-lg font-bold text-white">{sample.sampleId}</h2>
              <p className="text-sm text-surface-400">
                标注人员: <span className="text-cyan-400">{sample.annotatorId}</span>
                {sample.videoAModel && (
                  <span className="ml-3">
                    {sample.videoAModel} vs {sample.videoBModel}
                  </span>
                )}
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-surface-800 hover:bg-surface-700 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-surface-400" />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto p-6">
            {/* Summary */}
            <div className="mb-6 p-4 bg-surface-800/50 rounded-xl border border-surface-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-surface-400 mb-1">一致维度</p>
                  <p className="text-2xl font-bold text-white">
                    {sample.matchedCount} / {sample.totalDimensions}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-surface-400 mb-1">一致率</p>
                  <p className={clsx(
                    'text-2xl font-bold',
                    sample.softMatchRate >= 0.8 ? 'text-green-400' :
                    sample.softMatchRate >= 0.6 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {(sample.softMatchRate * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Prompt */}
            {sample.prompt && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-surface-400 mb-2">Prompt</h3>
                <div className="p-4 bg-surface-800/50 rounded-xl border border-surface-700/50">
                  <p className="text-surface-200 text-sm whitespace-pre-wrap">{sample.prompt}</p>
                </div>
              </div>
            )}

            {/* First Frame */}
            {sample.firstFrameUrl && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-surface-400 mb-2">首帧图</h3>
                <div 
                  className="relative w-fit cursor-pointer group"
                  onClick={() => setShowImageModal(true)}
                >
                  <img 
                    src={sample.firstFrameUrl} 
                    alt="First frame" 
                    className="max-h-48 rounded-xl border border-surface-700 object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                    <Image className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>
            )}

            {/* Video Compare */}
            {sample.videoAUrl && sample.videoBUrl && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-surface-400 mb-2">视频对比</h3>
                <VideoCompare 
                  videoAUrl={sample.videoAUrl}
                  videoBUrl={sample.videoBUrl}
                  modelA={sample.videoAModel || 'Model A'}
                  modelB={sample.videoBModel || 'Model B'}
                />
              </div>
            )}

            {/* Dimension Details */}
            <h3 className="text-sm font-medium text-surface-400 mb-3">各维度对比</h3>
            <div className="space-y-3">
              {sample.dimensionResults.map((dimResult) => (
                <div 
                  key={dimResult.dimension}
                  className={clsx(
                    'rounded-xl p-4 border',
                    dimResult.isMatch 
                      ? 'bg-green-500/5 border-green-500/20' 
                      : 'bg-red-500/5 border-red-500/20'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {dimResult.isMatch ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                      <span className="font-semibold text-white">
                        {DIMENSION_LABELS[dimResult.dimension]}
                      </span>
                    </div>
                    <span className={clsx(
                      'px-2 py-1 rounded text-xs font-bold',
                      dimResult.isMatch ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    )}>
                      {dimResult.isMatch ? '一致' : '不一致'}
                    </span>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    {/* Golden Set */}
                    <div className="bg-surface-900/50 rounded-lg p-3">
                      <p className="text-xs text-amber-400 mb-2">Golden Set</p>
                      <p className={clsx(
                        'text-lg font-bold mb-2',
                        dimResult.goldenComparison === 'A>B' ? 'text-green-400' :
                        dimResult.goldenComparison === 'A<B' ? 'text-red-400' : 'text-surface-400'
                      )}>
                        {dimResult.goldenComparison}
                      </p>
                      {/* Video A reasons */}
                      <div className="mb-2">
                        <p className="text-xs text-accent-400 mb-1">Video A 问题：</p>
                        {dimResult.goldenVideoAMajorReason && (
                          <p className="text-xs text-surface-300 mb-0.5">
                            <span className="text-red-400">主要:</span> {dimResult.goldenVideoAMajorReason}
                          </p>
                        )}
                        {dimResult.goldenVideoAMinorReason && (
                          <p className="text-xs text-surface-400">
                            <span className="text-amber-400">次要:</span> {dimResult.goldenVideoAMinorReason}
                          </p>
                        )}
                        {!dimResult.goldenVideoAMajorReason && !dimResult.goldenVideoAMinorReason && (
                          <p className="text-xs text-surface-500 italic">无问题</p>
                        )}
                      </div>
                      {/* Video B reasons */}
                      <div>
                        <p className="text-xs text-orange-400 mb-1">Video B 问题：</p>
                        {dimResult.goldenVideoBMajorReason && (
                          <p className="text-xs text-surface-300 mb-0.5">
                            <span className="text-red-400">主要:</span> {dimResult.goldenVideoBMajorReason}
                          </p>
                        )}
                        {dimResult.goldenVideoBMinorReason && (
                          <p className="text-xs text-surface-400">
                            <span className="text-amber-400">次要:</span> {dimResult.goldenVideoBMinorReason}
                          </p>
                        )}
                        {!dimResult.goldenVideoBMajorReason && !dimResult.goldenVideoBMinorReason && (
                          <p className="text-xs text-surface-500 italic">无问题</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Annotator Result */}
                    <div className="bg-surface-900/50 rounded-lg p-3">
                      <p className="text-xs text-sky-400 mb-2">标注结果</p>
                      <p className={clsx(
                        'text-lg font-bold mb-2',
                        dimResult.annotatorComparison === 'A>B' ? 'text-green-400' :
                        dimResult.annotatorComparison === 'A<B' ? 'text-red-400' : 'text-surface-400'
                      )}>
                        {dimResult.annotatorComparison}
                      </p>
                      {/* Video A reasons */}
                      <div className="mb-2">
                        <p className="text-xs text-accent-400 mb-1">Video A 问题：</p>
                        {dimResult.annotatorVideoAMajorReason && (
                          <p className="text-xs text-surface-300 mb-0.5">
                            <span className="text-red-400">主要:</span> {dimResult.annotatorVideoAMajorReason}
                          </p>
                        )}
                        {dimResult.annotatorVideoAMinorReason && (
                          <p className="text-xs text-surface-400">
                            <span className="text-amber-400">次要:</span> {dimResult.annotatorVideoAMinorReason}
                          </p>
                        )}
                        {!dimResult.annotatorVideoAMajorReason && !dimResult.annotatorVideoAMinorReason && (
                          <p className="text-xs text-surface-500 italic">无问题</p>
                        )}
                      </div>
                      {/* Video B reasons */}
                      <div>
                        <p className="text-xs text-orange-400 mb-1">Video B 问题：</p>
                        {dimResult.annotatorVideoBMajorReason && (
                          <p className="text-xs text-surface-300 mb-0.5">
                            <span className="text-red-400">主要:</span> {dimResult.annotatorVideoBMajorReason}
                          </p>
                        )}
                        {dimResult.annotatorVideoBMinorReason && (
                          <p className="text-xs text-surface-400">
                            <span className="text-amber-400">次要:</span> {dimResult.annotatorVideoBMinorReason}
                          </p>
                        )}
                        {!dimResult.annotatorVideoBMajorReason && !dimResult.annotatorVideoBMinorReason && (
                          <p className="text-xs text-surface-500 italic">无问题</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* First Frame Image Modal */}
      {sample.firstFrameUrl && (
        <ImageModal
          src={sample.firstFrameUrl}
          alt="First frame"
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </>
  )
}

// Score Sample Detail Modal
interface ScoreSampleDetailModalProps {
  sample: QAScoreSampleResult
  onClose: () => void
}

function ScoreSampleDetailModal({ sample, onClose }: ScoreSampleDetailModalProps) {
  const [showImageModal, setShowImageModal] = useState(false)
  
  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-surface-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-surface-800">
          <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-900/80">
            <div>
              <h2 className="text-lg font-bold text-white">{sample.sampleId}</h2>
              <p className="text-sm text-surface-400">
                标注人员: <span className="text-cyan-400">{sample.annotatorId}</span>
                {sample.videoModel && (
                  <span className="ml-3 text-accent-400">{sample.videoModel}</span>
                )}
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-surface-800 hover:bg-surface-700 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-surface-400" />
            </button>
          </div>
          
          <div className="flex-1 overflow-auto p-6">
            {/* Summary */}
            <div className="mb-6 p-4 bg-surface-800/50 rounded-xl border border-surface-700/50">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-surface-400 mb-1">分数一致</p>
                  <p className="text-2xl font-bold text-white">
                    {sample.exactMatchCount} / {sample.totalDimensions}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-surface-400 mb-1">等级一致</p>
                  <p className="text-2xl font-bold text-white">
                    {sample.levelMatchCount} / {sample.totalDimensions}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-surface-400 mb-1">等级一致率</p>
                  <p className={clsx(
                    'text-2xl font-bold',
                    sample.softMatchRate >= 0.8 ? 'text-green-400' :
                    sample.softMatchRate >= 0.6 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {(sample.softMatchRate * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Prompt */}
            {sample.prompt && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-surface-400 mb-2">Prompt</h3>
                <div className="p-4 bg-surface-800/50 rounded-xl border border-surface-700/50">
                  <p className="text-surface-200 text-sm whitespace-pre-wrap">{sample.prompt}</p>
                </div>
              </div>
            )}

            {/* First Frame and Video side by side */}
            <div className="mb-6 grid grid-cols-2 gap-4">
              {/* First Frame */}
              {sample.firstFrameUrl && (
                <div>
                  <h3 className="text-sm font-medium text-surface-400 mb-2">首帧图</h3>
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => setShowImageModal(true)}
                  >
                    <img 
                      src={sample.firstFrameUrl} 
                      alt="First frame" 
                      className="w-full aspect-video rounded-xl border border-surface-700 object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                      <Image className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>
              )}

              {/* Video */}
              {sample.videoUrl && (
                <div>
                  <h3 className="text-sm font-medium text-surface-400 mb-2">视频</h3>
                  <div className="relative">
                    <video
                      src={sample.videoUrl}
                      controls
                      className="w-full aspect-video rounded-xl bg-black"
                      playsInline
                    />
                    {sample.videoModel && (
                      <div className="absolute top-3 left-3 px-3 py-1.5 bg-accent-600/90 backdrop-blur-sm rounded-lg text-xs font-bold text-white shadow-lg">
                        {sample.videoModel}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Dimension Details */}
            <h3 className="text-sm font-medium text-surface-400 mb-3">各维度对比</h3>
            <div className="space-y-3">
              {sample.dimensionResults.map((dimResult) => (
                <div 
                  key={dimResult.dimension}
                  className={clsx(
                    'rounded-xl p-4 border',
                    dimResult.isExactMatch 
                      ? 'bg-green-500/5 border-green-500/20' 
                      : dimResult.isLevelMatch
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {dimResult.isExactMatch ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : dimResult.isLevelMatch ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                      <span className="font-semibold text-white">
                        {DIMENSION_LABELS[dimResult.dimension]}
                      </span>
                    </div>
                    <span className={clsx(
                      'px-2 py-1 rounded text-xs font-bold',
                      dimResult.isExactMatch ? 'bg-green-500/20 text-green-400' :
                      dimResult.isLevelMatch ? 'bg-amber-500/20 text-amber-400' :
                      'bg-red-500/20 text-red-400'
                    )}>
                      {dimResult.isExactMatch ? '完全一致' : dimResult.isLevelMatch ? '等级一致' : '不一致'}
                    </span>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    {/* Golden Set */}
                    <div className="bg-surface-900/50 rounded-lg p-3">
                      <p className="text-xs text-amber-400 mb-2">Golden Set</p>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className={clsx('text-2xl font-bold', getScoreColor(dimResult.goldenScore))}>
                          {dimResult.goldenScore}
                        </span>
                        <span className="text-xs text-surface-500">
                          ({getProblemLevelLabel(dimResult.goldenLevel)})
                        </span>
                      </div>
                      {/* Problem reasons */}
                      {dimResult.goldenMajorReason && (
                        <p className="text-xs text-surface-300 mb-0.5">
                          <span className="text-red-400">主要问题:</span> {dimResult.goldenMajorReason}
                        </p>
                      )}
                      {dimResult.goldenMinorReason && (
                        <p className="text-xs text-surface-400">
                          <span className="text-amber-400">次要问题:</span> {dimResult.goldenMinorReason}
                        </p>
                      )}
                      {!dimResult.goldenMajorReason && !dimResult.goldenMinorReason && (
                        <p className="text-xs text-surface-500 italic">无问题描述</p>
                      )}
                    </div>
                    
                    {/* Annotator Result */}
                    <div className="bg-surface-900/50 rounded-lg p-3">
                      <p className="text-xs text-sky-400 mb-2">标注结果</p>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className={clsx('text-2xl font-bold', getScoreColor(dimResult.annotatorScore))}>
                          {dimResult.annotatorScore}
                        </span>
                        <span className="text-xs text-surface-500">
                          ({getProblemLevelLabel(dimResult.annotatorLevel)})
                        </span>
                      </div>
                      {/* Problem reasons */}
                      {dimResult.annotatorMajorReason && (
                        <p className="text-xs text-surface-300 mb-0.5">
                          <span className="text-red-400">主要问题:</span> {dimResult.annotatorMajorReason}
                        </p>
                      )}
                      {dimResult.annotatorMinorReason && (
                        <p className="text-xs text-surface-400">
                          <span className="text-amber-400">次要问题:</span> {dimResult.annotatorMinorReason}
                        </p>
                      )}
                      {!dimResult.annotatorMajorReason && !dimResult.annotatorMinorReason && (
                        <p className="text-xs text-surface-500 italic">无问题描述</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* First Frame Image Modal */}
      {sample.firstFrameUrl && (
        <ImageModal
          src={sample.firstFrameUrl}
          alt="First frame"
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </>
  )
}

function getScoreColor(score: number): string {
  if (score >= 5) return 'text-green-400'
  if (score >= 4) return 'text-sky-400'
  if (score >= 3) return 'text-amber-400'
  if (score >= 2) return 'text-orange-400'
  return 'text-red-400'
}
