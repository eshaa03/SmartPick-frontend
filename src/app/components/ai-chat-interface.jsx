import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2 } from 'lucide-react';

const formatRealtimeMeta = (meta) => {
  const analyzed = Math.max(0, Number(meta?.productsAnalyzed) || 0);
  const elapsedMs = Math.max(0, Number(meta?.elapsedMs) || 0);
  const elapsedSec = elapsedMs > 0 ? (elapsedMs / 1000).toFixed(1) : "";

  if (analyzed > 0 && elapsedSec) {
    return `AI analyzed ${analyzed.toLocaleString()} products in ${elapsedSec}s`;
  }
  if (elapsedSec) {
    return `AI processed your request in ${elapsedSec}s`;
  }
  return "";
};

export function AIChatInterface({ messages, isThinking }) {
  const isEmpty = messages.length === 0 && !isThinking;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 space-y-5 sm:space-y-6">
      <AnimatePresence mode="popLayout">
        {isEmpty && (
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="chat-empty glass-strong sp-float-in rounded-3xl px-5 sm:px-6 py-7 sm:py-8 text-center"
          >
            <div className="chat-empty-icon w-12 h-12 mx-auto mb-4 rounded-2xl flex items-center justify-center glow-blue-subtle">
              <Sparkles className="w-6 h-6 chat-empty-icon-mark" />
            </div>
            <h2 className="chat-empty-title text-xl font-semibold text-slate-100">
              Start a conversation with SmartPick
            </h2>
            <p className="chat-empty-subtitle text-sm text-slate-400 mt-2">
              Describe what you need and I will find the best matches for you.
            </p>
          </motion.div>
        )}

        {messages.map((message, index) => {

          // SAFE dynamic content fallback
          let displayContent = message.content;

          if (
            message.type === "ai" &&
            message.detected_items &&
            message.detected_items.length > 0
          ) {
            const subtype =
              message.detected_items[0]?.subtype || "product";

            displayContent =
              message.content ||
              `I found ${subtype} that looks closest to your image.`;
          }

          return (
            <motion.div
              key={message.id}
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.95 }}
              transition={{
                duration: 0.4,
                ease: [0.19, 1.0, 0.22, 1.0],
                delay: index * 0.05,
              }}
              className={`flex ${
                message.type === 'user'
                  ? 'justify-end'
                  : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xl w-fit ${
                  message.type === 'user' ? 'ml-auto' : ''
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center gap-2 mb-2">
                  {message.type === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-teal-600/90 border border-teal-400/40 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <span className="text-sm text-slate-400">
                    {message.type === 'ai'
                      ? 'SmartPick AI'
                      : 'You'}
                  </span>
                </div>

                {/* Message Content */}
                <div
                    className={`rounded-3xl px-4 py-3 ${
                    message.type === 'user'
                      ? 'bg-teal-600/90 border border-teal-400/40 text-white'
                      : 'glass-strong'
                  }`}
                >
                  <p className="text-sm leading-relaxed">
                    {displayContent}
                  </p>

                  {message.imageDataUrl && (
                    <img
                      src={message.imageDataUrl}
                      alt="Attached"
                      className="mt-3 w-full max-w-xs rounded-xl border border-slate-700/60"
                    />
                  )}

                  {/* AI Explanation */}
                  {message.type === 'ai' && formatRealtimeMeta(message.analysisMeta) && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-3 pt-3 border-t border-slate-700"
                    >
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Sparkles className="w-3 h-3" />
                        <span>
                          {formatRealtimeMeta(message.analysisMeta)}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Thinking Indicator */}
        {isThinking && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-xl w-fit">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-teal-600/90 border border-teal-400/40 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-slate-400">
                  SmartPick AI
                </span>
              </div>

              <div className="glass-strong rounded-3xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-teal-300 animate-spin" />

                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 bg-teal-300 rounded-full"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>

                  <span className="text-slate-400 text-sm">
                    Analyzing your request...
                  </span>

                </div>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
