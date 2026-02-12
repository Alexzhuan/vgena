/**
 * Inter-Annotator Agreement Analysis for QC Overlap Samples
 *
 * Features:
 * - Auto-detect QC samples by finding duplicate sample_ids across annotator files
 * - Krippendorff's Alpha with Hard Match distance (exact equality)
 * - Krippendorff's Alpha with Soft Match distance (relaxed criteria)
 * - Annotator Reliability Score (ARS) composite metric
 * - Per-dimension breakdown
 */

import type {
  Dimension,
  ComparisonResult,
  PairSample,
  ScoreSample,
  PairTaskPackage,
  ScoreTaskPackage,
} from '../../types'
import type {
  PairSampleResult,
  ScoreSampleResult,
  QCDetectionResult,
  QCGroupedSample,
  KrippendorffResult,
  QCScoreAgreementDetail,
  QCPairAgreementDetail,
  QCDimensionAgreementStats,
  AnnotatorSkillMetrics,
  QCOverlapAgreementStats,
  ClassifiedDisagreement,
} from '../../types/analysis'

const ALL_DIMENSIONS: Dimension[] = [
  'text_consistency',
  'temporal_consistency',
  'visual_quality',
  'distortion',
  'motion_quality',
]

// ============================================
// Score Soft Match Logic (reused from qa.ts)
// ============================================

type ProblemLevel = 'none' | 'minor' | 'major'

function scoreToProblemLevel(score: number): ProblemLevel {
  if (score >= 5) return 'none'
  if (score >= 3) return 'minor'
  return 'major'
}

/**
 * Check if two scores satisfy soft match criteria.
 * - Same problem level -> match
 * - none <-> minor with diff=1 -> match (5-4 case)
 * - Involving major with different level -> reject (3-2 boundary)
 */
function isSoftMatchScore(a: number, b: number): boolean {
  const levelA = scoreToProblemLevel(a)
  const levelB = scoreToProblemLevel(b)

  if (levelA === levelB) return true

  if (levelA === 'major' || levelB === 'major') return false

  return Math.abs(a - b) === 1
}

// ============================================
// Pair Soft Match Logic
// ============================================

/**
 * Check if two pair comparisons satisfy soft match criteria.
 * No direction conflict: A>B vs A=B is OK, A>B vs A<B is NOT.
 */
function isSoftMatchPair(a: ComparisonResult, b: ComparisonResult): boolean {
  if (a === b) return true

  // Direction conflict: A>B vs A<B
  if ((a === 'A>B' && b === 'A<B') || (a === 'A<B' && b === 'A>B')) {
    return false
  }

  // All other combos (one is A=B) are acceptable
  return true
}

// ============================================
// Distance Functions for Krippendorff's Alpha
// ============================================

type DistanceFn = (a: string | number, b: string | number) => number

/**
 * Hard match distance: 0 if exactly equal, 1 otherwise.
 * Used for both score and pair modes.
 */
function hardMatchDistance(a: string | number, b: string | number): number {
  return a === b ? 0 : 1
}

/**
 * Soft match distance for score mode:
 * 0 if soft match criteria met, 1 otherwise.
 */
function softMatchDistanceScore(a: string | number, b: string | number): number {
  return isSoftMatchScore(a as number, b as number) ? 0 : 1
}

/**
 * Soft match distance for pair mode:
 * 0 if no direction conflict, 1 otherwise.
 */
function softMatchDistancePair(a: string | number, b: string | number): number {
  return isSoftMatchPair(a as ComparisonResult, b as ComparisonResult) ? 0 : 1
}

// ============================================
// QC Sample Auto-Detection
// ============================================

interface ParsedAnnotatorFile {
  annotatorId: string
  mode: 'pair' | 'score'
  pairResults: PairSampleResult[]
  scoreResults: ScoreSampleResult[]
  pairSamples: PairSample[]
  scoreSamples: ScoreSample[]
}

/**
 * Parse uploaded annotation result files into a uniform structure.
 * Also extracts sample details from task_package if available.
 */
export function parseAnnotatorFiles(
  files: { content: unknown; fileName: string }[]
): ParsedAnnotatorFile[] {
  const results: ParsedAnnotatorFile[] = []

  for (const file of files) {
    const data = file.content as Record<string, unknown>
    const annotatorId = (data.annotator_id as string) || 'unknown'

    if (data.mode === 'pair' && Array.isArray(data.results)) {
      const pairResults = (data.results as PairSampleResult[]).map(r => ({
        ...r,
        annotator_id: r.annotator_id || annotatorId,
      }))
      // Extract samples from task_package if available
      const taskPackage = data.task_package as PairTaskPackage | undefined
      const pairSamples = taskPackage?.samples || []
      results.push({
        annotatorId,
        mode: 'pair',
        pairResults,
        scoreResults: [],
        pairSamples,
        scoreSamples: [],
      })
    } else if (data.mode === 'score' && Array.isArray(data.results)) {
      const scoreResults = (data.results as ScoreSampleResult[]).map(r => ({
        ...r,
        annotator_id: r.annotator_id || annotatorId,
      }))
      // Extract samples from task_package if available
      const taskPackage = data.task_package as ScoreTaskPackage | undefined
      const scoreSamples = taskPackage?.samples || []
      results.push({
        annotatorId,
        mode: 'score',
        pairResults: [],
        scoreResults,
        pairSamples: [],
        scoreSamples,
      })
    }
  }

  return results
}

/**
 * Build a sample details map from parsed annotator files.
 * Maps sample_id -> PairSample | ScoreSample for looking up prompt, video URLs, etc.
 */
function buildSampleDetailsMap(
  parsedFiles: ParsedAnnotatorFile[]
): Record<string, PairSample | ScoreSample> {
  const map: Record<string, PairSample | ScoreSample> = {}
  for (const file of parsedFiles) {
    for (const sample of file.pairSamples) {
      if (!map[sample.sample_id]) {
        map[sample.sample_id] = sample
      }
    }
    for (const sample of file.scoreSamples) {
      if (!map[sample.sample_id]) {
        map[sample.sample_id] = sample
      }
    }
  }
  return map
}

/**
 * Auto-detect QC samples by finding sample_ids that appear across
 * multiple annotators. Samples with the maximum frequency are QC samples.
 */
export function detectQCSamples(
  parsedFiles: ParsedAnnotatorFile[]
): QCDetectionResult {
  // Map: sample_id -> set of annotator ids
  const sampleAnnotatorMap = new Map<string, Set<string>>()

  for (const file of parsedFiles) {
    const results = file.mode === 'pair' ? file.pairResults : file.scoreResults
    for (const result of results) {
      const sampleId = result.sample_id
      if (!sampleAnnotatorMap.has(sampleId)) {
        sampleAnnotatorMap.set(sampleId, new Set())
      }
      sampleAnnotatorMap.get(sampleId)!.add(file.annotatorId)
    }
  }

  // Find maximum frequency
  let maxFrequency = 0
  for (const annotators of sampleAnnotatorMap.values()) {
    if (annotators.size > maxFrequency) {
      maxFrequency = annotators.size
    }
  }

  // QC samples are those with max frequency (and freq > 1)
  const qcSampleIds: string[] = []
  if (maxFrequency > 1) {
    for (const [sampleId, annotators] of sampleAnnotatorMap) {
      if (annotators.size === maxFrequency) {
        qcSampleIds.push(sampleId)
      }
    }
  }

  // Convert to plain object
  const mapObj: Record<string, string[]> = {}
  for (const [sampleId, annotators] of sampleAnnotatorMap) {
    mapObj[sampleId] = Array.from(annotators).sort()
  }

  // Count unique annotators
  const allAnnotators = new Set<string>()
  for (const file of parsedFiles) {
    allAnnotators.add(file.annotatorId)
  }

  return {
    qcSampleIds: qcSampleIds.sort(),
    maxFrequency,
    totalUniqueSamples: sampleAnnotatorMap.size,
    qcCount: qcSampleIds.length,
    annotatorCount: allAnnotators.size,
    sampleAnnotatorMap: mapObj,
  }
}

/**
 * Group QC samples: for each QC sample_id, collect all annotator entries.
 */
export function groupQCSamples(
  detection: QCDetectionResult,
  parsedFiles: ParsedAnnotatorFile[]
): QCGroupedSample[] {
  const qcSet = new Set(detection.qcSampleIds)
  const groups = new Map<string, QCGroupedSample>()

  for (const file of parsedFiles) {
    if (file.mode === 'pair') {
      for (const result of file.pairResults) {
        if (!qcSet.has(result.sample_id)) continue
        if (!groups.has(result.sample_id)) {
          groups.set(result.sample_id, {
            sampleId: result.sample_id,
            mode: 'pair',
            entries: [],
          })
        }
        groups.get(result.sample_id)!.entries.push({
          sampleId: result.sample_id,
          annotatorId: file.annotatorId,
          mode: 'pair',
          pairResult: result,
        })
      }
    } else {
      for (const result of file.scoreResults) {
        if (!qcSet.has(result.sample_id)) continue
        if (!groups.has(result.sample_id)) {
          groups.set(result.sample_id, {
            sampleId: result.sample_id,
            mode: 'score',
            entries: [],
          })
        }
        groups.get(result.sample_id)!.entries.push({
          sampleId: result.sample_id,
          annotatorId: file.annotatorId,
          mode: 'score',
          scoreResult: result,
        })
      }
    }
  }

  return Array.from(groups.values())
}

// ============================================
// Reliability Matrix & Krippendorff's Alpha
// ============================================

/**
 * A unit in the reliability matrix: one sample x one dimension.
 * Contains the values assigned by each rater (annotator).
 */
interface ReliabilityUnit {
  sampleId: string
  dimension: Dimension
  values: (string | number)[] // rater values (only non-missing)
}

/**
 * Build the reliability matrix from grouped QC samples.
 * Each unit = (sample_id, dimension), values = annotator ratings for that unit.
 */
function buildReliabilityMatrix(
  groupedSamples: QCGroupedSample[],
): ReliabilityUnit[] {
  const units: ReliabilityUnit[] = []

  for (const group of groupedSamples) {
    for (const dim of ALL_DIMENSIONS) {
      const values: (string | number)[] = []

      for (const entry of group.entries) {
        if (entry.mode === 'score' && entry.scoreResult) {
          const score = entry.scoreResult.scores[dim]?.score
          if (score != null) {
            values.push(score)
          }
        } else if (entry.mode === 'pair' && entry.pairResult) {
          const comparison = entry.pairResult.dimensions[dim]?.comparison
          if (comparison != null) {
            values.push(comparison)
          }
        }
      }

      // Need at least 2 raters for a valid unit
      if (values.length >= 2) {
        units.push({ sampleId: group.sampleId, dimension: dim, values })
      }
    }
  }

  return units
}

/**
 * Build reliability matrix for a single dimension (used for per-dimension Alpha).
 */
function buildReliabilityMatrixForDimension(
  groupedSamples: QCGroupedSample[],
  dimension: Dimension,
): ReliabilityUnit[] {
  const units: ReliabilityUnit[] = []

  for (const group of groupedSamples) {
    const values: (string | number)[] = []

    for (const entry of group.entries) {
      if (entry.mode === 'score' && entry.scoreResult) {
        const score = entry.scoreResult.scores[dimension]?.score
        if (score != null) values.push(score)
      } else if (entry.mode === 'pair' && entry.pairResult) {
        const comparison = entry.pairResult.dimensions[dimension]?.comparison
        if (comparison != null) values.push(comparison)
      }
    }

    if (values.length >= 2) {
      units.push({ sampleId: group.sampleId, dimension, values })
    }
  }

  return units
}

/**
 * Calculate Krippendorff's Alpha from a reliability matrix using the given
 * distance function.
 *
 * Formula: alpha = 1 - D_o / D_e
 *
 * D_o = sum over units of [sum of pairwise distances within unit] /
 *       sum over units of [n_u - 1]
 *
 * D_e = sum of pairwise distances across ALL values /
 *       (n_total - 1)
 *
 * Where distances are weighted by 1/(n_u - 1) within each unit.
 */
function calculateKrippendorffAlpha(
  units: ReliabilityUnit[],
  distanceFn: DistanceFn,
): { alpha: number; observedDisagreement: number; expectedDisagreement: number } {
  if (units.length === 0) {
    return { alpha: 0, observedDisagreement: 0, expectedDisagreement: 0 }
  }

  // Collect all values for D_e calculation
  const allValues: (string | number)[] = []
  for (const unit of units) {
    allValues.push(...unit.values)
  }

  const nTotal = allValues.length
  if (nTotal < 2) {
    return { alpha: 0, observedDisagreement: 0, expectedDisagreement: 0 }
  }

  // D_o: observed disagreement
  let numeratorDo = 0
  let denominatorDo = 0

  for (const unit of units) {
    const n = unit.values.length
    if (n < 2) continue

    let pairwiseSum = 0
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairwiseSum += distanceFn(unit.values[i], unit.values[j])
      }
    }

    // Weight by 1/(n_u - 1) for each unit
    numeratorDo += pairwiseSum / (n - 1)
    denominatorDo += 1  // each unit contributes 1 to denominator
  }

  // Handle edge case: denominatorDo is actually n_units with pairable data
  // Standard formula: D_o = (1/N) * sum_u [ (1/(n_u-1)) * sum_{c<k} d(c,k) * n_uc * n_uk ]
  // Simplified for our case where we enumerate all pairs:
  // D_o = sum_u [ pairwise_sum / (n_u - 1) ] / sum_u [n_u / 2]
  // Actually let me use the standard textbook formula properly:

  // Reset and use standard formulation
  // D_o = (1 / sum(n_u * (n_u - 1) / 2)) * sum_u [ sum_{i<j} d(v_i, v_j) ]
  // But more precisely from Krippendorff (2011):
  // D_o = (1 / (n.. - 1)) * sum_u [ (1/(n_u-1)) * sum over pairable values of d ]

  // Let me use the coincidence matrix approach which is more standard:
  numeratorDo = 0
  let totalPairableValues = 0

  for (const unit of units) {
    const n = unit.values.length
    if (n < 2) continue

    let unitPairwiseDistSum = 0
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        unitPairwiseDistSum += distanceFn(unit.values[i], unit.values[j])
      }
    }

    // Each unit contributes: pairwise_dist_sum / (n_u - 1)
    numeratorDo += unitPairwiseDistSum / (n - 1)
    totalPairableValues += n
  }

  // D_o normalized
  const Do = (totalPairableValues > 0) ? numeratorDo / (totalPairableValues / 2) : 0

  // D_e: expected disagreement (based on marginal distribution)
  // D_e = sum over all pairs of values (globally) of d(v_i, v_j) / (n_total * (n_total - 1) / 2)
  let globalPairwiseDistSum = 0
  for (let i = 0; i < nTotal; i++) {
    for (let j = i + 1; j < nTotal; j++) {
      globalPairwiseDistSum += distanceFn(allValues[i], allValues[j])
    }
  }

  const De = (nTotal > 1) ? globalPairwiseDistSum / (nTotal * (nTotal - 1) / 2) : 0

  // Alpha
  const alpha = (De === 0) ? 1 : 1 - Do / De

  return { alpha, observedDisagreement: Do, expectedDisagreement: De }
}

// ============================================
// Agreement Detail Computation
// ============================================

/**
 * Compute per-sample per-dimension agreement details for score mode.
 */
function computeScoreAgreementDetails(
  groupedSamples: QCGroupedSample[],
): QCScoreAgreementDetail[] {
  const details: QCScoreAgreementDetail[] = []

  for (const group of groupedSamples) {
    if (group.mode !== 'score') continue

    for (const dim of ALL_DIMENSIONS) {
      const annotatorScores: { annotatorId: string; score: number }[] = []

      for (const entry of group.entries) {
        if (entry.scoreResult) {
          const score = entry.scoreResult.scores[dim]?.score
          if (score != null) {
            annotatorScores.push({ annotatorId: entry.annotatorId, score })
          }
        }
      }

      if (annotatorScores.length < 2) continue

      const scores = annotatorScores.map(a => a.score)
      const mean = scores.reduce((s, v) => s + v, 0) / scores.length
      const spread = Math.max(...scores) - Math.min(...scores)

      details.push({
        sampleId: group.sampleId,
        dimension: dim,
        annotatorScores,
        mean,
        spread,
      })
    }
  }

  return details
}

/**
 * Compute per-sample per-dimension agreement details for pair mode.
 */
function computePairAgreementDetails(
  groupedSamples: QCGroupedSample[],
): QCPairAgreementDetail[] {
  const details: QCPairAgreementDetail[] = []

  for (const group of groupedSamples) {
    if (group.mode !== 'pair') continue

    for (const dim of ALL_DIMENSIONS) {
      const annotatorComparisons: { annotatorId: string; comparison: ComparisonResult }[] = []

      for (const entry of group.entries) {
        if (entry.pairResult) {
          const comparison = entry.pairResult.dimensions[dim]?.comparison
          if (comparison != null) {
            annotatorComparisons.push({ annotatorId: entry.annotatorId, comparison })
          }
        }
      }

      if (annotatorComparisons.length < 2) continue

      const comparisons = annotatorComparisons.map(a => a.comparison)

      // Majority value
      const counts = new Map<ComparisonResult, number>()
      for (const c of comparisons) {
        counts.set(c, (counts.get(c) || 0) + 1)
      }
      let majorityValue: ComparisonResult | undefined
      let maxCount = 0
      for (const [val, count] of counts) {
        if (count > maxCount) {
          maxCount = count
          majorityValue = val
        }
      }

      details.push({
        sampleId: group.sampleId,
        dimension: dim,
        annotatorComparisons,
        majorityValue,
      })
    }
  }

  return details
}

// ============================================
// Annotator Skill Metric Computation
// ============================================

/**
 * Compute the majority vote value from a list of values.
 * Returns the value with the highest count.
 */
function getMajority<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>()
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1)
  }
  let best: T | undefined
  let bestCount = 0
  for (const [val, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      best = val
    }
  }
  return best
}

/**
 * Calculate annotator skill metrics from QC overlap data.
 */
function computeAnnotatorSkills(
  groupedSamples: QCGroupedSample[],
  scoreDetails: QCScoreAgreementDetail[],
  pairDetails: QCPairAgreementDetail[],
): AnnotatorSkillMetrics[] {
  // Collect all annotator IDs
  const annotatorIds = new Set<string>()
  for (const group of groupedSamples) {
    for (const entry of group.entries) {
      annotatorIds.add(entry.annotatorId)
    }
  }

  const mode = groupedSamples.length > 0 ? groupedSamples[0].mode : 'score'
  const metrics: AnnotatorSkillMetrics[] = []

  for (const annotatorId of annotatorIds) {
    // Count QC samples this annotator participated in
    let qcSampleCount = 0
    for (const group of groupedSamples) {
      if (group.entries.some(e => e.annotatorId === annotatorId)) {
        qcSampleCount++
      }
    }

    // Per-dimension tracking
    const dimStats: Record<Dimension, {
      hardMajTotal: number; hardMajMatch: number
      softMajTotal: number; softMajMatch: number
    }> = {} as typeof dimStats

    for (const dim of ALL_DIMENSIONS) {
      dimStats[dim] = {
        hardMajTotal: 0, hardMajMatch: 0,
        softMajTotal: 0, softMajMatch: 0,
      }
    }

    let totalMajHardChecks = 0
    let totalMajHardMatches = 0
    let totalMajSoftChecks = 0
    let totalMajSoftMatches = 0
    let deviationSum = 0
    let deviationCount = 0

    if (mode === 'score') {
      for (const detail of scoreDetails) {
        const myEntry = detail.annotatorScores.find(a => a.annotatorId === annotatorId)
        if (!myEntry) continue

        const otherScores = detail.annotatorScores
          .filter(a => a.annotatorId !== annotatorId)
          .map(a => a.score)

        if (otherScores.length === 0) continue

        // Majority agreement (hard)
        const allScores = detail.annotatorScores.map(a => a.score)
        const majority = getMajority(allScores)
        totalMajHardChecks++
        if (majority !== undefined && myEntry.score === majority) {
          totalMajHardMatches++
          dimStats[detail.dimension].hardMajMatch++
        }
        dimStats[detail.dimension].hardMajTotal++

        // Majority agreement (soft)
        totalMajSoftChecks++
        if (majority !== undefined && isSoftMatchScore(myEntry.score, majority)) {
          totalMajSoftMatches++
          dimStats[detail.dimension].softMajMatch++
        }
        dimStats[detail.dimension].softMajTotal++

        // Deviation from others' mean
        const otherMean = otherScores.reduce((s, v) => s + v, 0) / otherScores.length
        deviationSum += Math.abs(myEntry.score - otherMean)
        deviationCount++
      }
    } else {
      // Pair mode
      for (const detail of pairDetails) {
        const myEntry = detail.annotatorComparisons.find(a => a.annotatorId === annotatorId)
        if (!myEntry) continue

        const otherComps = detail.annotatorComparisons
          .filter(a => a.annotatorId !== annotatorId)
          .map(a => a.comparison)

        if (otherComps.length === 0) continue

        // Majority agreement (hard)
        const allComps = detail.annotatorComparisons.map(a => a.comparison)
        const majority = getMajority(allComps)
        totalMajHardChecks++
        if (majority !== undefined && myEntry.comparison === majority) {
          totalMajHardMatches++
          dimStats[detail.dimension].hardMajMatch++
        }
        dimStats[detail.dimension].hardMajTotal++

        // Majority agreement (soft)
        totalMajSoftChecks++
        if (majority !== undefined && isSoftMatchPair(myEntry.comparison, majority)) {
          totalMajSoftMatches++
          dimStats[detail.dimension].softMajMatch++
        }
        dimStats[detail.dimension].softMajTotal++
      }
    }

    const majHardRate = totalMajHardChecks > 0 ? totalMajHardMatches / totalMajHardChecks : 0
    const majSoftRate = totalMajSoftChecks > 0 ? totalMajSoftMatches / totalMajSoftChecks : 0
    const avgDeviation = deviationCount > 0 ? deviationSum / deviationCount : null

    // Composite score
    let compositeScore: number
    if (mode === 'score' && avgDeviation !== null) {
      // Normalize deviation: max possible deviation on 1-5 scale is 4
      const normalizedDev = Math.min(avgDeviation / 4, 1)
      compositeScore = 0.4 * majHardRate + 0.4 * majSoftRate + 0.2 * (1 - normalizedDev)
    } else {
      compositeScore = 0.5 * majHardRate + 0.5 * majSoftRate
    }

    // Per-dimension breakdown
    const byDimension: AnnotatorSkillMetrics['byDimension'] = {} as AnnotatorSkillMetrics['byDimension']
    for (const dim of ALL_DIMENSIONS) {
      const ds = dimStats[dim]
      byDimension[dim] = {
        majorityAgreementRateHard: ds.hardMajTotal > 0 ? ds.hardMajMatch / ds.hardMajTotal : 0,
        majorityAgreementRateSoft: ds.softMajTotal > 0 ? ds.softMajMatch / ds.softMajTotal : 0,
      }
    }

    metrics.push({
      annotatorId,
      qcSampleCount,
      majorityAgreementRateHard: majHardRate,
      majorityAgreementRateSoft: majSoftRate,
      avgDeviation,
      compositeScore,
      rank: 0, // Will be set after sorting
      byDimension,
    })
  }

  // Sort by composite score descending and assign ranks
  metrics.sort((a, b) => b.compositeScore - a.compositeScore)
  metrics.forEach((m, i) => { m.rank = i + 1 })

  return metrics
}

// ============================================
// Disagreement Classification
// ============================================

/**
 * Classify a disagreement as 'hard_only' or 'soft_fail'.
 * - hard_only: annotators differ on exact values but ALL pairs satisfy soft match
 * - soft_fail: at least one pair of annotators fails soft match criteria
 */
function classifyDisagreement(
  detail: QCScoreAgreementDetail | QCPairAgreementDetail,
): ClassifiedDisagreement {
  let hasSoftFail = false

  if ('annotatorScores' in detail) {
    const scores = (detail as QCScoreAgreementDetail).annotatorScores.map(a => a.score)
    // Check all pairs for soft match failure
    for (let i = 0; i < scores.length && !hasSoftFail; i++) {
      for (let j = i + 1; j < scores.length && !hasSoftFail; j++) {
        if (!isSoftMatchScore(scores[i], scores[j])) {
          hasSoftFail = true
        }
      }
    }
  } else if ('annotatorComparisons' in detail) {
    const comps = (detail as QCPairAgreementDetail).annotatorComparisons.map(a => a.comparison)
    // Check all pairs for soft match failure
    for (let i = 0; i < comps.length && !hasSoftFail; i++) {
      for (let j = i + 1; j < comps.length && !hasSoftFail; j++) {
        if (!isSoftMatchPair(comps[i], comps[j])) {
          hasSoftFail = true
        }
      }
    }
  }

  return {
    detail,
    matchCategory: hasSoftFail ? 'soft_fail' : 'hard_only',
  }
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Calculate complete inter-annotator agreement statistics.
 *
 * 1. Auto-detect QC samples from duplicate sample_ids
 * 2. Group QC samples by sample_id
 * 3. Calculate Hard Match & Soft Match Krippendorff's Alpha
 * 4. Compute per-dimension breakdown
 * 5. Compute annotator skill metrics
 * 6. Classify disagreements and build sample details map
 */
export function calculateInterAnnotatorAgreement(
  files: { content: unknown; fileName: string }[]
): QCOverlapAgreementStats {
  // Step 1: Parse files
  const parsedFiles = parseAnnotatorFiles(files)

  if (parsedFiles.length === 0) {
    throw new Error('没有找到有效的标注结果文件')
  }

  // Step 2: Detect QC samples
  const detection = detectQCSamples(parsedFiles)

  if (detection.qcCount === 0) {
    throw new Error('未检测到 QC 样本（没有发现跨标注员的重复 sample_id）')
  }

  // Step 3: Group QC samples
  const groupedSamples = groupQCSamples(detection, parsedFiles)

  // Determine mode
  const modes = new Set(groupedSamples.map(g => g.mode))
  const mode: 'pair' | 'score' | 'mixed' = modes.size > 1 ? 'mixed' : (modes.values().next().value || 'score')

  // Step 4: Compute agreement details
  const scoreDetails = computeScoreAgreementDetails(groupedSamples)
  const pairDetails = computePairAgreementDetails(groupedSamples)

  // Step 5: Build reliability matrix and calculate Alpha
  const allUnits = buildReliabilityMatrix(groupedSamples)

  // Choose the right soft distance function based on mode
  const softDistFn = mode === 'pair' ? softMatchDistancePair : softMatchDistanceScore

  const hardAlphaResult = calculateKrippendorffAlpha(allUnits, hardMatchDistance)
  const softAlphaResult = calculateKrippendorffAlpha(allUnits, softDistFn)

  // Per-dimension Alpha
  const hardByDim: Record<Dimension, number> = {} as Record<Dimension, number>
  const softByDim: Record<Dimension, number> = {} as Record<Dimension, number>

  for (const dim of ALL_DIMENSIONS) {
    const dimUnits = buildReliabilityMatrixForDimension(groupedSamples, dim)
    const hardResult = calculateKrippendorffAlpha(dimUnits, hardMatchDistance)
    const softResult = calculateKrippendorffAlpha(dimUnits, softDistFn)
    hardByDim[dim] = hardResult.alpha
    softByDim[dim] = softResult.alpha
  }

  const krippendorffHard: KrippendorffResult = {
    alpha: hardAlphaResult.alpha,
    observedDisagreement: hardAlphaResult.observedDisagreement,
    expectedDisagreement: hardAlphaResult.expectedDisagreement,
    method: 'hard',
    byDimension: hardByDim,
  }

  const krippendorffSoft: KrippendorffResult = {
    alpha: softAlphaResult.alpha,
    observedDisagreement: softAlphaResult.observedDisagreement,
    expectedDisagreement: softAlphaResult.expectedDisagreement,
    method: 'soft',
    byDimension: softByDim,
  }

  // Step 6: Compute detail lists
  const allDetails = [...scoreDetails, ...pairDetails]
  const totalChecks = allDetails.length

  // Step 7: Per-dimension stats
  const byDimension: Record<Dimension, QCDimensionAgreementStats> = {} as Record<Dimension, QCDimensionAgreementStats>

  for (const dim of ALL_DIMENSIONS) {
    const dimDetails = allDetails.filter(d => d.dimension === dim)

    byDimension[dim] = {
      dimension: dim,
      totalChecks: dimDetails.length,
      hardAlpha: hardByDim[dim],
      softAlpha: softByDim[dim],
    }
  }

  // Step 8: Annotator skill metrics
  const annotatorSkills = computeAnnotatorSkills(groupedSamples, scoreDetails, pairDetails)

  // Step 9: Disagreements (annotators don't fully agree)
  const disagreements = allDetails.filter(d => {
    if ('annotatorScores' in d) {
      const scores = (d as QCScoreAgreementDetail).annotatorScores.map(a => a.score)
      return !scores.every(s => s === scores[0])
    }
    if ('annotatorComparisons' in d) {
      const comps = (d as QCPairAgreementDetail).annotatorComparisons.map(a => a.comparison)
      return !comps.every(c => c === comps[0])
    }
    return false
  })

  // Step 10: Classify disagreements as hard_only vs soft_fail
  const classifiedDisagreements = disagreements.map(d => classifyDisagreement(d))

  // Step 11: Build sample details map from task_package data
  const sampleDetailsMap = buildSampleDetailsMap(parsedFiles)

  return {
    mode,
    detection,
    totalChecks,
    krippendorffHard,
    krippendorffSoft,
    byDimension,
    annotatorSkills,
    scoreDetails,
    pairDetails,
    disagreements,
    classifiedDisagreements,
    groupedSamples,
    sampleDetailsMap,
  }
}
