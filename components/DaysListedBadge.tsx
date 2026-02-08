import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface DaysListedBadgeProps {
  days: number;
  isStale?: boolean;
  status: string;
  compact?: boolean;
}

export const DaysListedBadge: React.FC<DaysListedBadgeProps> = ({
  days,
  isStale,
  status,
  compact = false,
}) => {
  // Don't show for draft items
  if (status === 'draft') return null;

  // For sold items, show "Sold in X days"
  if (status === 'sold') {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <Clock className="w-3 h-3" />
          {days}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-2 py-1 rounded-md">
        <Clock className="w-3 h-3" />
        Sold in {days} days
      </span>
    );
  }

  // For listed items
  const isWarning = days > 14 && !isStale;
  
  if (isStale) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400 font-medium">
          <AlertTriangle className="w-3 h-3" />
          {days}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/10 px-2 py-1 rounded-md">
        <AlertTriangle className="w-3 h-3" />
        {days} days listed — Stale inventory
      </span>
    );
  }

  if (isWarning) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <Clock className="w-3 h-3" />
          {days}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 px-2 py-1 rounded-md">
        <Clock className="w-3 h-3" />
        {days} days listed
      </span>
    );
  }

  // Normal (0-14 days)
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-neutral-400">
        <Clock className="w-3 h-3" />
        {days}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
      <Clock className="w-3 h-3" />
      {days} days listed
    </span>
  );
};
