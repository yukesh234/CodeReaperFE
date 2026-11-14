import { motion, useReducedMotion } from "framer-motion";

const container = {
  start: { transition: { staggerChildren: 0.15 } },
  end: { transition: { staggerChildren: 0.15 } },
};

const dot = {
  start: { y: "0%" },
  end: { y: "100%" },
};

const dotTransition = {
  duration: 0.5,
  repeat: Infinity,
  repeatType: "reverse",
  ease: "easeInOut",
};

export default function Loader({ label = "Loading", fullScreen = true }) {
  const reduce = useReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${fullScreen ? "min-h-screen" : "py-24"} grid place-items-center bg-canvas font-sans text-white`}
    >
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <motion.div
          className="flex gap-2"
          variants={container}
          initial="start"
          animate="end"
          aria-hidden="true"
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-3 rounded-full bg-white"
              variants={reduce ? undefined : dot}
              transition={dotTransition}
            />
          ))}
        </motion.div>
        <span className="text-sm text-muted">{label}…</span>
      </motion.div>
    </div>
  );
}