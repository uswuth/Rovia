import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Trash2, Edit2, Check, X, AlertCircle } from 'lucide-react';
import { getJobTitles, createJobTitle, updateJobTitle, deleteJobTitle, type JobTitle } from '@/api/job-title/job-title.api';

interface ManageJobTitlesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTitlesChanged?: () => void;
}

export const ManageJobTitlesModal: React.FC<ManageJobTitlesModalProps> = ({
  isOpen,
  onClose,
  onTitlesChanged,
}) => {
  const [titles, setTitles] = useState<JobTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchTitles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getJobTitles();
      setTitles(res.data?.data || []);
    } catch {
      setError('Unable to load job titles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    getJobTitles()
      .then((res) => {
        if (mounted) setTitles(res.data?.data || []);
      })
      .catch(() => {
        if (mounted) setError('Unable to load job titles');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError(null);
    try {
      await createJobTitle(newTitle.trim());
      setNewTitle('');
      await fetchTitles();
      onTitlesChanged?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create job title';
      setError(msg);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingText.trim()) return;
    setError(null);
    try {
      await updateJobTitle(id, editingText.trim());
      setEditingId(null);
      await fetchTitles();
      onTitlesChanged?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update job title';
      setError(msg);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteJobTitle(id);
      await fetchTitles();
      onTitlesChanged?.();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete job title';
      setError(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Briefcase size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Organization Job Titles</h3>
              <p className="text-xs text-muted-foreground">Manage official titles for team members</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-600 dark:text-red-400">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Add Title Form */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="h-9 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        </form>

        {/* List of Titles */}
        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/40">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-6">Loading titles...</p>
          ) : titles.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No job titles defined yet. Add the first one above!
            </p>
          ) : (
            titles.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 gap-2 text-xs">
                {editingId === t.id ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="flex-1 h-7 rounded border border-emerald-500 bg-background px-2 text-xs text-foreground"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdate(t.id)}
                      className="p-1 rounded text-emerald-500 hover:bg-emerald-500/10 cursor-pointer"
                      title="Save"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1 rounded text-muted-foreground hover:bg-secondary cursor-pointer"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium text-foreground">{t.title}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingId(t.id);
                          setEditingText(t.title);
                        }}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                        title="Edit title"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                        title="Delete title"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="pt-2 border-t border-border flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-4 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 text-xs font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
