import { create } from 'zustand'
import type {
  PairAnnotationResult,
  ScoreAnnotationResult,
  PairSampleResult,
  ScoreSampleResult,
  QAPairStats,
  QAScoreStats,
} from '../types/analysis'
import { calculatePairQA, calculateScoreQA } from '../utils/analysis/qa'

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
  
  // Annotator data
  annotatorPairResults: PairSampleResult[]
  annotatorScoreResults: ScoreSampleResult[]
  annotatorFileInfos: QAFileInfo[]
  
  // QA Statistics
  qaPairStats: QAPairStats | null
  qaScoreStats: QAScoreStats | null
  
  // Loading state
  isLoading: boolean
  error: string | null
  
  // Computed helpers
  hasGoldenSet: () => boolean
  hasAnnotatorData: () => boolean
  canCalculateQA: () => boolean
  
  // Actions
  setMode: (mode: QAMode) => void
  loadGoldenSet: (content: unknown, fileName: string) => void
  loadAnnotatorResults: (files: { content: unknown; fileName: string }[]) => void
  calculateQA: () => void
  clearAll: () => void
  clearGoldenSet: () => void
  clearAnnotatorData: () => void
}

// Parse annotation result file
function parseAnnotationFile(content: unknown): {
  mode: QAMode
  pairResults: PairSampleResult[]
  scoreResults: ScoreSampleResult[]
  annotatorId: string
  sampleCount: number
} | null {
  const data = content as Record<string, unknown>
  
  if (data.mode === 'pair' && Array.isArray(data.results)) {
    const results = data.results as PairSampleResult[]
    // Add annotator_id to each result if not present
    const annotatorId = (data.annotator_id as string) || 'unknown'
    const processedResults = results.map(r => ({
      ...r,
      annotator_id: r.annotator_id || annotatorId,
    }))
    return {
      mode: 'pair',
      pairResults: processedResults,
      scoreResults: [],
      annotatorId,
      sampleCount: results.length,
    }
  }
  
  if (data.mode === 'score' && Array.isArray(data.results)) {
    const results = data.results as ScoreSampleResult[]
    const annotatorId = (data.annotator_id as string) || 'unknown'
    const processedResults = results.map(r => ({
      ...r,
      annotator_id: r.annotator_id || annotatorId,
    }))
    return {
      mode: 'score',
      pairResults: [],
      scoreResults: processedResults,
      annotatorId,
      sampleCount: results.length,
    }
  }
  
  return null
}

export const useQAStore = create<QAState>((set, get) => ({
  mode: 'pair',
  
  goldenPairResults: [],
  goldenScoreResults: [],
  goldenFileInfo: null,
  
  annotatorPairResults: [],
  annotatorScoreResults: [],
  annotatorFileInfos: [],
  
  qaPairStats: null,
  qaScoreStats: null,
  
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
  
  setMode: (mode) => {
    set({
      mode,
      // Clear stats when mode changes
      qaPairStats: null,
      qaScoreStats: null,
    })
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
        set({
          goldenPairResults: parsed.pairResults,
          goldenFileInfo: fileInfo,
          qaPairStats: null, // Clear existing stats
          isLoading: false,
        })
      } else {
        set({
          goldenScoreResults: parsed.scoreResults,
          goldenFileInfo: fileInfo,
          qaScoreStats: null, // Clear existing stats
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
          state.annotatorPairResults
        )
        set({ qaPairStats: stats, isLoading: false })
      } else {
        const stats = calculateScoreQA(
          state.goldenScoreResults,
          state.annotatorScoreResults
        )
        set({ qaScoreStats: stats, isLoading: false })
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
      annotatorPairResults: [],
      annotatorScoreResults: [],
      annotatorFileInfos: [],
      qaPairStats: null,
      qaScoreStats: null,
      error: null,
    })
  },
  
  clearGoldenSet: () => {
    const { mode } = get()
    if (mode === 'pair') {
      set({
        goldenPairResults: [],
        goldenFileInfo: null,
        qaPairStats: null,
      })
    } else {
      set({
        goldenScoreResults: [],
        goldenFileInfo: null,
        qaScoreStats: null,
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
      })
    } else {
      set({
        annotatorScoreResults: [],
        annotatorFileInfos: [],
        qaScoreStats: null,
      })
    }
  },
}))
