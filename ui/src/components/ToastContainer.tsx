"use client";

import { useToastStore } from "@/lib/toast";
import { motion, AnimatePresence } from "framer-motion";

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => {
          const isError = toast.type === 'error';
          const isSuccess = toast.type === 'success';
          
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.3, type: "spring", bounce: 0.4 }}
              onClick={() => removeToast(toast.id)}
              className={`group pointer-events-auto cursor-pointer font-mono text-[11px] font-bold tracking-widest px-6 py-4 rounded-xl transition-colors duration-300 flex items-center gap-3 shadow-2xl backdrop-blur-xl border hover:shadow-[0_0_20px_rgba(0,255,136,0.2)] ${
                isError 
                  ? "bg-red-500/10 border-red-500/30 text-red-500 hover:bg-gradient-to-r hover:from-red-500/20 hover:to-transparent" 
                  : isSuccess 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-gradient-to-r hover:from-accent/20 hover:to-transparent" 
                    : "bg-surface-2/80 border-border text-foreground hover:bg-gradient-to-r hover:from-accent/20 hover:to-transparent hover:border-accent/50"
              }`}
            >
              {isSuccess && (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {isError && (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {!isError && !isSuccess && (
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.message}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
