import React, { useId } from "react";
import { Particles, ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { cn } from "@/lib/utils";
import { motion, useAnimation } from "framer-motion";

async function initEngine(engine) {
  await loadSlim(engine);
}

export const SparklesCore = (props) => {
  const {
    id,
    className,
    background,
    minSize,
    maxSize,
    speed,
    particleColor,
    particleDensity,
  } = props;

  const controls = useAnimation();
  const generatedId = useId();

  const particlesLoaded = async (container) => {
    if (container) {
      controls.start({ opacity: 1, transition: { duration: 1 } });
    }
  };

  const options = {
    background: { color: { value: background || "transparent" } },
    fullScreen: { enable: false, zIndex: 1 },
    fpsLimit: 120,
    interactivity: {
      events: {
        onClick: { enable: false },
        onHover: { enable: false },
        resize: true,
      },
    },
    particles: {
      color: { value: particleColor || "#ffffff" },
      move: {
        direction: "none",
        enable: true,
        outModes: { default: "out" },
        random: false,
        speed: { min: 0.1, max: speed || 1 },
        straight: false,
      },
      number: {
        density: { enable: true, width: 400, height: 400 },
        value: particleDensity || 120,
      },
      opacity: {
        value: { min: 0.1, max: 1 },
        animation: {
          enable: true,
          speed: speed || 4,
          sync: false,
          mode: "auto",
          startValue: "random",
          destroy: "none",
        },
      },
      shape: { type: "circle" },
      size: {
        value: { min: minSize || 1, max: maxSize || 3 },
      },
    },
    detectRetina: true,
  };

  return (
    <ParticlesProvider init={initEngine}>
      <motion.div animate={controls} className={cn("opacity-0", className)}>
        <Particles
          id={id || generatedId}
          className={cn("h-full w-full")}
          particlesLoaded={particlesLoaded}
          options={options}
        />
      </motion.div>
    </ParticlesProvider>
  );
};
