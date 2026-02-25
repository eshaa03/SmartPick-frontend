import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function HeroSection() {
  const navigate = useNavigate();
  const modes = ['Text', 'Voice', 'Image', 'Smart AI'];

  return (
    <div className="relative h-[calc(100dvh-4rem-5rem)] md:h-[calc(100dvh-5rem)] flex items-center justify-center overflow-hidden hero-section">
      <div className="absolute inset-0 hero-gradient">
        <div className="absolute inset-0 hero-animated-gradient hero-bg-drift" />
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full hero-particle"
              style={{
                left: `${8 + Math.random() * 84}%`,
                top: `${8 + Math.random() * 80}%`,
              }}
              animate={{
                y: [0, -12, 0],
                opacity: [0.15, 0.5, 0.15],
              }}
              transition={{
                duration: 5 + Math.random() * 3,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <motion.div
          className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-5 md:mb-8 relative"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, y: [0, -6, 0] }}
          transition={{
            duration: 0.8,
            ease: [0.19, 1.0, 0.22, 1.0],
            y: {
              duration: 2.8,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }}
        >
          <div className="absolute inset-0 rounded-full hero-orb hero-orb-pulse" />
          <div className="absolute inset-2 rounded-full bg-[#0d111c] flex items-center justify-center border border-slate-700/70">
            <Sparkles className="w-10 h-10 hero-orb-icon" />
          </div>
        </motion.div>

        <motion.h1
          className="hero-title text-4xl md:text-7xl mb-4 md:mb-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.19, 1.0, 0.22, 1.0] }}
        >
          Ask SmartPick.
          <br />
          Get the perfect match.
        </motion.h1>

        <motion.p
          className="hero-subtitle text-xl md:text-xl mb-8 md:mb-12 max-w-2xl mx-auto"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.8, ease: [0.19, 1.0, 0.22, 1.0] }}
        >
          Your AI-powered shopping assistant. Describe what you need in text, voice, or images
          -- and let our intelligent system find the perfect products for you.
        </motion.p>

        <motion.button
          onClick={() => navigate('/chat')}
          className="hero-cta px-7 md:px-8 py-3.5 md:py-4 rounded-2xl font-medium text-base md:text-lg transition-all duration-300"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          transition={{ delay: 0.6, duration: 0.8, ease: [0.19, 1.0, 0.22, 1.0] }}
        >
          Start AI Recommendation
        </motion.button>

        <motion.div
          className="mt-5 md:mt-6 flex items-center justify-center gap-2.5 md:gap-3 flex-wrap"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.72, duration: 0.8, ease: [0.19, 1.0, 0.22, 1.0] }}
        >
          {modes.map((mode) => (
            <span
              key={mode}
              className="px-5 md:px-6 py-2 md:py-2.5 rounded-full border border-slate-700/70 bg-slate-900/50 text-slate-300 text-sm md:text-base leading-none"
            >
              {mode}
            </span>
          ))}
        </motion.div>

      </div>
    </div>
  );
}
