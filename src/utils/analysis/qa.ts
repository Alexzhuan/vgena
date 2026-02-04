/**
 * Quality Assurance (QA) utilities for annotation quality check
 * 
 * Supports:
 * - Pair mode: Compare Golden Set comparison results with annotator results
 * - Score mode: Compare Golden Set scores with annotator scores
 */

import type { Dimension, PairSample, ScoreSample } from '../../types'
import type {
  PairSampleResult,
  ScoreSampleResult,
  QAProblemLevel,
  QAPairDimensionResult,
  QAPairSampleResult,
  QAPairStats,
  QAScoreDimensionResult,
  QAScoreSampleResult,
  QAScoreStats,
} from '../../types/analysis'

/**
 * Sample details map for looking up prompt, firstFrameUrl, videoUrls
 */
export type PairSampleDetailsMap = Map<string, PairSample>
export type ScoreSampleDetailsMap = Map<string, ScoreSample>

const ALL_DIMENSIONS: Dimension[] = [
  'text_consistency',
  'temporal_consistency',
  'visual_quality',
  'distortion',
  'motion_quality',
]

/**
 * Convert score (1-5) to problem level
 * - 5: none (perfect)
 * - 3-4: minor (minor issues)
 * - 1-2: major (major issues)
 */
export function scoreToProblemLevel(score: number): QAProblemLevel {
  if (score >= 5) return 'none'
  if (score >= 3) return 'minor'
  return 'major'
}

/**
 * Get problem level label in Chinese
 */
export function getProblemLevelLabel(level: QAProblemLevel): string {
  switch (level) {
    case 'none': return '无问题'
    case 'minor': return '次要问题'
    case 'major': return '主要问题'
  }
}

/**
 * Check if two scores are a soft match for QA purposes.
 * 
 * Soft match rules:
 * - Same problem level → accept
 * - none ↔ minor with diff=1 → accept (5-4 case)
 * - Involving major with different level → reject (3-2 boundary)
 * 
 * Acceptable pairs: 5-4, 4-3, 2-1
 * Rejected pairs: 3-2 (crosses minor→major boundary)
 */
function isSoftMatchScore(goldenScore: number, annotatorScore: number): boolean {
  const goldenLevel = scoreToProblemLevel(goldenScore)
  const annotatorLevel = scoreToProblemLevel(annotatorScore)

  // Same level always matches
  if (goldenLevel === annotatorLevel) return true

  // Different levels: only accept none↔minor (not involving major)
  // This allows 5-4 but rejects 3-2
  if (goldenLevel === 'major' || annotatorLevel === 'major') {
    return false
  }

  // none↔minor difference: check that score diff is exactly 1 (5-4 case)
  return Math.abs(goldenScore - annotatorScore) === 1
}

// ============================================
// Pair Mode QA
// ============================================

/**
 * Compare a single Pair sample between golden and annotator
 */
function comparePairSample(
  golden: PairSampleResult,
  annotator: PairSampleResult,
  sampleDetails?: PairSample
): QAPairSampleResult {
  const dimensionResults: QAPairDimensionResult[] = []
  let matchedCount = 0

  for (const dim of ALL_DIMENSIONS) {
    const goldenComparison = golden.dimensions[dim]?.comparison
    const annotatorComparison = annotator.dimensions[dim]?.comparison

    const isMatch = goldenComparison === annotatorComparison

    if (isMatch) {
      matchedCount++
    }

    dimensionResults.push({
      dimension: dim,
      goldenComparison,
      annotatorComparison,
      isMatch,
    })
  }

  const totalDimensions = ALL_DIMENSIONS.length
  const hardMatch = matchedCount === totalDimensions
  const softMatchRate = matchedCount / totalDimensions

  return {
    sampleId: golden.sample_id,
    annotatorId: annotator.annotator_id || 'unknown',
    dimensionResults,
    matchedCount,
    totalDimensions,
    hardMatch,
    softMatchRate,
    // Sample details from task_package
    prompt: sampleDetails?.prompt,
    firstFrameUrl: sampleDetails?.first_frame_url,
    videoAUrl: sampleDetails?.video_a_url,
    videoBUrl: sampleDetails?.video_b_url,
    videoAModel: golden.video_a_model,
    videoBModel: golden.video_b_model,
  }
}

/**
 * Calculate Pair mode QA statistics
 * 
 * @param goldenResults - Golden Set results (standard answers)
 * @param annotatorResults - Annotator results to check
 * @param sampleDetailsMap - Optional map of sample_id to sample details (from task_package)
 * @returns QA statistics for Pair mode
 */
export function calculatePairQA(
  goldenResults: PairSampleResult[],
  annotatorResults: PairSampleResult[],
  sampleDetailsMap?: PairSampleDetailsMap
): QAPairStats {
  // Build a map of golden results by sample_id
  const goldenMap = new Map<string, PairSampleResult>()
  for (const result of goldenResults) {
    goldenMap.set(result.sample_id, result)
  }

  const sampleResults: QAPairSampleResult[] = []
  const mismatchedSamples: QAPairSampleResult[] = []

  // Initialize dimension stats
  const byDimension: QAPairStats['byDimension'] = {} as QAPairStats['byDimension']
  for (const dim of ALL_DIMENSIONS) {
    byDimension[dim] = { total: 0, matchCount: 0, matchRate: 0 }
  }

  // Initialize annotator stats
  const annotatorStatsMap = new Map<string, {
    total: number
    hardMatchCount: number
    softMatchSum: number
  }>()

  // Process each annotator result
  for (const annotatorResult of annotatorResults) {
    const golden = goldenMap.get(annotatorResult.sample_id)
    if (!golden) {
      // No matching golden set - skip
      continue
    }

    const sampleDetails = sampleDetailsMap?.get(annotatorResult.sample_id)
    const sampleResult = comparePairSample(golden, annotatorResult, sampleDetails)
    sampleResults.push(sampleResult)

    // Update dimension stats
    for (const dimResult of sampleResult.dimensionResults) {
      byDimension[dimResult.dimension].total++
      if (dimResult.isMatch) {
        byDimension[dimResult.dimension].matchCount++
      }
    }

    // Update annotator stats
    const annotatorId = sampleResult.annotatorId
    if (!annotatorStatsMap.has(annotatorId)) {
      annotatorStatsMap.set(annotatorId, {
        total: 0,
        hardMatchCount: 0,
        softMatchSum: 0,
      })
    }
    const annotatorStats = annotatorStatsMap.get(annotatorId)!
    annotatorStats.total++
    if (sampleResult.hardMatch) {
      annotatorStats.hardMatchCount++
    }
    annotatorStats.softMatchSum += sampleResult.softMatchRate

    // Track mismatched samples
    if (!sampleResult.hardMatch) {
      mismatchedSamples.push(sampleResult)
    }
  }

  // Calculate dimension rates
  for (const dim of ALL_DIMENSIONS) {
    const stats = byDimension[dim]
    stats.matchRate = stats.total > 0 ? stats.matchCount / stats.total : 0
  }

  // Calculate annotator rates
  const byAnnotator: QAPairStats['byAnnotator'] = {}
  for (const [annotatorId, stats] of annotatorStatsMap) {
    byAnnotator[annotatorId] = {
      total: stats.total,
      hardMatchCount: stats.hardMatchCount,
      hardMatchRate: stats.total > 0 ? stats.hardMatchCount / stats.total : 0,
      avgSoftMatchRate: stats.total > 0 ? stats.softMatchSum / stats.total : 0,
    }
  }

  // Calculate overall stats
  const totalSamples = sampleResults.length
  const hardMatchCount = sampleResults.filter(s => s.hardMatch).length
  const hardMatchRate = totalSamples > 0 ? hardMatchCount / totalSamples : 0
  const avgSoftMatchRate = totalSamples > 0
    ? sampleResults.reduce((sum, s) => sum + s.softMatchRate, 0) / totalSamples
    : 0

  return {
    mode: 'pair',
    totalSamples,
    hardMatchCount,
    hardMatchRate,
    avgSoftMatchRate,
    byDimension,
    byAnnotator,
    mismatchedSamples,
  }
}

// ============================================
// Score Mode QA
// ============================================

/**
 * Compare a single Score sample between golden and annotator
 */
function compareScoreSample(
  golden: ScoreSampleResult,
  annotator: ScoreSampleResult,
  sampleDetails?: ScoreSample
): QAScoreSampleResult {
  const dimensionResults: QAScoreDimensionResult[] = []
  let exactMatchCount = 0
  let levelMatchCount = 0

  for (const dim of ALL_DIMENSIONS) {
    const goldenScore = golden.scores[dim]?.score ?? 0
    const annotatorScore = annotator.scores[dim]?.score ?? 0
    const goldenLevel = scoreToProblemLevel(goldenScore)
    const annotatorLevel = scoreToProblemLevel(annotatorScore)

    const isExactMatch = goldenScore === annotatorScore
    // Use new soft match logic: 5-4, 4-3, 2-1 acceptable; 3-2 not acceptable
    const isLevelMatch = isSoftMatchScore(goldenScore, annotatorScore)

    if (isExactMatch) {
      exactMatchCount++
    }
    if (isLevelMatch) {
      levelMatchCount++
    }

    dimensionResults.push({
      dimension: dim,
      goldenScore,
      annotatorScore,
      goldenLevel,
      annotatorLevel,
      isExactMatch,
      isLevelMatch,
    })
  }

  const totalDimensions = ALL_DIMENSIONS.length
  const hardMatch = exactMatchCount === totalDimensions
  const softMatchRate = levelMatchCount / totalDimensions

  return {
    sampleId: golden.sample_id,
    annotatorId: annotator.annotator_id || 'unknown',
    dimensionResults,
    exactMatchCount,
    levelMatchCount,
    totalDimensions,
    hardMatch,
    softMatchRate,
    // Sample details from task_package
    prompt: sampleDetails?.prompt,
    firstFrameUrl: sampleDetails?.first_frame_url,
    videoUrl: sampleDetails?.video_url,
    videoModel: golden.video_model,
  }
}

/**
 * Calculate Score mode QA statistics
 * 
 * @param goldenResults - Golden Set results (standard answers)
 * @param annotatorResults - Annotator results to check
 * @param sampleDetailsMap - Optional map of sample_id to sample details (from task_package)
 * @returns QA statistics for Score mode
 */
export function calculateScoreQA(
  goldenResults: ScoreSampleResult[],
  annotatorResults: ScoreSampleResult[],
  sampleDetailsMap?: ScoreSampleDetailsMap
): QAScoreStats {
  // Build a map of golden results by sample_id
  const goldenMap = new Map<string, ScoreSampleResult>()
  for (const result of goldenResults) {
    goldenMap.set(result.sample_id, result)
  }

  const sampleResults: QAScoreSampleResult[] = []
  const mismatchedSamples: QAScoreSampleResult[] = []

  // Initialize dimension stats
  const byDimension: QAScoreStats['byDimension'] = {} as QAScoreStats['byDimension']
  for (const dim of ALL_DIMENSIONS) {
    byDimension[dim] = {
      total: 0,
      exactMatchCount: 0,
      exactMatchRate: 0,
      levelMatchCount: 0,
      levelMatchRate: 0,
    }
  }

  // Initialize annotator stats
  const annotatorStatsMap = new Map<string, {
    total: number
    hardMatchCount: number
    levelMatchSum: number
  }>()

  // Process each annotator result
  for (const annotatorResult of annotatorResults) {
    const golden = goldenMap.get(annotatorResult.sample_id)
    if (!golden) {
      // No matching golden set - skip
      continue
    }

    const sampleDetails = sampleDetailsMap?.get(annotatorResult.sample_id)
    const sampleResult = compareScoreSample(golden, annotatorResult, sampleDetails)
    sampleResults.push(sampleResult)

    // Update dimension stats
    for (const dimResult of sampleResult.dimensionResults) {
      byDimension[dimResult.dimension].total++
      if (dimResult.isExactMatch) {
        byDimension[dimResult.dimension].exactMatchCount++
      }
      if (dimResult.isLevelMatch) {
        byDimension[dimResult.dimension].levelMatchCount++
      }
    }

    // Update annotator stats
    const annotatorId = sampleResult.annotatorId
    if (!annotatorStatsMap.has(annotatorId)) {
      annotatorStatsMap.set(annotatorId, {
        total: 0,
        hardMatchCount: 0,
        levelMatchSum: 0,
      })
    }
    const annotatorStats = annotatorStatsMap.get(annotatorId)!
    annotatorStats.total++
    if (sampleResult.hardMatch) {
      annotatorStats.hardMatchCount++
    }
    annotatorStats.levelMatchSum += sampleResult.softMatchRate

    // Track mismatched samples
    if (!sampleResult.hardMatch) {
      mismatchedSamples.push(sampleResult)
    }
  }

  // Calculate dimension rates
  for (const dim of ALL_DIMENSIONS) {
    const stats = byDimension[dim]
    stats.exactMatchRate = stats.total > 0 ? stats.exactMatchCount / stats.total : 0
    stats.levelMatchRate = stats.total > 0 ? stats.levelMatchCount / stats.total : 0
  }

  // Calculate annotator rates
  const byAnnotator: QAScoreStats['byAnnotator'] = {}
  for (const [annotatorId, stats] of annotatorStatsMap) {
    byAnnotator[annotatorId] = {
      total: stats.total,
      hardMatchCount: stats.hardMatchCount,
      hardMatchRate: stats.total > 0 ? stats.hardMatchCount / stats.total : 0,
      avgLevelMatchRate: stats.total > 0 ? stats.levelMatchSum / stats.total : 0,
    }
  }

  // Calculate overall stats
  const totalSamples = sampleResults.length
  const hardMatchCount = sampleResults.filter(s => s.hardMatch).length
  const softMatchCount = sampleResults.filter(s => s.levelMatchCount === ALL_DIMENSIONS.length).length
  const hardMatchRate = totalSamples > 0 ? hardMatchCount / totalSamples : 0
  const softMatchRate = totalSamples > 0 ? softMatchCount / totalSamples : 0
  const avgExactMatchRate = totalSamples > 0
    ? sampleResults.reduce((sum, s) => sum + s.exactMatchCount / s.totalDimensions, 0) / totalSamples
    : 0
  const avgLevelMatchRate = totalSamples > 0
    ? sampleResults.reduce((sum, s) => sum + s.softMatchRate, 0) / totalSamples
    : 0

  return {
    mode: 'score',
    totalSamples,
    hardMatchCount,
    hardMatchRate,
    softMatchCount,
    softMatchRate,
    avgExactMatchRate,
    avgLevelMatchRate,
    byDimension,
    byAnnotator,
    mismatchedSamples,
  }
}
