import { useState, useCallback, useEffect, useRef } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react'
import clsx from 'clsx'

interface ImageModalProps {
  src: string
  alt?: string
  isOpen: boolean
  onClose: () => void
}

export function ImageModal({ src, alt = 'Image', isOpen, onClose }: ImageModalProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }, [isOpen])

  // Handle keyboard
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case '+':
        case '=':
          setScale(s => Math.min(s + 0.25, 5))
          break
        case '-':
          setScale(s => Math.max(s - 0.25, 0.5))
          break
        case '0':
          setScale(1)
          setPosition({ x: 0, y: 0 })
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale(s => Math.min(Math.max(s + delta, 0.5), 5))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale <= 1) return
    setIsDragging(true)
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }, [scale, position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    })
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleReset = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-surface-800/90 backdrop-blur rounded-xl px-4 py-2 shadow-xl border border-surface-600">
        <button
          onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(s - 0.25, 0.5)) }}
          className="p-2 hover:bg-surface-700 rounded-lg transition-colors"
          title="缩小 (-)"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        
        <span className="text-sm font-mono min-w-[60px] text-center">
          {Math.round(scale * 100)}%
        </span>
        
        <button
          onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(s + 0.25, 5)) }}
          className="p-2 hover:bg-surface-700 rounded-lg transition-colors"
          title="放大 (+)"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        
        <div className="w-px h-6 bg-surface-600" />
        
        <button
          onClick={(e) => { e.stopPropagation(); handleReset() }}
          className="p-2 hover:bg-surface-700 rounded-lg transition-colors"
          title="重置 (0)"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        
        <button
          onClick={(e) => { e.stopPropagation(); setScale(2) }}
          className="p-2 hover:bg-surface-700 rounded-lg transition-colors"
          title="2x 放大"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-surface-800/90 hover:bg-surface-700 rounded-lg transition-colors"
        title="关闭 (Esc)"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image container */}
      <div
        ref={containerRef}
        className={clsx(
          'relative overflow-hidden',
          scale > 1 ? 'cursor-grab' : 'cursor-zoom-in',
          isDragging && 'cursor-grabbing'
        )}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-[90vw] max-h-[85vh] object-contain select-none transition-transform duration-100"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
          }}
          draggable={false}
        />
      </div>

      {/* Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-surface-400">
        滚轮缩放 • 拖拽移动 • Esc 关闭
      </div>
    </div>
  )
}
