import { create } from 'zustand'
import type { PairSample, ScoreSample, PairTaskPackage, ScoreTaskPackage } from '../types'
import type {
  PairSampleResult,
  ScoreSampleResult,
  QAPairStats,
  QAScoreStats,
} from '../types/analysis'
import { 
  calculatePairQA, 
  calculateScoreQA,
  type PairSampleDetailsMap,
  type ScoreSampleDetailsMap,
} from '../utils/analysis/qa'

type QAMode = 'pair' | 'score'

interface QAFileInfo {
  name: string
  mode: QAMode
  sampleCount: number
  annotatorId?: string
}

interface QAState {
  // Mode
  mode: QAMode
  
  // Golden Set data
  goldenPairResults: PairSampleResult[]
  goldenScoreResults: ScoreSampleResult[]
  goldenFileInfo: QAFileInfo | null
  
  // Sample details maps (from task_package)
  pairSampleDetailsMap: PairSampleDetailsMap
  scoreSampleDetailsMap: ScoreSampleDetailsMap
  
  // Annotator data
  annotatorPairResults: PairSampleResult[]
  annotatorScoreResults: ScoreSampleResult[]
  annotatorFileInfos: QAFileInfo[]
  
  // QA Statistics
  qaPairStats: QAPairStats | null
  qaScoreStats: QAScoreStats | null
  
  // Annotator selection for filtering
  selectedAnnotatorId: string | null  // null means "all"
  annotatorIds: string[]  // List of all annotator IDs
  
  // Loading state
  isLoading: boolean
  error: string | null
  
  // Computed helpers
  hasGoldenSet: () => boolean
  hasAnnotatorData: () => boolean
  canCalculateQA: () => boolean
  getFilteredPairStats: () => QAPairStats | null
  getFilteredScoreStats: () => QAScoreStats | null
  
  // Actions
  setMode: (mode: QAMode) => void
  setSelectedAnnotatorId: (id: string | null) => void
  loadGoldenSet: (content: unknown, fileName: string) => void
  loadAnnotatorResults: (files: { content: unknown; fileName: string }[]) => void
  calculateQA: () => void
  clearAll: () => void
  clearGoldenSet: () => void
  clearAnnotatorData: () => void
}

// Parse annotation result file
interface ParsedAnnotationFile {
  mode: QAMode
  pairResults: PairSampleResult[]
  scoreResults: ScoreSampleResult[]
  annotatorId: string
  sampleCount: number
  // Sample details from task_package
  pairSamples: PairSample[]
  scoreSamples: ScoreSample[]
}

function parseAnnotationFile(content: unknown): ParsedAnnotationFile | null {
  const data = content as Record<string, unknown>
  
  if (data.mode === 'pair' && Array.isArray(data.results)) {
    const results = data.results as PairSampleResult[]
    // Add annotator_id to each result if not present
    const annotatorId = (data.annotator_id as string) || 'unknown'
    const processedResults = results.map(r => ({
      ...r,
      annotator_id: r.annotator_id || annotatorId,
    }))
    
    // Extract samples from task_package if available
    const taskPackage = data.task_package as PairTaskPackage | undefined
    const pairSamples = taskPackage?.samples || []
    
    return {
      mode: 'pair',
      pairResults: processedResults,
      scoreResults: [],
      annotatorId,
      sampleCount: results.length,
      pairSamples,
      scoreSamples: [],
    }
  }
  
  if (data.mode === 'score' && Array.isArray(data.results)) {
    const results = data.results as ScoreSampleResult[]
    const annotatorId = (data.annotator_id as string) || 'unknown'
    const processedResults = results.map(r => ({
      ...r,
      annotator_id: r.annotator_id || annotatorId,
    }))
    
    // Extract samples from task_package if available
    const taskPackage = data.task_package as ScoreTaskPackage | undefined
    const scoreSamples = taskPackage?.samples || []
    
    return {
      mode: 'score',
      pairResults: [],
      scoreResults: processedResults,
      annotatorId,
      sampleCount: results.length,
      pairSamples: [],
      scoreSamples,
    }
  }
  
  return null
}

// Build sample details map from samples array
function buildPairSampleDetailsMap(samples: PairSample[]): PairSampleDetailsMap {
  const map = new Map<string, PairSample>()
  for (const sample of samples) {
    map.set(sample.sample_id, sample)
  }
  return map
}

function buildScoreSampleDetailsMap(samples: ScoreSample[]): ScoreSampleDetailsMap {
  const map = new Map<string, ScoreSample>()
  for (const sample of samples) {
    map.set(sample.sample_id, sample)
  }
  return map
}

export const useQAStore = create<QAState>((set, get) => ({
  mode: 'pair',
  
  goldenPairResults: [],
  goldenScoreResults: [],
  goldenFileInfo: null,
  
  pairSampleDetailsMap: new Map(),
  scoreSampleDetailsMap: new Map(),
  
  annotatorPairResults: [],
  annotatorScoreResults: [],
  annotatorFileInfos: [],
  
  qaPairStats: null,
  qaScoreStats: null,
  
  selectedAnnotatorId: null,
  annotatorIds: [],
  
  isLoading: false,
  error: null,
  
  hasGoldenSet: () => {
    const state = get()
    return state.mode === 'pair' 
      ? state.goldenPairResults.length > 0
      : state.goldenScoreResults.length > 0
  },
  
  hasAnnotatorData: () => {
    const state = get()
    return state.mode === 'pair'
      ? state.annotatorPairResults.length > 0
      : state.annotatorScoreResults.length > 0
  },
  
  canCalculateQA: () => {
    const state = get()
    return state.hasGoldenSet() && state.hasAnnotatorData()
  },
  
  // Get stats filtered by selected annotator (Pair mode)
  getFilteredPairStats: () => {
    const state = get()
    if (!state.qaPairStats) return null
    if (!state.selectedAnnotatorId) return state.qaPairStats
    
    // Filter stats for selected annotator
    const annotatorId = state.selectedAnnotatorId
    const annotatorData = state.qaPairStats.byAnnotator[annotatorId]
    if (!annotatorData) return null
    
    // Filter mismatched samples for this annotator
    const filteredMismatched = state.qaPairStats.mismatchedSamples.filter(
      s => s.annotatorId === annotatorId
    )
    
    return {
      ...state.qaPairStats,
      totalSamples: annotatorData.total,
      hardMatchCount: annotatorData.hardMatchCount,
      hardMatchRate: annotatorData.hardMatchRate,
      avgSoftMatchRate: annotatorData.avgSoftMatchRate,
      byAnnotator: { [annotatorId]: annotatorData },
      mismatchedSamples: filteredMismatched,
    }
  },
  
  // Get stats filtered by selected annotator (Score mode)
  getFilteredScoreStats: () => {
    const state = get()
    if (!state.qaScoreStats) return null
    if (!state.selectedAnnotatorId) return state.qaScoreStats
    
    // Filter stats for selected annotator
    const annotatorId = state.selectedAnnotatorId
    const annotatorData = state.qaScoreStats.byAnnotator[annotatorId]
    if (!annotatorData) return null
    
    // Filter mismatched samples for this annotator
    const filteredMismatched = state.qaScoreStats.mismatchedSamples.filter(
      s => s.annotatorId === annotatorId
    )
    
    return {
      ...state.qaScoreStats,
      totalSamples: annotatorData.total,
      hardMatchCount: annotatorData.hardMatchCount,
      hardMatchRate: annotatorData.hardMatchRate,
      avgLevelMatchRate: annotatorData.avgLevelMatchRate,
      byAnnotator: { [annotatorId]: annotatorData },
      mismatchedSamples: filteredMismatched,
    }
  },
  
  setMode: (mode) => {
    set({
      mode,
      // Clear stats when mode changes
      qaPairStats: null,
      qaScoreStats: null,
      selectedAnnotatorId: null,
    })
  },
  
  setSelectedAnnotatorId: (id) => {
    set({ selectedAnnotatorId: id })
  },
  
  loadGoldenSet: (content, fileName) => {
    set({ isLoading: true, error: null })
    
    try {
      const parsed = parseAnnotationFile(content)
      
      if (!parsed) {
        throw new Error('无法解析 Golden Set 文件格式')
      }
      
      const { mode } = get()
      
      if (parsed.mode !== mode) {
        throw new Error(`Golden Set 模式 (${parsed.mode}) 与当前选择的模式 (${mode}) 不匹配`)
      }
      
      const fileInfo: QAFileInfo = {
        name: fileName,
        mode: parsed.mode,
        sampleCount: parsed.sampleCount,
        annotatorId: parsed.annotatorId,
      }
      
      if (mode === 'pair') {
        // Build sample details map from task_package
        const pairSampleDetailsMap = buildPairSampleDetailsMap(parsed.pairSamples)
        
        set({
          goldenPairResults: parsed.pairResults,
          goldenFileInfo: fileInfo,
          pairSampleDetailsMap,
          qaPairStats: null, // Clear existing stats
          selectedAnnotatorId: null,
          isLoading: false,
        })
      } else {
        // Build sample details map from task_package
        const scoreSampleDetailsMap = buildScoreSampleDetailsMap(parsed.scoreSamples)
        
        set({
          goldenScoreResults: parsed.scoreResults,
          goldenFileInfo: fileInfo,
          scoreSampleDetailsMap,
          qaScoreStats: null, // Clear existing stats
          selectedAnnotatorId: null,
          isLoading: false,
        })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '加载 Golden Set 失败',
        isLoading: false,
      })
    }
  },
  
  loadAnnotatorResults: (files) => {
    set({ isLoading: true, error: null })
    
    try {
      const { mode } = get()
      const allPairResults: PairSampleResult[] = []
      const allScoreResults: ScoreSampleResult[] = []
      const fileInfos: QAFileInfo[] = []
      
      for (const file of files) {
        const parsed = parseAnnotationFile(file.content)
        
        if (!parsed) {
          console.warn(`跳过无法解析的文件: ${file.fileName}`)
          continue
        }
        
        if (parsed.mode !== mode) {
          console.warn(`跳过模式不匹配的文件: ${file.fileName} (${parsed.mode} vs ${mode})`)
          continue
        }
        
        if (mode === 'pair') {
          allPairResults.push(...parsed.pairResults)
        } else {
          allScoreResults.push(...parsed.scoreResults)
        }
        
        fileInfos.push({
          name: file.fileName,
          mode: parsed.mode,
          sampleCount: parsed.sampleCount,
          annotatorId: parsed.annotatorId,
        })
      }
      
      if (mode === 'pair') {
        set({
          annotatorPairResults: allPairResults,
          annotatorFileInfos: fileInfos,
          qaPairStats: null, // Clear existing stats
          isLoading: false,
        })
      } else {
        set({
          annotatorScoreResults: allScoreResults,
          annotatorFileInfos: fileInfos,
          qaScoreStats: null, // Clear existing stats
          isLoading: false,
        })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '加载标注结果失败',
        isLoading: false,
      })
    }
  },
  
  calculateQA: () => {
    const state = get()
    
    if (!state.canCalculateQA()) {
      set({ error: '需要同时上传 Golden Set 和标注结果才能进行质检' })
      return
    }
    
    set({ isLoading: true, error: null })
    
    try {
      if (state.mode === 'pair') {
        const stats = calculatePairQA(
          state.goldenPairResults,
          state.annotatorPairResults,
          state.pairSampleDetailsMap
        )
        // Extract unique annotator IDs
        const annotatorIds = Object.keys(stats.byAnnotator).sort()
        set({ 
          qaPairStats: stats, 
          annotatorIds,
          selectedAnnotatorId: null,
          isLoading: false,
        })
      } else {
        const stats = calculateScoreQA(
          state.goldenScoreResults,
          state.annotatorScoreResults,
          state.scoreSampleDetailsMap
        )
        // Extract unique annotator IDs
        const annotatorIds = Object.keys(stats.byAnnotator).sort()
        set({ 
          qaScoreStats: stats,
          annotatorIds,
          selectedAnnotatorId: null,
          isLoading: false,
        })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '质检计算失败',
        isLoading: false,
      })
    }
  },
  
  clearAll: () => {
    set({
      goldenPairResults: [],
      goldenScoreResults: [],
      goldenFileInfo: null,
      pairSampleDetailsMap: new Map(),
      scoreSampleDetailsMap: new Map(),
      annotatorPairResults: [],
      annotatorScoreResults: [],
      annotatorFileInfos: [],
      qaPairStats: null,
      qaScoreStats: null,
      selectedAnnotatorId: null,
      annotatorIds: [],
      error: null,
    })
  },
  
  clearGoldenSet: () => {
    const { mode } = get()
    if (mode === 'pair') {
      set({
        goldenPairResults: [],
        goldenFileInfo: null,
        pairSampleDetailsMap: new Map(),
        qaPairStats: null,
        selectedAnnotatorId: null,
        annotatorIds: [],
      })
    } else {
      set({
        goldenScoreResults: [],
        goldenFileInfo: null,
        scoreSampleDetailsMap: new Map(),
        qaScoreStats: null,
        selectedAnnotatorId: null,
        annotatorIds: [],
      })
    }
  },
  
  clearAnnotatorData: () => {
    const { mode } = get()
    if (mode === 'pair') {
      set({
        annotatorPairResults: [],
        annotatorFileInfos: [],
        qaPairStats: null,
        selectedAnnotatorId: null,
        annotatorIds: [],
      })
    } else {
      set({
        annotatorScoreResults: [],
        annotatorFileInfos: [],
        qaScoreStats: null,
        selectedAnnotatorId: null,
        annotatorIds: [],
      })
    }
  },
}))
