import React, { useEffect, useMemo, useRef } from 'react';
import { motion, useAnimationControls, useInView, useReducedMotion } from 'framer-motion';

/**
 * FadeIn component adapted from the t3 stack for staggered entrance effects.
 * - Wraps children and fades/slides them in once they enter the viewport.
 * - Respects prefers-reduced-motion and skips animations when users opt out.
 */
export default function FadeIn({
  children,
  delayStep = 0.3,
  immediate = false,
  className = '',
  childClassName = '',
  as: Component = 'div',
  ...rest
}) {
  const prefersReduced = useReducedMotion();
  const controls = useAnimationControls();
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: !immediate, margin: '0px' });
  const items = useMemo(() => React.Children.toArray(children), [children]);
  const MotionContainer = useMemo(() => motion(Component), [Component]);

  useEffect(() => {
    if (immediate || prefersReduced) {
      return;
    }

    if (inView) {
      controls.start('visible');
    } else {
      controls.start('hidden');
    }
  }, [controls, immediate, inView, prefersReduced]);

  if (prefersReduced) {
    return (
      <Component ref={containerRef} className={className} {...rest}>
        {children}
      </Component>
    );
  }

  const container = {
    hidden: {},
    visible: {
      transition: { staggerChildren: delayStep }
    }
  };

  const childVariants = {
    hidden: { opacity: 0, y: prefersReduced ? 0 : 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  };

  return (
    <MotionContainer
      ref={containerRef}
      variants={container}
      initial="hidden"
      animate={immediate ? 'visible' : controls}
      className={className}
      {...rest}
    >
      {items.map((child, index) => (
        <motion.div variants={childVariants} className={childClassName} key={child.key ?? index}>
          {child}
        </motion.div>
      ))}
    </MotionContainer>
  );
}
