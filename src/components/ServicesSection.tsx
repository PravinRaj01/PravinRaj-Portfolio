import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useServices } from '@/hooks/useServices';

interface ServicesSectionProps {
  mode: 'professional' | 'creative';
}

// Border colors matching the reference design
const borderColors = [
  'border-cyan-500',
  'border-blue-400',
  'border-white/80',
  'border-pink-500',
  'border-cyan-400',
  'border-blue-500',
  'border-pink-400',
];

const ServicesSection = ({ mode }: ServicesSectionProps) => {
  const { data: services = [] } = useServices();
  const animationRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: animationRef,
    offset: ["0 1", "1.33 1"],
  });
  const scaleProgress = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const opacityProgress = useTransform(scrollYProgress, [0, 1], [0.6, 1]);

  if (services.length === 0) {
    return null;
  }

  return (
    <section className="py-20 px-4 relative">
      {/* Title */}
      <div className="container mx-auto mb-16">
        <motion.div
          ref={animationRef}
          style={{
            scale: scaleProgress,
            opacity: opacityProgress,
          }}
          className="text-center"
        >
          <p className="text-muted-foreground mb-2">
            <span className="text-primary">&lt;</span>
            Services
            <span className="text-primary">/&gt;</span>
          </p>
          <h2 className="text-3xl md:text-4xl font-bold">
            {mode === 'professional' ? 'My TechStack and Skills' : 'Creative Skills'}
          </h2>
        </motion.div>
      </div>

      {/* Skills Cards Grid - Matching reference layout */}
      <div className="container mx-auto flex flex-wrap justify-center gap-8 lg:gap-10">
        {services.map((service, serviceIndex) => (
          <motion.article
            key={service.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: serviceIndex * 0.1 }}
            viewport={{ once: true }}
            className="bg-card rounded-2xl p-6 pt-14 relative shadow-xl border border-border flex-1 min-w-[280px] max-w-[450px]"
          >
            {/* Category Title Tag - Centered at top */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
              <span className="font-bold text-lg md:text-xl">
                <span className="text-primary">&lt;</span>
                {service.title}
                <span className="text-primary">/&gt;</span>
              </span>
            </div>

            {/* Skills Grid - Fixed layout */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {service.features.map((feature, featureIndex) => (
                <motion.div
                  key={featureIndex}
                  className={`skill-item cursor-pointer flex flex-col items-center justify-center gap-2 rounded-xl p-3 md:p-4 border-2 bg-secondary/50 hover:bg-secondary transition-all duration-300 min-h-[100px] ${borderColors[featureIndex % borderColors.length]}`}
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: '0 0 20px rgba(var(--primary), 0.3)'
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: featureIndex * 0.05 }}
                  viewport={{ once: true }}
                >
                  {/* Icon Letter */}
                  <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-2xl md:text-3xl font-bold text-foreground">
                    {feature.charAt(0).toUpperCase()}
                  </div>
                  {/* Feature Name - Multi-line centered */}
                  <span className="text-[10px] md:text-xs text-center text-muted-foreground font-medium leading-tight">
                    {feature}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
};

export default ServicesSection;
