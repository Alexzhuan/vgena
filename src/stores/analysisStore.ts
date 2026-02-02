import { create } from 'zustand'
import type { PairTaskPackage, ScoreTaskPackage } from '../types'
import type {
  PairAnnotationResult,
  ScoreAnnotationResult,
  CombinedPairData,
  CombinedScoreData,
  ModelStats,
  ConsistencyStats,
  UploadedFileRecord,
} from '../types/analysis'
import {
  loadPairData,
  loadScoreData,
  combinePairData,
  combineScoreData,
  defaultDataFiles,
  parseUploadedFiles,
  mergePairResults,
  mergeScoreResults,
} from '../utils/analysis/dataLoader'
import { getModelStats } from '../utils/analysis/stats'
import { calculateConsistencyStats } from '../utils/analysis/consistency'

interface AnalysisState {
  // Raw data
  pairResults: PairAnnotationResult | null
  scoreResults: ScoreAnnotationResult | null
  pairTaskPackage: PairTaskPackage | null
  scoreTaskPackage: ScoreTaskPackage | null
  
  // Combined data
  combinedPairData: CombinedPairData[]
  combinedScoreData: CombinedScoreData[]
  
  // Analysis results
  modelStats: ModelStats[]
  consistencyStats: ConsistencyStats | null
  
  // Uploaded file info
  uploadedFiles: UploadedFileRecord[]
  
  // Loading state
  isLoading: boolean
  error: string | null
  
  // Computed-like helpers
  hasData: () => boolean
  
  // Actions
  loadAllData: () => Promise<void>
  loadPairData: (resultFile: string) => Promise<void>
  loadScoreData: (resultFile: string) => Promise<void>
  loadFromUploadedFiles: (files: { name: string; mode: 'pair' | 'score'; sampleCount: number; content: unknown }[]) => Promise<void>
  clearData: () => void
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  pairResults: null,
  scoreResults: null,
  pairTaskPackage: null,
  scoreTaskPackage: null,
  combinedPairData: [],
  combinedScoreData: [],
  modelStats: [],
  consistencyStats: null,
  uploadedFiles: [],
  isLoading: false,
  error: null,
  
  hasData: () => {
    const state = get()
    return state.pairResults !== null || state.scoreResults !== null
  },
  
  clearData: () => {
    set({
      pairResults: null,
      scoreResults: null,
      pairTaskPackage: null,
      scoreTaskPackage: null,
      combinedPairData: [],
      combinedScoreData: [],
      modelStats: [],
      consistencyStats: null,
      uploadedFiles: [],
      error: null,
    })
  },
  
  loadFromUploadedFiles: async (files) => {
    set({ isLoading: true, error: null })
    
    try {
      // Parse and categorize files
      const { pairResults, scoreResults } = 
        await parseUploadedFiles(files)
      
      // Merge multiple files of the same type
      const mergedPairResults = mergePairResults(pairResults)
      const mergedScoreResults = mergeScoreResults(scoreResults)
      
      // Get merged task packages
      const pairTask = mergedPairResults?.task_package || null
      const scoreTask = mergedScoreResults?.task_package || null
      
      // Combine data
      const combinedPair = pairTask && mergedPairResults 
        ? combinePairData(pairTask, mergedPairResults) 
        : []
      const combinedScore = scoreTask && mergedScoreResults 
        ? combineScoreData(scoreTask, mergedScoreResults) 
        : []
      
      // Calculate model stats (need at least one dataset)
      let stats: ModelStats[] = []
      let consistency: ConsistencyStats | null = null
      
      if (mergedPairResults || mergedScoreResults) {
        stats = getModelStats(
          mergedPairResults?.results || [],
          mergedScoreResults?.results || []
        )
      }
      
      // Calculate consistency only if we have both pair and score data
      if (mergedPairResults && mergedScoreResults && pairTask) {
        consistency = calculateConsistencyStats(
          mergedPairResults.results,
          mergedScoreResults.results,
          pairTask.samples
        )
      }
      
      // Record uploaded files
      const uploadedFileRecords: UploadedFileRecord[] = files.map(f => ({
        name: f.name,
        mode: f.mode,
        sampleCount: f.sampleCount,
      }))
      
      set({
        pairResults: mergedPairResults,
        scoreResults: mergedScoreResults,
        pairTaskPackage: pairTask,
        scoreTaskPackage: scoreTask,
        combinedPairData: combinedPair,
        combinedScoreData: combinedScore,
        modelStats: stats,
        consistencyStats: consistency,
        uploadedFiles: uploadedFileRecords,
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '加载上传文件失败',
        isLoading: false,
      })
    }
  },
  
  loadAllData: async () => {
    set({ isLoading: true, error: null })
    
    try {
      // Load both datasets
      const [pairData, scoreData] = await Promise.all([
        loadPairData(defaultDataFiles.pairResult),
        loadScoreData(defaultDataFiles.scoreResult),
      ])
      
      const { results: pairResults, taskPackage: pairTask } = pairData
      const { results: scoreResults, taskPackage: scoreTask } = scoreData
      
      // Combine data
      const combinedPair = combinePairData(pairTask, pairResults)
      const combinedScore = combineScoreData(scoreTask, scoreResults)
      
      // Calculate model stats
      const stats = getModelStats(pairResults.results, scoreResults.results)
      
      // Calculate consistency
      const consistency = calculateConsistencyStats(
        pairResults.results,
        scoreResults.results,
        pairTask.samples
      )
      
      set({
        pairResults,
        scoreResults,
        pairTaskPackage: pairTask,
        scoreTaskPackage: scoreTask,
        combinedPairData: combinedPair,
        combinedScoreData: combinedScore,
        modelStats: stats,
        consistencyStats: consistency,
        uploadedFiles: [
          { name: defaultDataFiles.pairResult, mode: 'pair', sampleCount: pairResults.completed_samples },
          { name: defaultDataFiles.scoreResult, mode: 'score', sampleCount: scoreResults.completed_samples },
        ],
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load data',
        isLoading: false,
      })
    }
  },
  
  loadPairData: async (resultFile: string) => {
    set({ isLoading: true, error: null })
    
    try {
      const { results, taskPackage } = await loadPairData(resultFile)
      const combined = combinePairData(taskPackage, results)
      
      set({
        pairResults: results,
        pairTaskPackage: taskPackage,
        combinedPairData: combined,
        isLoading: false,
      })
      
      // Recalculate stats if we have both datasets
      const state = get()
      if (state.scoreResults && state.scoreTaskPackage) {
        const stats = getModelStats(results.results, state.scoreResults.results)
        const consistency = calculateConsistencyStats(
          results.results,
          state.scoreResults.results,
          taskPackage.samples
        )
        set({ modelStats: stats, consistencyStats: consistency })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load pair data',
        isLoading: false,
      })
    }
  },
  
  loadScoreData: async (resultFile: string) => {
    set({ isLoading: true, error: null })
    
    try {
      const { results, taskPackage } = await loadScoreData(resultFile)
      const combined = combineScoreData(taskPackage, results)
      
      set({
        scoreResults: results,
        scoreTaskPackage: taskPackage,
        combinedScoreData: combined,
        isLoading: false,
      })
      
      // Recalculate stats if we have both datasets
      const state = get()
      if (state.pairResults && state.pairTaskPackage) {
        const stats = getModelStats(state.pairResults.results, results.results)
        const consistency = calculateConsistencyStats(
          state.pairResults.results,
          results.results,
          state.pairTaskPackage.samples
        )
        set({ modelStats: stats, consistencyStats: consistency })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load score data',
        isLoading: false,
      })
    }
  },
}))
