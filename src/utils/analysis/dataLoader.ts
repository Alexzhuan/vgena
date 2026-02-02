import type { PairTaskPackage, ScoreTaskPackage, PairSample, ScoreSample } from '../../types'
import type {
  PairAnnotationResult,
  ScoreAnnotationResult,
  CombinedPairData,
  CombinedScoreData,
} from '../../types/analysis'

// Load JSON file from public/data directory
export async function loadJsonFile<T>(filename: string): Promise<T> {
  // Use import.meta.env.BASE_URL for GitHub Pages compatibility
  const basePath = import.meta.env.BASE_URL || '/'
  const response = await fetch(`${basePath}data/${filename}`)
  if (!response.ok) {
    throw new Error(`Failed to load ${filename}: ${response.statusText}`)
  }
  return response.json()
}

// Load pair annotation results (new format with embedded task_package)
export async function loadPairResults(filename: string): Promise<PairAnnotationResult> {
  const result = await loadJsonFile<PairAnnotationResult>(filename)
  
  if (!result.task_package) {
    throw new Error(`File ${filename} does not contain task_package. Please convert to new format.`)
  }
  
  return result
}

// Load score annotation results (new format with embedded task_package)
export async function loadScoreResults(filename: string): Promise<ScoreAnnotationResult> {
  const result = await loadJsonFile<ScoreAnnotationResult>(filename)
  
  if (!result.task_package) {
    throw new Error(`File ${filename} does not contain task_package. Please convert to new format.`)
  }
  
  return result
}

/**
 * Load pair data - extracts task_package from results
 */
export async function loadPairData(resultFile: string): Promise<{
  results: PairAnnotationResult
  taskPackage: PairTaskPackage
}> {
  const results = await loadPairResults(resultFile)
  
  return {
    results,
    taskPackage: results.task_package!,
  }
}

/**
 * Load score data - extracts task_package from results
 */
export async function loadScoreData(resultFile: string): Promise<{
  results: ScoreAnnotationResult
  taskPackage: ScoreTaskPackage
}> {
  const results = await loadScoreResults(resultFile)
  
  return {
    results,
    taskPackage: results.task_package!,
  }
}

// Combine pair task and results
export function combinePairData(
  taskPackage: PairTaskPackage,
  results: PairAnnotationResult
): CombinedPairData[] {
  const resultMap = new Map(results.results.map(r => [r.sample_id, r]))
  // Use top-level annotator_id as default
  const defaultAnnotatorId = results.annotator_id
  
  return taskPackage.samples
    .filter(sample => resultMap.has(sample.sample_id))
    .map(sample => {
      const result = resultMap.get(sample.sample_id)!
      return {
        sample: sample as PairSample,
        result,
        // Use sample-level annotator_id if available, otherwise use default
        annotatorId: result.annotator_id || defaultAnnotatorId,
      }
    })
}

// Combine score task and results
export function combineScoreData(
  taskPackage: ScoreTaskPackage,
  results: ScoreAnnotationResult
): CombinedScoreData[] {
  const resultMap = new Map(results.results.map(r => [r.sample_id, r]))
  // Use top-level annotator_id as default
  const defaultAnnotatorId = results.annotator_id
  
  return taskPackage.samples
    .filter(sample => resultMap.has(sample.sample_id))
    .map(sample => {
      const result = resultMap.get(sample.sample_id)!
      return {
        sample: sample as ScoreSample,
        result,
        // Use sample-level annotator_id if available, otherwise use default
        annotatorId: result.annotator_id || defaultAnnotatorId,
      }
    })
}

// Default data files (new format)
export const defaultDataFiles = {
  pairResult: 'converted_annotation_pair_gold_20260126_01_2026-01-29.json',
  scoreResult: 'converted_annotation_score_gold_20260126_01_2026-01-29.json',
}

// Extract model names from sample_id
export function extractModels(sampleId: string): { modelA?: string; modelB?: string; model?: string } {
  const parts = sampleId.split('_')
  if (parts.length === 3) {
    return { modelA: parts[1], modelB: parts[2] }
  } else if (parts.length === 2) {
    return { model: parts[1] }
  }
  return {}
}

// ============================================
// File upload parsing functions
// ============================================

export type ParsedAnnotationFile = 
  | { mode: 'pair'; results: PairAnnotationResult; taskPackage: PairTaskPackage }
  | { mode: 'score'; results: ScoreAnnotationResult; taskPackage: ScoreTaskPackage }

/**
 * Parse annotation file content (from uploaded file)
 */
export function parseAnnotationContent(content: unknown): ParsedAnnotationFile {
  const data = content as Record<string, unknown>
  
  if (!data.mode) {
    throw new Error('文件缺少 mode 字段')
  }
  
  if (!data.task_package) {
    throw new Error('文件缺少 task_package 字段，请使用转换后的格式')
  }
  
  if (data.mode === 'pair') {
    const results = data as unknown as PairAnnotationResult
    return {
      mode: 'pair',
      results,
      taskPackage: results.task_package!,
    }
  } else if (data.mode === 'score') {
    const results = data as unknown as ScoreAnnotationResult
    return {
      mode: 'score',
      results,
      taskPackage: results.task_package!,
    }
  } else {
    throw new Error(`未知的 mode 类型: ${data.mode}`)
  }
}

/**
 * Read and parse a File object
 */
export function readFileAsJson(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const content = JSON.parse(e.target?.result as string)
        resolve(content)
      } catch {
        reject(new Error(`解析 ${file.name} 失败: JSON 格式错误`))
      }
    }
    
    reader.onerror = () => {
      reject(new Error(`读取 ${file.name} 失败`))
    }
    
    reader.readAsText(file)
  })
}

/**
 * Parse multiple uploaded files and categorize them
 */
export async function parseUploadedFiles(files: { content: unknown }[]): Promise<{
  pairResults: PairAnnotationResult[]
  scoreResults: ScoreAnnotationResult[]
  pairTaskPackages: PairTaskPackage[]
  scoreTaskPackages: ScoreTaskPackage[]
}> {
  const pairResults: PairAnnotationResult[] = []
  const scoreResults: ScoreAnnotationResult[] = []
  const pairTaskPackages: PairTaskPackage[] = []
  const scoreTaskPackages: ScoreTaskPackage[] = []
  
  for (const file of files) {
    const parsed = parseAnnotationContent(file.content)
    
    if (parsed.mode === 'pair') {
      pairResults.push(parsed.results)
      pairTaskPackages.push(parsed.taskPackage)
    } else {
      scoreResults.push(parsed.results)
      scoreTaskPackages.push(parsed.taskPackage)
    }
  }
  
  return {
    pairResults,
    scoreResults,
    pairTaskPackages,
    scoreTaskPackages,
  }
}

/**
 * Merge multiple pair annotation results into one
 * Each sample result will have its annotator_id preserved at sample level
 */
export function mergePairResults(results: PairAnnotationResult[]): PairAnnotationResult | null {
  if (results.length === 0) return null
  if (results.length === 1) return results[0]
  
  // Add annotator_id to each sample result from its source file
  const mergedResults = results.flatMap(r => 
    r.results.map(sampleResult => ({
      ...sampleResult,
      annotator_id: sampleResult.annotator_id || r.annotator_id,
    }))
  )
  
  const merged: PairAnnotationResult = {
    task_id: results.map(r => r.task_id).join('+'),
    annotator_id: [...new Set(results.map(r => r.annotator_id))].join('+'),
    mode: 'pair',
    total_samples: results.reduce((sum, r) => sum + r.total_samples, 0),
    completed_samples: results.reduce((sum, r) => sum + r.completed_samples, 0),
    exported_at: new Date().toISOString(),
    results: mergedResults,
    task_package: {
      task_id: results.map(r => r.task_package?.task_id || '').join('+'),
      annotator_id: [...new Set(results.map(r => r.task_package?.annotator_id || ''))].join('+'),
      mode: 'pair',
      created_at: results[0].task_package?.created_at || '',
      samples: results.flatMap(r => r.task_package?.samples || []),
    },
  }
  
  return merged
}

/**
 * Merge multiple score annotation results into one
 * Each sample result will have its annotator_id preserved at sample level
 */
export function mergeScoreResults(results: ScoreAnnotationResult[]): ScoreAnnotationResult | null {
  if (results.length === 0) return null
  if (results.length === 1) return results[0]
  
  // Add annotator_id to each sample result from its source file
  const mergedResults = results.flatMap(r => 
    r.results.map(sampleResult => ({
      ...sampleResult,
      annotator_id: sampleResult.annotator_id || r.annotator_id,
    }))
  )
  
  const merged: ScoreAnnotationResult = {
    task_id: results.map(r => r.task_id).join('+'),
    annotator_id: [...new Set(results.map(r => r.annotator_id))].join('+'),
    mode: 'score',
    total_samples: results.reduce((sum, r) => sum + r.total_samples, 0),
    completed_samples: results.reduce((sum, r) => sum + r.completed_samples, 0),
    exported_at: new Date().toISOString(),
    results: mergedResults,
    task_package: {
      task_id: results.map(r => r.task_package?.task_id || '').join('+'),
      annotator_id: [...new Set(results.map(r => r.task_package?.annotator_id || ''))].join('+'),
      mode: 'score',
      created_at: results[0].task_package?.created_at || '',
      samples: results.flatMap(r => r.task_package?.samples || []),
    },
  }
  
  return merged
}
