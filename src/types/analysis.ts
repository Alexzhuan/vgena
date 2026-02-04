// ============================================
// Analysis Types for Annotation Dashboard
// ============================================

import type {
  Dimension,
  ComparisonResult,
  PairSample,
  ScoreSample,
  PairTaskPackage,
  ScoreTaskPackage,
} from './index'

// ============================================
// Annotation Result Types (for analysis)
// ============================================

export interface PairDimensionResult {
  video_a: {
    level: 'none' | 'minor' | 'major'
    major_reason: string
    minor_reason: string
  }
  video_b: {
    level: 'none' | 'minor' | 'major'
    major_reason: string
    minor_reason: string
  }
  comparison: ComparisonResult
  degree_diff_reason?: string
}

export interface PairSampleResult {
  sample_id: string
  dimensions: Record<Dimension, PairDimensionResult>
  checklist_results: Record<string, boolean>
  annotated_at: string
  video_a_model: string
  video_b_model: string
  annotator_id?: string
}

export interface PairAnnotationResult {
  task_id: string
  annotator_id: string
  mode: 'pair'
  total_samples: number
  completed_samples: number
  exported_at: string
  results: PairSampleResult[]
  doubtful_samples?: number
  doubtful_sample_ids?: string[]
  drafts?: Record<string, unknown>
  task_package?: PairTaskPackage
  converted_at?: string
}

export interface ScoreDimensionResult {
  score: number // 1-5
  major_reason: string
  minor_reason: string
}

export interface ScoreSampleResult {
  sample_id: string
  scores: Record<Dimension, ScoreDimensionResult>
  checklist_results: Record<string, boolean>
  annotated_at: string
  video_model: string
  annotator_id?: string
}

export interface ScoreAnnotationResult {
  task_id: string
  annotator_id: string
  mode: 'score'
  total_samples: number
  completed_samples: number
  exported_at: string
  results: ScoreSampleResult[]
  doubtful_samples?: number
  doubtful_sample_ids?: string[]
  drafts?: Record<string, unknown>
  task_package?: ScoreTaskPackage
  converted_at?: string
}

// ============================================
// Model Statistics Types
// ============================================

export interface ModelStats {
  model: string
  wins: number
  losses: number
  ties: number
  winRate: number
  elo: number
  avgScores: Record<Dimension, number>
  sampleCount: number
}

export interface DimensionWinRate {
  dimension: Dimension
  winRate: number
  wins: number
  losses: number
  ties: number
}

// ============================================
// Consistency Analysis Types
// ============================================

export interface ConsistencyResult {
  sampleId: string
  dimension: Dimension
  pairComparison: ComparisonResult
  scoreA: number
  scoreB: number
  scoreDiff: number
  isConsistent: boolean
  inconsistencyType?: 'direction_mismatch' | 'tie_but_diff' | 'diff_but_tie'
  videoAModel: string
  videoBModel: string
  prompt?: string
}

export interface ConsistencyStats {
  totalMatched: number
  hardMatchConsistent: number
  hardMatchRate: number
  softMatchConsistent: number
  softMatchRate: number
  byDimension: Record<Dimension, {
    total: number
    hardMatchConsistent: number
    hardMatchRate: number
    softMatchConsistent: number
    softMatchRate: number
  }>
  inconsistentSamples: ConsistencyResult[]
}

// ============================================
// Combined Data Types (for display)
// ============================================

export interface CombinedPairData {
  sample: PairSample
  result: PairSampleResult
  annotatorId: string
}

export interface CombinedScoreData {
  sample: ScoreSample
  result: ScoreSampleResult
  annotatorId: string
}

// ============================================
// Uploaded File Types
// ============================================

export interface UploadedFileInfo {
  file: File
  name: string
  mode: 'pair' | 'score' | 'unknown'
  sampleCount: number
  status: 'pending' | 'parsed' | 'error'
  error?: string
  content?: unknown
}

export interface UploadedFileRecord {
  name: string
  mode: 'pair' | 'score'
  sampleCount: number
}

// ============================================
// Quality Assurance (QA) Types
// ============================================

/**
 * Problem level for score mode QA
 */
export type QAProblemLevel = 'none' | 'minor' | 'major'

/**
 * Pair mode - single dimension QA result
 */
export interface QAPairDimensionResult {
  dimension: Dimension
  goldenComparison: ComparisonResult
  annotatorComparison: ComparisonResult
  isMatch: boolean
}

/**
 * Pair mode - single sample QA result
 */
export interface QAPairSampleResult {
  sampleId: string
  annotatorId: string
  dimensionResults: QAPairDimensionResult[]
  matchedCount: number  // Number of matched dimensions
  totalDimensions: number  // Always 5
  hardMatch: boolean  // All 5 dimensions match
  softMatchRate: number  // matchedCount / 5
  // Sample details for preview
  prompt?: string
  firstFrameUrl?: string
  videoAUrl?: string
  videoBUrl?: string
  videoAModel?: string
  videoBModel?: string
}

/**
 * Score mode - single dimension QA result
 */
export interface QAScoreDimensionResult {
  dimension: Dimension
  goldenScore: number
  annotatorScore: number
  goldenLevel: QAProblemLevel
  annotatorLevel: QAProblemLevel
  isExactMatch: boolean  // Score exactly equal
  isLevelMatch: boolean  // Problem level equal
}

/**
 * Score mode - single sample QA result
 */
export interface QAScoreSampleResult {
  sampleId: string
  annotatorId: string
  dimensionResults: QAScoreDimensionResult[]
  exactMatchCount: number  // Number of dimensions with exact score match
  levelMatchCount: number  // Number of dimensions with level match
  totalDimensions: number  // Always 5
  hardMatch: boolean  // All 5 dimensions have exact score match
  softMatchRate: number  // levelMatchCount / 5
  // Sample details for preview
  prompt?: string
  firstFrameUrl?: string
  videoUrl?: string
  videoModel?: string
}

/**
 * Pair mode - overall QA statistics
 */
export interface QAPairStats {
  mode: 'pair'
  totalSamples: number
  hardMatchCount: number  // Samples where all dimensions match
  hardMatchRate: number
  avgSoftMatchRate: number  // Average dimension match rate across all samples
  byDimension: Record<Dimension, {
    total: number
    matchCount: number
    matchRate: number
  }>
  byAnnotator: Record<string, {
    total: number
    hardMatchCount: number
    hardMatchRate: number
    avgSoftMatchRate: number
  }>
  mismatchedSamples: QAPairSampleResult[]  // Samples that don't hard match
}

/**
 * Score mode - overall QA statistics
 */
export interface QAScoreStats {
  mode: 'score'
  totalSamples: number
  hardMatchCount: number  // Samples where all dimensions have exact score match
  hardMatchRate: number
  softMatchCount: number  // Samples where all dimensions have same problem level
  softMatchRate: number
  avgExactMatchRate: number  // Average exact score match rate
  avgLevelMatchRate: number  // Average level match rate
  byDimension: Record<Dimension, {
    total: number
    exactMatchCount: number
    exactMatchRate: number
    levelMatchCount: number
    levelMatchRate: number
  }>
  byAnnotator: Record<string, {
    total: number
    hardMatchCount: number
    hardMatchRate: number
    avgLevelMatchRate: number
  }>
  mismatchedSamples: QAScoreSampleResult[]  // Samples that don't hard match
}

/**
 * Union type for QA stats
 */
export type QAStats = QAPairStats | QAScoreStats
