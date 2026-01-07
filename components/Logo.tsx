import React from 'react';

interface LogoProps {
  className?: string;
  light?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10", light = false }) => {
  // Theme configuration
  // light=true (Sidebar): White BG, Dark strokes
  // light=false (Default): Brand Blue BG, White strokes
  const bgFill = light ? "#ffffff" : "#0284c7"; 
  const strokeColor = light ? "#0f172a" : "#ffffff";
  const moneyBg = "#10b981"; // Emerald 500
  const moneySymbol = "#ffffff";

  return (
    <svg 
      viewBox="0 0 512 512" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      aria-label="ReList Logo"
    >
      {/* Main Container */}
      <rect width="512" height="512" rx="110" fill={bgFill} />

      {/* Phone Silhouette */}
      <rect 
        x="136" 
        y="152" 
        width="180" 
        height="280" 
        rx="24" 
        stroke={strokeColor} 
        strokeWidth="24" 
        fill="none"
      />
      
      {/* Phone Notch/Speaker */}
      <path d="M206 180 H246" stroke={strokeColor} strokeWidth="12" strokeLinecap="round" />

      {/* Abstract Content Lines inside Phone */}
      <line x1="166" y1="240" x2="286" y2="240" stroke={strokeColor} strokeWidth="12" strokeOpacity="0.3" strokeLinecap="round" />
      <line x1="166" y1="280" x2="246" y2="280" stroke={strokeColor} strokeWidth="12" strokeOpacity="0.3" strokeLinecap="round" />
      <line x1="166" y1="320" x2="266" y2="320" stroke={strokeColor} strokeWidth="12" strokeOpacity="0.3" strokeLinecap="round" />

      {/* Growth Arrow - Bursting out of the screen */}
      {/* Starts bottom left, goes zig-zag up to top right */}
      <path 
        d="M166 380 L230 316 L260 346 L370 170" 
        stroke={strokeColor} 
        strokeWidth="32" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />

      {/* Profit Indicator (Money Sign Circle) at Arrow Tip */}
      {/* Use the background color as a border to separate it from the arrow line */}
      <circle cx="370" cy="170" r="55" fill={moneyBg} stroke={bgFill} strokeWidth="12" />
      
      {/* Dollar Symbol */}
      <path 
        d="M370 145 V195 M360 155 C360 155 380 155 380 160 C380 165 360 165 360 170 C360 175 380 175 380 175" 
        stroke={moneySymbol} 
        strokeWidth="10" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
};