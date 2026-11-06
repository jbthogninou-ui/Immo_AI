import { Moon, Sun } from 'lucide-react'
import { motion } from 'framer-motion'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/utils/cn'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useUIStore()
  const dark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      aria-label={dark ? 'Passer en thème clair' : 'Passer en thème sombre'}
      title={dark ? 'Thème clair' : 'Thème sombre'}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-xl border border-line',
        'bg-surface text-content-muted transition-colors hover:border-line-strong hover:text-content',
        className,
      )}
    >
      <motion.span
        key={theme}
        initial={{ opacity: 0, rotate: -70, scale: 0.6 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </motion.span>
    </button>
  )
}
