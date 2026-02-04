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

// Sample status type for the progress grid
export type SampleStatus = 'completed' | 'doubtful' | 'pending'

// Draft data structure for export (same as DraftData but JSON-serializable)
interface ExportedDraft {
  checklist: ChecklistState
  pairDraft?: Record<Dimension, DimensionPairDraft>
  scoreDraft?: {
    scores: Record<Dimension, { score: number; major_reason: string; minor_reason: string }>
  }
}

// Exported results structure (for rework import)
export interface ExportedResults {
  task_id: string
  annotator_id: string
  mode: 'pair' | 'score'
  total_samples: number
  completed_samples: number
  doubtful_samples?: number
  doubtful_sample_ids?: string[]
  drafts?: Record<string, ExportedDraft>
  exported_at: string
  task_package: TaskPackage
  results: AnnotationResult[]
}

// Draft data structure for saving incomplete annotations
interface DraftData {
  checklist: ChecklistState
  pairDraft?: Record<Dimension, DimensionPairDraft>
  scoreDraft?: {
    scores: Record<Dimension, { score: number; major_reason: string; minor_reason: string }>
  }
}

interface AnnotationState {
  // Task data
  taskPackage: TaskPackage | null
  currentSampleIndex: number
  
  // Annotation results
  results: Map<string, AnnotationResult>
  
  // Doubtful samples tracking
  doubtfulSamples: Set<string>
  
  // Dirty samples tracking (modified but not saved)
  dirtySamples: Set<string>
  
  // Drafts for incomplete annotations (saved when marking as doubtful or navigating away)
  drafts: Map<string, DraftData>
  
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
  loadExportedResults: (exported: ExportedResults) => void
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
  
  // Save current draft (for incomplete annotations)
  saveDraft: () => void
  
  // Doubtful actions
  markAsDoubtful: () => void
  removeDoubt: (sampleId: string) => void
  
  // Get completion stats (now includes doubtful and modified count)
  getCompletionStats: () => { completed: number; doubtful: number; modified: number; pending: number; total: number }
  
  // Get sample status by index
  getSampleStatus: (index: number) => SampleStatus
  
  // Check if current annotation is valid
  isCurrentAnnotationValid: () => boolean
  
  // Check if a specific dimension is complete (for pair mode)
  isDimensionComplete: (dimension: Dimension) => boolean
  
  // Export all results
  exportResults: () => string
  
  // Internal helper to update dirty status based on comparison with saved result
  _updateDirtyStatus: () => void
  
  // Internal helper to check if current draft matches saved result
  _isCurrentDraftMatchingSavedResult: () => boolean
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
      doubtfulSamples: new Set(),
      dirtySamples: new Set(),
      drafts: new Map(),
      currentChecklist: {},
      currentPairDraft: createEmptyPairDraft(),
      currentScoreDraft: createEmptyScoreDraft(),
      
      // Load task package
      loadTaskPackage: (pkg) => {
        set({
          taskPackage: pkg,
          currentSampleIndex: 0,
          results: new Map(),
          doubtfulSamples: new Set(),
          dirtySamples: new Set(),
          drafts: new Map(),
          currentChecklist: {},
          currentPairDraft: createEmptyPairDraft(),
          currentScoreDraft: createEmptyScoreDraft(),
        })
      },
      
      // Load exported results for rework
      loadExportedResults: (exported) => {
        const { task_package, results, doubtful_sample_ids, drafts: exportedDrafts } = exported
        
        // Convert results array to Map
        const resultsMap = new Map<string, AnnotationResult>()
        for (const result of results) {
          resultsMap.set(result.sample_id, result)
        }
        
        // Restore doubtful samples - ensure it's a proper Set
        const doubtfulArray = Array.isArray(doubtful_sample_ids) ? doubtful_sample_ids : []
        const doubtfulSet = new Set<string>(doubtfulArray)
        
        // Restore drafts - convert object to Map
        const draftsMap = new Map<string, DraftData>()
        if (exportedDrafts && typeof exportedDrafts === 'object') {
          for (const [key, value] of Object.entries(exportedDrafts)) {
            draftsMap.set(key, value as DraftData)
          }
        }
        
        // Set state with restored data
        set({
          taskPackage: task_package,
          currentSampleIndex: 0,
          results: resultsMap,
          doubtfulSamples: doubtfulSet,
          dirtySamples: new Set(),
          drafts: draftsMap,
          currentChecklist: {},
          currentPairDraft: createEmptyPairDraft(),
          currentScoreDraft: createEmptyScoreDraft(),
        })
        
        // Navigate to first sample to load its data if already annotated
        const firstSample = task_package.samples[0]
        if (firstSample && resultsMap.has(firstSample.sample_id)) {
          get().goToSample(0)
        }
      },
      
      clearTaskPackage: () => {
        set({
          taskPackage: null,
          currentSampleIndex: 0,
          results: new Map(),
          doubtfulSamples: new Set(),
          dirtySamples: new Set(),
          drafts: new Map(),
          currentChecklist: {},
          currentPairDraft: createEmptyPairDraft(),
          currentScoreDraft: createEmptyScoreDraft(),
        })
      },
      
      // Navigation
      goToSample: (index) => {
        const { taskPackage, results, drafts } = get()
        if (!taskPackage || index < 0 || index >= taskPackage.samples.length) return
        
        const sample = taskPackage.samples[index]
        const existingResult = results.get(sample.sample_id)
        const existingDraft = drafts.get(sample.sample_id)
        
        // Priority: 1. Completed result, 2. Draft, 3. Empty
        if (existingResult) {
          // Load from completed result
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
        } else if (existingDraft) {
          // Load from draft (incomplete annotation)
          set({
            currentSampleIndex: index,
            currentChecklist: existingDraft.checklist,
            currentPairDraft: existingDraft.pairDraft || createEmptyPairDraft(),
            currentScoreDraft: existingDraft.scoreDraft || createEmptyScoreDraft(),
          })
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
      
      // Helper to check if current draft matches saved result
      _isCurrentDraftMatchingSavedResult: () => {
        const { taskPackage, currentSampleIndex, results, currentChecklist, currentPairDraft, currentScoreDraft } = get()
        if (!taskPackage) return false
        
        const sample = taskPackage.samples[currentSampleIndex]
        const savedResult = results.get(sample.sample_id)
        if (!savedResult) return false
        
        // Helper to compare strings (trim and handle undefined/null)
        const strEq = (a: string | undefined, b: string | undefined): boolean => {
          return (a || '').trim() === (b || '').trim()
        }
        
        // Compare checklist
        const savedChecklist = savedResult.checklist_results || {}
        const checklistKeys = new Set([...Object.keys(savedChecklist), ...Object.keys(currentChecklist)])
        for (const key of checklistKeys) {
          if (Boolean(savedChecklist[key]) !== Boolean(currentChecklist[key])) {
            return false
          }
        }
        
        if (taskPackage.mode === 'pair') {
          const pairResult = savedResult as PairAnnotationResult
          
          for (const dim of DIMENSIONS) {
            const savedDim = pairResult.dimensions[dim]
            const currentDim = currentPairDraft[dim]
            
            if (!savedDim) return false
            
            // Compare all fields
            if (!strEq(savedDim.video_a.major_reason, currentDim.video_a_major_reason)) return false
            if (!strEq(savedDim.video_a.minor_reason, currentDim.video_a_minor_reason)) return false
            if (!strEq(savedDim.video_b.major_reason, currentDim.video_b_major_reason)) return false
            if (!strEq(savedDim.video_b.minor_reason, currentDim.video_b_minor_reason)) return false
            if (savedDim.comparison !== currentDim.comparison) return false
            if (!strEq(savedDim.degree_diff_reason, currentDim.degree_diff_reason)) return false
          }
        } else {
          const scoreResult = savedResult as ScoreAnnotationResult
          
          for (const dim of DIMENSIONS) {
            const savedScore = scoreResult.scores[dim]
            const currentScore = currentScoreDraft.scores[dim]
            
            if (savedScore.score !== currentScore.score) return false
            if (!strEq(savedScore.major_reason, currentScore.major_reason)) return false
            if (!strEq(savedScore.minor_reason, currentScore.minor_reason)) return false
          }
        }
        
        return true
      },
      
      // Helper to update dirty status based on comparison with saved result
      _updateDirtyStatus: () => {
        const { taskPackage, currentSampleIndex, results, dirtySamples } = get()
        if (!taskPackage) return
        
        const sample = taskPackage.samples[currentSampleIndex]
        // Only relevant for samples that have been saved
        if (!results.has(sample.sample_id)) return
        
        const isMatching = get()._isCurrentDraftMatchingSavedResult()
        const isDirty = dirtySamples.has(sample.sample_id)
        
        if (isMatching && isDirty) {
          // Draft matches saved result, remove from dirty
          const newDirtySamples = new Set(dirtySamples)
          newDirtySamples.delete(sample.sample_id)
          set({ dirtySamples: newDirtySamples })
        } else if (!isMatching && !isDirty) {
          // Draft differs from saved result, add to dirty
          const newDirtySamples = new Set(dirtySamples)
          newDirtySamples.add(sample.sample_id)
          set({ dirtySamples: newDirtySamples })
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
        get()._updateDirtyStatus()
      },
      
      setChecklistItem: (itemId, checked) => {
        set((state) => ({
          currentChecklist: {
            ...state.currentChecklist,
            [itemId]: checked,
          },
        }))
        get()._updateDirtyStatus()
      },
      
      // Pair mode - dimension-based (level is auto-inferred from reasons)
      setPairDimensionVideoAMajorReason: (dimension, reason) => {
        set((state) => ({
          currentPairDraft: {
            ...state.currentPairDraft,
            [dimension]: { ...state.currentPairDraft[dimension], video_a_major_reason: reason },
          },
        }))
        get()._updateDirtyStatus()
      },
      
      setPairDimensionVideoAMinorReason: (dimension, reason) => {
        set((state) => ({
          currentPairDraft: {
            ...state.currentPairDraft,
            [dimension]: { ...state.currentPairDraft[dimension], video_a_minor_reason: reason },
          },
        }))
        get()._updateDirtyStatus()
      },
      
      setPairDimensionVideoBMajorReason: (dimension, reason) => {
        set((state) => ({
          currentPairDraft: {
            ...state.currentPairDraft,
            [dimension]: { ...state.currentPairDraft[dimension], video_b_major_reason: reason },
          },
        }))
        get()._updateDirtyStatus()
      },
      
      setPairDimensionVideoBMinorReason: (dimension, reason) => {
        set((state) => ({
          currentPairDraft: {
            ...state.currentPairDraft,
            [dimension]: { ...state.currentPairDraft[dimension], video_b_minor_reason: reason },
          },
        }))
        get()._updateDirtyStatus()
      },
      
      setPairDimensionComparison: (dimension, comparison) => {
        set((state) => ({
          currentPairDraft: {
            ...state.currentPairDraft,
            [dimension]: { ...state.currentPairDraft[dimension], comparison },
          },
        }))
        get()._updateDirtyStatus()
      },
      
      setPairDimensionDegreeDiff: (dimension, reason) => {
        set((state) => ({
          currentPairDraft: {
            ...state.currentPairDraft,
            [dimension]: { ...state.currentPairDraft[dimension], degree_diff_reason: reason },
          },
        }))
        get()._updateDirtyStatus()
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
        get()._updateDirtyStatus()
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
        get()._updateDirtyStatus()
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
        get()._updateDirtyStatus()
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
        const { taskPackage, currentSampleIndex, currentChecklist, currentPairDraft, currentScoreDraft, results, drafts, doubtfulSamples, dirtySamples } = state
        
        if (!taskPackage) return false
        if (!state.isCurrentAnnotationValid()) return false
        
        const sample = taskPackage.samples[currentSampleIndex]
        const now = new Date().toISOString()
        
        const newResults = new Map(results)
        const newDrafts = new Map(drafts)
        const newDoubtfulSamples = new Set(doubtfulSamples)
        const newDirtySamples = new Set(dirtySamples)
        
        // Clear draft for this sample since it's now complete
        newDrafts.delete(sample.sample_id)
        // Also remove from doubtful if it was marked
        newDoubtfulSamples.delete(sample.sample_id)
        // Clear dirty flag since we're saving
        newDirtySamples.delete(sample.sample_id)
        
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
        
        set({ results: newResults, drafts: newDrafts, doubtfulSamples: newDoubtfulSamples, dirtySamples: newDirtySamples })
        return true
      },
      
      // Save current draft (for incomplete annotations)
      saveDraft: () => {
        const { taskPackage, currentSampleIndex, currentChecklist, currentPairDraft, currentScoreDraft, drafts } = get()
        if (!taskPackage) return
        
        const sample = taskPackage.samples[currentSampleIndex]
        const newDrafts = new Map(drafts)
        
        // Check if there's any content to save
        let hasContent = false
        if (taskPackage.mode === 'pair') {
          for (const dim of DIMENSIONS) {
            const draft = currentPairDraft[dim]
            if (draft.comparison || draft.video_a_major_reason || draft.video_a_minor_reason || 
                draft.video_b_major_reason || draft.video_b_minor_reason) {
              hasContent = true
              break
            }
          }
        } else {
          for (const dim of DIMENSIONS) {
            if (currentScoreDraft.scores[dim].score > 0 || 
                currentScoreDraft.scores[dim].major_reason || 
                currentScoreDraft.scores[dim].minor_reason) {
              hasContent = true
              break
            }
          }
        }
        
        // Also check checklist
        if (Object.values(currentChecklist).some(v => v)) {
          hasContent = true
        }
        
        if (hasContent) {
          newDrafts.set(sample.sample_id, {
            checklist: { ...currentChecklist },
            pairDraft: taskPackage.mode === 'pair' ? JSON.parse(JSON.stringify(currentPairDraft)) : undefined,
            scoreDraft: taskPackage.mode === 'score' ? JSON.parse(JSON.stringify(currentScoreDraft)) : undefined,
          })
          set({ drafts: newDrafts })
        }
      },
      
      // Doubtful actions
      markAsDoubtful: () => {
        const { taskPackage, currentSampleIndex, doubtfulSamples } = get()
        if (!taskPackage) return
        
        // Save current draft before navigating away
        get().saveDraft()
        
        const sample = taskPackage.samples[currentSampleIndex]
        const newDoubtfulSamples = new Set(doubtfulSamples)
        newDoubtfulSamples.add(sample.sample_id)
        
        set({ doubtfulSamples: newDoubtfulSamples })
        
        // Auto-navigate to next sample
        if (currentSampleIndex < taskPackage.samples.length - 1) {
          get().goToSample(currentSampleIndex + 1)
        }
      },
      
      removeDoubt: (sampleId) => {
        const { doubtfulSamples } = get()
        const newDoubtfulSamples = new Set(doubtfulSamples)
        newDoubtfulSamples.delete(sampleId)
        set({ doubtfulSamples: newDoubtfulSamples })
      },
      
      // Stats (now includes doubtful, modified and pending count)
      getCompletionStats: () => {
        const { taskPackage, results, doubtfulSamples, dirtySamples } = get()
        if (!taskPackage) return { completed: 0, doubtful: 0, modified: 0, pending: 0, total: 0 }
        
        // Count samples that are truly completed (in results but not dirty)
        let completed = 0
        let modified = 0
        
        for (const sampleId of results.keys()) {
          if (dirtySamples.has(sampleId)) {
            modified++
          } else {
            completed++
          }
        }
        
        // Pending = total - completed - modified - doubtful
        // Note: doubtful samples may overlap with results/dirty, so we need to be careful
        const pending = taskPackage.samples.length - completed - modified - doubtfulSamples.size
        
        return {
          completed,
          doubtful: doubtfulSamples.size,
          modified,
          pending: Math.max(0, pending),
          total: taskPackage.samples.length,
        }
      },
      
      // Get sample status by index
      getSampleStatus: (index) => {
        const { taskPackage, results, doubtfulSamples, dirtySamples } = get()
        if (!taskPackage || index < 0 || index >= taskPackage.samples.length) {
          return 'pending'
        }
        
        const sampleId = taskPackage.samples[index].sample_id
        // Dirty samples (modified but not saved) should show as pending
        if (dirtySamples.has(sampleId)) return 'pending'
        if (results.has(sampleId)) return 'completed'
        if (doubtfulSamples.has(sampleId)) return 'doubtful'
        return 'pending'
      },
      
      // Export
      exportResults: () => {
        const { taskPackage, results, doubtfulSamples, drafts } = get()
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
        
        // Convert drafts Map to object for export
        const draftsObject: Record<string, DraftData> = {}
        drafts.forEach((value, key) => {
          draftsObject[key] = value
        })
        
        const exportData = {
          task_id: taskPackage.task_id,
          annotator_id: taskPackage.annotator_id,
          mode: taskPackage.mode,
          total_samples: taskPackage.samples.length,
          completed_samples: results.size,
          doubtful_samples: doubtfulSamples.size,
          doubtful_sample_ids: Array.from(doubtfulSamples),
          drafts: draftsObject,
          exported_at: new Date().toISOString(),
          // Include full task package for rework support
          task_package: taskPackage,
          results: resultsWithModel,
        }
        
        return JSON.stringify(exportData, null, 2)
      },
    }),
    {
      name: 'annotation-storage-v6', // Version bump for dirtySamples feature
      // Custom serialization for Map and Set
      storage: {
        getItem: (name) => {
          try {
            const str = localStorage.getItem(name)
            if (!str) return null
            const parsed = JSON.parse(str)
            if (parsed.state?.results) {
              parsed.state.results = new Map(Object.entries(parsed.state.results))
            }
            // Convert doubtfulSamples array back to Set
            if (parsed.state?.doubtfulSamples) {
              parsed.state.doubtfulSamples = new Set(parsed.state.doubtfulSamples)
            } else {
              parsed.state.doubtfulSamples = new Set()
            }
            // Convert dirtySamples array back to Set
            if (parsed.state?.dirtySamples) {
              parsed.state.dirtySamples = new Set(parsed.state.dirtySamples)
            } else {
              parsed.state.dirtySamples = new Set()
            }
            // Convert drafts object back to Map
            if (parsed.state?.drafts) {
              parsed.state.drafts = new Map(Object.entries(parsed.state.drafts))
            } else {
              parsed.state.drafts = new Map()
            }
            // Validate that currentPairDraft has the new structure with major/minor reasons
            if (parsed.state?.currentPairDraft?.text_consistency && 
                !('video_a_major_reason' in parsed.state.currentPairDraft.text_consistency)) {
              // Old format detected (v2), clear it
              console.warn('Old annotation data format (v2) detected, resetting...')
              localStorage.removeItem(name)
              localStorage.removeItem('annotation-storage-v5')
              localStorage.removeItem('annotation-storage-v4')
              localStorage.removeItem('annotation-storage-v3')
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
                doubtfulSamples: value.state.doubtfulSamples instanceof Set
                  ? Array.from(value.state.doubtfulSamples)
                  : value.state.doubtfulSamples || [],
                dirtySamples: value.state.dirtySamples instanceof Set
                  ? Array.from(value.state.dirtySamples)
                  : value.state.dirtySamples || [],
                drafts: value.state.drafts instanceof Map
                  ? Object.fromEntries(value.state.drafts)
                  : value.state.drafts || {},
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
