import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AnalysisHeader, VideoCompare } from '../../components/analysis'
import { useAnalysisStore } from '../../stores/analysisStore'
import { DIMENSION_LABELS } from '../../types'
import type { Dimension } from '../../types'
import type { ConsistencyResult, CombinedPairData, CombinedScoreData } from '../../types/analysis'
import { getInconsistencyTypeLabel } from '../../utils/analysis'
import { Upload, X, Search } from 'lucide-react'
import clsx from 'clsx'

type MatchMode = 'hard' | 'soft'

export function AnalysisConsistency() {
  const { consistencyStats, combinedPairData, combinedScoreData, isLoading } = useAnalysisStore()
  const [matchMode, setMatchMode] = useState<MatchMode>('hard')
  const [selectedDimension, setSelectedDimension] = useState<Dimension | 'all'>('all')
  const [selectedInconsistent, setSelectedInconsistent] = useState<ConsistencyResult | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  const pairDataMap = useMemo(() => {
    const map = new Map<string, CombinedPairData>()
    combinedPairData.forEach(data => map.set(data.sample.sample_id, data))
    return map
  }, [combinedPairData])
  
  // Build maps for Score data lookup by model + prompt
  const scoreDataByModelAndPrompt = useMemo(() => {
    const map = new Map<string, CombinedScoreData>()
    combinedScoreData.forEach(data => {
      const key = `${data.result.video_model}::${data.sample.prompt}`
      map.set(key, data)
    })
    return map
  }, [combinedScoreData])
  
  // Function to find matching score data for a video
  const findScoreData = (model: string, prompt: string | undefined): CombinedScoreData | undefined => {
    if (!prompt) return undefined
    const key = `${model}::${prompt}`
    return scoreDataByModelAndPrompt.get(key)
  }
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-950">
        <div className="animate-spin w-12 h-12 border-4 border-accent-500 border-t-transparent rounded-full" />
      </div>
    )
  }
  
  if (!consistencyStats) {
    return (
      <div className="flex flex-col h-full bg-surface-950">
        <AnalysisHeader title="一致性验证" subtitle="Pair与Score标注一致性分析" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-surface-800/50 flex items-center justify-center">
              <Upload className="w-10 h-10 text-surface-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">暂无一致性数据</h3>
            <p className="text-surface-400 mb-6">
              需要同时上传 Pair 和 Score 模式的标注结果
            </p>
            <Link
              to="/analysis"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-600 hover:bg-accent-500 text-white rounded-xl font-medium transition-colors"
            >
              <Upload className="w-5 h-5" />
              前往上传
            </Link>
          </div>
        </div>
      </div>
    )
  }
  
  const currentRate = matchMode === 'hard' ? consistencyStats.hardMatchRate : consistencyStats.softMatchRate
  const currentConsistent = matchMode === 'hard' ? consistencyStats.hardMatchConsistent : consistencyStats.softMatchConsistent
  
  let filteredInconsistent = selectedDimension === 'all'
    ? consistencyStats.inconsistentSamples
    : consistencyStats.inconsistentSamples.filter(s => s.dimension === selectedDimension)
  
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim()
    filteredInconsistent = filteredInconsistent.filter(s => s.sampleId.toLowerCase().includes(query))
  }
  
  // Get the pair data for the selected inconsistent sample
  const selectedPairData = selectedInconsistent ? pairDataMap.get(selectedInconsistent.sampleId) : null
  
  // Get the prompt from pair data
  const selectedPrompt = selectedPairData?.sample.prompt || selectedInconsistent?.prompt
  
  // Find Score data for both videos
  const selectedScoreDataA = selectedInconsistent 
    ? findScoreData(selectedInconsistent.videoAModel, selectedPrompt)
    : undefined
  const selectedScoreDataB = selectedInconsistent 
    ? findScoreData(selectedInconsistent.videoBModel, selectedPrompt)
    : undefined
  
  return (
    <div className="flex flex-col h-full bg-surface-950">
      <AnalysisHeader title="一致性验证" subtitle="Pair与Score标注一致性分析" />
      <div className="flex-1 overflow-auto p-6">
        {/* Match Mode Toggle */}
        <div className="flex flex-row items-center justify-between mb-6">
          <div className="flex bg-surface-900 rounded-xl p-1 border border-surface-800">
            <button
              onClick={() => setMatchMode('hard')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                matchMode === 'hard' ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20' : 'text-surface-400 hover:text-white'
              )}
            >
              Hard Match
            </button>
            <button
              onClick={() => setMatchMode('soft')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                matchMode === 'soft' ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20' : 'text-surface-400 hover:text-white'
              )}
            >
              Soft Match
            </button>
          </div>
          
          <div className="text-sm text-surface-400 bg-surface-900 px-4 py-2 rounded-xl border border-surface-800">
            {matchMode === 'hard' ? (
              <span>严格模式：A=B 时要求 |A分 - B分| = 0</span>
            ) : (
              <span>宽松模式：A=B 时要求 |A分 - B分| ≤ 1</span>
            )}
          </div>
        </div>
        
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface-900 rounded-2xl border border-surface-800 p-5">
            <p className="text-surface-400 text-sm mb-1">匹配样本数</p>
            <p className="text-3xl font-bold text-white">{consistencyStats.totalMatched}</p>
          </div>
          <div className="bg-green-500/10 rounded-2xl border border-green-500/20 p-5">
            <p className="text-surface-400 text-sm mb-1">一致数量</p>
            <p className="text-3xl font-bold text-green-400">{currentConsistent}</p>
          </div>
          <div className="bg-accent-500/10 rounded-2xl border border-accent-500/20 p-5">
            <p className="text-surface-400 text-sm mb-1">一致率</p>
            <p className="text-3xl font-bold text-accent-400">{(currentRate * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-red-500/10 rounded-2xl border border-red-500/20 p-5">
            <p className="text-surface-400 text-sm mb-1">不一致数量</p>
            <p className="text-3xl font-bold text-red-400">{consistencyStats.totalMatched - currentConsistent}</p>
          </div>
        </div>
        
        {/* Dimension Breakdown */}
        <div className="bg-surface-900 rounded-2xl border border-surface-800 mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-800 bg-surface-900/50">
            <h2 className="text-lg font-semibold text-white">分维度一致率</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-5 gap-4">
              {Object.entries(consistencyStats.byDimension).map(([dim, stats]) => {
                const rate = matchMode === 'hard' ? stats.hardMatchRate : stats.softMatchRate
                const consistent = matchMode === 'hard' ? stats.hardMatchConsistent : stats.softMatchConsistent
                
                return (
                  <div
                    key={dim}
                    className={clsx(
                      'bg-surface-800/50 rounded-xl p-4 cursor-pointer transition-all border',
                      selectedDimension === dim 
                        ? 'ring-2 ring-accent-500 border-accent-500/50' 
                        : 'border-surface-700/50 hover:bg-surface-800 hover:border-surface-600'
                    )}
                    onClick={() => setSelectedDimension(selectedDimension === dim ? 'all' : dim as Dimension)}
                  >
                    <div className="text-sm text-surface-400 mb-2 font-medium">
                      {DIMENSION_LABELS[dim as Dimension]}
                    </div>
                    <div className={clsx('text-2xl font-bold mb-1', getConsistencyColor(rate))}>
                      {(rate * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-surface-500">{consistent} / {stats.total}</div>
                    <div className="mt-3 h-2 bg-surface-700 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all',
                          rate >= 0.8 ? 'bg-green-500' : rate >= 0.6 ? 'bg-amber-500' : 'bg-red-500'
                        )}
                        style={{ width: `${rate * 100}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        
        {/* Inconsistent Samples */}
        <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-900/50 flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-white">
              不一致样本列表
              {selectedDimension !== 'all' && (
                <span className="text-sm font-normal text-surface-400 ml-2">
                  （筛选：{DIMENSION_LABELS[selectedDimension]}）
                </span>
              )}
            </h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                <input
                  type="text"
                  placeholder="搜索 Sample ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-surface-800 border border-surface-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500 w-48"
                />
              </div>
              <span className="text-sm text-surface-400 bg-surface-800 px-3 py-1 rounded-lg">
                共 {filteredInconsistent.length} 条
              </span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-surface-400 text-sm border-b border-surface-800 bg-surface-900/30">
                  <th className="px-4 py-4 font-medium">Sample ID</th>
                  <th className="px-4 py-4 font-medium">维度</th>
                  <th className="px-4 py-4 font-medium">Model A</th>
                  <th className="px-4 py-4 font-medium">Model B</th>
                  <th className="px-4 py-4 font-medium">Pair 结果</th>
                  <th className="px-4 py-4 font-medium">Score A</th>
                  <th className="px-4 py-4 font-medium">Score B</th>
                  <th className="px-4 py-4 font-medium">分差</th>
                  <th className="px-4 py-4 font-medium">不一致类型</th>
                  <th className="px-4 py-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/50">
                {filteredInconsistent.slice(0, 100).map((item, index) => (
                  <tr key={`${item.sampleId}-${item.dimension}-${index}`} className="hover:bg-surface-800/30 transition-colors">
                    <td className="px-4 py-4">
                      <span className="text-sm text-white font-medium truncate block max-w-[180px]" title={item.sampleId}>
                        {item.sampleId}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-surface-200 font-medium">{DIMENSION_LABELS[item.dimension]}</td>
                    <td className="px-4 py-4 text-sm text-accent-400 font-medium">{item.videoAModel}</td>
                    <td className="px-4 py-4 text-sm text-orange-400 font-medium">{item.videoBModel}</td>
                    <td className="px-4 py-4">
                      <span className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-bold',
                        item.pairComparison === 'A>B' ? 'bg-green-500/15 text-green-400' :
                        item.pairComparison === 'A<B' ? 'bg-red-500/15 text-red-400' :
                        'bg-surface-700 text-surface-400'
                      )}>
                        {item.pairComparison}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx('text-xl font-bold', getScoreColor(item.scoreA))}>{item.scoreA}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx('text-xl font-bold', getScoreColor(item.scoreB))}>{item.scoreB}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx(
                        'font-mono font-bold',
                        item.scoreDiff > 0 ? 'text-green-400' :
                        item.scoreDiff < 0 ? 'text-red-400' :
                        'text-surface-500'
                      )}>
                        {item.scoreDiff > 0 ? '+' : ''}{item.scoreDiff}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={clsx(
                        'inline-flex items-center gap-1.5 text-sm font-medium',
                        item.inconsistencyType === 'direction_mismatch' ? 'text-red-400' :
                        item.inconsistencyType === 'tie_but_diff' ? 'text-orange-400' : 'text-amber-400'
                      )}>
                        <span className={clsx(
                          'w-2 h-2 rounded-full',
                          item.inconsistencyType === 'direction_mismatch' ? 'bg-red-500' :
                          item.inconsistencyType === 'tie_but_diff' ? 'bg-orange-500' : 'bg-amber-500'
                        )}></span>
                        {getInconsistencyTypeLabel(item.inconsistencyType)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setSelectedInconsistent(item)}
                        className="px-3 py-1.5 bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium rounded-lg"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredInconsistent.length === 0 && (
              <div className="p-12 text-center text-surface-500">无不一致样本</div>
            )}
          </div>
        </div>
        
        {/* Explanation */}
        <div className="mt-6 bg-surface-900 rounded-2xl border border-surface-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">验证规则说明</h3>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-surface-800/30 rounded-xl p-4 border border-surface-700/50">
              <h4 className="font-semibold text-accent-400 mb-3">Hard Match（严格模式）</h4>
              <ul className="text-sm text-surface-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>Pair: A&gt;B → Score: A分 &gt; B分</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>Pair: A&lt;B → Score: A分 &lt; B分</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>Pair: A=B → Score: A分 = B分（完全相等）</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-surface-800/30 rounded-xl p-4 border border-surface-700/50">
              <h4 className="font-semibold text-sky-400 mb-3">Soft Match（宽松模式）</h4>
              <ul className="text-sm text-surface-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>Pair: A&gt;B → Score: A分 &gt; B分</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>Pair: A&lt;B → Score: A分 &lt; B分</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span>
                  <span>Pair: A=B → |A分 - B分| ≤ 1 <strong className="text-amber-400">且</strong> 问题等级相同</span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-surface-400 bg-surface-900/50 rounded-lg p-2">
                问题等级：5分=none，4分=none/minor，3分=minor，2分=major，1分=major
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Detail Modal */}
      {selectedInconsistent && (
        <InconsistentDetailModal
          item={selectedInconsistent}
          pairData={selectedPairData}
          scoreDataA={selectedScoreDataA}
          scoreDataB={selectedScoreDataB}
          onClose={() => setSelectedInconsistent(null)}
        />
      )}
    </div>
  )
}

// Detail Modal Component
interface InconsistentDetailModalProps {
  item: ConsistencyResult
  pairData: CombinedPairData | null | undefined
  scoreDataA: CombinedScoreData | undefined
  scoreDataB: CombinedScoreData | undefined
  onClose: () => void
}

function InconsistentDetailModal({ item, pairData, scoreDataA, scoreDataB, onClose }: InconsistentDetailModalProps) {
  const dimension = item.dimension
  
  // Get Score annotation details for the specific dimension
  const scoreDetailA = scoreDataA?.result.scores[dimension]
  const scoreDetailB = scoreDataB?.result.scores[dimension]
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-900 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-surface-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-900/80">
          <div>
            <h2 className="text-lg font-bold text-white">{item.sampleId}</h2>
            <p className="text-sm text-surface-400">
              不一致样本详情 - {DIMENSION_LABELS[item.dimension]}
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
          {/* Inconsistency Summary */}
          <div className="mb-6 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
            <h3 className="text-sm font-medium text-red-400 mb-3">不一致性摘要</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-surface-400 mb-1">Pair 结果</p>
                <span className={clsx(
                  'px-2.5 py-1 rounded-lg text-sm font-bold',
                  item.pairComparison === 'A>B' ? 'bg-green-500/15 text-green-400' :
                  item.pairComparison === 'A<B' ? 'bg-red-500/15 text-red-400' :
                  'bg-surface-700 text-surface-400'
                )}>
                  {item.pairComparison}
                </span>
              </div>
              <div>
                <p className="text-xs text-surface-400 mb-1">Score A ({item.videoAModel})</p>
                <span className={clsx('text-2xl font-bold', getScoreColor(item.scoreA))}>
                  {item.scoreA}
                </span>
              </div>
              <div>
                <p className="text-xs text-surface-400 mb-1">Score B ({item.videoBModel})</p>
                <span className={clsx('text-2xl font-bold', getScoreColor(item.scoreB))}>
                  {item.scoreB}
                </span>
              </div>
              <div>
                <p className="text-xs text-surface-400 mb-1">不一致类型</p>
                <span className={clsx(
                  'inline-flex items-center gap-1.5 text-sm font-medium',
                  item.inconsistencyType === 'direction_mismatch' ? 'text-red-400' :
                  item.inconsistencyType === 'tie_but_diff' ? 'text-orange-400' :
                  'text-amber-400'
                )}>
                  <span className={clsx(
                    'w-2 h-2 rounded-full',
                    item.inconsistencyType === 'direction_mismatch' ? 'bg-red-500' :
                    item.inconsistencyType === 'tie_but_diff' ? 'bg-orange-500' :
                    'bg-amber-500'
                  )}></span>
                  {getInconsistencyTypeLabel(item.inconsistencyType)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Prompt */}
          {(item.prompt || pairData?.sample.prompt) && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-surface-400 mb-2">Prompt</h3>
              <p className="text-surface-200 bg-surface-800/50 rounded-xl p-4 border border-surface-700/50">
                {item.prompt || pairData?.sample.prompt}
              </p>
            </div>
          )}
          
          {/* Video Compare */}
          {pairData ? (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-surface-400 mb-2">视频对比</h3>
              <VideoCompare
                videoAUrl={pairData.sample.video_a_url}
                videoBUrl={pairData.sample.video_b_url}
                modelA={item.videoAModel}
                modelB={item.videoBModel}
              />
            </div>
          ) : (
            <div className="mb-6 p-8 bg-surface-800/30 rounded-xl border border-surface-700/50 text-center">
              <Upload className="w-12 h-12 mx-auto mb-3 text-surface-600" />
              <p className="text-surface-400 text-sm">无法找到对应的视频数据</p>
            </div>
          )}
          
          {/* Pair Mode Annotation Detail */}
          {pairData && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-surface-400 mb-3">
                {DIMENSION_LABELS[item.dimension]} - Pair 模式标注详情
              </h3>
              <div className="bg-accent-500/5 rounded-xl p-4 border border-accent-500/20">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-900/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-accent-400">
                        Video A - {item.videoAModel}
                      </span>
                      <span className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-bold',
                        pairData.result.dimensions[item.dimension]?.comparison === 'A>B' ? 'bg-green-500/15 text-green-400' :
                        pairData.result.dimensions[item.dimension]?.comparison === 'A<B' ? 'bg-red-500/15 text-red-400' :
                        'bg-surface-700 text-surface-400'
                      )}>
                        {pairData.result.dimensions[item.dimension]?.comparison}
                      </span>
                    </div>
                    {pairData.result.dimensions[item.dimension] && (
                      <>
                        <div className={clsx('text-sm font-semibold mb-2', getLevelColor(pairData.result.dimensions[item.dimension].video_a.level))}>
                          {getLevelLabel(pairData.result.dimensions[item.dimension].video_a.level)}
                        </div>
                        {pairData.result.dimensions[item.dimension].video_a.major_reason && (
                          <p className="text-xs text-surface-300 mb-1">
                            <span className="text-surface-500">主要:</span> {pairData.result.dimensions[item.dimension].video_a.major_reason}
                          </p>
                        )}
                        {pairData.result.dimensions[item.dimension].video_a.minor_reason && (
                          <p className="text-xs text-surface-400">
                            <span className="text-surface-500">次要:</span> {pairData.result.dimensions[item.dimension].video_a.minor_reason}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="bg-surface-900/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-orange-400">
                        Video B - {item.videoBModel}
                      </span>
                    </div>
                    {pairData.result.dimensions[item.dimension] && (
                      <>
                        <div className={clsx('text-sm font-semibold mb-2', getLevelColor(pairData.result.dimensions[item.dimension].video_b.level))}>
                          {getLevelLabel(pairData.result.dimensions[item.dimension].video_b.level)}
                        </div>
                        {pairData.result.dimensions[item.dimension].video_b.major_reason && (
                          <p className="text-xs text-surface-300 mb-1">
                            <span className="text-surface-500">主要:</span> {pairData.result.dimensions[item.dimension].video_b.major_reason}
                          </p>
                        )}
                        {pairData.result.dimensions[item.dimension].video_b.minor_reason && (
                          <p className="text-xs text-surface-400">
                            <span className="text-surface-500">次要:</span> {pairData.result.dimensions[item.dimension].video_b.minor_reason}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Score Mode Annotation Detail */}
          <div>
            <h3 className="text-sm font-medium text-surface-400 mb-3">
              {DIMENSION_LABELS[item.dimension]} - Score 模式标注详情
            </h3>
            <div className="bg-sky-500/5 rounded-xl p-4 border border-sky-500/20">
              <div className="grid grid-cols-2 gap-4">
                {/* Score A */}
                <div className="bg-surface-900/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-accent-400">
                      Video A - {item.videoAModel}
                    </span>
                    <span className={clsx('text-2xl font-bold', getScoreColor(item.scoreA))}>
                      {item.scoreA}
                    </span>
                  </div>
                  {/* Problem level from score */}
                  <div className={clsx('text-sm font-semibold mb-2', getScoreLevelColor(item.scoreA))}>
                    {getScoreLevelLabel(item.scoreA)}
                  </div>
                  {scoreDetailA ? (
                    <>
                      {scoreDetailA.major_reason && (
                        <p className="text-xs text-surface-300 mb-1">
                          <span className="text-surface-500">主要问题:</span> {scoreDetailA.major_reason}
                        </p>
                      )}
                      {scoreDetailA.minor_reason && (
                        <p className="text-xs text-surface-400">
                          <span className="text-surface-500">次要问题:</span> {scoreDetailA.minor_reason}
                        </p>
                      )}
                      {!scoreDetailA.major_reason && !scoreDetailA.minor_reason && (
                        <p className="text-xs text-surface-500 italic">无问题描述</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-surface-500 italic">未找到对应的 Score 标注数据</p>
                  )}
                </div>
                
                {/* Score B */}
                <div className="bg-surface-900/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-orange-400">
                      Video B - {item.videoBModel}
                    </span>
                    <span className={clsx('text-2xl font-bold', getScoreColor(item.scoreB))}>
                      {item.scoreB}
                    </span>
                  </div>
                  {/* Problem level from score */}
                  <div className={clsx('text-sm font-semibold mb-2', getScoreLevelColor(item.scoreB))}>
                    {getScoreLevelLabel(item.scoreB)}
                  </div>
                  {scoreDetailB ? (
                    <>
                      {scoreDetailB.major_reason && (
                        <p className="text-xs text-surface-300 mb-1">
                          <span className="text-surface-500">主要问题:</span> {scoreDetailB.major_reason}
                        </p>
                      )}
                      {scoreDetailB.minor_reason && (
                        <p className="text-xs text-surface-400">
                          <span className="text-surface-500">次要问题:</span> {scoreDetailB.minor_reason}
                        </p>
                      )}
                      {!scoreDetailB.major_reason && !scoreDetailB.minor_reason && (
                        <p className="text-xs text-surface-500 italic">无问题描述</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-surface-500 italic">未找到对应的 Score 标注数据</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getConsistencyColor(rate: number): string {
  if (rate >= 0.9) return 'text-green-400'
  if (rate >= 0.8) return 'text-sky-400'
  if (rate >= 0.6) return 'text-amber-400'
  if (rate >= 0.4) return 'text-orange-400'
  return 'text-red-400'
}

function getScoreColor(score: number): string {
  if (score >= 5) return 'text-green-400'
  if (score >= 4) return 'text-sky-400'
  if (score >= 3) return 'text-amber-400'
  if (score >= 2) return 'text-orange-400'
  return 'text-red-400'
}

function getLevelColor(level: string): string {
  switch (level) {
    case 'none': return 'text-green-400'
    case 'minor': return 'text-amber-400'
    case 'major': return 'text-red-400'
    default: return 'text-surface-400'
  }
}

function getLevelLabel(level: string): string {
  switch (level) {
    case 'none': return '无问题'
    case 'minor': return '次要问题'
    case 'major': return '主要问题'
    default: return level
  }
}

// Convert score to problem level color
function getScoreLevelColor(score: number): string {
  if (score >= 5) return 'text-green-400'
  if (score >= 4) return 'text-green-400' // 4-5 = none
  if (score >= 3) return 'text-amber-400' // 3 = minor
  return 'text-red-400' // 1-2 = major
}

// Convert score to problem level label
function getScoreLevelLabel(score: number): string {
  if (score >= 5) return '无问题'
  if (score >= 4) return '无问题/轻微'
  if (score >= 3) return '次要问题'
  return '主要问题'
}
