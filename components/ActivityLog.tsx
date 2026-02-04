import React, { useState } from 'react';
import { ActivityLogEntry } from '../lib/api';
import { Card, Button, Textarea } from './ui/UIComponents';
import { MessageSquare, Trash2, Clock, Tag, DollarSign, Package, Edit3, Plus } from 'lucide-react';

interface ActivityLogProps {
  logs: ActivityLogEntry[];
  onAddNote: (content: string) => Promise<void>;
  onDeleteLog?: (logId: string) => Promise<void>;
  isLoading?: boolean;
}

const activityIcons: Record<string, React.ReactNode> = {
  note: <MessageSquare className="w-4 h-4" />,
  status_change: <Edit3 className="w-4 h-4" />,
  price_change: <DollarSign className="w-4 h-4" />,
  listed: <Package className="w-4 h-4" />,
  sold: <Tag className="w-4 h-4" />,
  relisted: <Package className="w-4 h-4" />,
  created: <Plus className="w-4 h-4" />,
};

const activityColors: Record<string, string> = {
  note: 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
  status_change: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400',
  price_change: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  listed: 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400',
  sold: 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400',
  relisted: 'bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400',
  created: 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400',
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export const ActivityLog: React.FC<ActivityLogProps> = ({
  logs,
  onAddNote,
  onDeleteLog,
  isLoading,
}) => {
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmitting(true);
    await onAddNote(newNote.trim());
    setSubmitting(false);
    setNewNote('');
    setIsAddingNote(false);
  };

  const handleDelete = async (logId: string) => {
    if (!onDeleteLog) return;
    if (!confirm('Delete this entry?')) return;
    await onDeleteLog(logId);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-violet-500" />
          Activity Log
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAddingNote(!isAddingNote)}
          className="text-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Note
        </Button>
      </div>

      {isAddingNote && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-3">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note about this item..."
            rows={2}
            className="text-sm"
            disabled={submitting}
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
              className="text-sm px-3 py-1.5"
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsAddingNote(false);
                setNewNote('');
              }}
              className="text-sm px-3 py-1.5"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8 text-slate-500 dark:text-neutral-400">
            Loading activity...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-neutral-400 text-sm">
            No activity yet. Add notes to track your progress.
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="flex gap-3 p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/50 group hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  activityColors[log.activity_type] || activityColors.note
                }`}
              >
                {activityIcons[log.activity_type] || activityIcons.note}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 dark:text-neutral-300 leading-relaxed">
                  {log.content}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500 dark:text-neutral-500">
                    {formatDate(log.created_at)}
                  </span>
                  {log.activity_type === 'note' && onDeleteLog && (
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 dark:text-neutral-500 dark:hover:text-red-400 transition-all"
                      title="Delete note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
