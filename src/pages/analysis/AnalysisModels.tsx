import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnalysisHeader } from '../../components/analysis'
import { useAnalysisStore } from '../../stores/analysisStore'
import { DIMENSION_LABELS, DIMENSIONS } from '../../types'
import type { Dimension } from '../../types'
import { generateWinRateMatrix } from '../../utils/analysis'
import { Upload } from 'lucide-react'
import clsx from 'clsx'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

type ViewTab = 'ranking' | 'radar' | 'heatmap' | 'distribution' | 'overall'

const COLORS = ['#8b5cf6', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444']
const COMPARISON_COLORS = ['#22c55e', '#ef4444', '#71717a']
const SCORE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#0ea5e9', '#22c55e']

export function AnalysisModels() {
  const { modelStats, pairResults, scoreResults, combinedPairData, combinedScoreData, isLoading } = useAnalysisStore()
  const [activeTab, setActiveTab] = useState<ViewTab>('ranking')
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  
  const winRateMatrix = useMemo(() => {
    if (!pairResults) return null
    return generateWinRateMatrix(pairResults.results)
  }, [pairResults])
  
  const radarData = useMemo(() => {
    const models = selectedModels.length > 0 
      ? modelStats.filter(m => selectedModels.includes(m.model))
      : modelStats.slice(0, 5)
    
    return DIMENSIONS.map(dim => {
      const entry: Record<string, string | number> = { dimension: DIMENSION_LABELS[dim] }
      models.forEach(m => { entry[m.model] = m.avgScores[dim] || 0 })
      return entry
    })
  }, [modelStats, selectedModels])
  
  const radarModels = useMemo(() => {
    if (selectedModels.length > 0) return selectedModels
    return modelStats.slice(0, 5).map(m => m.model)
  }, [modelStats, selectedModels])
  
  // Per-dimension score distribution for model comparison
  const dimensionScoreData = useMemo(() => {
    return DIMENSIONS.map(dim => ({
      dimension: dim,
      label: DIMENSION_LABELS[dim],
      data: modelStats.map(stat => ({
        model: stat.model,
        score: stat.avgScores[dim] || 0,
      })).sort((a, b) => b.score - a.score),
    }))
  }, [modelStats])
  
  // Overall comparison distribution data
  const comparisonDistribution = useMemo(() => {
    if (!pairResults) return { total: [], byDimension: {} as Record<Dimension, { name: string; value: number }[]> }
    
    const totalCounts = { 'A>B': 0, 'A<B': 0, 'A=B': 0 }
    const dimCounts: Record<Dimension, { 'A>B': number; 'A<B': number; 'A=B': number }> = {
      text_consistency: { 'A>B': 0, 'A<B': 0, 'A=B': 0 },
      temporal_consistency: { 'A>B': 0, 'A<B': 0, 'A=B': 0 },
      visual_quality: { 'A>B': 0, 'A<B': 0, 'A=B': 0 },
      distortion: { 'A>B': 0, 'A<B': 0, 'A=B': 0 },
      motion_quality: { 'A>B': 0, 'A<B': 0, 'A=B': 0 },
    }
    
    pairResults.results.forEach(result => {
      DIMENSIONS.forEach(dim => {
        const comparison = result.dimensions[dim].comparison
        totalCounts[comparison]++
        dimCounts[dim][comparison]++
      })
    })
    
    const total = [
      { name: 'A优于B', value: totalCounts['A>B'], key: 'A>B' },
      { name: 'A劣于B', value: totalCounts['A<B'], key: 'A<B' },
      { name: '持平', value: totalCounts['A=B'], key: 'A=B' },
    ]
    
    const byDimension: Record<Dimension, { name: string; value: number }[]> = {} as Record<Dimension, { name: string; value: number }[]>
    DIMENSIONS.forEach(dim => {
      byDimension[dim] = [
        { name: 'A>B', value: dimCounts[dim]['A>B'] },
        { name: 'A<B', value: dimCounts[dim]['A<B'] },
        { name: 'A=B', value: dimCounts[dim]['A=B'] },
      ]
    })
    
    return { total, byDimension }
  }, [pairResults])
  
  // Overall score distribution data
  const scoreDistribution = useMemo(() => {
    if (!scoreResults) return { total: [], byDimension: {} as Record<Dimension, { score: string; count: number }[]> }
    
    const totalCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const dimCounts: Record<Dimension, Record<number, number>> = {
      text_consistency: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      temporal_consistency: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      visual_quality: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      distortion: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      motion_quality: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    }
    
    scoreResults.results.forEach(result => {
      DIMENSIONS.forEach(dim => {
        const score = result.scores[dim].score
        totalCounts[score]++
        dimCounts[dim][score]++
      })
    })
    
    const total = [1, 2, 3, 4, 5].map(score => ({
      score: score.toString(),
      count: totalCounts[score],
    }))
    
    const byDimension: Record<Dimension, { score: string; count: number }[]> = {} as Record<Dimension, { score: string; count: number }[]>
    DIMENSIONS.forEach(dim => {
      byDimension[dim] = [1, 2, 3, 4, 5].map(score => ({
        score: score.toString(),
        count: dimCounts[dim][score],
      }))
    })
    
    return { total, byDimension }
  }, [scoreResults])
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-950">
        <div className="animate-spin w-12 h-12 border-4 border-accent-500 border-t-transparent rounded-full" />
      </div>
    )
  }
  
  if (modelStats.length === 0) {
    return (
      <div className="flex flex-col h-full bg-surface-950">
        <AnalysisHeader title="模型分析" subtitle="模型性能对比与排名" />
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
      <AnalysisHeader title="模型分析" subtitle="模型性能对比与排名" />
      <div className="flex-1 overflow-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-surface-900 rounded-xl p-1 mb-6 w-fit border border-surface-800">
          {[
            { id: 'ranking', label: '排名表' },
            { id: 'radar', label: '雷达图' },
            { id: 'heatmap', label: '胜率热力图' },
            { id: 'distribution', label: '分数分布' },
            { id: 'overall', label: '整体分布' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ViewTab)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Ranking Table */}
        {activeTab === 'ranking' && (
          <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-surface-400 text-sm border-b border-surface-800 bg-surface-900/50">
                    <th className="px-6 py-4 font-medium">排名</th>
                    <th className="px-6 py-4 font-medium">模型</th>
                    <th className="px-6 py-4 font-medium">ELO</th>
                    <th className="px-6 py-4 font-medium">胜率</th>
                    <th className="px-6 py-4 font-medium">胜/负/平</th>
                    {DIMENSIONS.map(dim => (
                      <th key={dim} className="px-4 py-4 font-medium text-center whitespace-nowrap">
                        {DIMENSION_LABELS[dim]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800/50">
                  {modelStats.map((stat, index) => (
                    <tr key={stat.model} className="hover:bg-surface-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className={clsx(
                          'inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold',
                          index === 0 ? 'bg-amber-500/20 text-amber-400' :
                          index === 1 ? 'bg-surface-400/20 text-surface-300' :
                          index === 2 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-surface-800 text-surface-500'
                        )}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-white">{stat.model}</td>
                      <td className="px-6 py-4 font-mono font-bold text-accent-400">{stat.elo}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-surface-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-accent-500 to-accent-400 rounded-full"
                              style={{ width: `${stat.winRate * 100}%` }}
                            />
                          </div>
                          <span className="text-surface-300 text-sm font-medium w-14">
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
                      {DIMENSIONS.map(dim => (
                        <td key={dim} className="px-4 py-4 text-center">
                          <span className={clsx('font-mono font-medium', getScoreColor(stat.avgScores[dim]))}>
                            {stat.avgScores[dim]?.toFixed(2) || '-'}
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
        
        {/* Radar Chart */}
        {activeTab === 'radar' && (
          <div className="bg-surface-900 rounded-2xl border border-surface-800 p-6">
            <div className="mb-4">
              <label className="text-sm text-surface-400 mb-3 block font-medium">选择模型（最多5个）</label>
              <div className="flex flex-wrap gap-2">
                {modelStats.map(stat => (
                  <button
                    key={stat.model}
                    onClick={() => {
                      if (selectedModels.includes(stat.model)) {
                        setSelectedModels(selectedModels.filter(m => m !== stat.model))
                      } else if (selectedModels.length < 5) {
                        setSelectedModels([...selectedModels, stat.model])
                      }
                    }}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                      selectedModels.includes(stat.model)
                        ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20'
                        : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                    )}
                  >
                    {stat.model}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#3f3f46" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fill: '#71717a' }} />
                  {radarModels.map((model, index) => (
                    <Radar
                      key={model}
                      name={model}
                      dataKey={model}
                      stroke={COLORS[index % COLORS.length]}
                      fill={COLORS[index % COLORS.length]}
                      fillOpacity={0.2}
                    />
                  ))}
                  <Legend />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#27272a',
                      border: '1px solid #3f3f46',
                      borderRadius: '12px',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Heatmap */}
        {activeTab === 'heatmap' && winRateMatrix && (
          <div className="bg-surface-900 rounded-2xl border border-surface-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">模型对战胜率矩阵</h3>
            <p className="text-sm text-surface-400 mb-6">
              行模型 vs 列模型的胜率（基于5个维度的多数胜出）
            </p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className="p-3 text-left text-surface-400 text-sm font-medium">vs</th>
                    {winRateMatrix.models.map(model => (
                      <th key={model} className="p-3 text-center text-surface-400 text-xs font-medium whitespace-nowrap">
                        {model}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {winRateMatrix.models.map((rowModel, rowIndex) => (
                    <tr key={rowModel}>
                      <td className="p-3 text-sm text-surface-300 font-medium whitespace-nowrap">{rowModel}</td>
                      {winRateMatrix.matrix[rowIndex].map((winRate, colIndex) => (
                        <td
                          key={colIndex}
                          className="p-3 text-center text-sm font-medium rounded"
                          style={{
                            backgroundColor: getHeatmapColor(winRate),
                            color: winRate >= 0 ? (winRate > 0.5 ? '#fff' : '#000') : '#71717a',
                          }}
                        >
                          {winRate >= 0 ? (winRate * 100).toFixed(0) + '%' : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center mt-6 gap-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded" style={{ backgroundColor: 'rgb(239, 68, 68)' }} />
                <span className="text-sm text-surface-400">0%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded" style={{ backgroundColor: 'rgb(113, 113, 122)' }} />
                <span className="text-sm text-surface-400">50%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded" style={{ backgroundColor: 'rgb(34, 197, 94)' }} />
                <span className="text-sm text-surface-400">100%</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Score Distribution - Separate charts per dimension */}
        {activeTab === 'distribution' && (
          <div className="space-y-6">
            <div className="bg-surface-900 rounded-2xl border border-surface-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-2">各维度模型平均分对比</h3>
              <p className="text-sm text-surface-400 mb-6">
                每个维度独立展示各模型的平均分，便于清晰对比
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {dimensionScoreData.map((dimData, dimIndex) => (
                <div key={dimData.dimension} className="bg-surface-900 rounded-2xl border border-surface-800 p-5">
                  <h4 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[dimIndex % COLORS.length] }}
                    />
                    {dimData.label}
                  </h4>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dimData.data}
                        layout="vertical"
                        margin={{ left: 100, right: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" horizontal={false} />
                        <XAxis 
                          type="number" 
                          domain={[0, 5]} 
                          tick={{ fill: '#a1a1aa', fontSize: 11 }}
                          tickCount={6}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="model" 
                          tick={{ fill: '#a1a1aa', fontSize: 11 }}
                          width={95}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#27272a',
                            border: '1px solid #3f3f46',
                            borderRadius: '12px',
                          }}
                          formatter={(value) => [typeof value === 'number' ? value.toFixed(2) : '-', '平均分']}
                        />
                        <Bar
                          dataKey="score"
                          fill={COLORS[dimIndex % COLORS.length]}
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Overall Distribution - Batch-level analysis */}
        {activeTab === 'overall' && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-surface-900 rounded-2xl border border-surface-800 p-5">
                <p className="text-surface-400 text-sm mb-1">Pair 样本数</p>
                <p className="text-3xl font-bold text-white">
                  {combinedPairData.length}
                </p>
              </div>
              <div className="bg-surface-900 rounded-2xl border border-surface-800 p-5">
                <p className="text-surface-400 text-sm mb-1">Score 样本数</p>
                <p className="text-3xl font-bold text-white">
                  {combinedScoreData.length}
                </p>
              </div>
              <div className="bg-surface-900 rounded-2xl border border-surface-800 p-5">
                <p className="text-surface-400 text-sm mb-1">Pair 总评估数</p>
                <p className="text-3xl font-bold text-accent-400">
                  {combinedPairData.length * 5}
                </p>
                <p className="text-xs text-surface-500 mt-1">({combinedPairData.length} 样本 × 5 维度)</p>
              </div>
              <div className="bg-surface-900 rounded-2xl border border-surface-800 p-5">
                <p className="text-surface-400 text-sm mb-1">Score 总评估数</p>
                <p className="text-3xl font-bold text-accent-400">
                  {combinedScoreData.length * 5}
                </p>
                <p className="text-xs text-surface-500 mt-1">({combinedScoreData.length} 样本 × 5 维度)</p>
              </div>
            </div>
            
            {/* Comparison Distribution */}
            {pairResults && (
              <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-surface-800 bg-surface-900/50">
                  <h3 className="text-lg font-semibold text-white">对比结果分布</h3>
                  <p className="text-sm text-surface-400 mt-1">全部 Pair 标注中 A&gt;B / A&lt;B / A=B 的整体分布</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Pie Chart - Overall */}
                    <div>
                      <h4 className="text-sm font-medium text-surface-400 mb-4">整体分布</h4>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={comparisonDistribution.total}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, value, percent }) => `${name}: ${value} (${((percent ?? 0) * 100).toFixed(1)}%)`}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {comparisonDistribution.total.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COMPARISON_COLORS[index % COMPARISON_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#27272a',
                                border: '1px solid #3f3f46',
                                borderRadius: '12px',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COMPARISON_COLORS[0] }} />
                          <span className="text-sm text-surface-400">A优于B</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COMPARISON_COLORS[1] }} />
                          <span className="text-sm text-surface-400">A劣于B</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COMPARISON_COLORS[2] }} />
                          <span className="text-sm text-surface-400">持平</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Bar Chart - By Dimension */}
                    <div>
                      <h4 className="text-sm font-medium text-surface-400 mb-4">分维度分布</h4>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={DIMENSIONS.map(dim => ({
                              dimension: DIMENSION_LABELS[dim],
                              'A>B': comparisonDistribution.byDimension[dim]?.[0]?.value || 0,
                              'A<B': comparisonDistribution.byDimension[dim]?.[1]?.value || 0,
                              'A=B': comparisonDistribution.byDimension[dim]?.[2]?.value || 0,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                            <XAxis dataKey="dimension" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#a1a1aa' }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#27272a',
                                border: '1px solid #3f3f46',
                                borderRadius: '12px',
                              }}
                            />
                            <Legend />
                            <Bar dataKey="A>B" name="A优于B" fill={COMPARISON_COLORS[0]} stackId="a" />
                            <Bar dataKey="A<B" name="A劣于B" fill={COMPARISON_COLORS[1]} stackId="a" />
                            <Bar dataKey="A=B" name="持平" fill={COMPARISON_COLORS[2]} stackId="a" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Score Distribution */}
            {scoreResults && (
              <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-surface-800 bg-surface-900/50">
                  <h3 className="text-lg font-semibold text-white">打分分布</h3>
                  <p className="text-sm text-surface-400 mt-1">全部 Score 标注中 1-5 分的整体分布</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Histogram - Overall */}
                    <div>
                      <h4 className="text-sm font-medium text-surface-400 mb-4">整体分数分布</h4>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={scoreDistribution.total}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                            <XAxis dataKey="score" tick={{ fill: '#a1a1aa' }} />
                            <YAxis tick={{ fill: '#a1a1aa' }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#27272a',
                                border: '1px solid #3f3f46',
                                borderRadius: '12px',
                              }}
                              formatter={(value) => [typeof value === 'number' ? value : 0, '数量']}
                            />
                            <Bar dataKey="count" name="数量" radius={[4, 4, 0, 0]}>
                              {scoreDistribution.total.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={SCORE_COLORS[index]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-4 mt-4 flex-wrap">
                        {[1, 2, 3, 4, 5].map((score, index) => (
                          <div key={score} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: SCORE_COLORS[index] }} />
                            <span className="text-xs text-surface-400">{score}分</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Stacked Bar - By Dimension */}
                    <div>
                      <h4 className="text-sm font-medium text-surface-400 mb-4">分维度分数分布</h4>
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={DIMENSIONS.map(dim => ({
                              dimension: DIMENSION_LABELS[dim],
                              '1分': scoreDistribution.byDimension[dim]?.[0]?.count || 0,
                              '2分': scoreDistribution.byDimension[dim]?.[1]?.count || 0,
                              '3分': scoreDistribution.byDimension[dim]?.[2]?.count || 0,
                              '4分': scoreDistribution.byDimension[dim]?.[3]?.count || 0,
                              '5分': scoreDistribution.byDimension[dim]?.[4]?.count || 0,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                            <XAxis dataKey="dimension" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                            <YAxis tick={{ fill: '#a1a1aa' }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#27272a',
                                border: '1px solid #3f3f46',
                                borderRadius: '12px',
                              }}
                            />
                            <Legend />
                            {['1分', '2分', '3分', '4分', '5分'].map((key, index) => (
                              <Bar key={key} dataKey={key} fill={SCORE_COLORS[index]} stackId="a" />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Statistics Summary Table */}
            <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-surface-800 bg-surface-900/50">
                <h3 className="text-lg font-semibold text-white">分维度统计摘要</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-surface-400 text-sm border-b border-surface-800 bg-surface-900/30">
                      <th className="px-6 py-4 font-medium">维度</th>
                      <th className="px-4 py-4 font-medium text-center">A&gt;B</th>
                      <th className="px-4 py-4 font-medium text-center">A&lt;B</th>
                      <th className="px-4 py-4 font-medium text-center">A=B</th>
                      <th className="px-4 py-4 font-medium text-center">1分</th>
                      <th className="px-4 py-4 font-medium text-center">2分</th>
                      <th className="px-4 py-4 font-medium text-center">3分</th>
                      <th className="px-4 py-4 font-medium text-center">4分</th>
                      <th className="px-4 py-4 font-medium text-center">5分</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800/50">
                    {DIMENSIONS.map(dim => (
                      <tr key={dim} className="hover:bg-surface-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{DIMENSION_LABELS[dim]}</td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-green-400 font-medium">
                            {comparisonDistribution.byDimension[dim]?.[0]?.value || 0}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-red-400 font-medium">
                            {comparisonDistribution.byDimension[dim]?.[1]?.value || 0}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-surface-400 font-medium">
                            {comparisonDistribution.byDimension[dim]?.[2]?.value || 0}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-red-400">{scoreDistribution.byDimension[dim]?.[0]?.count || 0}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-orange-400">{scoreDistribution.byDimension[dim]?.[1]?.count || 0}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-amber-400">{scoreDistribution.byDimension[dim]?.[2]?.count || 0}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-sky-400">{scoreDistribution.byDimension[dim]?.[3]?.count || 0}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="text-green-400">{scoreDistribution.byDimension[dim]?.[4]?.count || 0}</span>
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-surface-800/30 font-semibold">
                      <td className="px-6 py-4 text-white">合计</td>
                      <td className="px-4 py-4 text-center text-green-400">
                        {comparisonDistribution.total[0]?.value || 0}
                      </td>
                      <td className="px-4 py-4 text-center text-red-400">
                        {comparisonDistribution.total[1]?.value || 0}
                      </td>
                      <td className="px-4 py-4 text-center text-surface-400">
                        {comparisonDistribution.total[2]?.value || 0}
                      </td>
                      <td className="px-4 py-4 text-center text-red-400">
                        {scoreDistribution.total[0]?.count || 0}
                      </td>
                      <td className="px-4 py-4 text-center text-orange-400">
                        {scoreDistribution.total[1]?.count || 0}
                      </td>
                      <td className="px-4 py-4 text-center text-amber-400">
                        {scoreDistribution.total[2]?.count || 0}
                      </td>
                      <td className="px-4 py-4 text-center text-sky-400">
                        {scoreDistribution.total[3]?.count || 0}
                      </td>
                      <td className="px-4 py-4 text-center text-green-400">
                        {scoreDistribution.total[4]?.count || 0}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getScoreColor(score: number): string {
  if (!score) return 'text-surface-600'
  if (score >= 4.5) return 'text-green-400'
  if (score >= 3.5) return 'text-sky-400'
  if (score >= 2.5) return 'text-amber-400'
  if (score >= 1.5) return 'text-orange-400'
  return 'text-red-400'
}

function getHeatmapColor(value: number): string {
  if (value < 0) return 'transparent'
  if (value === 0.5) return 'rgb(113, 113, 122)'
  
  if (value < 0.5) {
    const t = value * 2
    const r = Math.round(239 - (239 - 113) * t)
    const g = Math.round(68 + (113 - 68) * t)
    const b = Math.round(68 + (122 - 68) * t)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    const t = (value - 0.5) * 2
    const r = Math.round(113 - (113 - 34) * t)
    const g = Math.round(113 + (197 - 113) * t)
    const b = Math.round(122 - (122 - 94) * t)
    return `rgb(${r}, ${g}, ${b})`
  }
}
