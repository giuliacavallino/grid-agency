"use client";

import Image from "next/image";
import { motion } from "framer-motion";

type GridMonogramProps = {
  color?: "snow" | "sky" | "dune" | "earth" | "dawn";
  size?: number;
  className?: string;
  animate?: boolean;
};

export function GridMonogram({
  color = "dune",
  size = 96,
  className = "",
  animate = true,
}: GridMonogramProps) {
  const image = (
    <Image
      src={`/brand/grid_monogram_${color}.png`}
      alt="GRID Agency Monogramm"
      width={size}
      height={Math.round(size * 0.554)}
      className={className}
      priority
    />
  );

  if (!animate) return image;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: "inline-block" }}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        {image}
      </motion.div>
    </motion.div>
  );
}
