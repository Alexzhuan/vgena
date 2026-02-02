import { useCallback } from 'react'
import { AnalysisHeader, FileUploader, type UploadedFileInfo } from '../../components/analysis'
import { useAnalysisStore } from '../../stores/analysisStore'
import { DIMENSION_LABELS, type Dimension } from '../../types'
import { Loader2, RefreshCw } from 'lucide-react'

export function AnalysisDashboard() {
  const { 
    isLoading, 
    error, 
    pairResults, 
    scoreResults, 
    modelStats,
    consistencyStats,
    uploadedFiles,
    hasData,
    loadFromUploadedFiles,
    clearData,
  } = useAnalysisStore()
  
  const handleFilesReady = useCallback((files: UploadedFileInfo[]) => {
    const validFiles = files.filter(f => f.status === 'parsed' && f.content)
    loadFromUploadedFiles(validFiles.map(f => ({
      name: f.name,
      mode: f.mode as 'pair' | 'score',
      sampleCount: f.sampleCount,
      content: f.content,
    })))
  }, [loadFromUploadedFiles])
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-950">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-accent-500 mx-auto mb-4" />
          <p className="text-surface-400">处理数据中...</p>
        </div>
      </div>
    )
  }
  
  // Show error state with option to retry upload
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-950">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-red-400 mb-2 text-lg font-medium">处理失败</p>
          <p className="text-surface-500 text-sm mb-6">{error}</p>
          <button
            onClick={clearData}
            className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 text-white rounded-xl font-medium transition-colors"
          >
            重新上传
          </button>
        </div>
      </div>
    )
  }
  
  // Show upload interface when no data is loaded
  if (!hasData()) {
    return (
      <div className="flex flex-col h-full bg-surface-950">
        <AnalysisHeader title="标注结果分析平台" subtitle="上传标注结果开始分析" />
        <div className="flex-1 overflow-auto">
          <FileUploader onFilesReady={handleFilesReady} isLoading={isLoading} />
        </div>
      </div>
    )
  }
  
  // Show data dashboard
  return (
    <div className="flex flex-col h-full bg-surface-950">
      <AnalysisHeader title="总览" subtitle="标注数据概览与分析" />
      <div className="flex-1 overflow-auto p-6">
        {/* Uploaded Files Info & Clear Button */}
        <div className="flex items-center justify-between mb-6 p-4 bg-surface-900/50 rounded-xl border border-surface-800">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-surface-400">已加载文件:</span>
            {uploadedFiles.map((file) => (
              <span 
                key={file.name} 
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium
                  ${file.mode === 'pair' 
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                    : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  }
                `}
              >
                {file.name.length > 30 ? file.name.slice(0, 27) + '...' : file.name}
                <span className="ml-2 opacity-60">({file.sampleCount})</span>
              </span>
            ))}
          </div>
          <button
            onClick={clearData}
            className="flex items-center gap-2 px-4 py-2 text-sm text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重新上传
          </button>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            title="Pair 样本数"
            value={pairResults?.completed_samples ?? 0}
            color="green"
          />
          <StatCard
            title="Score 样本数"
            value={scoreResults?.completed_samples ?? 0}
            color="sky"
          />
          <StatCard
            title="模型数量"
            value={modelStats.length}
            color="accent"
          />
          <StatCard
            title="一致率 (Hard)"
            value={consistencyStats ? `${((consistencyStats.hardMatchRate ?? 0) * 100).toFixed(1)}%` : '-'}
            color="amber"
          />
        </div>
        
        {/* Model Ranking Preview */}
        {modelStats.length > 0 && (
          <div className="bg-surface-900 rounded-2xl border border-surface-800 mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-800 bg-surface-900/50">
              <h2 className="text-lg font-semibold text-white">模型排名 (按ELO)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-surface-400 text-sm bg-surface-900/30">
                    <th className="px-6 py-4 font-medium">排名</th>
                    <th className="px-6 py-4 font-medium">模型</th>
                    <th className="px-6 py-4 font-medium">ELO</th>
                    <th className="px-6 py-4 font-medium">胜率</th>
                    <th className="px-6 py-4 font-medium">胜/负/平</th>
                    {Object.keys(DIMENSION_LABELS).map((dim) => (
                      <th key={dim} className="px-4 py-4 font-medium text-center">
                        {DIMENSION_LABELS[dim as Dimension].slice(0, 2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/50">
                  {modelStats.slice(0, 10).map((stat, index) => (
                    <tr key={stat.model} className="hover:bg-surface-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${
                          index === 0 ? 'bg-amber-500/20 text-amber-400' :
                          index === 1 ? 'bg-surface-400/20 text-surface-300' :
                          index === 2 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-surface-800 text-surface-500'
                        }`}>
                          #{index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">{stat.model}</td>
                      <td className="px-6 py-4">
                        <span className="text-accent-400 font-mono font-bold">{stat.elo}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-2 bg-surface-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-accent-500 to-accent-400 rounded-full"
                              style={{ width: `${stat.winRate * 100}%` }}
                            />
                          </div>
                          <span className="text-surface-300 text-sm font-medium">
                            {(stat.winRate * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="text-green-400 font-medium">{stat.wins}</span>
                        <span className="text-surface-600 mx-1">/</span>
                        <span className="text-red-400 font-medium">{stat.losses}</span>
                        <span className="text-surface-600 mx-1">/</span>
                        <span className="text-surface-500">{stat.ties}</span>
                      </td>
                      {Object.keys(DIMENSION_LABELS).map((dim) => (
                        <td key={dim} className="px-4 py-4 text-center">
                          <span className={`font-mono font-medium ${getScoreColor(stat.avgScores[dim as Dimension])}`}>
                            {stat.avgScores[dim as Dimension]?.toFixed(1) || '-'}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Consistency Preview */}
        {consistencyStats && (
          <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-800 bg-surface-900/50">
              <h2 className="text-lg font-semibold text-white">Pair与Score一致性</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-surface-800/50 rounded-xl p-4 border border-surface-700/50">
                  <div className="text-sm text-surface-400 mb-1">匹配样本数</div>
                  <div className="text-2xl font-bold text-white">
                    {consistencyStats.totalMatched}
                  </div>
                </div>
                <div className="bg-surface-800/50 rounded-xl p-4 border border-surface-700/50">
                  <div className="text-sm text-surface-400 mb-1">Hard Match 一致率</div>
                  <div className="text-2xl font-bold text-green-400">
                    {(consistencyStats.hardMatchRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-surface-800/50 rounded-xl p-4 border border-surface-700/50">
                  <div className="text-sm text-surface-400 mb-1">Soft Match 一致率</div>
                  <div className="text-2xl font-bold text-sky-400">
                    {(consistencyStats.softMatchRate * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="bg-surface-800/50 rounded-xl p-4 border border-surface-700/50">
                  <div className="text-sm text-surface-400 mb-1">不一致样本数</div>
                  <div className="text-2xl font-bold text-red-400">
                    {consistencyStats.inconsistentSamples.length}
                  </div>
                </div>
              </div>
              
              {/* Dimension breakdown */}
              <div className="grid grid-cols-5 gap-3">
                {Object.entries(consistencyStats.byDimension).map(([dim, stats]) => (
                  <div key={dim} className="bg-surface-800/30 rounded-xl p-4 text-center border border-surface-700/30">
                    <div className="text-xs text-surface-400 mb-2 font-medium">
                      {DIMENSION_LABELS[dim as Dimension]}
                    </div>
                    <div className="text-xl font-bold text-white mb-1">
                      {(stats.hardMatchRate * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-surface-500">
                      {stats.hardMatchConsistent}/{stats.total}
                    </div>
                    <div className="mt-2 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          stats.hardMatchRate >= 0.8 ? 'bg-green-500' :
                          stats.hardMatchRate >= 0.6 ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${stats.hardMatchRate * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* No consistency data message */}
        {!consistencyStats && pairResults && scoreResults && (
          <div className="bg-surface-900/50 rounded-2xl border border-surface-700 p-8 text-center">
            <p className="text-surface-400">无法计算一致性：pair和score数据没有匹配的样本</p>
          </div>
        )}
        
        {/* Only one type of data loaded */}
        {!consistencyStats && !(pairResults && scoreResults) && (
          <div className="bg-surface-900/50 rounded-2xl border border-surface-700 p-8 text-center">
            <p className="text-surface-400">
              {pairResults ? '仅加载了 Pair 数据' : '仅加载了 Score 数据'}
              ，上传两种类型的数据可查看一致性分析
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number | string
  color: 'green' | 'sky' | 'accent' | 'amber'
}

function StatCard({ title, value, color }: StatCardProps) {
  const colorClasses = {
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    accent: 'bg-accent-500/10 text-accent-400 border-accent-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }
  
  return (
    <div className={`rounded-2xl border p-5 ${colorClasses[color]}`}>
      <p className="text-surface-400 text-sm mb-2">{title}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  )
}

function getScoreColor(score: number): string {
  if (score >= 4.5) return 'text-green-400'
  if (score >= 3.5) return 'text-sky-400'
  if (score >= 2.5) return 'text-amber-400'
  if (score >= 1.5) return 'text-orange-400'
  return 'text-red-400'
}
