import React from 'react';
import { Loader2 } from 'lucide-react';

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = ''
}) => (
  <div className={`bg-white dark:bg-neutral-900/80 backdrop-blur-sm p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl ${className}`}>
    {children}
  </div>
);

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = "px-4 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm tracking-wide active:scale-95";

  const variants = {
    primary: "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/20 border border-transparent",
    secondary: "bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-900 dark:text-white border border-slate-200 dark:border-neutral-700",
    outline: "bg-transparent border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 hover:border-slate-400 dark:hover:border-neutral-500 hover:text-slate-900 dark:hover:text-white",
    destructive: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/50",
    ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${disabled || isLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin text-current" />}
      {children}
    </button>
  );
};

// --- Badge ---
export const Badge: React.FC<{
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'neutral' | 'error' | 'violet';
  className?: string;
}> = ({ children, variant = 'neutral', className = '' }) => {
  const styles = {
    success: "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
    warning: "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
    neutral: "bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-400 border-slate-200 dark:border-neutral-700",
    error: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20",
    violet: "bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-500/20",
  };
  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${styles[variant]} shadow-sm ${className}`}>
      {children}
    </span>
  );
};

// --- Input ---
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...props
}) => (
  <input
    className={`px-4 py-2.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none w-full text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 transition-all shadow-sm ${className}`}
    {...props}
  />
);

// --- Select ---
export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  ...props
}) => (
  <select
    className={`px-4 py-2.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none w-full text-base text-slate-900 dark:text-white transition-all shadow-sm ${className}`}
    {...props}
  />
);

// --- Textarea ---
export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = '',
  ...props
}) => (
  <textarea
    className={`px-4 py-2.5 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 dark:focus:border-violet-400 outline-none w-full text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 transition-all shadow-sm resize-none ${className}`}
    {...props}
  />
);
