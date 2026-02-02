import type { Dimension, ComparisonResult, PairSample } from '../../types'
import type { PairSampleResult, ScoreSampleResult, ConsistencyResult, ConsistencyStats } from '../../types/analysis'

const ALL_DIMENSIONS: Dimension[] = [
  'text_consistency',
  'temporal_consistency',
  'visual_quality',
  'distortion',
  'motion_quality'
]

// Get problem level from score
type ProblemLevel = 'none' | 'minor' | 'major'

function scoreToProblemLevel(score: number): ProblemLevel {
  if (score >= 5) return 'none'
  if (score >= 4) return 'none' // 4 is none or light minor
  if (score >= 3) return 'minor'
  return 'major' // 1-2
}

// Check if two scores have same problem level (for soft match)
function hasSameProblemLevel(scoreA: number, scoreB: number): boolean {
  const levelA = scoreToProblemLevel(scoreA)
  const levelB = scoreToProblemLevel(scoreB)
  return levelA === levelB
}

// Extract prompt_id from sample_id (format: promptId_modelA_modelB or promptId_model)
export function extractPromptId(sampleId: string): string {
  const parts = sampleId.split('_')
  return parts[0]
}

// Build a map from promptId_model to score result
function buildScoreMap(scoreResults: ScoreSampleResult[]): Map<string, ScoreSampleResult> {
  const map = new Map<string, ScoreSampleResult>()
  for (const result of scoreResults) {
    map.set(result.sample_id, result)
  }
  return map
}

// Check consistency for a single dimension
function checkDimensionConsistency(
  pairResult: PairSampleResult,
  scoreA: ScoreSampleResult,
  scoreB: ScoreSampleResult,
  dimension: Dimension,
  taskSample?: PairSample
): ConsistencyResult {
  const comparison = pairResult.dimensions[dimension].comparison
  const scoreAVal = scoreA.scores[dimension].score
  const scoreBVal = scoreB.scores[dimension].score
  const scoreDiff = scoreAVal - scoreBVal
  
  let isHardMatchConsistent = false
  let inconsistencyType: ConsistencyResult['inconsistencyType']
  
  // Check based on comparison result
  if (comparison === 'A>B') {
    // A should score higher than B
    isHardMatchConsistent = scoreAVal > scoreBVal
    if (!isHardMatchConsistent) {
      if (scoreAVal === scoreBVal) {
        inconsistencyType = 'diff_but_tie' // Pair有差异但Score相等
      } else {
        inconsistencyType = 'direction_mismatch'
      }
    }
  } else if (comparison === 'A<B') {
    // B should score higher than A
    isHardMatchConsistent = scoreBVal > scoreAVal
    if (!isHardMatchConsistent) {
      if (scoreAVal === scoreBVal) {
        inconsistencyType = 'diff_but_tie' // Pair有差异但Score相等
      } else {
        inconsistencyType = 'direction_mismatch'
      }
    }
  } else {
    // A=B case - scores should be equal or close
    const absDiff = Math.abs(scoreDiff)
    
    // Hard match: scores must be exactly equal
    isHardMatchConsistent = absDiff === 0
    
    if (!isHardMatchConsistent) {
      inconsistencyType = 'tie_but_diff' // Pair平局但Score不同
    }
  }
  
  return {
    sampleId: pairResult.sample_id,
    dimension,
    pairComparison: comparison,
    scoreA: scoreAVal,
    scoreB: scoreBVal,
    scoreDiff,
    isConsistent: isHardMatchConsistent, // Default to hard match
    inconsistencyType,
    videoAModel: pairResult.video_a_model,
    videoBModel: pairResult.video_b_model,
    prompt: taskSample?.prompt,
  }
}

// Calculate consistency stats
export function calculateConsistencyStats(
  pairResults: PairSampleResult[],
  scoreResults: ScoreSampleResult[],
  pairTaskSamples?: PairSample[]
): ConsistencyStats {
  const scoreMap = buildScoreMap(scoreResults)
  const taskMap = new Map<string, PairSample>()
  
  if (pairTaskSamples) {
    for (const sample of pairTaskSamples) {
      taskMap.set(sample.sample_id, sample)
    }
  }
  
  const stats: ConsistencyStats = {
    totalMatched: 0,
    hardMatchConsistent: 0,
    hardMatchRate: 0,
    softMatchConsistent: 0,
    softMatchRate: 0,
    byDimension: {} as ConsistencyStats['byDimension'],
    inconsistentSamples: [],
  }
  
  // Initialize dimension stats
  for (const dim of ALL_DIMENSIONS) {
    stats.byDimension[dim] = {
      total: 0,
      hardMatchConsistent: 0,
      hardMatchRate: 0,
      softMatchConsistent: 0,
      softMatchRate: 0,
    }
  }
  
  // Process each pair result
  for (const pairResult of pairResults) {
    const promptId = extractPromptId(pairResult.sample_id)
    const modelA = pairResult.video_a_model
    const modelB = pairResult.video_b_model
    
    // Find corresponding score results
    const scoreAKey = `${promptId}_${modelA}`
    const scoreBKey = `${promptId}_${modelB}`
    
    const scoreA = scoreMap.get(scoreAKey)
    const scoreB = scoreMap.get(scoreBKey)
    
    if (!scoreA || !scoreB) {
      // Cannot match - skip this pair
      continue
    }
    
    const taskSample = taskMap.get(pairResult.sample_id)
    
    // Check each dimension
    for (const dim of ALL_DIMENSIONS) {
      const result = checkDimensionConsistency(
        pairResult,
        scoreA,
        scoreB,
        dim,
        taskSample
      )
      
      stats.totalMatched++
      stats.byDimension[dim].total++
      
      // Hard match check
      const comparison = pairResult.dimensions[dim].comparison
      let isHardMatch = false
      let isSoftMatch = false
      
      if (comparison === 'A>B') {
        isHardMatch = result.scoreA > result.scoreB
        isSoftMatch = isHardMatch
      } else if (comparison === 'A<B') {
        isHardMatch = result.scoreB > result.scoreA
        isSoftMatch = isHardMatch
      } else {
        // A=B
        const absDiff = Math.abs(result.scoreDiff)
        isHardMatch = absDiff === 0
        isSoftMatch = absDiff <= 1 && hasSameProblemLevel(result.scoreA, result.scoreB)
      }
      
      if (isHardMatch) {
        stats.hardMatchConsistent++
        stats.byDimension[dim].hardMatchConsistent++
      }
      
      if (isSoftMatch) {
        stats.softMatchConsistent++
        stats.byDimension[dim].softMatchConsistent++
      }
      
      // Track inconsistent samples (based on hard match)
      if (!isHardMatch) {
        stats.inconsistentSamples.push({
          ...result,
          isConsistent: false,
        })
      }
    }
  }
  
  // Calculate rates
  if (stats.totalMatched > 0) {
    stats.hardMatchRate = stats.hardMatchConsistent / stats.totalMatched
    stats.softMatchRate = stats.softMatchConsistent / stats.totalMatched
  }
  
  for (const dim of ALL_DIMENSIONS) {
    const dimStats = stats.byDimension[dim]
    if (dimStats.total > 0) {
      dimStats.hardMatchRate = dimStats.hardMatchConsistent / dimStats.total
      dimStats.softMatchRate = dimStats.softMatchConsistent / dimStats.total
    }
  }
  
  return stats
}

// Get inconsistency type label
export function getInconsistencyTypeLabel(type?: ConsistencyResult['inconsistencyType']): string {
  switch (type) {
    case 'direction_mismatch':
      return '方向不一致'
    case 'tie_but_diff':
      return 'Pair平局但Score不同'
    case 'diff_but_tie':
      return 'Pair有差异但Score相等'
    default:
      return '-'
  }
}

// Format comparison result for display
export function formatComparison(comparison: ComparisonResult): string {
  switch (comparison) {
    case 'A>B':
      return 'A 优于 B'
    case 'A<B':
      return 'A 劣于 B'
    case 'A=B':
      return 'A 等于 B'
  }
}
