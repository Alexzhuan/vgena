import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AnalysisHeader, VideoCompare } from '../../components/analysis'
import { useAnalysisStore } from '../../stores/analysisStore'
import { DIMENSION_LABELS, DIMENSIONS } from '../../types'
import type { Dimension } from '../../types'
import type { CombinedPairData, CombinedScoreData } from '../../types/analysis'
import { Upload, Search, X } from 'lucide-react'
import clsx from 'clsx'

type ViewMode = 'pair' | 'score'

export function AnalysisResults() {
  const { combinedPairData, combinedScoreData, isLoading } = useAnalysisStore()
  const [viewMode, setViewMode] = useState<ViewMode>('pair')
  const [selectedModel, setSelectedModel] = useState<string>('all')
  const [selectedAnnotator, setSelectedAnnotator] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedPairSample, setSelectedPairSample] = useState<CombinedPairData | null>(null)
  const [selectedScoreSample, setSelectedScoreSample] = useState<CombinedScoreData | null>(null)
  
  // Get unique models
  const models = useMemo(() => {
    const modelSet = new Set<string>()
    combinedPairData.forEach((d) => {
      modelSet.add(d.result.video_a_model)
      modelSet.add(d.result.video_b_model)
    })
    combinedScoreData.forEach((d) => {
      modelSet.add(d.result.video_model)
    })
    return Array.from(modelSet).sort()
  }, [combinedPairData, combinedScoreData])
  
  // Get unique annotators
  const annotators = useMemo(() => {
    const annotatorSet = new Set<string>()
    combinedPairData.forEach((d) => {
      if (d.annotatorId) annotatorSet.add(d.annotatorId)
    })
    combinedScoreData.forEach((d) => {
      if (d.annotatorId) annotatorSet.add(d.annotatorId)
    })
    return Array.from(annotatorSet).sort()
  }, [combinedPairData, combinedScoreData])
  
  // Filter data by model, annotator, and search query
  const filteredPairData = useMemo(() => {
    let data = combinedPairData
    
    // Filter by model
    if (selectedModel !== 'all') {
      data = data.filter(
        (d) => d.result.video_a_model === selectedModel || d.result.video_b_model === selectedModel
      )
    }
    
    // Filter by annotator
    if (selectedAnnotator !== 'all') {
      data = data.filter((d) => d.annotatorId === selectedAnnotator)
    }
    
    // Filter by search query (sample_id)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      data = data.filter((d) => d.sample.sample_id.toLowerCase().includes(query))
    }
    
    return data
  }, [combinedPairData, selectedModel, selectedAnnotator, searchQuery])
  
  const filteredScoreData = useMemo(() => {
    let data = combinedScoreData
    
    // Filter by model
    if (selectedModel !== 'all') {
      data = data.filter((d) => d.result.video_model === selectedModel)
    }
    
    // Filter by annotator
    if (selectedAnnotator !== 'all') {
      data = data.filter((d) => d.annotatorId === selectedAnnotator)
    }
    
    // Filter by search query (sample_id)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      data = data.filter((d) => d.sample.sample_id.toLowerCase().includes(query))
    }
    
    return data
  }, [combinedScoreData, selectedModel, selectedAnnotator, searchQuery])
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-950">
        <div className="animate-spin w-12 h-12 border-4 border-accent-500 border-t-transparent rounded-full" />
      </div>
    )
  }
  
  // No data uploaded yet
  if (combinedPairData.length === 0 && combinedScoreData.length === 0) {
    return (
      <div className="flex flex-col h-full bg-surface-950">
        <AnalysisHeader title="标注结果" subtitle="浏览所有标注样本" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-surface-800/50 flex items-center justify-center">
              <Upload className="w-10 h-10 text-surface-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">暂无数据</h3>
            <p className="text-surface-400 mb-6">请先在首页上传标注结果文件</p>
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
  
  return (
    <div className="flex flex-col h-full bg-surface-950">
      <AnalysisHeader title="标注结果" subtitle="浏览所有标注样本" />
      <div className="flex-1 overflow-auto p-6">
        {/* Filters */}
        <div className="flex flex-row items-center gap-4 mb-6 flex-wrap">
          <div className="flex bg-surface-900 rounded-xl p-1 border border-surface-800">
            <button
              onClick={() => setViewMode('pair')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                viewMode === 'pair'
                  ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              Pair 模式 ({combinedPairData.length})
            </button>
            <button
              onClick={() => setViewMode('score')}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                viewMode === 'score'
                  ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              Score 模式 ({combinedScoreData.length})
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              placeholder="搜索 Sample ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-900 border border-surface-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent w-64"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-surface-900 border border-surface-800 rounded-xl px-4 py-2.5 text-sm text-surface-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="all">所有模型</option>
            {models.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          
          {/* Annotator Filter */}
          <select
            value={selectedAnnotator}
            onChange={(e) => setSelectedAnnotator(e.target.value)}
            className="bg-surface-900 border border-surface-800 rounded-xl px-4 py-2.5 text-sm text-surface-200 focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="all">所有标注人员</option>
            {annotators.map((annotator) => (
              <option key={annotator} value={annotator}>{annotator}</option>
            ))}
          </select>
          
          <div className="text-sm text-surface-400 ml-auto">
            显示 {viewMode === 'pair' ? filteredPairData.length : filteredScoreData.length} 条结果
          </div>
        </div>
        
        {/* Results Table */}
        <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
          {viewMode === 'pair' ? (
            <PairResultTable data={filteredPairData} onViewDetail={setSelectedPairSample} />
          ) : (
            <ScoreResultTable data={filteredScoreData} onViewDetail={setSelectedScoreSample} />
          )}
        </div>
      </div>
      
      {/* Detail Modals */}
      {selectedPairSample && (
        <PairDetailModal data={selectedPairSample} onClose={() => setSelectedPairSample(null)} />
      )}
      {selectedScoreSample && (
        <ScoreDetailModal data={selectedScoreSample} onClose={() => setSelectedScoreSample(null)} />
      )}
    </div>
  )
}

// Pair Result Table
function PairResultTable({ data, onViewDetail }: { data: CombinedPairData[]; onViewDetail: (d: CombinedPairData) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-surface-400 text-sm border-b border-surface-800 bg-surface-900/50">
            <th className="px-4 py-4 font-medium">Sample ID</th>
            <th className="px-4 py-4 font-medium max-w-[200px]">Prompt</th>
            <th className="px-4 py-4 font-medium">Model A</th>
            <th className="px-4 py-4 font-medium">Model B</th>
            <th className="px-4 py-4 font-medium text-center">A Wins</th>
            <th className="px-4 py-4 font-medium text-center">B Wins</th>
            <th className="px-4 py-4 font-medium text-center">结果</th>
            <th className="px-4 py-4 font-medium">标注人员</th>
            <th className="px-4 py-4 font-medium">标注时间</th>
            <th className="px-4 py-4 font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-800/50">
          {data.slice(0, 100).map((item) => {
            let winsA = 0, winsB = 0
            Object.values(item.result.dimensions).forEach((dim) => {
              if (dim.comparison === 'A>B') winsA++
              else if (dim.comparison === 'A<B') winsB++
            })
            const overallResult = winsA > winsB ? 'A wins' : winsB > winsA ? 'B wins' : 'Tie'
            
            return (
              <tr key={item.sample.sample_id} className="hover:bg-surface-800/30 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-sm text-white font-medium truncate block max-w-[180px]" title={item.sample.sample_id}>
                    {item.sample.sample_id}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <span className="text-sm text-surface-400 truncate block" title={item.sample.prompt}>
                    {item.sample.prompt}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-accent-400 font-medium">{item.result.video_a_model}</td>
                <td className="px-4 py-3 text-sm text-orange-400 font-medium">{item.result.video_b_model}</td>
                <td className="px-4 py-3 text-center">
                  <span className="text-lg font-bold text-green-400">{winsA}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-lg font-bold text-red-400">{winsB}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={clsx(
                    'px-2.5 py-1 rounded-lg text-xs font-bold',
                    winsA > winsB ? 'bg-green-500/15 text-green-400' :
                    winsB > winsA ? 'bg-red-500/15 text-red-400' :
                    'bg-surface-700 text-surface-400'
                  )}>
                    {overallResult}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-cyan-400 font-medium">{item.annotatorId}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-surface-500">
                    {new Date(item.result.annotated_at).toLocaleDateString()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onViewDetail(item)}
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
      {data.length === 0 && (
        <div className="p-12 text-center text-surface-500">没有找到匹配的结果</div>
      )}
    </div>
  )
}

// Score Result Table
function ScoreResultTable({ data, onViewDetail }: { data: CombinedScoreData[]; onViewDetail: (d: CombinedScoreData) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-surface-400 text-sm border-b border-surface-800 bg-surface-900/50">
            <th className="px-4 py-4 font-medium">Sample ID</th>
            <th className="px-4 py-4 font-medium max-w-[200px]">Prompt</th>
            <th className="px-4 py-4 font-medium">Model</th>
            <th className="px-4 py-4 font-medium text-center">维度分数</th>
            <th className="px-4 py-4 font-medium text-center">平均分</th>
            <th className="px-4 py-4 font-medium">标注人员</th>
            <th className="px-4 py-4 font-medium">标注时间</th>
            <th className="px-4 py-4 font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-800/50">
          {data.slice(0, 100).map((item) => {
            const avgScore = Object.values(item.result.scores).reduce((sum, s) => sum + s.score, 0) / 5
            return (
              <tr key={item.sample.sample_id} className="hover:bg-surface-800/30 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-sm text-white font-medium truncate block max-w-[180px]" title={item.sample.sample_id}>
                    {item.sample.sample_id}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <span className="text-sm text-surface-400 truncate block" title={item.sample.prompt}>
                    {item.sample.prompt}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-accent-400 font-medium">{item.result.video_model}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    {DIMENSIONS.map((dim) => {
                      const score = item.result.scores[dim]?.score ?? 0
                      return (
                        <div
                          key={dim}
                          className={clsx(
                            'w-7 h-7 rounded flex items-center justify-center text-xs font-bold',
                            getScoreBgColor(score)
                          )}
                          title={DIMENSION_LABELS[dim]}
                        >
                          {score}
                        </div>
                      )
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={clsx('text-xl font-bold', getScoreTextColor(avgScore))}>
                    {avgScore.toFixed(1)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-cyan-400 font-medium">{item.annotatorId}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-surface-500">
                    {new Date(item.result.annotated_at).toLocaleDateString()}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onViewDetail(item)}
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
      {data.length === 0 && (
        <div className="p-12 text-center text-surface-500">没有找到匹配的结果</div>
      )}
    </div>
  )
}

// Pair Detail Modal
function PairDetailModal({ data, onClose }: { data: CombinedPairData; onClose: () => void }) {
  const { sample, result, annotatorId } = data
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-900 rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-surface-800">
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-900/80">
          <div>
            <h2 className="text-lg font-bold text-white">{sample.sample_id}</h2>
            <p className="text-sm text-surface-400">
              {result.video_a_model} vs {result.video_b_model}
              <span className="mx-2">•</span>
              <span className="text-cyan-400">标注人员: {annotatorId}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-surface-800 hover:bg-surface-700 flex items-center justify-center">
            <X className="w-5 h-5 text-surface-400" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {/* Prompt */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-surface-400 mb-2">Prompt</h3>
            <p className="text-surface-200 bg-surface-800/50 rounded-xl p-4 border border-surface-700/50">{sample.prompt}</p>
          </div>
          
          {/* Video Compare */}
          <div className="mb-6">
            <VideoCompare
              videoAUrl={sample.video_a_url}
              videoBUrl={sample.video_b_url}
              modelA={result.video_a_model}
              modelB={result.video_b_model}
            />
          </div>
          
          {/* Dimension Results */}
          <div>
            <h3 className="text-sm font-medium text-surface-400 mb-3">维度评估</h3>
            <div className="space-y-3">
              {Object.entries(result.dimensions).map(([dim, dimResult]) => (
                <div key={dim} className="bg-surface-800/50 rounded-xl p-4 border border-surface-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-white">
                      {DIMENSION_LABELS[dim as Dimension]}
                    </span>
                    <span className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm font-bold',
                      dimResult.comparison === 'A>B' ? 'bg-green-500/15 text-green-400' :
                      dimResult.comparison === 'A<B' ? 'bg-red-500/15 text-red-400' :
                      'bg-surface-700 text-surface-400'
                    )}>
                      {dimResult.comparison}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-surface-900/50 rounded-xl p-3">
                      <div className="text-xs text-surface-500 mb-1">Video A - {result.video_a_model}</div>
                      <div className={clsx('text-sm font-semibold mb-2', getLevelColor(dimResult.video_a.level))}>
                        {getLevelLabel(dimResult.video_a.level)}
                      </div>
                      {dimResult.video_a.major_reason && (
                        <p className="text-xs text-surface-300">主要: {dimResult.video_a.major_reason}</p>
                      )}
                      {dimResult.video_a.minor_reason && (
                        <p className="text-xs text-surface-400">次要: {dimResult.video_a.minor_reason}</p>
                      )}
                    </div>
                    <div className="bg-surface-900/50 rounded-xl p-3">
                      <div className="text-xs text-surface-500 mb-1">Video B - {result.video_b_model}</div>
                      <div className={clsx('text-sm font-semibold mb-2', getLevelColor(dimResult.video_b.level))}>
                        {getLevelLabel(dimResult.video_b.level)}
                      </div>
                      {dimResult.video_b.major_reason && (
                        <p className="text-xs text-surface-300">主要: {dimResult.video_b.major_reason}</p>
                      )}
                      {dimResult.video_b.minor_reason && (
                        <p className="text-xs text-surface-400">次要: {dimResult.video_b.minor_reason}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Score Detail Modal
function ScoreDetailModal({ data, onClose }: { data: CombinedScoreData; onClose: () => void }) {
  const { sample, result, annotatorId } = data
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-surface-800">
        <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-900/80">
          <div>
            <h2 className="text-lg font-bold text-white">{sample.sample_id}</h2>
            <p className="text-sm text-surface-400">
              {result.video_model}
              <span className="mx-2">•</span>
              <span className="text-cyan-400">标注人员: {annotatorId}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-surface-800 hover:bg-surface-700 flex items-center justify-center">
            <X className="w-5 h-5 text-surface-400" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {/* Prompt */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-surface-400 mb-2">Prompt</h3>
            <p className="text-surface-200 bg-surface-800/50 rounded-xl p-4 border border-surface-700/50">{sample.prompt}</p>
          </div>
          
          {/* Video */}
          <div className="mb-6">
            <video
              src={sample.video_url}
              controls
              className="w-full rounded-xl bg-black"
            />
          </div>
          
          {/* Scores - updated to show problem level prominently like Pair mode */}
          <div>
            <h3 className="text-sm font-medium text-surface-400 mb-3">维度评分</h3>
            <div className="space-y-3">
              {Object.entries(result.scores).map(([dim, score]) => (
                <div key={dim} className="bg-surface-800/50 rounded-xl p-4 border border-surface-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-white">
                      {DIMENSION_LABELS[dim as Dimension]}
                    </span>
                    <div className="flex items-center gap-3">
                      {/* Problem level badge - like Pair mode */}
                      <span className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-bold',
                        getScoreLevelBgColor(score.score)
                      )}>
                        {getScoreLevelLabel(score.score)}
                      </span>
                      <span className={clsx('text-3xl font-bold', getScoreTextColor(score.score))}>
                        {score.score}
                      </span>
                    </div>
                  </div>
                  
                  {/* Reason details with same layout as Pair mode */}
                  <div className="bg-surface-900/50 rounded-xl p-3">
                    <div className="text-xs text-surface-500 mb-2">问题详情</div>
                    {score.major_reason ? (
                      <p className="text-sm text-surface-300 mb-1">
                        <span className="text-red-400 font-medium mr-2">主要问题:</span>
                        {score.major_reason}
                      </p>
                    ) : (
                      <p className="text-sm text-surface-500 italic mb-1">无主要问题</p>
                    )}
                    {score.minor_reason ? (
                      <p className="text-sm text-surface-400">
                        <span className="text-amber-400 font-medium mr-2">次要问题:</span>
                        {score.minor_reason}
                      </p>
                    ) : (
                      <p className="text-sm text-surface-500 italic">无次要问题</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper Functions
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

function getScoreBgColor(score: number): string {
  if (score >= 5) return 'bg-green-500/20 text-green-400'
  if (score >= 4) return 'bg-sky-500/20 text-sky-400'
  if (score >= 3) return 'bg-amber-500/20 text-amber-400'
  if (score >= 2) return 'bg-orange-500/20 text-orange-400'
  return 'bg-red-500/20 text-red-400'
}

function getScoreTextColor(score: number): string {
  if (score >= 4.5) return 'text-green-400'
  if (score >= 3.5) return 'text-sky-400'
  if (score >= 2.5) return 'text-amber-400'
  if (score >= 1.5) return 'text-orange-400'
  return 'text-red-400'
}

// Convert score to problem level label (like Pair mode's level labels)
function getScoreLevelLabel(score: number): string {
  if (score >= 5) return '无问题'
  if (score >= 4) return '轻微问题'
  if (score >= 3) return '次要问题'
  if (score >= 2) return '主要问题'
  return '严重问题'
}

// Convert score to problem level background color (like Pair mode)
function getScoreLevelBgColor(score: number): string {
  if (score >= 5) return 'bg-green-500/15 text-green-400'
  if (score >= 4) return 'bg-sky-500/15 text-sky-400'
  if (score >= 3) return 'bg-amber-500/15 text-amber-400'
  if (score >= 2) return 'bg-orange-500/15 text-orange-400'
  return 'bg-red-500/15 text-red-400'
}
