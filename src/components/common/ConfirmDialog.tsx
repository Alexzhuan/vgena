import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'warning' | 'danger'
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  variant = 'warning',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  // Focus on cancel button when dialog opens
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus()
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        className="bg-surface-800 border border-surface-600 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-700">
          <div className={clsx(
            'w-10 h-10 rounded-full flex items-center justify-center',
            variant === 'danger' ? 'bg-red-500/20' : 'bg-amber-500/20'
          )}>
            <AlertTriangle className={clsx(
              'w-5 h-5',
              variant === 'danger' ? 'text-red-400' : 'text-amber-400'
            )} />
          </div>
          <h2 id="dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          <p className="text-surface-300 whitespace-pre-line leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-surface-700 bg-surface-850 rounded-b-xl">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-surface-300 hover:text-surface-100 hover:bg-surface-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
