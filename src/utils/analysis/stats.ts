import type { Dimension } from '../../types'
import type { PairSampleResult, ScoreSampleResult, ModelStats } from '../../types/analysis'
import { calculateOverallElo } from './elo'

const ALL_DIMENSIONS: Dimension[] = [
  'text_consistency',
  'temporal_consistency',
  'visual_quality',
  'distortion',
  'motion_quality'
]

// Calculate win/loss/tie stats for each model from pair results
export function calculateWinLossStats(results: PairSampleResult[]): Map<string, {
  wins: number
  losses: number
  ties: number
  total: number
}> {
  const stats = new Map<string, { wins: number; losses: number; ties: number; total: number }>()
  
  const getOrCreate = (model: string) => {
    if (!stats.has(model)) {
      stats.set(model, { wins: 0, losses: 0, ties: 0, total: 0 })
    }
    return stats.get(model)!
  }
  
  for (const result of results) {
    const modelA = result.video_a_model
    const modelB = result.video_b_model
    const statsA = getOrCreate(modelA)
    const statsB = getOrCreate(modelB)
    
    // Count wins per dimension and determine overall winner
    let winsA = 0
    let winsB = 0
    
    for (const dim of ALL_DIMENSIONS) {
      const comparison = result.dimensions[dim].comparison
      if (comparison === 'A>B') winsA++
      else if (comparison === 'A<B') winsB++
    }
    
    if (winsA > winsB) {
      statsA.wins++
      statsB.losses++
    } else if (winsB > winsA) {
      statsA.losses++
      statsB.wins++
    } else {
      statsA.ties++
      statsB.ties++
    }
    
    statsA.total++
    statsB.total++
  }
  
  return stats
}

// Calculate dimension-wise win rates for each model
export function calculateDimensionWinRates(results: PairSampleResult[]): Map<string, Record<Dimension, {
  wins: number
  losses: number
  ties: number
  winRate: number
}>> {
  const stats = new Map<string, Record<Dimension, { wins: number; losses: number; ties: number; winRate: number }>>()
  
  const getOrCreate = (model: string) => {
    if (!stats.has(model)) {
      const dimStats: Record<string, { wins: number; losses: number; ties: number; winRate: number }> = {}
      for (const dim of ALL_DIMENSIONS) {
        dimStats[dim] = { wins: 0, losses: 0, ties: 0, winRate: 0 }
      }
      stats.set(model, dimStats as Record<Dimension, { wins: number; losses: number; ties: number; winRate: number }>)
    }
    return stats.get(model)!
  }
  
  for (const result of results) {
    const modelA = result.video_a_model
    const modelB = result.video_b_model
    const statsA = getOrCreate(modelA)
    const statsB = getOrCreate(modelB)
    
    for (const dim of ALL_DIMENSIONS) {
      const comparison = result.dimensions[dim].comparison
      if (comparison === 'A>B') {
        statsA[dim].wins++
        statsB[dim].losses++
      } else if (comparison === 'A<B') {
        statsA[dim].losses++
        statsB[dim].wins++
      } else {
        statsA[dim].ties++
        statsB[dim].ties++
      }
    }
  }
  
  // Calculate win rates
  for (const [, modelStats] of stats) {
    for (const dim of ALL_DIMENSIONS) {
      const total = modelStats[dim].wins + modelStats[dim].losses + modelStats[dim].ties
      modelStats[dim].winRate = total > 0 ? modelStats[dim].wins / total : 0
    }
  }
  
  return stats
}

// Calculate average scores for each model from score results
export function calculateAverageScores(results: ScoreSampleResult[]): Map<string, Record<Dimension, {
  sum: number
  count: number
  avg: number
}>> {
  const stats = new Map<string, Record<Dimension, { sum: number; count: number; avg: number }>>()
  
  const getOrCreate = (model: string) => {
    if (!stats.has(model)) {
      const dimStats: Record<string, { sum: number; count: number; avg: number }> = {}
      for (const dim of ALL_DIMENSIONS) {
        dimStats[dim] = { sum: 0, count: 0, avg: 0 }
      }
      stats.set(model, dimStats as Record<Dimension, { sum: number; count: number; avg: number }>)
    }
    return stats.get(model)!
  }
  
  for (const result of results) {
    const model = result.video_model
    const modelStats = getOrCreate(model)
    
    for (const dim of ALL_DIMENSIONS) {
      const score = result.scores[dim].score
      modelStats[dim].sum += score
      modelStats[dim].count++
    }
  }
  
  // Calculate averages
  for (const [, modelStats] of stats) {
    for (const dim of ALL_DIMENSIONS) {
      modelStats[dim].avg = modelStats[dim].count > 0 
        ? modelStats[dim].sum / modelStats[dim].count 
        : 0
    }
  }
  
  return stats
}

// Get comprehensive model stats
export function getModelStats(
  pairResults: PairSampleResult[],
  scoreResults: ScoreSampleResult[]
): ModelStats[] {
  const winLossStats = calculateWinLossStats(pairResults)
  const avgScores = calculateAverageScores(scoreResults)
  const eloRatings = calculateOverallElo(pairResults)
  
  // Get all unique models
  const models = new Set<string>()
  winLossStats.forEach((_, model) => models.add(model))
  avgScores.forEach((_, model) => models.add(model))
  
  const stats: ModelStats[] = []
  
  for (const model of models) {
    const wls = winLossStats.get(model) || { wins: 0, losses: 0, ties: 0, total: 0 }
    const scores = avgScores.get(model)
    const elo = eloRatings[model] || 1500
    
    const avgScoresByDim: Record<Dimension, number> = {} as Record<Dimension, number>
    for (const dim of ALL_DIMENSIONS) {
      avgScoresByDim[dim] = scores?.[dim]?.avg || 0
    }
    
    stats.push({
      model,
      wins: wls.wins,
      losses: wls.losses,
      ties: wls.ties,
      winRate: wls.total > 0 ? wls.wins / wls.total : 0,
      elo: Math.round(elo),
      avgScores: avgScoresByDim,
      sampleCount: wls.total + (scores ? Object.values(scores)[0]?.count || 0 : 0)
    })
  }
  
  // Sort by Elo
  stats.sort((a, b) => b.elo - a.elo)
  
  return stats
}

// Generate win rate matrix for heatmap
export function generateWinRateMatrix(results: PairSampleResult[]): {
  models: string[]
  matrix: number[][]
} {
  // Get all unique models
  const modelSet = new Set<string>()
  for (const result of results) {
    modelSet.add(result.video_a_model)
    modelSet.add(result.video_b_model)
  }
  const models = Array.from(modelSet).sort()
  
  // Initialize matrix
  const wins: Record<string, Record<string, number>> = {}
  const total: Record<string, Record<string, number>> = {}
  
  for (const m1 of models) {
    wins[m1] = {}
    total[m1] = {}
    for (const m2 of models) {
      wins[m1][m2] = 0
      total[m1][m2] = 0
    }
  }
  
  // Count wins
  for (const result of results) {
    const modelA = result.video_a_model
    const modelB = result.video_b_model
    
    // Count dimension wins
    let winsA = 0
    let winsB = 0
    for (const dim of ALL_DIMENSIONS) {
      const comparison = result.dimensions[dim].comparison
      if (comparison === 'A>B') winsA++
      else if (comparison === 'A<B') winsB++
    }
    
    total[modelA][modelB]++
    total[modelB][modelA]++
    
    if (winsA > winsB) {
      wins[modelA][modelB]++
    } else if (winsB > winsA) {
      wins[modelB][modelA]++
    } else {
      // Tie - count as 0.5 win for each
      wins[modelA][modelB] += 0.5
      wins[modelB][modelA] += 0.5
    }
  }
  
  // Build matrix
  const matrix: number[][] = []
  for (const m1 of models) {
    const row: number[] = []
    for (const m2 of models) {
      if (m1 === m2) {
        row.push(0.5) // Self comparison
      } else if (total[m1][m2] > 0) {
        row.push(wins[m1][m2] / total[m1][m2])
      } else {
        row.push(-1) // No comparison data
      }
    }
    matrix.push(row)
  }
  
  return { models, matrix }
}

// Get score distribution for box plot
export function getScoreDistribution(results: ScoreSampleResult[]): Map<string, Record<Dimension, number[]>> {
  const distribution = new Map<string, Record<Dimension, number[]>>()
  
  for (const result of results) {
    const model = result.video_model
    
    if (!distribution.has(model)) {
      const dimScores: Record<string, number[]> = {}
      for (const dim of ALL_DIMENSIONS) {
        dimScores[dim] = []
      }
      distribution.set(model, dimScores as Record<Dimension, number[]>)
    }
    
    const modelDist = distribution.get(model)!
    for (const dim of ALL_DIMENSIONS) {
      modelDist[dim].push(result.scores[dim].score)
    }
  }
  
  return distribution
}
