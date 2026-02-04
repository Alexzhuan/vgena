/**
 * QA Results Export to Excel
 * 
 * Exports annotation quality check results to Excel format,
 * including per-annotator per-dimension hard/soft match rates.
 */

import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import type { Dimension } from '../../types'
import { DIMENSION_LABELS, DIMENSIONS } from '../../types'
import type {
  QAPairStats,
  QAScoreStats,
  QAPairSampleResult,
  QAScoreSampleResult,
} from '../../types/analysis'

/**
 * Per-annotator per-dimension statistics
 */
interface AnnotatorDimensionStats {
  annotatorId: string
  dimensions: Record<Dimension, {
    total: number
    hardMatchCount: number
    hardMatchRate: number
    softMatchCount: number
    softMatchRate: number
  }>
  avgHardMatchRate: number
  avgSoftMatchRate: number
  totalSamples: number
}

/**
 * Calculate per-annotator per-dimension stats for Pair mode
 */
function calculatePairAnnotatorDimensionStats(
  stats: QAPairStats
): AnnotatorDimensionStats[] {
  // Group samples by annotator
  const annotatorSamplesMap = new Map<string, QAPairSampleResult[]>()
  
  for (const sample of stats.allSampleResults) {
    const existing = annotatorSamplesMap.get(sample.annotatorId) || []
    existing.push(sample)
    annotatorSamplesMap.set(sample.annotatorId, existing)
  }
  
  const result: AnnotatorDimensionStats[] = []
  
  for (const [annotatorId, samples] of annotatorSamplesMap) {
    // Initialize dimension stats
    const dimensions: AnnotatorDimensionStats['dimensions'] = {} as AnnotatorDimensionStats['dimensions']
    for (const dim of DIMENSIONS) {
      dimensions[dim] = {
        total: 0,
        hardMatchCount: 0,
        hardMatchRate: 0,
        softMatchCount: 0,
        softMatchRate: 0,
      }
    }
    
    // Count matches per dimension
    for (const sample of samples) {
      for (const dimResult of sample.dimensionResults) {
        dimensions[dimResult.dimension].total++
        if (dimResult.isMatch) {
          dimensions[dimResult.dimension].hardMatchCount++
          dimensions[dimResult.dimension].softMatchCount++ // In Pair mode, hard match = soft match for individual dimension
        }
      }
    }
    
    // Calculate rates
    let hardSum = 0
    let softSum = 0
    let dimCount = 0
    
    for (const dim of DIMENSIONS) {
      const dimStats = dimensions[dim]
      if (dimStats.total > 0) {
        dimStats.hardMatchRate = dimStats.hardMatchCount / dimStats.total
        dimStats.softMatchRate = dimStats.softMatchCount / dimStats.total
        hardSum += dimStats.hardMatchRate
        softSum += dimStats.softMatchRate
        dimCount++
      }
    }
    
    result.push({
      annotatorId,
      dimensions,
      avgHardMatchRate: dimCount > 0 ? hardSum / dimCount : 0,
      avgSoftMatchRate: dimCount > 0 ? softSum / dimCount : 0,
      totalSamples: samples.length,
    })
  }
  
  // Sort by annotator ID
  result.sort((a, b) => a.annotatorId.localeCompare(b.annotatorId))
  
  return result
}

/**
 * Calculate per-annotator per-dimension stats for Score mode
 */
function calculateScoreAnnotatorDimensionStats(
  stats: QAScoreStats
): AnnotatorDimensionStats[] {
  // Group samples by annotator
  const annotatorSamplesMap = new Map<string, QAScoreSampleResult[]>()
  
  for (const sample of stats.allSampleResults) {
    const existing = annotatorSamplesMap.get(sample.annotatorId) || []
    existing.push(sample)
    annotatorSamplesMap.set(sample.annotatorId, existing)
  }
  
  const result: AnnotatorDimensionStats[] = []
  
  for (const [annotatorId, samples] of annotatorSamplesMap) {
    // Initialize dimension stats
    const dimensions: AnnotatorDimensionStats['dimensions'] = {} as AnnotatorDimensionStats['dimensions']
    for (const dim of DIMENSIONS) {
      dimensions[dim] = {
        total: 0,
        hardMatchCount: 0,
        hardMatchRate: 0,
        softMatchCount: 0,
        softMatchRate: 0,
      }
    }
    
    // Count matches per dimension
    for (const sample of samples) {
      for (const dimResult of sample.dimensionResults) {
        dimensions[dimResult.dimension].total++
        if (dimResult.isExactMatch) {
          dimensions[dimResult.dimension].hardMatchCount++
        }
        if (dimResult.isLevelMatch) {
          dimensions[dimResult.dimension].softMatchCount++
        }
      }
    }
    
    // Calculate rates
    let hardSum = 0
    let softSum = 0
    let dimCount = 0
    
    for (const dim of DIMENSIONS) {
      const dimStats = dimensions[dim]
      if (dimStats.total > 0) {
        dimStats.hardMatchRate = dimStats.hardMatchCount / dimStats.total
        dimStats.softMatchRate = dimStats.softMatchCount / dimStats.total
        hardSum += dimStats.hardMatchRate
        softSum += dimStats.softMatchRate
        dimCount++
      }
    }
    
    result.push({
      annotatorId,
      dimensions,
      avgHardMatchRate: dimCount > 0 ? hardSum / dimCount : 0,
      avgSoftMatchRate: dimCount > 0 ? softSum / dimCount : 0,
      totalSamples: samples.length,
    })
  }
  
  // Sort by annotator ID
  result.sort((a, b) => a.annotatorId.localeCompare(b.annotatorId))
  
  return result
}

/**
 * Format percentage for display
 */
function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

/**
 * Generate Excel workbook for Pair mode QA stats
 */
export function exportPairQAToExcel(stats: QAPairStats, filename?: string): void {
  const annotatorStats = calculatePairAnnotatorDimensionStats(stats)
  
  // Create workbook
  const wb = XLSX.utils.book_new()
  
  // Sheet 1: Per-annotator per-dimension stats
  const headers = [
    '标注人员',
    '样本数',
    ...DIMENSIONS.map(d => `${DIMENSION_LABELS[d]}(Hard)`),
    ...DIMENSIONS.map(d => `${DIMENSION_LABELS[d]}(Soft)`),
    'Hard均值',
    'Soft均值',
  ]
  
  const rows: (string | number)[][] = [headers]
  
  // Add data rows
  for (const annotator of annotatorStats) {
    const row: (string | number)[] = [
      annotator.annotatorId,
      annotator.totalSamples,
      ...DIMENSIONS.map(d => formatPercent(annotator.dimensions[d].hardMatchRate)),
      ...DIMENSIONS.map(d => formatPercent(annotator.dimensions[d].softMatchRate)),
      formatPercent(annotator.avgHardMatchRate),
      formatPercent(annotator.avgSoftMatchRate),
    ]
    rows.push(row)
  }
  
  // Add total row
  if (annotatorStats.length > 0) {
    const totalRow: (string | number)[] = [
      '总计',
      stats.totalSamples,
      ...DIMENSIONS.map(d => formatPercent(stats.byDimension[d].matchRate)),
      ...DIMENSIONS.map(d => formatPercent(stats.byDimension[d].matchRate)), // In Pair mode, same as hard match
      formatPercent(stats.avgSoftMatchRate),
      formatPercent(stats.avgSoftMatchRate),
    ]
    rows.push(totalRow)
  }
  
  const ws1 = XLSX.utils.aoa_to_sheet(rows)
  
  // Set column widths
  ws1['!cols'] = [
    { wch: 15 }, // 标注人员
    { wch: 8 },  // 样本数
    ...DIMENSIONS.map(() => ({ wch: 14 })), // Hard match columns
    ...DIMENSIONS.map(() => ({ wch: 14 })), // Soft match columns
    { wch: 10 }, // Hard均值
    { wch: 10 }, // Soft均值
  ]
  
  XLSX.utils.book_append_sheet(wb, ws1, '分标注人员统计')
  
  // Sheet 2: Per-dimension summary
  const dimHeaders = ['维度', '样本数', '一致数', '一致率']
  const dimRows: (string | number)[][] = [dimHeaders]
  
  for (const dim of DIMENSIONS) {
    const dimStats = stats.byDimension[dim]
    dimRows.push([
      DIMENSION_LABELS[dim],
      dimStats.total,
      dimStats.matchCount,
      formatPercent(dimStats.matchRate),
    ])
  }
  
  const ws2 = XLSX.utils.aoa_to_sheet(dimRows)
  ws2['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
  ]
  
  XLSX.utils.book_append_sheet(wb, ws2, '分维度统计')
  
  // Generate file
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  
  const defaultFilename = `QA_Pair_${new Date().toISOString().slice(0, 10)}.xlsx`
  saveAs(blob, filename || defaultFilename)
}

/**
 * Generate Excel workbook for Score mode QA stats
 */
export function exportScoreQAToExcel(stats: QAScoreStats, filename?: string): void {
  const annotatorStats = calculateScoreAnnotatorDimensionStats(stats)
  
  // Create workbook
  const wb = XLSX.utils.book_new()
  
  // Sheet 1: Per-annotator per-dimension stats
  const headers = [
    '标注人员',
    '样本数',
    ...DIMENSIONS.map(d => `${DIMENSION_LABELS[d]}(Hard)`),
    ...DIMENSIONS.map(d => `${DIMENSION_LABELS[d]}(Soft)`),
    'Hard均值',
    'Soft均值',
  ]
  
  const rows: (string | number)[][] = [headers]
  
  // Add data rows
  for (const annotator of annotatorStats) {
    const row: (string | number)[] = [
      annotator.annotatorId,
      annotator.totalSamples,
      ...DIMENSIONS.map(d => formatPercent(annotator.dimensions[d].hardMatchRate)),
      ...DIMENSIONS.map(d => formatPercent(annotator.dimensions[d].softMatchRate)),
      formatPercent(annotator.avgHardMatchRate),
      formatPercent(annotator.avgSoftMatchRate),
    ]
    rows.push(row)
  }
  
  // Add total row
  if (annotatorStats.length > 0) {
    const totalRow: (string | number)[] = [
      '总计',
      stats.totalSamples,
      ...DIMENSIONS.map(d => formatPercent(stats.byDimension[d].exactMatchRate)),
      ...DIMENSIONS.map(d => formatPercent(stats.byDimension[d].levelMatchRate)),
      formatPercent(stats.avgExactMatchRate),
      formatPercent(stats.avgLevelMatchRate),
    ]
    rows.push(totalRow)
  }
  
  const ws1 = XLSX.utils.aoa_to_sheet(rows)
  
  // Set column widths
  ws1['!cols'] = [
    { wch: 15 }, // 标注人员
    { wch: 8 },  // 样本数
    ...DIMENSIONS.map(() => ({ wch: 14 })), // Hard match columns
    ...DIMENSIONS.map(() => ({ wch: 14 })), // Soft match columns
    { wch: 10 }, // Hard均值
    { wch: 10 }, // Soft均值
  ]
  
  XLSX.utils.book_append_sheet(wb, ws1, '分标注人员统计')
  
  // Sheet 2: Per-dimension summary
  const dimHeaders = ['维度', '样本数', 'Hard一致数', 'Hard一致率', 'Soft一致数', 'Soft一致率']
  const dimRows: (string | number)[][] = [dimHeaders]
  
  for (const dim of DIMENSIONS) {
    const dimStats = stats.byDimension[dim]
    dimRows.push([
      DIMENSION_LABELS[dim],
      dimStats.total,
      dimStats.exactMatchCount,
      formatPercent(dimStats.exactMatchRate),
      dimStats.levelMatchCount,
      formatPercent(dimStats.levelMatchRate),
    ])
  }
  
  const ws2 = XLSX.utils.aoa_to_sheet(dimRows)
  ws2['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ]
  
  XLSX.utils.book_append_sheet(wb, ws2, '分维度统计')
  
  // Generate file
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  
  const defaultFilename = `QA_Score_${new Date().toISOString().slice(0, 10)}.xlsx`
  saveAs(blob, filename || defaultFilename)
}

/**
 * Export QA stats to Excel (auto-detect mode)
 */
export function exportQAToExcel(
  stats: QAPairStats | QAScoreStats,
  filename?: string
): void {
  if (stats.mode === 'pair') {
    exportPairQAToExcel(stats as QAPairStats, filename)
  } else {
    exportScoreQAToExcel(stats as QAScoreStats, filename)
  }
}
