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
  // Golden Set reasons
  goldenVideoAMajorReason?: string
  goldenVideoAMinorReason?: string
  goldenVideoBMajorReason?: string
  goldenVideoBMinorReason?: string
  // Annotator reasons
  annotatorVideoAMajorReason?: string
  annotatorVideoAMinorReason?: string
  annotatorVideoBMajorReason?: string
  annotatorVideoBMinorReason?: string
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
  // Golden Set reasons
  goldenMajorReason?: string
  goldenMinorReason?: string
  // Annotator reasons
  annotatorMajorReason?: string
  annotatorMinorReason?: string
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
  allSampleResults: QAPairSampleResult[]  // All sample results for filtering
  mismatchedSamples: QAPairSampleResult[]  // Samples that don't hard match
  dimensionMismatches: QAPairDimensionMismatch[]  // Per-dimension mismatches
}

/**
 * Pair mode - per-dimension mismatch record (for expanded list view)
 */
export interface QAPairDimensionMismatch {
  sampleId: string
  annotatorId: string
  dimension: Dimension
  goldenComparison: ComparisonResult
  annotatorComparison: ComparisonResult
  // Sample details
  prompt?: string
  firstFrameUrl?: string
  videoAUrl?: string
  videoBUrl?: string
  videoAModel?: string
  videoBModel?: string
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
  avgExactMatchRate: number  // Average exact score match rate (Hard Match)
  avgLevelMatchRate: number  // Average level match rate (Soft Match)
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
    softMatchCount: number
    softMatchRate: number
    avgExactMatchRate: number
    avgLevelMatchRate: number
  }>
  allSampleResults: QAScoreSampleResult[]  // All sample results for filtering
  mismatchedSamples: QAScoreSampleResult[]  // Samples that don't hard match
  dimensionMismatches: QAScoreDimensionMismatch[]  // Per-dimension mismatches
}

/**
 * Score mode - per-dimension mismatch record (for expanded list view)
 */
export interface QAScoreDimensionMismatch {
  sampleId: string
  annotatorId: string
  dimension: Dimension
  goldenScore: number
  annotatorScore: number
  goldenLevel: QAProblemLevel
  annotatorLevel: QAProblemLevel
  // Sample details
  prompt?: string
  firstFrameUrl?: string
  videoUrl?: string
  videoModel?: string
}

/**
 * Union type for QA stats
 */
export type QAStats = QAPairStats | QAScoreStats

// ============================================
// QC Inter-Annotator Agreement Types
// ============================================

/**
 * Auto-detected QC sample information
 */
export interface QCDetectionResult {
  /** sample_ids that appear at max frequency (i.e. QC samples) */
  qcSampleIds: string[]
  /** Maximum occurrence count across annotators */
  maxFrequency: number
  /** Total unique samples across all annotator files */
  totalUniqueSamples: number
  /** Number of QC samples detected */
  qcCount: number
  /** Number of annotators in the dataset */
  annotatorCount: number
  /** Map: sample_id -> list of annotatorIds that annotated it */
  sampleAnnotatorMap: Record<string, string[]>
}

/**
 * A single annotator's annotation for a QC sample
 */
export interface QCAnnotatorEntry {
  sampleId: string
  annotatorId: string
  mode: 'pair' | 'score'
  pairResult?: PairSampleResult
  scoreResult?: ScoreSampleResult
}

/**
 * A QC sample grouped with all annotator entries
 */
export interface QCGroupedSample {
  sampleId: string
  mode: 'pair' | 'score'
  entries: QCAnnotatorEntry[]
}

/**
 * Krippendorff's Alpha calculation result
 */
export interface KrippendorffResult {
  /** The alpha value (-1 to 1, 1 = perfect agreement) */
  alpha: number
  /** Observed disagreement D_o */
  observedDisagreement: number
  /** Expected disagreement D_e */
  expectedDisagreement: number
  /** Which match method was used */
  method: 'hard' | 'soft'
  /** Per-dimension alpha values */
  byDimension: Record<Dimension, number>
}

/**
 * Score mode: per-dimension agreement detail for a QC sample
 */
export interface QCScoreAgreementDetail {
  sampleId: string
  dimension: Dimension
  annotatorScores: { annotatorId: string; score: number }[]
  mean: number
  spread: number // max - min
}

/**
 * Pair mode: per-dimension agreement detail for a QC sample
 */
export interface QCPairAgreementDetail {
  sampleId: string
  dimension: Dimension
  annotatorComparisons: { annotatorId: string; comparison: ComparisonResult }[]
  majorityValue?: ComparisonResult
}

/**
 * Per-dimension agreement statistics
 */
export interface QCDimensionAgreementStats {
  dimension: Dimension
  totalChecks: number
  hardAlpha: number
  softAlpha: number
}

/**
 * Annotator skill metrics
 */
export interface AnnotatorSkillMetrics {
  annotatorId: string
  /** How many QC samples this annotator was involved in */
  qcSampleCount: number
  /** How often annotator agrees with majority (hard criteria) */
  majorityAgreementRateHard: number
  /** How often annotator agrees with majority (soft criteria) */
  majorityAgreementRateSoft: number
  /** Mean absolute deviation from other annotators' mean (score mode only) */
  avgDeviation: number | null
  /** Composite reliability score (0-1, higher is better) */
  compositeScore: number
  /** Rank among all annotators (1 = best) */
  rank: number
  /** Per-dimension breakdown */
  byDimension: Record<Dimension, {
    majorityAgreementRateHard: number
    majorityAgreementRateSoft: number
  }>
}

/**
 * Classified disagreement: wraps a disagreement detail with its match category
 */
export interface ClassifiedDisagreement {
  /** The underlying disagreement detail (score or pair) */
  detail: QCScoreAgreementDetail | QCPairAgreementDetail
  /** 'hard_only' = differs on exact values but passes soft match; 'soft_fail' = fails soft match too */
  matchCategory: 'hard_only' | 'soft_fail'
}

/**
 * Overall QC inter-annotator agreement statistics
 */
export interface QCOverlapAgreementStats {
  /** Detected mode from uploaded files */
  mode: 'pair' | 'score' | 'mixed'
  /** Auto-detected QC info */
  detection: QCDetectionResult
  /** Total dimension-level checks performed */
  totalChecks: number
  /** Krippendorff's Alpha results */
  krippendorffHard: KrippendorffResult
  krippendorffSoft: KrippendorffResult
  /** Per-dimension stats */
  byDimension: Record<Dimension, QCDimensionAgreementStats>
  /** Per-annotator skill metrics */
  annotatorSkills: AnnotatorSkillMetrics[]
  /** Detailed agreement data for score mode */
  scoreDetails: QCScoreAgreementDetail[]
  /** Detailed agreement data for pair mode */
  pairDetails: QCPairAgreementDetail[]
  /** All disagreement cases (where annotators differ) */
  disagreements: (QCScoreAgreementDetail | QCPairAgreementDetail)[]
  /** Classified disagreements with Hard-only / Soft-fail category */
  classifiedDisagreements: ClassifiedDisagreement[]
  /** Grouped QC samples for detail lookup (full annotator entries) */
  groupedSamples: QCGroupedSample[]
  /** Sample details map: sample_id -> sample metadata (prompt, video URLs, etc.) */
  sampleDetailsMap: Record<string, PairSample | ScoreSample>
}
