import React from 'react';
import type { LucideProps } from 'lucide-react';

const BehanceIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ color = 'currentColor', size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Behance "B" shape */}
      <path d="M3 6h5a3 3 0 0 1 0 6H3V6z" />
      <path d="M3 12h6a3 3 0 0 1 0 6H3v-6z" />
      {/* Behance "e" shape */}
      <path d="M14 14h6a3 3 0 1 0-3-3v6a3 3 0 0 0 3-3" />
      {/* Line above "e" */}
      <line x1="14" y1="7" x2="21" y2="7" />
    </svg>
  )
);

BehanceIcon.displayName = 'BehanceIcon';

export default BehanceIcon;
