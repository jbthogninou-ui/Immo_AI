import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { cn } from '@/utils/cn'

/**
 * Capture une signature au doigt (tactile) ou à la souris sur un canvas, et
 * renvoie une image PNG encodée en data URL — utilisée pour les signatures
 * électroniques de contrat (agent/agence et client).
 */
export function SignaturePad({
  onChange, height = 160, className,
}: {
  onChange: (dataUrl: string | null) => void
  height?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasStroke = useRef(false)
  const [empty, setEmpty] = useState(true)

  function context() {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }

  function pointerPos(canvas: HTMLCanvasElement, event: React.PointerEvent) {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = context()
    if (!canvas || !ctx) return
    drawing.current = true
    const { x, y } = pointerPos(canvas, event)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = context()
    if (!canvas || !ctx || !drawing.current) return
    const { x, y } = pointerPos(canvas, event)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1c1917'
    ctx.lineTo(x, y)
    ctx.stroke()
    hasStroke.current = true
    setEmpty(false)
  }

  function end() {
    drawing.current = false
    if (hasStroke.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'))
    }
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = context()
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasStroke.current = false
    setEmpty(true)
    onChange(null)
  }

  // Redimensionne le canvas à la résolution de l'écran pour un trait net.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    ctx?.scale(ratio, ratio)
  }, [])

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative overflow-hidden rounded-xl border border-dashed border-line bg-surface">
        <canvas
          ref={canvasRef}
          style={{ height, width: '100%', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-content-subtle">
            Signez ici avec la souris ou le doigt
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="flex items-center gap-1.5 text-xs font-medium text-content-subtle hover:text-content"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Effacer
      </button>
    </div>
  )
}
