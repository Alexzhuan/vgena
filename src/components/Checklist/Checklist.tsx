import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Star, CheckCircle2 } from 'lucide-react'
import { useAnnotationStore } from '../../stores/annotationStore'
import { groupChecklistByDimension } from '../../utils'
import { DIMENSION_LABELS, DIMENSIONS } from '../../types'
import type { ChecklistItem, Dimension } from '../../types'
import clsx from 'clsx'

interface ChecklistProps {
  items: ChecklistItem[]
  activeDimension?: Dimension  // When set, only show items for this dimension
  className?: string
}

export function Checklist({ items, activeDimension, className }: ChecklistProps) {
  const { currentChecklist, toggleChecklistItem } = useAnnotationStore()
  const [expandedDimensions, setExpandedDimensions] = useState<Set<Dimension>>(
    new Set(DIMENSIONS)
  )

  const groupedItems = useMemo(() => groupChecklistByDimension(items), [items])
  
  // Filter dimensions to display based on activeDimension prop
  const dimensionsToShow = useMemo(() => {
    if (activeDimension) {
      return [activeDimension]
    }
    return DIMENSIONS
  }, [activeDimension])

  const toggleDimension = (dimension: Dimension) => {
    setExpandedDimensions((prev) => {
      const next = new Set(prev)
      if (next.has(dimension)) {
        next.delete(dimension)
      } else {
        next.add(dimension)
      }
      return next
    })
  }

  const getDimensionStats = (dimension: Dimension) => {
    const dimensionItems = groupedItems[dimension]
    const checkedCount = dimensionItems.filter(item => currentChecklist[item.id]).length
    return { checked: checkedCount, total: dimensionItems.length }
  }
  
  // Get total checked count for current filter
  const totalCheckedInView = useMemo(() => {
    return dimensionsToShow.reduce((count, dim) => {
      const dimItems = groupedItems[dim]
      return count + dimItems.filter(item => currentChecklist[item.id]).length
    }, 0)
  }, [dimensionsToShow, groupedItems, currentChecklist])

  // Dimension colors for visual distinction
  const dimensionColors: Record<Dimension, string> = {
    text_consistency: 'border-l-blue-500',
    temporal_consistency: 'border-l-purple-500',
    visual_quality: 'border-l-green-500',
    distortion: 'border-l-orange-500',
    motion_quality: 'border-l-pink-500',
  }

  const dimensionBgColors: Record<Dimension, string> = {
    text_consistency: 'bg-blue-500/10',
    temporal_consistency: 'bg-purple-500/10',
    visual_quality: 'bg-green-500/10',
    distortion: 'bg-orange-500/10',
    motion_quality: 'bg-pink-500/10',
  }

  return (
    <div className={clsx('flex flex-col', className)}>
      <div className="px-4 py-3 border-b border-surface-700">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-accent-400" />
          检查清单
        </h2>
        <p className="text-xs text-surface-400 mt-1">
          根据以下检查项快速定位问题
        </p>
      </div>

      <div className="flex-1 relative">
        <div className="overflow-y-auto max-h-[60vh] h-full">
          {dimensionsToShow.map((dimension) => {
            const isExpanded = expandedDimensions.has(dimension) || activeDimension !== undefined
            const stats = getDimensionStats(dimension)
            const dimensionItems = groupedItems[dimension]

            if (dimensionItems.length === 0) return null

            return (
              <div 
                key={dimension} 
                className={clsx(
                  'border-l-4 border-b border-surface-700',
                  dimensionColors[dimension]
                )}
              >
                {/* Dimension header - only show toggle when not filtered */}
                {!activeDimension ? (
                  <button
                    onClick={() => toggleDimension(dimension)}
                    className={clsx(
                      'w-full px-4 py-3 flex items-center gap-2 hover:bg-surface-800/50 transition-colors',
                      isExpanded && dimensionBgColors[dimension]
                    )}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-surface-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-surface-400 flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm flex-1 text-left">
                      {DIMENSION_LABELS[dimension]}
                    </span>
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full',
                      stats.checked > 0 
                        ? 'bg-warning/20 text-warning' 
                        : 'bg-surface-700 text-surface-400'
                    )}>
                      {stats.checked}/{stats.total}
                    </span>
                  </button>
                ) : (
                  <div className={clsx(
                    'px-4 py-3 flex items-center gap-2',
                    dimensionBgColors[dimension]
                  )}>
                    <span className="font-medium text-sm flex-1">
                      {DIMENSION_LABELS[dimension]}
                    </span>
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full',
                      stats.checked > 0 
                        ? 'bg-warning/20 text-warning' 
                        : 'bg-surface-700 text-surface-400'
                    )}>
                      {stats.checked}/{stats.total}
                    </span>
                  </div>
                )}

                {/* Dimension items - always show when filtered by dimension */}
                {isExpanded && (
                  <div className="pb-2 animate-fade-in">
                    {dimensionItems.map((item) => (
                      <ChecklistItemRow
                        key={item.id}
                        item={item}
                        isChecked={currentChecklist[item.id] || false}
                        onToggle={() => toggleChecklistItem(item.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* Scroll hint gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-surface-900 to-transparent pointer-events-none" />
      </div>

      {/* Summary footer */}
      <div className="px-4 py-3 border-t border-surface-700 bg-surface-800/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-surface-400">
            {activeDimension ? '当前维度已勾选' : '已勾选问题'}
          </span>
          <span className="font-medium text-warning">
            {totalCheckedInView}
          </span>
        </div>
      </div>
    </div>
  )
}

interface ChecklistItemRowProps {
  item: ChecklistItem
  isChecked: boolean
  onToggle: () => void
}

function ChecklistItemRow({ item, isChecked, onToggle }: ChecklistItemRowProps) {
  return (
    <label
      className={clsx(
        'flex items-start gap-3 mx-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all hover:bg-surface-800',
        isChecked && 'bg-warning/10'
      )}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        className="w-4 h-4 mt-0.5 rounded border-2 border-surface-500 flex-shrink-0
                   checked:bg-warning checked:border-warning
                   focus:ring-2 focus:ring-warning/50 focus:ring-offset-0
                   cursor-pointer transition-colors"
      />
      <div className="flex-1">
        <div className="flex items-start gap-1.5">
          {item.isCore && (
            <Star className="w-3 h-3 text-warning flex-shrink-0 mt-0.5" fill="currentColor" />
          )}
          <span className={clsx(
            'text-sm leading-tight',
            isChecked ? 'text-warning font-medium' : 'text-surface-200'
          )}>
            {item.label}
          </span>
        </div>
        {item.description && (
          <p className="text-xs text-surface-500 mt-1 leading-relaxed">
            {item.description}
          </p>
        )}
      </div>
    </label>
  )
}
