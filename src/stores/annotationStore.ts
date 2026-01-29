import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  TaskPackage,
  AnnotationResult,
  PairAnnotationResult,
  ScoreAnnotationResult,
  ChecklistState,
  ProblemLevel,
  ComparisonResult,
  Dimension,
  DimensionPairAnnotation,
} from '../types'
import { DIMENSIONS } from '../types'

// Type for a single dimension's pair draft
// Note: level is now auto-inferred from reasons during save
interface DimensionPairDraft {
  video_a_major_reason: string
  video_a_minor_reason: string
  video_b_major_reason: string
  video_b_minor_reason: string
  comparison: ComparisonResult | null
  degree_diff_reason: string
}

// Helper to infer problem level from reasons
function inferProblemLevel(majorReason: string, minorReason: string): ProblemLevel {
  if (majorReason.trim()) return 'major'
  if (minorReason.trim()) return 'minor'
  return 'none'
}

interface AnnotationState {
  // Task data
  taskPackage: TaskPackage | null
  currentSampleIndex: number
  
  // Annotation results
  results: Map<string, AnnotationResult>
  
  // Current annotation state (working draft)
  currentChecklist: ChecklistState
  
  // Pair mode draft - now per dimension
  currentPairDraft: Record<Dimension, DimensionPairDraft>
  
  // Score mode draft
  currentScoreDraft: {
    scores: Record<Dimension, { score: number; major_reason: string; minor_reason: string }>
  }
  
  // Actions
  loadTaskPackage: (pkg: TaskPackage) => void
  clearTaskPackage: () => void
  
  goToSample: (index: number) => void
  goToNextSample: () => void
  goToPrevSample: () => void
  
  toggleChecklistItem: (itemId: string) => void
  setChecklistItem: (itemId: string, checked: boolean) => void
  
  // Pair mode actions - now per dimension (level is auto-inferred)
  setPairDimensionVideoAMajorReason: (dimension: Dimension, reason: string) => void
  setPairDimensionVideoAMinorReason: (dimension: Dimension, reason: string) => void
  setPairDimensionVideoBMajorReason: (dimension: Dimension, reason: string) => void
  setPairDimensionVideoBMinorReason: (dimension: Dimension, reason: string) => void
  setPairDimensionComparison: (dimension: Dimension, comparison: ComparisonResult) => void
  setPairDimensionDegreeDiff: (dimension: Dimension, reason: string) => void
  
  // Score mode actions
  setDimensionScore: (dimension: Dimension, score: number) => void
  setDimensionMajorReason: (dimension: Dimension, reason: string) => void
  setDimensionMinorReason: (dimension: Dimension, reason: string) => void
  
  // Save current annotation
  saveCurrentAnnotation: () => boolean
  
  // Get completion stats
  getCompletionStats: () => { completed: number; total: number }
  
  // Check if current annotation is valid
  isCurrentAnnotationValid: () => boolean
  
  // Check if a specific dimension is complete (for pair mode)
  isDimensionComplete: (dimension: Dimension) => boolean
  
  // Export all results
  exportResults: () => string
}

const createEmptyDimensionPairDraft = (): DimensionPairDraft => ({
  video_a_major_reason: '',
  video_a_minor_reason: '',
  video_b_major_reason: '',
  video_b_minor_reason: '',
  comparison: null,
  degree_diff_reason: '',
})

const createEmptyPairDraft = (): Record<Dimension, DimensionPairDraft> => ({
  text_consistency: createEmptyDimensionPairDraft(),
  temporal_consistency: createEmptyDimensionPairDraft(),
  visual_quality: createEmptyDimensionPairDraft(),
  distortion: createEmptyDimensionPairDraft(),
  motion_quality: createEmptyDimensionPairDraft(),
})

const createEmptyScoreDraft = () => ({
  scores: {
    text_consistency: { score: 0, major_reason: '', minor_reason: '' },
    temporal_consistency: { score: 0, major_reason: '', minor_reason: '' },
    visual_quality: { score: 0, major_reason: '', minor_reason: '' },
    distortion: { score: 0, major_reason: '', minor_reason: '' },
    motion_quality: { score: 0, major_reason: '', minor_reason: '' },
  } as Record<Dimension, { score: number; major_reason: string; minor_reason: string }>,
})

export const useAnnotationStore = create<AnnotationState>()(
  persist(
    (set, get) => ({
      // Initial state
      taskPackage: null,
      currentSampleIndex: 0,
      results: new Map(),
      currentChecklist: {},
      currentPairDraft: createEmptyPairDraft(),
      currentScoreDraft: createEmptyScoreDraft(),
      
      // Load task package
      loadTaskPackage: (pkg) => {
        set({
          taskPackage: pkg,
          currentSampleIndex: 0,
          results: new Map(),
          currentChecklist: {},
          currentPairDraft: createEmptyPairDraft(),
          currentScoreDraft: createEmptyScoreDraft(),
        })
      },
      
      clearTaskPackage: () => {
        set({
          taskPackage: null,
          currentSampleIndex: 0,
          results: new Map(),
          currentChecklist: {},
          currentPairDraft: createEmptyPairDraft(),
          currentScoreDraft: createEmptyScoreDraft(),
        })
      },
      
      // Navigation
      goToSample: (index) => {
        const { taskPackage, results } = get()
        if (!taskPackage || index < 0 || index >= taskPackage.samples.length) return
        
        const sample = taskPackage.samples[index]
        const existingResult = results.get(sample.sample_id)
        
        // Load existing result if available
        if (existingResult) {
          if (taskPackage.mode === 'pair') {
            const pairResult = existingResult as PairAnnotationResult
            const pairDraft = createEmptyPairDraft()
            
            // Convert saved result back to draft format (level is auto-inferred, not stored in draft)
            for (const dim of DIMENSIONS) {
              if (pairResult.dimensions[dim]) {
                pairDraft[dim] = {
                  video_a_major_reason: pairResult.dimensions[dim].video_a.major_reason,
                  video_a_minor_reason: pairResult.dimensions[dim].video_a.minor_reason,
                  video_b_major_reason: pairResult.dimensions[dim].video_b.major_reason,
                  video_b_minor_reason: pairResult.dimensions[dim].video_b.minor_reason,
                  comparison: pairResult.dimensions[dim].comparison,
                  degree_diff_reason: pairResult.dimensions[dim].degree_diff_reason || '',
                }
              }
            }
            
            set({
              currentSampleIndex: index,
              currentChecklist: pairResult.checklist_results,
              currentPairDraft: pairDraft,
            })
          } else {
            const scoreResult = existingResult as ScoreAnnotationResult
            set({
              currentSampleIndex: index,
              currentChecklist: scoreResult.checklist_results,
              currentScoreDraft: { scores: scoreResult.scores },
            })
          }
        } else {
          // Reset to empty draft
          set({
            currentSampleIndex: index,
            currentChecklist: {},
            currentPairDraft: createEmptyPairDraft(),
            currentScoreDraft: createEmptyScoreDraft(),
          })
        }
      },
      
      goToNextSample: () => {
        const { currentSampleIndex, taskPackage } = get()
        if (taskPackage && currentSampleIndex < taskPackage.samples.length - 1) {
          get().goToSample(currentSampleIndex + 1)
        }
      },
      
      goToPrevSample: () => {
        const { currentSampleIndex } = get()
        if (currentSampleIndex > 0) {
          get().goToSample(currentSampleIndex - 1)
        }
      },
      
      // Checklist
      toggleChecklistItem: (itemId) => {
        set((state) => ({
          currentChecklist: {
            ...state.currentChecklist,
            [itemId]: !state.currentChecklist[itemId],
          },
        }))
      },
      
      setChecklistItem: (itemId, checked) => {
        set((state) => ({
          currentChecklist: {
            ...state.currentChecklist,
            [itemId]: checked,
          },
        }))
      },
      
      // Pair mode - dimension-based (level is auto-inferred from reasons)
      setPairDimensionVideoAMajorReason: (dimension, reason) => {
        set((state) => ({
          currentPairDraft: {
            ...state.currentPairDraft,
            [dimension]: { ...state.currentPairDraft[dimension], video_a_major_reason: reason },
          },
        }))
      },
      
      setPairDimensionVideoAMinorReason: (dimension, reason) => {
        set((state) => ({
          currentPairDraft: {
            ...state.currentPairDraft,
            [dimension]: { ...state.currentPairDraft[dimension], video_a_minor_reason: reason },
          },
        }))
      },
      
      setPairDimensionVideoBMajorReason: (dimension, reason) => {
        set((state) => ({
          currentPairDraft: {
            ...state.currentPairDraft,
            [dimension]: { ...state.currentPairDraft[dimension], video_b_major_reason: reason },
          },
        }))
      },
      
      setPairDimensionVideoBMinorReason: (dimension, reason) => {
        set((state) => ({
          currentPairDraft: {
            ...state.currentPairDraft,
            [dimension]: { ...state.currentPairDraft[dimension], video_b_minor_reason: reason },
          },
        }))
      },
      
      setPairDimensionComparison: (dimension, comparison) => {
        set((state) => ({
          currentPairDraft: {
            ...state.currentPairDraft,
            [dimension]: { ...state.currentPairDraft[dimension], comparison },
          },
        }))
      },
      
      setPairDimensionDegreeDiff: (dimension, reason) => {
        set((state) => ({
          currentPairDraft: {
            ...state.currentPairDraft,
            [dimension]: { ...state.currentPairDraft[dimension], degree_diff_reason: reason },
          },
        }))
      },
      
      // Score mode
      setDimensionScore: (dimension, score) => {
        set((state) => ({
          currentScoreDraft: {
            scores: {
              ...state.currentScoreDraft.scores,
              [dimension]: { ...state.currentScoreDraft.scores[dimension], score },
            },
          },
        }))
      },
      
      setDimensionMajorReason: (dimension, reason) => {
        set((state) => ({
          currentScoreDraft: {
            scores: {
              ...state.currentScoreDraft.scores,
              [dimension]: { ...state.currentScoreDraft.scores[dimension], major_reason: reason },
            },
          },
        }))
      },
      
      setDimensionMinorReason: (dimension, reason) => {
        set((state) => ({
          currentScoreDraft: {
            scores: {
              ...state.currentScoreDraft.scores,
              [dimension]: { ...state.currentScoreDraft.scores[dimension], minor_reason: reason },
            },
          },
        }))
      },
      
      // Check if a dimension is complete for pair mode
      // Only requires comparison to be set (level is auto-inferred from reasons)
      isDimensionComplete: (dimension) => {
        const { currentPairDraft } = get()
        const draft = currentPairDraft[dimension]
        
        return draft.comparison !== null
      },
      
      // Validation
      isCurrentAnnotationValid: () => {
        const { taskPackage, currentPairDraft, currentScoreDraft } = get()
        if (!taskPackage) return false
        
        if (taskPackage.mode === 'pair') {
          // All dimensions must have comparison set (level is auto-inferred from reasons)
          for (const dim of DIMENSIONS) {
            const draft = currentPairDraft[dim]
            if (!draft.comparison) return false
          }
          return true
        } else {
          // Score mode validation - all dimensions must have scores
          for (const dim of DIMENSIONS) {
            if (currentScoreDraft.scores[dim].score === 0) return false
            // If score < 5, need at least one reason (major or minor)
            const hasMajor = currentScoreDraft.scores[dim].major_reason.trim()
            const hasMinor = currentScoreDraft.scores[dim].minor_reason.trim()
            if (currentScoreDraft.scores[dim].score < 5 && !hasMajor && !hasMinor) return false
          }
          return true
        }
      },
      
      // Save
      saveCurrentAnnotation: () => {
        const state = get()
        const { taskPackage, currentSampleIndex, currentChecklist, currentPairDraft, currentScoreDraft, results } = state
        
        if (!taskPackage) return false
        if (!state.isCurrentAnnotationValid()) return false
        
        const sample = taskPackage.samples[currentSampleIndex]
        const now = new Date().toISOString()
        
        const newResults = new Map(results)
        
        if (taskPackage.mode === 'pair') {
          const dimensions: Record<Dimension, DimensionPairAnnotation> = {} as Record<Dimension, DimensionPairAnnotation>
          
          for (const dim of DIMENSIONS) {
            const draft = currentPairDraft[dim]
            // Auto-infer level from reasons
            const videoALevel = inferProblemLevel(draft.video_a_major_reason, draft.video_a_minor_reason)
            const videoBLevel = inferProblemLevel(draft.video_b_major_reason, draft.video_b_minor_reason)
            
            dimensions[dim] = {
              video_a: {
                level: videoALevel,
                major_reason: draft.video_a_major_reason,
                minor_reason: draft.video_a_minor_reason,
              },
              video_b: {
                level: videoBLevel,
                major_reason: draft.video_b_major_reason,
                minor_reason: draft.video_b_minor_reason,
              },
              comparison: draft.comparison!,
              degree_diff_reason: draft.degree_diff_reason || undefined,
            }
          }
          
          const result: PairAnnotationResult = {
            sample_id: sample.sample_id,
            dimensions,
            checklist_results: currentChecklist,
            annotated_at: now,
          }
          newResults.set(sample.sample_id, result)
        } else {
          const result: ScoreAnnotationResult = {
            sample_id: sample.sample_id,
            scores: currentScoreDraft.scores,
            checklist_results: currentChecklist,
            annotated_at: now,
          }
          newResults.set(sample.sample_id, result)
        }
        
        set({ results: newResults })
        return true
      },
      
      // Stats
      getCompletionStats: () => {
        const { taskPackage, results } = get()
        if (!taskPackage) return { completed: 0, total: 0 }
        return {
          completed: results.size,
          total: taskPackage.samples.length,
        }
      },
      
      // Export
      exportResults: () => {
        const { taskPackage, results } = get()
        if (!taskPackage) return '{}'
        
        // Create a map of sample_id to sample for quick lookup
        const sampleMap = new Map(
          taskPackage.samples.map((s) => [s.sample_id, s])
        )
        
        // Attach model info to each result
        const resultsWithModel = Array.from(results.values()).map((result) => {
          const sample = sampleMap.get(result.sample_id)
          if (!sample) return result
          
          if (taskPackage.mode === 'pair' && 'video_a_url' in sample) {
            return {
              ...result,
              video_a_model: sample.video_a_model,
              video_b_model: sample.video_b_model,
            }
          } else if (taskPackage.mode === 'score' && 'video_url' in sample) {
            return {
              ...result,
              video_model: sample.video_model,
            }
          }
          return result
        })
        
        const exportData = {
          task_id: taskPackage.task_id,
          annotator_id: taskPackage.annotator_id,
          mode: taskPackage.mode,
          total_samples: taskPackage.samples.length,
          completed_samples: results.size,
          exported_at: new Date().toISOString(),
          results: resultsWithModel,
        }
        
        return JSON.stringify(exportData, null, 2)
      },
    }),
    {
      name: 'annotation-storage-v3', // Version bump for major/minor reason split
      // Custom serialization for Map
      storage: {
        getItem: (name) => {
          try {
            const str = localStorage.getItem(name)
            if (!str) return null
            const parsed = JSON.parse(str)
            if (parsed.state?.results) {
              parsed.state.results = new Map(Object.entries(parsed.state.results))
            }
            // Validate that currentPairDraft has the new structure with major/minor reasons
            if (parsed.state?.currentPairDraft?.text_consistency && 
                !('video_a_major_reason' in parsed.state.currentPairDraft.text_consistency)) {
              // Old format detected (v2), clear it
              console.warn('Old annotation data format (v2) detected, resetting...')
              localStorage.removeItem(name)
              localStorage.removeItem('annotation-storage-v2')
              localStorage.removeItem('annotation-storage')
              return null
            }
            return parsed
          } catch (e) {
            console.error('Failed to parse stored data:', e)
            localStorage.removeItem(name)
            return null
          }
        },
        setItem: (name, value) => {
          try {
            const toStore = {
              ...value,
              state: {
                ...value.state,
                results: value.state.results instanceof Map 
                  ? Object.fromEntries(value.state.results)
                  : value.state.results,
              },
            }
            localStorage.setItem(name, JSON.stringify(toStore))
          } catch (e) {
            console.error('Failed to save data:', e)
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
)
