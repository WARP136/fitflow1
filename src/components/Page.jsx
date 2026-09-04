import { motion } from 'framer-motion'
import { useApp } from '../store/AppState.jsx'

/*
 * Shared page transition. Every route wraps in this so navigation has one
 * motion language instead of each page inventing its own. Spring easing,
 * duration scaled by the energy tempo.
 */
export default function Page({ children, className = '' }) {
  const { dur } = useApp()
  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: dur(0.45), ease: [0.22, 1, 0.36, 1] }}
      className={`relative mx-auto w-full max-w-[1440px] px-10 py-10 xl:px-14 ${className}`}
    >
      {children}
    </motion.main>
  )
}

// Container + child, for lists and card grids that reveal in sequence.
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

export const riseIn = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 260, damping: 26 },
  },
}
