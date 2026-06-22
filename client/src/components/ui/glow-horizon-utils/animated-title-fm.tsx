import { motion } from "framer-motion";

export function AnimatedTitleFM({ open }: { open: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={open ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="text-center"
    >
      <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight">
        Glow Horizon
      </h1>
    </motion.div>
  );
}
