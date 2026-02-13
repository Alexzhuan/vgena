import { create } from 'zustand'
import type {
  QCDetectionResult,
  QCOverlapAgreementStats,
  QCScoreAgreementDetail,
  QCPairAgreementDetail,
  AnnotatorSkillMetrics,
  ClassifiedDisagreement,
  QCGroupedSample,
  LOOAnalysisResult,
} from '../types/analysis'
import type { PairSample, ScoreSample } from '../types'
import { calculateInterAnnotatorAgreement, calculateLOOAnalysis } from '../utils/analysis/agreementAnalysis'

// ============================================
// File info for uploaded files
// ============================================

export interface QCFileInfo {
  name: string
  mode: 'pair' | 'score' | 'unknown'
  sampleCount: number
  annotatorId: string
}

// ============================================
// Store State Interface
// ============================================

interface QCResultState {
  // Raw uploaded file data
  uploadedFiles: { content: unknown; fileName: string }[]
  fileInfos: QCFileInfo[]

  // Computed results
  agreementStats: QCOverlapAgreementStats | null
  detection: QCDetectionResult | null
  looResult: LOOAnalysisResult | null

  // UI state
  selectedAnnotatorId: string | null
  isLoading: boolean
  error: string | null

  // Computed helpers
  hasData: () => boolean
  hasResults: () => boolean
  getAnnotatorIds: () => string[]
  getDetectedMode: () => 'pair' | 'score' | 'mixed' | null
  getFilteredDisagreements: () => (QCScoreAgreementDetail | QCPairAgreementDetail)[]
  getFilteredClassifiedDisagreements: () => ClassifiedDisagreement[]
  getSelectedAnnotatorSkill: () => AnnotatorSkillMetrics | null
  getSampleDetails: (sampleId: string) => PairSample | ScoreSample | null
  getGroupedSample: (sampleId: string) => QCGroupedSample | null

  // Actions
  loadAnnotatorResults: (files: { content: unknown; fileName: string }[]) => void
  calculateAgreement: () => void
  setSelectedAnnotatorId: (id: string | null) => void
  clearAll: () => void
}

// ============================================
// Helper: parse file info
// ============================================

function extractFileInfo(content: unknown, fileName: string): QCFileInfo {
  const data = content as Record<string, unknown>
  const mode = data.mode as string
  const annotatorId = (data.annotator_id as string) || 'unknown'
  const results = Array.isArray(data.results) ? data.results.length : 0

  return {
    name: fileName,
    mode: mode === 'pair' || mode === 'score' ? mode : 'unknown',
    sampleCount: results,
    annotatorId,
  }
}

// ============================================
// Store
// ============================================

export const useQCResultStore = create<QCResultState>((set, get) => ({
  uploadedFiles: [],
  fileInfos: [],
  agreementStats: null,
  detection: null,
  looResult: null,
  selectedAnnotatorId: null,
  isLoading: false,
  error: null,

  hasData: () => {
    return get().uploadedFiles.length > 0
  },

  hasResults: () => {
    return get().agreementStats !== null
  },

  getAnnotatorIds: () => {
    const stats = get().agreementStats
    if (!stats) return []
    return stats.annotatorSkills.map(s => s.annotatorId).sort()
  },

  getDetectedMode: () => {
    const stats = get().agreementStats
    if (!stats) return null
    return stats.mode
  },

  getFilteredDisagreements: () => {
    const state = get()
    if (!state.agreementStats) return []

    let disagreements = state.agreementStats.disagreements
    if (state.selectedAnnotatorId) {
      disagreements = disagreements.filter(d => {
        if ('annotatorScores' in d) {
          return (d as QCScoreAgreementDetail).annotatorScores.some(
            a => a.annotatorId === state.selectedAnnotatorId
          )
        }
        if ('annotatorComparisons' in d) {
          return (d as QCPairAgreementDetail).annotatorComparisons.some(
            a => a.annotatorId === state.selectedAnnotatorId
          )
        }
        return false
      })
    }
    return disagreements
  },

  getFilteredClassifiedDisagreements: () => {
    const state = get()
    if (!state.agreementStats) return []

    let classified = state.agreementStats.classifiedDisagreements
    if (state.selectedAnnotatorId) {
      classified = classified.filter(cd => {
        const d = cd.detail
        if ('annotatorScores' in d) {
          return (d as QCScoreAgreementDetail).annotatorScores.some(
            a => a.annotatorId === state.selectedAnnotatorId
          )
        }
        if ('annotatorComparisons' in d) {
          return (d as QCPairAgreementDetail).annotatorComparisons.some(
            a => a.annotatorId === state.selectedAnnotatorId
          )
        }
        return false
      })
    }
    return classified
  },

  getSampleDetails: (sampleId: string) => {
    const state = get()
    if (!state.agreementStats) return null
    return state.agreementStats.sampleDetailsMap[sampleId] || null
  },

  getGroupedSample: (sampleId: string) => {
    const state = get()
    if (!state.agreementStats) return null
    return state.agreementStats.groupedSamples.find(g => g.sampleId === sampleId) || null
  },

  getSelectedAnnotatorSkill: () => {
    const state = get()
    if (!state.agreementStats || !state.selectedAnnotatorId) return null
    return state.agreementStats.annotatorSkills.find(
      s => s.annotatorId === state.selectedAnnotatorId
    ) || null
  },

  loadAnnotatorResults: (files) => {
    set({ isLoading: true, error: null })

    try {
      const fileInfos: QCFileInfo[] = []

      for (const file of files) {
        const info = extractFileInfo(file.content, file.fileName)
        if (info.mode === 'unknown') {
          console.warn(`跳过无法识别的文件: ${file.fileName}`)
          continue
        }
        fileInfos.push(info)
      }

      if (fileInfos.length === 0) {
        throw new Error('没有找到有效的标注结果文件')
      }

      set({
        uploadedFiles: files,
        fileInfos,
        agreementStats: null,
        detection: null,
        looResult: null,
        selectedAnnotatorId: null,
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '加载文件失败',
        isLoading: false,
      })
    }
  },

  calculateAgreement: () => {
    const state = get()

    if (state.uploadedFiles.length === 0) {
      set({ error: '请先上传标注结果文件' })
      return
    }

    set({ isLoading: true, error: null })

    try {
      const stats = calculateInterAnnotatorAgreement(state.uploadedFiles)

      // Calculate LOO analysis
      const looResult = calculateLOOAnalysis(stats.groupedSamples, stats.mode === 'mixed' ? 'score' : stats.mode)

      set({
        agreementStats: stats,
        detection: stats.detection,
        looResult,
        selectedAnnotatorId: null,
        isLoading: false,
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '计算质检结果失败',
        isLoading: false,
      })
    }
  },

  setSelectedAnnotatorId: (id) => {
    set({ selectedAnnotatorId: id })
  },

  clearAll: () => {
    set({
      uploadedFiles: [],
      fileInfos: [],
      agreementStats: null,
      detection: null,
      looResult: null,
      selectedAnnotatorId: null,
      error: null,
    })
  },
}))
