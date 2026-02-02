import type { Dimension, ComparisonResult } from '../../types'
import type { PairSampleResult } from '../../types/analysis'

const DEFAULT_ELO = 1500
const K_FACTOR = 32

interface EloRatings {
  [model: string]: number
}

// Calculate expected score based on Elo ratings
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

// Update Elo ratings based on match result
function updateElo(
  ratingA: number,
  ratingB: number,
  scoreA: number, // 1 for win, 0.5 for tie, 0 for loss
  kFactor: number = K_FACTOR
): { newRatingA: number; newRatingB: number } {
  const expectedA = expectedScore(ratingA, ratingB)
  const expectedB = 1 - expectedA
  
  const newRatingA = ratingA + kFactor * (scoreA - expectedA)
  const newRatingB = ratingB + kFactor * ((1 - scoreA) - expectedB)
  
  return { newRatingA, newRatingB }
}

// Convert comparison result to score
function comparisonToScore(comparison: ComparisonResult): number {
  switch (comparison) {
    case 'A>B': return 1
    case 'A<B': return 0
    case 'A=B': return 0.5
  }
}

// Calculate Elo ratings from pair results (overall, based on majority wins)
export function calculateOverallElo(results: PairSampleResult[]): EloRatings {
  const ratings: EloRatings = {}
  
  // Process each match
  for (const result of results) {
    const modelA = result.video_a_model
    const modelB = result.video_b_model
    
    // Initialize ratings if needed
    if (!(modelA in ratings)) ratings[modelA] = DEFAULT_ELO
    if (!(modelB in ratings)) ratings[modelB] = DEFAULT_ELO
    
    // Count wins across all dimensions
    let winsA = 0
    let winsB = 0
    
    for (const dim of Object.keys(result.dimensions) as Dimension[]) {
      const comparison = result.dimensions[dim].comparison
      if (comparison === 'A>B') winsA++
      else if (comparison === 'A<B') winsB++
    }
    
    // Determine overall winner
    let overallScore: number
    if (winsA > winsB) overallScore = 1
    else if (winsB > winsA) overallScore = 0
    else overallScore = 0.5
    
    // Update ratings
    const { newRatingA, newRatingB } = updateElo(
      ratings[modelA],
      ratings[modelB],
      overallScore
    )
    
    ratings[modelA] = newRatingA
    ratings[modelB] = newRatingB
  }
  
  return ratings
}

// Calculate Elo ratings per dimension
export function calculateDimensionElo(
  results: PairSampleResult[],
  dimension: Dimension
): EloRatings {
  const ratings: EloRatings = {}
  
  for (const result of results) {
    const modelA = result.video_a_model
    const modelB = result.video_b_model
    
    if (!(modelA in ratings)) ratings[modelA] = DEFAULT_ELO
    if (!(modelB in ratings)) ratings[modelB] = DEFAULT_ELO
    
    const comparison = result.dimensions[dimension].comparison
    const scoreA = comparisonToScore(comparison)
    
    const { newRatingA, newRatingB } = updateElo(
      ratings[modelA],
      ratings[modelB],
      scoreA
    )
    
    ratings[modelA] = newRatingA
    ratings[modelB] = newRatingB
  }
  
  return ratings
}

// Calculate all dimension Elo ratings
export function calculateAllDimensionElo(
  results: PairSampleResult[]
): Record<Dimension, EloRatings> {
  const dimensions: Dimension[] = [
    'text_consistency',
    'temporal_consistency',
    'visual_quality',
    'distortion',
    'motion_quality'
  ]
  
  const allRatings: Record<string, EloRatings> = {}
  
  for (const dim of dimensions) {
    allRatings[dim] = calculateDimensionElo(results, dim)
  }
  
  return allRatings as Record<Dimension, EloRatings>
}
