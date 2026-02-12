import { useState, useCallback, useMemo } from 'react'
import { AnalysisHeader, VideoCompare } from '../../components/analysis'
import { useQCResultStore } from '../../stores/qcResultStore'
import { DIMENSION_LABELS, DIMENSIONS } from '../../types'
import type { Dimension, PairSample, ScoreSample } from '../../types'
import type {
  QCScoreAgreementDetail,
  QCPairAgreementDetail,
  AnnotatorSkillMetrics,
  ClassifiedDisagreement,
  QCGroupedSample,
} from '../../types/analysis'
import {
  Upload,
  Trash2,
  Play,
  CheckCircle2,
  AlertTriangle,
  Search,
  Users,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  Target,
  Info,
  ArrowUpDown,
  X,
  Image,
} from 'lucide-react'
import clsx from 'clsx'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts'

// ============================================
// Color helpers
// ============================================

function getAlphaColor(alpha: number): string {
  if (alpha >= 0.8) return 'text-green-400'
  if (alpha >= 0.67) return 'text-amber-400'
  return 'text-red-400'
}

function getAlphaBgColor(alpha: number): string {
  if (alpha >= 0.8) return 'bg-green-500/10 border-green-500/20'
  if (alpha >= 0.67) return 'bg-amber-500/10 border-amber-500/20'
  return 'bg-red-500/10 border-red-500/20'
}

function getAlphaLabel(alpha: number): string {
  if (alpha >= 0.8) return '可靠'
  if (alpha >= 0.67) return '可接受'
  return '需关注'
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'text-green-400'
  if (score >= 0.6) return 'text-amber-400'
  return 'text-red-400'
}

function getRankBadgeColor(rank: number, total: number): string {
  const pct = rank / total
  if (pct <= 0.33) return 'bg-green-500/20 text-green-400 border-green-500/30'
  if (pct <= 0.66) return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  return 'bg-red-500/20 text-red-400 border-red-500/30'
}

// ============================================
// Main Component
// ============================================

export function AnalysisQCResults() {
  const {
    fileInfos,
    agreementStats,
    detection,
    isLoading,
    error,
    hasData,
    hasResults,
    loadAnnotatorResults,
    calculateAgreement,
    clearAll,
    getFilteredClassifiedDisagreements,
    getSampleDetails,
    getGroupedSample,
  } = useQCResultStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'alpha' | 'annotators' | 'dimensions' | 'disagreements'>('overview')
  const [sortField, setSortField] = useState<'rank' | 'compositeScore' | 'majorityAgreementRateHard' | 'majorityAgreementRateSoft'>('rank')
  const [sortAsc, setSortAsc] = useState(true)

  // Disagreements tab state
  // 'hard' = show ALL disagreements (values not identical); 'soft' = show only soft-match failures (serious disagreements)
  const [disagreeMatchView, setDisagreeMatchView] = useState<'hard' | 'soft'>('hard')
  const [disagreeSelectedDim, setDisagreeSelectedDim] = useState<Dimension | 'all'>('all')
  const [selectedDisagreement, setSelectedDisagreement] = useState<ClassifiedDisagreement | null>(null)
  const [disagreePage, setDisagreePage] = useState(1)
  const DISAGREE_PAGE_SIZE = 50

  // ============================================
  // File handlers
  // ============================================

  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
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

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // ============================================
  // Computed data
  // ============================================

  const classifiedDisagreements = getFilteredClassifiedDisagreements()

  // Per-dimension disagreement counts for the clickable dimension cards
  // Counts are filtered by current match view so the numbers match the list below
  const disagreeByDimCounts = useMemo(() => {
    const counts: Record<string, { hard_only: number; soft_fail: number; total: number }> = {}
    for (const dim of DIMENSIONS) {
      counts[dim] = { hard_only: 0, soft_fail: 0, total: 0 }
    }
    for (const cd of classifiedDisagreements) {
      const dim = cd.detail.dimension
      if (counts[dim]) {
        counts[dim][cd.matchCategory]++
        counts[dim].total++
      }
    }
    return counts
  }, [classifiedDisagreements])

  // Count per dimension filtered by current match view (for card highlight numbers)
  // 'hard' = all disagreements, 'soft' = only soft_fail items
  const disagreeByDimCountsFiltered = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const dim of DIMENSIONS) {
      counts[dim] = 0
    }
    for (const cd of classifiedDisagreements) {
      if (disagreeMatchView === 'hard' || cd.matchCategory === 'soft_fail') {
        const dim = cd.detail.dimension
        if (dim in counts) {
          counts[dim]++
        }
      }
    }
    return counts
  }, [classifiedDisagreements, disagreeMatchView])

  // Filtered disagreements: by match view, search, and selected dimension
  // 'hard' = all disagreements (values not identical); 'soft' = only soft_fail items
  const filteredClassified = useMemo(() => {
    let items = classifiedDisagreements
    // Filter by match category: 'hard' shows all, 'soft' shows only soft_fail
    if (disagreeMatchView === 'soft') {
      items = items.filter(cd => cd.matchCategory === 'soft_fail')
    }
    // Filter by dimension
    if (disagreeSelectedDim !== 'all') {
      items = items.filter(cd => cd.detail.dimension === disagreeSelectedDim)
    }
    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(cd => cd.detail.sampleId.toLowerCase().includes(q))
    }
    return items
  }, [classifiedDisagreements, disagreeMatchView, disagreeSelectedDim, searchQuery])

  const disagreeTotalPages = Math.max(1, Math.ceil(filteredClassified.length / DISAGREE_PAGE_SIZE))
  // Clamp current page to valid range (handles filter changes reducing total pages)
  const safeDisagreePage = Math.min(disagreePage, disagreeTotalPages)
  const disagreePageItems = filteredClassified.slice((safeDisagreePage - 1) * DISAGREE_PAGE_SIZE, safeDisagreePage * DISAGREE_PAGE_SIZE)

  const sortedAnnotatorSkills = useMemo(() => {
    if (!agreementStats) return []
    const skills = [...agreementStats.annotatorSkills]
    skills.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return skills
  }, [agreementStats, sortField, sortAsc])

  // Recharts data
  const dimensionAlphaData = useMemo(() => {
    if (!agreementStats) return []
    return DIMENSIONS.map(dim => ({
      name: DIMENSION_LABELS[dim],
      'Hard Alpha': +agreementStats.krippendorffHard.byDimension[dim].toFixed(3),
      'Soft Alpha': +agreementStats.krippendorffSoft.byDimension[dim].toFixed(3),
    }))
  }, [agreementStats])

  const radarAlphaData = useMemo(() => {
    if (!agreementStats) return []
    return DIMENSIONS.map(dim => ({
      dimension: DIMENSION_LABELS[dim],
      'Hard Alpha': +agreementStats.krippendorffHard.byDimension[dim].toFixed(3),
      'Soft Alpha': +agreementStats.krippendorffSoft.byDimension[dim].toFixed(3),
    }))
  }, [agreementStats])

  const annotatorBarData = useMemo(() => {
    if (!agreementStats) return []
    return agreementStats.annotatorSkills.map(s => ({
      name: s.annotatorId,
      '综合得分': +(s.compositeScore * 100).toFixed(1),
      '多数投票(Hard)': +(s.majorityAgreementRateHard * 100).toFixed(1),
      '多数投票(Soft)': +(s.majorityAgreementRateSoft * 100).toFixed(1),
    }))
  }, [agreementStats])

  // ============================================
  // Render
  // ============================================

  return (
    <div className="flex flex-col h-full bg-surface-950">
      <AnalysisHeader title="QC 质检结果" subtitle="基于重叠标注的标注员间一致性分析" />

      <div className="flex-1 overflow-auto p-6">
        {/* Top Bar */}
        <div className="flex items-center justify-end mb-6">
          <div className="flex items-center gap-2">
            {hasData() && (
              <button
                onClick={clearAll}
                className="flex items-center gap-2 px-4 py-2 text-sm text-surface-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                清空所有
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Section */}
        {!hasResults() && (
          <>
            <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-surface-800 bg-surface-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-accent-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-accent-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">上传标注结果文件</h3>
                    <p className="text-xs text-surface-500 mt-0.5">系统将自动检测 QC 样本（跨标注员的重复 sample_id）</p>
                  </div>
                </div>
                {fileInfos.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-surface-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="p-5">
                {fileInfos.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {fileInfos.map((info, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-accent-500/10 rounded-lg border border-accent-500/20"
                      >
                        <CheckCircle2 className="w-4 h-4 text-accent-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{info.name}</p>
                          <p className="text-xs text-surface-400">
                            {info.sampleCount} 样本 · {info.annotatorId} · {info.mode} 模式
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <label
                    className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-surface-700 rounded-xl cursor-pointer hover:border-accent-500/50 hover:bg-accent-500/5 transition-colors"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                  >
                    <Upload className="w-8 h-8 text-surface-500 mb-2" />
                    <span className="text-sm text-surface-400">拖拽或点击上传标注结果文件</span>
                    <span className="text-xs text-surface-500 mt-1">支持多个 .json 文件，无需上传 QC Manifest</span>
                    <input
                      type="file"
                      accept=".json"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Calculate Button */}
            {hasData() && (
              <div className="mb-6 flex justify-center">
                <button
                  onClick={calculateAgreement}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-6 py-3 bg-accent-600 hover:bg-accent-500 disabled:bg-surface-700 text-white rounded-xl font-medium transition-colors"
                >
                  <Play className="w-5 h-5" />
                  {isLoading ? '分析中...' : '开始分析'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-surface-400 text-sm">正在分析标注一致性...</span>
            </div>
          </div>
        )}

        {/* Results */}
        {agreementStats && !isLoading && (
          <>
            {/* Detection Info Banner */}
            {detection && (
              <div className="mb-6 p-4 bg-accent-500/10 border border-accent-500/20 rounded-xl flex items-center gap-3">
                <Info className="w-5 h-5 text-accent-400 flex-shrink-0" />
                <span className="text-sm text-accent-300">
                  自动检测到 <strong className="text-white">{detection.qcCount}</strong> 个 QC 样本
                  （每个被 <strong className="text-white">{detection.maxFrequency}</strong> 个标注员标注），
                  共 <strong className="text-white">{detection.annotatorCount}</strong> 个标注员，
                  模式：<strong className="text-white">{agreementStats.mode === 'pair' ? 'Pair' : agreementStats.mode === 'score' ? 'Score' : '混合'}</strong>
                </span>
              </div>
            )}

            {/* Tab Navigation */}
            <div className="flex gap-1 mb-6 bg-surface-900 rounded-xl p-1 border border-surface-800 w-fit">
              {[
                { id: 'overview' as const, label: '总览', icon: <BarChart3 className="w-4 h-4" /> },
                { id: 'alpha' as const, label: "Krippendorff's Alpha", icon: <Target className="w-4 h-4" /> },
                { id: 'annotators' as const, label: '标注员排名', icon: <Users className="w-4 h-4" /> },
                { id: 'dimensions' as const, label: '维度分析', icon: <TrendingUp className="w-4 h-4" /> },
                { id: 'disagreements' as const, label: '分歧详情', icon: <AlertTriangle className="w-4 h-4" /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    activeTab === tab.id
                      ? 'bg-accent-600 text-white shadow-lg shadow-accent-600/20'
                      : 'text-surface-400 hover:text-white'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <StatsCard
                    title="QC 样本匹配"
                    value={`${detection?.qcCount || 0}`}
                    subtitle={`共 ${detection?.totalUniqueSamples || 0} 个样本`}
                    icon={<ShieldCheck className="w-5 h-5" />}
                    color="accent"
                  />
                  <StatsCard
                    title="Hard Match Alpha"
                    value={agreementStats.krippendorffHard.alpha.toFixed(3)}
                    subtitle={getAlphaLabel(agreementStats.krippendorffHard.alpha)}
                    icon={<Target className="w-5 h-5" />}
                    color={agreementStats.krippendorffHard.alpha >= 0.8 ? 'green' : agreementStats.krippendorffHard.alpha >= 0.67 ? 'amber' : 'red'}
                  />
                  <StatsCard
                    title="Soft Match Alpha"
                    value={agreementStats.krippendorffSoft.alpha.toFixed(3)}
                    subtitle={getAlphaLabel(agreementStats.krippendorffSoft.alpha)}
                    icon={<Target className="w-5 h-5" />}
                    color={agreementStats.krippendorffSoft.alpha >= 0.8 ? 'green' : agreementStats.krippendorffSoft.alpha >= 0.67 ? 'amber' : 'red'}
                  />
                  <StatsCard
                    title="检查总数"
                    value={`${agreementStats.totalChecks}`}
                    subtitle={`${detection?.annotatorCount || 0} 个标注员`}
                    icon={<CheckCircle2 className="w-5 h-5" />}
                    color="sky"
                  />
                </div>

                {/* Quick Alpha Comparison */}
                <div className="grid grid-cols-2 gap-6">
                  <AlphaCard title="Hard Match Alpha" result={agreementStats.krippendorffHard} />
                  <AlphaCard title="Soft Match Alpha" result={agreementStats.krippendorffSoft} />
                </div>

                {/* Top Annotators Preview */}
                <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-surface-800">
                    <h3 className="font-semibold text-white">标注员综合得分排名</h3>
                  </div>
                  <div className="p-5">
                    <div className="space-y-2">
                      {agreementStats.annotatorSkills.slice(0, 5).map((skill) => (
                        <AnnotatorRow key={skill.annotatorId} skill={skill} total={agreementStats.annotatorSkills.length} />
                      ))}
                      {agreementStats.annotatorSkills.length > 5 && (
                        <button
                          onClick={() => setActiveTab('annotators')}
                          className="w-full text-center py-2 text-sm text-accent-400 hover:text-accent-300 transition-colors"
                        >
                          查看全部 {agreementStats.annotatorSkills.length} 个标注员 →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Alpha Tab */}
            {activeTab === 'alpha' && (
              <div className="space-y-6">
                {/* Alpha Cards */}
                <div className="grid grid-cols-2 gap-6">
                  <AlphaCard title="Hard Match Alpha" result={agreementStats.krippendorffHard} detailed />
                  <AlphaCard title="Soft Match Alpha" result={agreementStats.krippendorffSoft} detailed />
                </div>

                {/* Interpretation Guide */}
                <div className="bg-surface-900 rounded-2xl border border-surface-800 p-5">
                  <h3 className="font-semibold text-white mb-3">解读指南</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                      <p className="text-green-400 font-medium text-sm">alpha &ge; 0.80</p>
                      <p className="text-surface-400 text-xs mt-1">可靠 (Reliable) -- 标注员间一致性高</p>
                    </div>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                      <p className="text-amber-400 font-medium text-sm">0.67 &le; alpha &lt; 0.80</p>
                      <p className="text-surface-400 text-xs mt-1">可接受 (Acceptable) -- 可用于部分分析</p>
                    </div>
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <p className="text-red-400 font-medium text-sm">alpha &lt; 0.67</p>
                      <p className="text-surface-400 text-xs mt-1">需关注 (Questionable) -- 建议复审标注标准</p>
                    </div>
                  </div>
                </div>

                {/* Per-dimension Alpha Chart */}
                <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-surface-800">
                    <h3 className="font-semibold text-white">各维度 Krippendorff's Alpha</h3>
                  </div>
                  <div className="p-5 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dimensionAlphaData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <YAxis domain={[0, 1]} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="Hard Alpha" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Soft Alpha" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Hard vs Soft Match Description */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-surface-900 rounded-2xl border border-surface-800 p-5">
                    <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-violet-500" />
                      Hard Match 标准
                    </h4>
                    <ul className="text-sm text-surface-400 space-y-1.5">
                      <li>Score 模式：两个分数<strong className="text-surface-200">完全相同</strong>才算一致</li>
                      <li>Pair 模式：两个比较结果<strong className="text-surface-200">完全相同</strong>才算一致</li>
                    </ul>
                  </div>
                  <div className="bg-surface-900 rounded-2xl border border-surface-800 p-5">
                    <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      Soft Match 标准
                    </h4>
                    <ul className="text-sm text-surface-400 space-y-1.5">
                      <li>Score 模式：同问题等级，或跨 none/minor 差 1 分（5-4 可以，3-2 不行）</li>
                      <li>Pair 模式：无方向冲突（A&gt;B 和 A=B 可以，A&gt;B 和 A&lt;B 不行）</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Annotators Tab */}
            {activeTab === 'annotators' && (
              <div className="space-y-6">
                {/* Annotator Bar Chart */}
                <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-surface-800">
                    <h3 className="font-semibold text-white">标注员综合得分分布</h3>
                  </div>
                  <div className="p-5 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={annotatorBarData} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                        <YAxis domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff' }}
                          formatter={(value: number) => `${value}%`}
                        />
                        <Bar dataKey="综合得分" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="多数投票(Hard)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="多数投票(Soft)" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Annotator Table */}
                <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-surface-800">
                    <h3 className="font-semibold text-white">标注员详细排名</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-surface-800">
                          <SortableHeader label="排名" field="rank" currentField={sortField} asc={sortAsc} onSort={(f) => { if (f === sortField) setSortAsc(!sortAsc); else { setSortField(f as typeof sortField); setSortAsc(true) } }} />
                          <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">标注员</th>
                          <SortableHeader label="综合得分" field="compositeScore" currentField={sortField} asc={sortAsc} onSort={(f) => { if (f === sortField) setSortAsc(!sortAsc); else { setSortField(f as typeof sortField); setSortAsc(false) } }} />
                          <SortableHeader label="多数投票一致(Hard)" field="majorityAgreementRateHard" currentField={sortField} asc={sortAsc} onSort={(f) => { if (f === sortField) setSortAsc(!sortAsc); else { setSortField(f as typeof sortField); setSortAsc(false) } }} />
                          <SortableHeader label="多数投票一致(Soft)" field="majorityAgreementRateSoft" currentField={sortField} asc={sortAsc} onSort={(f) => { if (f === sortField) setSortAsc(!sortAsc); else { setSortField(f as typeof sortField); setSortAsc(false) } }} />
                          {agreementStats.mode === 'score' && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">平均偏差</th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">QC样本数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedAnnotatorSkills.map((skill) => (
                          <tr key={skill.annotatorId} className="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <span className={clsx('inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold border', getRankBadgeColor(skill.rank, agreementStats.annotatorSkills.length))}>
                                {skill.rank}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-white">{skill.annotatorId}</td>
                            <td className="px-4 py-3">
                              <span className={clsx('font-mono font-bold', getScoreColor(skill.compositeScore))}>
                                {(skill.compositeScore * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-surface-300">{(skill.majorityAgreementRateHard * 100).toFixed(1)}%</td>
                            <td className="px-4 py-3 font-mono text-surface-300">{(skill.majorityAgreementRateSoft * 100).toFixed(1)}%</td>
                            {agreementStats.mode === 'score' && (
                              <td className="px-4 py-3 font-mono text-surface-300">
                                {skill.avgDeviation !== null ? skill.avgDeviation.toFixed(2) : '-'}
                              </td>
                            )}
                            <td className="px-4 py-3 text-surface-400">{skill.qcSampleCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Score Explanation */}
                <div className="bg-surface-900 rounded-2xl border border-surface-800 p-5">
                  <h4 className="font-semibold text-white mb-3">综合得分 (ARS) 计算方式</h4>
                  <div className="text-sm text-surface-400 space-y-2">
                    {agreementStats.mode === 'score' ? (
                      <p>ARS = 0.4 &times; 多数投票一致率(Hard) + 0.4 &times; 多数投票一致率(Soft) + 0.2 &times; (1 - 标准化平均偏差)</p>
                    ) : (
                      <p>ARS = 0.5 &times; 多数投票一致率(Hard) + 0.5 &times; 多数投票一致率(Soft)</p>
                    )}
                    <p className="text-surface-500">综合得分反映了标注员与其他标注员的一致程度，得分越高说明标注越可靠。</p>
                  </div>
                </div>
              </div>
            )}

            {/* Dimensions Tab */}
            {activeTab === 'dimensions' && (
              <div className="space-y-6">
                {/* Alpha Bar Chart */}
                <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-surface-800">
                    <h3 className="font-semibold text-white">各维度 Krippendorff's Alpha</h3>
                  </div>
                  <div className="p-5 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dimensionAlphaData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <YAxis domain={[0, 1]} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="Hard Alpha" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Soft Alpha" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Radar Chart (Alpha) */}
                <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-surface-800">
                    <h3 className="font-semibold text-white">维度 Alpha 雷达图</h3>
                  </div>
                  <div className="p-5 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarAlphaData}>
                        <PolarGrid stroke="#374151" />
                        <PolarAngleAxis dataKey="dimension" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                        <PolarRadiusAxis domain={[0, 1]} tick={{ fill: '#6b7280', fontSize: 10 }} />
                        <Radar name="Hard Alpha" dataKey="Hard Alpha" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                        <Radar name="Soft Alpha" dataKey="Soft Alpha" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                        <Legend />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff' }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Dimension Table */}
                <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-surface-800">
                    <h3 className="font-semibold text-white">各维度详细数据</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-surface-800">
                          <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase">维度</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase">检查数</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase">Hard Alpha</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase">Soft Alpha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DIMENSIONS.map(dim => {
                          const ds = agreementStats.byDimension[dim]
                          return (
                            <tr key={dim} className="border-b border-surface-800/50 hover:bg-surface-800/30 transition-colors">
                              <td className="px-4 py-3 font-medium text-white">{DIMENSION_LABELS[dim]}</td>
                              <td className="px-4 py-3 text-surface-400">{ds.totalChecks}</td>
                              <td className="px-4 py-3">
                                <span className={clsx('font-mono font-bold', getAlphaColor(ds.hardAlpha))}>
                                  {ds.hardAlpha.toFixed(3)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={clsx('font-mono font-bold', getAlphaColor(ds.softAlpha))}>
                                  {ds.softAlpha.toFixed(3)}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Disagreements Tab */}
            {activeTab === 'disagreements' && (
              <div className="space-y-6">
                {/* Clickable Dimension Cards */}
                <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-surface-800 bg-surface-900/50">
                    <h2 className="text-lg font-semibold text-white">分维度分歧统计</h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-5 gap-4">
                      {DIMENSIONS.map(dim => {
                        const counts = disagreeByDimCounts[dim]
                        const filteredCount = disagreeByDimCountsFiltered[dim] || 0
                        return (
                          <div
                            key={dim}
                            className={clsx(
                              'bg-surface-800/50 rounded-xl p-4 cursor-pointer transition-all border',
                              disagreeSelectedDim === dim
                                ? 'ring-2 ring-accent-500 border-accent-500/50'
                                : 'border-surface-700/50 hover:bg-surface-800 hover:border-surface-600'
                            )}
                            onClick={() => { setDisagreeSelectedDim(disagreeSelectedDim === dim ? 'all' : dim); setDisagreePage(1) }}
                          >
                            <div className="text-sm text-surface-400 mb-2 font-medium">
                              {DIMENSION_LABELS[dim]}
                            </div>
                            <div className={clsx(
                              'text-2xl font-bold mb-1',
                              filteredCount === 0 ? 'text-green-400' :
                              disagreeMatchView === 'soft' ? 'text-red-400' : 'text-amber-400'
                            )}>
                              {filteredCount}
                            </div>
                            <div className="text-xs text-surface-500">
                              Hard 不一致: {counts?.total || 0} / Soft 不一致: {counts?.soft_fail || 0}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Disagreement List */}
                <div className="bg-surface-900 rounded-2xl border border-surface-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-900/50 flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <h2 className="text-lg font-semibold text-white">
                        分歧样本列表
                        {disagreeSelectedDim !== 'all' && (
                          <span className="text-sm font-normal text-surface-400 ml-2">
                            （筛选：{DIMENSION_LABELS[disagreeSelectedDim]}）
                          </span>
                        )}
                        <span className="text-sm font-normal text-surface-400 ml-2">
                          （共 {filteredClassified.length} 条）
                        </span>
                      </h2>

                      {/* Hard / Soft Match toggle */}
                      <div className="flex bg-surface-800 rounded-lg p-0.5 border border-surface-700">
                        <button
                          onClick={() => { setDisagreeMatchView('hard'); setDisagreePage(1) }}
                          className={clsx(
                            'px-3 py-1 rounded-md text-xs font-medium transition-all',
                            disagreeMatchView === 'hard'
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'text-surface-400 hover:text-white'
                          )}
                        >
                          Hard Match
                        </button>
                        <button
                          onClick={() => { setDisagreeMatchView('soft'); setDisagreePage(1) }}
                          className={clsx(
                            'px-3 py-1 rounded-md text-xs font-medium transition-all',
                            disagreeMatchView === 'soft'
                              ? 'bg-sky-600 text-white shadow-sm'
                              : 'text-surface-400 hover:text-white'
                          )}
                        >
                          Soft Match
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                      <input
                        type="text"
                        placeholder="搜索 Sample ID..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setDisagreePage(1) }}
                        className="bg-surface-800 border border-surface-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500 w-56"
                      />
                    </div>
                  </div>

                  {/* Match View Description */}
                  <div className="px-6 py-2 bg-surface-800/30 border-b border-surface-800 text-xs text-surface-400">
                    {disagreeMatchView === 'hard' ? (
                      <span>
                        <span className="text-green-400 font-medium">Hard Match</span>：显示标注员给出的值不完全相同的所有分歧（Score 模式分数不一致，Pair 模式 comparison 不一致）
                      </span>
                    ) : (
                      <span>
                        <span className="text-sky-400 font-medium">Soft Match</span>：仅显示严重分歧（Score 模式跨问题等级边界如5分=无问题、3-4分=次要、1-2分=主要，Pair 模式方向冲突如 A&gt;B vs A&lt;B）
                      </span>
                    )}
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-surface-400 text-sm border-b border-surface-800 bg-surface-900/30">
                          <th className="px-4 py-4 font-medium">Sample ID</th>
                          <th className="px-4 py-4 font-medium">维度</th>
                          <th className="px-4 py-4 font-medium">标注员标注值</th>
                          <th className="px-4 py-4 font-medium">统计</th>
                          <th className="px-4 py-4 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-800/50">
                        {disagreePageItems.map((cd, idx) => {
                          const d = cd.detail
                          const isScore = 'annotatorScores' in d
                          const scoreDetail = isScore ? d as QCScoreAgreementDetail : null
                          const pairDetail = !isScore ? d as QCPairAgreementDetail : null
                          const globalIdx = (safeDisagreePage - 1) * DISAGREE_PAGE_SIZE + idx
                          const key = `${d.sampleId}-${d.dimension}-${globalIdx}`
                          return (
                            <tr key={key} className="hover:bg-surface-800/30 transition-colors">
                              <td className="px-4 py-4">
                                <span className="text-sm text-white font-medium truncate block max-w-[180px]" title={d.sampleId}>
                                  {d.sampleId}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-surface-200 font-medium">
                                {DIMENSION_LABELS[d.dimension]}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-1.5">
                                  {scoreDetail && scoreDetail.annotatorScores.map((a) => (
                                    <span key={a.annotatorId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-800 rounded text-xs">
                                      <span className="text-surface-500">{a.annotatorId}:</span>
                                      <span className="font-mono font-bold text-white">{a.score}</span>
                                    </span>
                                  ))}
                                  {pairDetail && pairDetail.annotatorComparisons.map((a) => (
                                    <span key={a.annotatorId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-800 rounded text-xs">
                                      <span className="text-surface-500">{a.annotatorId}:</span>
                                      <span className={clsx(
                                        'font-mono font-bold',
                                        a.comparison === 'A>B' ? 'text-green-400' :
                                        a.comparison === 'A<B' ? 'text-red-400' :
                                        'text-surface-300'
                                      )}>{a.comparison}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-xs text-surface-500">
                                {scoreDetail && (
                                  <span>均值 {scoreDetail.mean.toFixed(1)} / 极差 {scoreDetail.spread}</span>
                                )}
                                {pairDetail && pairDetail.majorityValue && (
                                  <span>多数: {pairDetail.majorityValue}</span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                <button
                                  onClick={() => setSelectedDisagreement(cd)}
                                  className="px-3 py-1.5 bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium rounded-lg transition-colors"
                                >
                                  详情
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {filteredClassified.length === 0 && (
                      <div className="p-12 text-center text-surface-500">
                        {searchQuery ? '没有匹配的分歧记录' : '当前筛选条件下没有分歧记录'}
                      </div>
                    )}

                    {/* Pagination */}
                    {filteredClassified.length > 0 && (
                      <div className="px-6 py-3 border-t border-surface-800 flex items-center justify-between">
                        <span className="text-sm text-surface-500">
                          第 {(safeDisagreePage - 1) * DISAGREE_PAGE_SIZE + 1}-{Math.min(safeDisagreePage * DISAGREE_PAGE_SIZE, filteredClassified.length)} 条，共 {filteredClassified.length} 条
                        </span>
                        {disagreeTotalPages > 1 && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDisagreePage(p => Math.max(1, p - 1))}
                              disabled={safeDisagreePage <= 1}
                              className={clsx(
                                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                                safeDisagreePage <= 1
                                  ? 'text-surface-600 cursor-not-allowed'
                                  : 'text-surface-300 hover:bg-surface-800 hover:text-white'
                              )}
                            >
                              上一页
                            </button>
                            <span className="text-sm text-surface-400">
                              {safeDisagreePage} / {disagreeTotalPages}
                            </span>
                            <button
                              onClick={() => setDisagreePage(p => Math.min(disagreeTotalPages, p + 1))}
                              disabled={safeDisagreePage >= disagreeTotalPages}
                              className={clsx(
                                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                                safeDisagreePage >= disagreeTotalPages
                                  ? 'text-surface-600 cursor-not-allowed'
                                  : 'text-surface-300 hover:bg-surface-800 hover:text-white'
                              )}
                            >
                              下一页
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </>
        )}
      </div>

      {/* Disagreement Detail Modal */}
      {selectedDisagreement && (
        <DisagreementDetailModal
          classified={selectedDisagreement}
          getSampleDetails={getSampleDetails}
          getGroupedSample={getGroupedSample}
          onClose={() => setSelectedDisagreement(null)}
        />
      )}
    </div>
  )
}

// ============================================
// Sub-Components
// ============================================

function StatsCard({ title, value, subtitle, icon, color }: {
  title: string
  value: string
  subtitle: string
  icon: React.ReactNode
  color: 'accent' | 'green' | 'amber' | 'red' | 'sky'
}) {
  const colorMap = {
    accent: 'bg-accent-500/20 text-accent-400',
    green: 'bg-green-500/20 text-green-400',
    amber: 'bg-amber-500/20 text-amber-400',
    red: 'bg-red-500/20 text-red-400',
    sky: 'bg-sky-500/20 text-sky-400',
  }

  return (
    <div className="bg-surface-900 rounded-2xl border border-surface-800 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', colorMap[color])}>
          {icon}
        </div>
        <span className="text-sm text-surface-400">{title}</span>
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-surface-500">{subtitle}</p>
    </div>
  )
}

function AlphaCard({ title, result, detailed }: {
  title: string
  result: { alpha: number; observedDisagreement: number; expectedDisagreement: number; byDimension: Record<Dimension, number> }
  detailed?: boolean
}) {
  return (
    <div className={clsx('rounded-2xl border p-5', getAlphaBgColor(result.alpha))}>
      <h4 className="text-sm text-surface-400 mb-2">{title}</h4>
      <p className={clsx('text-3xl font-bold mb-1', getAlphaColor(result.alpha))}>
        {result.alpha.toFixed(3)}
      </p>
      <p className={clsx('text-sm font-medium', getAlphaColor(result.alpha))}>
        {getAlphaLabel(result.alpha)}
      </p>
      {detailed && (
        <div className="mt-4 pt-4 border-t border-surface-700/50 space-y-2 text-xs text-surface-400">
          <div className="flex justify-between">
            <span>观测不一致度 (D_o)</span>
            <span className="font-mono text-surface-300">{result.observedDisagreement.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span>期望不一致度 (D_e)</span>
            <span className="font-mono text-surface-300">{result.expectedDisagreement.toFixed(4)}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-surface-700/50">
            <p className="text-surface-500 mb-2">各维度 Alpha:</p>
            {DIMENSIONS.map(dim => (
              <div key={dim} className="flex justify-between py-0.5">
                <span>{DIMENSION_LABELS[dim]}</span>
                <span className={clsx('font-mono font-medium', getAlphaColor(result.byDimension[dim]))}>
                  {result.byDimension[dim].toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AnnotatorRow({ skill, total }: { skill: AnnotatorSkillMetrics; total: number }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-surface-800/50 rounded-xl">
      <span className={clsx('inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold border', getRankBadgeColor(skill.rank, total))}>
        {skill.rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-white text-sm">{skill.annotatorId}</p>
        <p className="text-xs text-surface-500">{skill.qcSampleCount} 个 QC 样本</p>
      </div>
      <div className="text-right">
        <p className={clsx('font-mono font-bold text-sm', getScoreColor(skill.compositeScore))}>
          {(skill.compositeScore * 100).toFixed(1)}%
        </p>
        <p className="text-xs text-surface-500">综合得分</p>
      </div>
    </div>
  )
}

function SortableHeader({ label, field, currentField, asc, onSort }: {
  label: string
  field: string
  currentField: string
  asc: boolean
  onSort: (field: string) => void
}) {
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {currentField === field ? (
          asc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  )
}

function DisagreementDetailModal({ classified, getSampleDetails, getGroupedSample, onClose }: {
  classified: ClassifiedDisagreement
  getSampleDetails: (sampleId: string) => PairSample | ScoreSample | null
  getGroupedSample: (sampleId: string) => QCGroupedSample | null
  onClose: () => void
}) {
  const [showImageModal, setShowImageModal] = useState(false)

  const { detail } = classified
  const isScore = 'annotatorScores' in detail
  const scoreDetail = isScore ? detail as QCScoreAgreementDetail : null
  const pairDetail = !isScore ? detail as QCPairAgreementDetail : null

  const sampleDetails = getSampleDetails(detail.sampleId)
  const groupedSample = getGroupedSample(detail.sampleId)

  const isPairSample = sampleDetails && 'video_a_url' in sampleDetails
  const isScoreSample = sampleDetails && 'video_url' in sampleDetails

  return (
    <>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-surface-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-surface-800">
          {/* Modal Header */}
          <div className="px-6 py-4 border-b border-surface-800 flex items-center justify-between bg-surface-900/80">
            <div>
              <h2 className="text-lg font-bold text-white">{detail.sampleId}</h2>
              <p className="text-sm text-surface-400">
                维度: <span className="text-cyan-400">{DIMENSION_LABELS[detail.dimension]}</span>
                <span className="ml-3">
                  标注人数: <span className="text-surface-200">{isScore ? scoreDetail!.annotatorScores.length : pairDetail!.annotatorComparisons.length}</span>
                </span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-surface-800 hover:bg-surface-700 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-surface-400" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-auto p-6">
            {/* Summary Stats */}
            <div className="mb-6 p-4 bg-surface-800/50 rounded-xl border border-surface-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-surface-400 mb-1">分歧类型</p>
                  <p className={clsx(
                    'text-lg font-bold',
                    classified.matchCategory === 'soft_fail' ? 'text-red-400' : 'text-amber-400'
                  )}>
                    {classified.matchCategory === 'soft_fail' ? '严重分歧（Soft Match 不通过）' : '轻微分歧（仅 Hard Match 不通过）'}
                  </p>
                </div>
                <div className="text-right">
                  {scoreDetail && (
                    <div>
                      <p className="text-sm text-surface-400 mb-1">统计</p>
                      <p className="text-lg font-bold text-white">
                        均值 {scoreDetail.mean.toFixed(1)} <span className="text-surface-500 text-sm mx-1">/</span> 极差 {scoreDetail.spread}
                      </p>
                    </div>
                  )}
                  {pairDetail && pairDetail.majorityValue && (
                    <div>
                      <p className="text-sm text-surface-400 mb-1">多数投票</p>
                      <p className="text-lg font-bold text-white">{pairDetail.majorityValue}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sample info */}
            {sampleDetails ? (
              <>
                {/* Prompt */}
                {sampleDetails.prompt && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-surface-400 mb-2">Prompt</h3>
                    <div className="p-4 bg-surface-800/50 rounded-xl border border-surface-700/50">
                      <p className="text-surface-200 text-sm whitespace-pre-wrap">{sampleDetails.prompt}</p>
                    </div>
                  </div>
                )}

                {/* First Frame */}
                {sampleDetails.first_frame_url && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-surface-400 mb-2">首帧图</h3>
                    <div
                      className="relative w-fit cursor-pointer group"
                      onClick={() => setShowImageModal(true)}
                    >
                      <img
                        src={sampleDetails.first_frame_url}
                        alt="First frame"
                        className="max-h-48 rounded-xl border border-surface-700 object-contain"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                        <Image className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Videos */}
                {isPairSample && (sampleDetails as PairSample).video_a_url && (sampleDetails as PairSample).video_b_url && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-surface-400 mb-2">视频对比</h3>
                    <VideoCompare
                      videoAUrl={(sampleDetails as PairSample).video_a_url}
                      videoBUrl={(sampleDetails as PairSample).video_b_url}
                      modelA={(sampleDetails as PairSample).video_a_model || 'Model A'}
                      modelB={(sampleDetails as PairSample).video_b_model || 'Model B'}
                    />
                  </div>
                )}
                {isScoreSample && (sampleDetails as ScoreSample).video_url && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-surface-400 mb-2">
                      视频
                      {(sampleDetails as ScoreSample).video_model && (
                        <span className="ml-1 text-surface-500">({(sampleDetails as ScoreSample).video_model})</span>
                      )}
                    </h3>
                    <video
                      src={(sampleDetails as ScoreSample).video_url}
                      className="w-full max-w-lg rounded-xl bg-black"
                      controls
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="mb-6 p-4 bg-surface-800/30 rounded-xl text-sm text-surface-500">
                样本详情不可用（上传的文件中未包含 task_package）
              </div>
            )}

            {/* Per-annotator annotation details */}
            <h3 className="text-sm font-medium text-surface-400 mb-3">各标注员标注详情</h3>
            <div className="space-y-3">
              {scoreDetail && scoreDetail.annotatorScores.map((a) => {
                const entry = groupedSample?.entries.find(e => e.annotatorId === a.annotatorId)
                const scoreResult = entry?.scoreResult
                const dimResult = scoreResult?.scores[detail.dimension]
                return (
                  <div key={a.annotatorId} className="rounded-xl p-4 border bg-surface-800/30 border-surface-700/50">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-medium text-cyan-400">{a.annotatorId}</span>
                      <span className="text-sm font-mono font-bold text-white bg-surface-700 px-2.5 py-1 rounded-lg">
                        {a.score} 分
                      </span>
                    </div>
                    {dimResult ? (
                      <div className="space-y-1.5 text-sm ml-1">
                        {dimResult.major_reason && (
                          <div>
                            <span className="text-red-400/80 font-medium">主要问题: </span>
                            <span className="text-surface-300">{dimResult.major_reason}</span>
                          </div>
                        )}
                        {dimResult.minor_reason && (
                          <div>
                            <span className="text-amber-400/80 font-medium">次要问题: </span>
                            <span className="text-surface-300">{dimResult.minor_reason}</span>
                          </div>
                        )}
                        {!dimResult.major_reason && !dimResult.minor_reason && (
                          <span className="text-surface-500">未填写原因</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-surface-500 ml-1">详细原因不可用</span>
                    )}
                  </div>
                )
              })}
              {pairDetail && pairDetail.annotatorComparisons.map((a) => {
                const entry = groupedSample?.entries.find(e => e.annotatorId === a.annotatorId)
                const pairResult = entry?.pairResult
                const dimResult = pairResult?.dimensions[detail.dimension]
                return (
                  <div key={a.annotatorId} className="rounded-xl p-4 border bg-surface-800/30 border-surface-700/50">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-medium text-cyan-400">{a.annotatorId}</span>
                      <span className={clsx(
                        'text-sm font-mono font-bold px-2.5 py-1 rounded-lg',
                        a.comparison === 'A>B' ? 'bg-green-500/15 text-green-400' :
                        a.comparison === 'A<B' ? 'bg-red-500/15 text-red-400' :
                        'bg-surface-700 text-surface-300'
                      )}>
                        {a.comparison}
                      </span>
                    </div>
                    {dimResult ? (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1.5 p-3 bg-surface-800/50 rounded-lg">
                          <p className="text-surface-500 font-medium text-xs">Video A — <span className={clsx(
                            dimResult.video_a.level === 'major' ? 'text-red-400' : dimResult.video_a.level === 'minor' ? 'text-amber-400' : 'text-green-400'
                          )}>{dimResult.video_a.level === 'none' ? '无问题' : dimResult.video_a.level === 'minor' ? '次要' : '主要'}</span></p>
                          {dimResult.video_a.major_reason && (
                            <div><span className="text-red-400/80 font-medium">主要: </span><span className="text-surface-300">{dimResult.video_a.major_reason}</span></div>
                          )}
                          {dimResult.video_a.minor_reason && (
                            <div><span className="text-amber-400/80 font-medium">次要: </span><span className="text-surface-300">{dimResult.video_a.minor_reason}</span></div>
                          )}
                          {!dimResult.video_a.major_reason && !dimResult.video_a.minor_reason && (
                            <span className="text-surface-500 text-xs">未填写原因</span>
                          )}
                        </div>
                        <div className="space-y-1.5 p-3 bg-surface-800/50 rounded-lg">
                          <p className="text-surface-500 font-medium text-xs">Video B — <span className={clsx(
                            dimResult.video_b.level === 'major' ? 'text-red-400' : dimResult.video_b.level === 'minor' ? 'text-amber-400' : 'text-green-400'
                          )}>{dimResult.video_b.level === 'none' ? '无问题' : dimResult.video_b.level === 'minor' ? '次要' : '主要'}</span></p>
                          {dimResult.video_b.major_reason && (
                            <div><span className="text-red-400/80 font-medium">主要: </span><span className="text-surface-300">{dimResult.video_b.major_reason}</span></div>
                          )}
                          {dimResult.video_b.minor_reason && (
                            <div><span className="text-amber-400/80 font-medium">次要: </span><span className="text-surface-300">{dimResult.video_b.minor_reason}</span></div>
                          )}
                          {!dimResult.video_b.major_reason && !dimResult.video_b.minor_reason && (
                            <span className="text-surface-500 text-xs">未填写原因</span>
                          )}
                        </div>
                        {dimResult.degree_diff_reason && (
                          <div className="col-span-2 p-3 bg-surface-800/50 rounded-lg">
                            <span className="text-surface-500 font-medium">程度差异原因: </span>
                            <span className="text-surface-300">{dimResult.degree_diff_reason}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-surface-500 ml-1">详细原因不可用</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Full-screen Image Modal */}
      {showImageModal && sampleDetails?.first_frame_url && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] cursor-pointer"
          onClick={() => setShowImageModal(false)}
        >
          <img
            src={sampleDetails.first_frame_url}
            alt="First frame full"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}
    </>
  )
}
