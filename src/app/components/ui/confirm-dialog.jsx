import { AnimatePresence, motion } from "motion/react";

export function ConfirmDialog({
  open = false,
  title = "Confirm action",
  description = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger = false,
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[121] flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.98 }}
              className="confirm-dialog-panel w-full max-w-md glass-strong rounded-2xl border border-slate-700/50 p-4 sm:p-5"
            >
              <h3 className="text-slate-100 text-base sm:text-lg font-semibold">{title}</h3>
              {description ? (
                <p className="text-slate-300 text-sm mt-2">{description}</p>
              ) : null}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="confirm-dialog-cancel px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/30 text-sm"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className={`confirm-dialog-confirm px-3 py-2 rounded-lg border text-sm ${
                    danger
                      ? "confirm-dialog-danger border-red-400/45 bg-red-500/20 text-red-100 hover:bg-red-500/30"
                      : "border-teal-400/45 bg-teal-500/20 text-teal-100 hover:bg-teal-500/30"
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
