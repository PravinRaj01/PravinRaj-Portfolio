import React from 'react';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { useVisitorCounter } from '@/hooks/useVisitorCounter';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const VisitorCounter = () => {
  const { totalCount, isLoading } = useVisitorCounter();
  const { data: siteSettings } = useSiteSettings();

  // Don't render if feature is disabled
  if (!siteSettings?.visitor_counter_enabled) {
    return null;
  }

  // Format count with commas for large numbers
  const formattedCount = totalCount.toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.6 }}
      className="mt-8 flex justify-start"
    >
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-white/80 text-sm">
        <Eye className="h-4 w-4" />
        {isLoading ? (
          <span className="animate-pulse">...</span>
        ) : (
          <span>{formattedCount} visitors</span>
        )}
      </div>
    </motion.div>
  );
};

export default VisitorCounter;
