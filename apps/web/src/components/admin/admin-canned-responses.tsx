'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Badge } from '@ui/badge';
import {
  cannedResponsesControllerFindAll,
  cannedResponsesControllerCreate,
  cannedResponsesControllerUpdate,
  cannedResponsesControllerDelete,
} from '../../api/endpoints/canned-responses/canned-responses';
import {
  CANNED_RESPONSES,
  CannedResponseTemplate,
  interpolateCannedResponse,
  extractApiErrorMessage,
} from '@lib/helpers';

interface AdminCannedResponsesProps {
  currentStaffName?: string;
}

const VARIABLE_PILLS = [
  { token: '{{customer_name}}', label: 'Customer Name', sample: 'Sarah Connor' },
  { token: '{{ticket_id}}', label: 'Ticket ID', sample: '#TK-482109' },
  { token: '{{ticket_title}}', label: 'Ticket Title', sample: 'VPN connection failure' },
  { token: '{{agent_name}}', label: 'Staff Name', sample: 'Alex Mercer' },
];

export function AdminCannedResponses({ currentStaffName = 'IT Support' }: AdminCannedResponsesProps) {
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = React.useState<string>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Form state
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formCategory, setFormCategory] = React.useState('Troubleshooting');
  const [formLabel, setFormLabel] = React.useState('');
  const [formContent, setFormContent] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // 1. Fetch templates
  const { data: templates = CANNED_RESPONSES, isLoading, refetch } = useQuery<CannedResponseTemplate[]>({
    queryKey: ['canned-responses'],
    queryFn: async () => {
      try {
        const res = (await cannedResponsesControllerFindAll()) as any;
        return res;
      } catch {
        return CANNED_RESPONSES;
      }
    },
  });

  // 2. Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: { category: string; label: string; content: string }) => {
      const res = (await cannedResponsesControllerCreate(payload as any)) as any;
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      resetForm();
    },
    onError: (err) => {
      setFormError(extractApiErrorMessage(err, 'Failed to create canned response template.'));
    },
  });

  // 3. Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { category?: string; label?: string; content?: string } }) => {
      const res = (await cannedResponsesControllerUpdate(id, payload as any)) as any;
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      resetForm();
    },
    onError: (err) => {
      setFormError(extractApiErrorMessage(err, 'Failed to update canned response template.'));
    },
  });

  // 4. Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = (await cannedResponsesControllerDelete(id)) as any;
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      setDeleteConfirmId(null);
    },
    onError: (err) => {
      setFormError(extractApiErrorMessage(err, 'Failed to delete template.'));
    },
  });

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormCategory('Troubleshooting');
    setFormLabel('');
    setFormContent('');
    setFormError(null);
  };

  const handleStartEdit = (template: CannedResponseTemplate) => {
    setEditingId(template.id);
    setFormCategory(template.category);
    setFormLabel(template.label);
    setFormContent(template.content);
    setFormError(null);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInsertToken = (token: string) => {
    if (!textareaRef.current) {
      setFormContent((prev) => `${prev} ${token} `);
      return;
    }
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const nextContent = formContent.substring(0, start) + token + formContent.substring(end);
    setFormContent(nextContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLabel.trim()) {
      setFormError('Please provide a descriptive template title/label.');
      return;
    }
    if (!formContent.trim() || formContent.trim().length < 5) {
      setFormError('Template content must be at least 5 characters long.');
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        payload: {
          category: formCategory.trim(),
          label: formLabel.trim(),
          content: formContent.trim(),
        },
      });
    } else {
      createMutation.mutate({
        category: formCategory.trim(),
        label: formLabel.trim(),
        content: formContent.trim(),
      });
    }
  };

  // Categories list
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => set.add(t.category));
    return ['ALL', ...Array.from(set)];
  }, [templates]);

  // Filtered templates
  const filteredTemplates = React.useMemo(() => {
    return templates.filter((t) => {
      const matchesCategory = activeCategory === 'ALL' || t.category === activeCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [templates, activeCategory, searchQuery]);

  // Live preview interpolated
  const livePreview = React.useMemo(() => {
    return interpolateCannedResponse(formContent, {
      customerName: 'Sarah Connor',
      ticketId: '482109',
      ticketTitle: 'VPN connection failure',
      agentName: currentStaffName,
    });
  }, [formContent, currentStaffName]);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black tracking-tight text-spruce-900 dark:text-white">
            Canned Responses &amp; Quick Reply Management
          </h2>
          <p className="text-xs text-spruce-600 dark:text-spruce-400 mt-0.5">
            Create and maintain organization-wide standard response macros with dynamic customer, ticket, and staff placeholders.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="text-xs h-9"
          >
            Refresh
          </Button>
          {!isFormOpen && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
              className="text-xs h-9 font-semibold bg-spruce-800 hover:bg-spruce-900 text-white dark:bg-spruce-300 dark:hover:bg-spruce-200 dark:text-spruce-950"
            >
              + Create Template
            </Button>
          )}
        </div>
      </div>

      {/* Template Create / Edit Form Card */}
      {isFormOpen && (
        <Card className="border-spruce-300 dark:border-spruce-700 bg-spruce-50/70 dark:bg-spruce-900/60 shadow-md">
          <CardHeader className="p-4 pb-2 border-b border-spruce-200 dark:border-spruce-800 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-spruce-950 dark:text-white">
              {editingId ? 'Edit Canned Response Template' : 'Create New Canned Response Template'}
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetForm}
              className="h-7 text-xs text-spruce-500 hover:text-spruce-800 dark:hover:text-spruce-200"
            >
              Cancel
            </Button>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {formError && (
              <div className="p-3 text-xs rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-spruce-800 dark:text-spruce-200">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="e.g. Troubleshooting, Information Request, Resolution"
                    required
                    className="w-full h-9 rounded-md border border-spruce-300 bg-white px-3 py-1 text-xs shadow-sm text-spruce-900 focus:outline-none focus:ring-2 focus:ring-spruce-500 dark:border-spruce-700 dark:bg-spruce-950 dark:text-spruce-100"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Troubleshooting', 'Information Request', 'Status & Escalation', 'Resolution'].map(
                      (cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormCategory(cat)}
                          className="text-[10px] px-2 py-0.5 rounded border border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900 text-spruce-700 dark:text-spruce-300 hover:bg-spruce-100 dark:hover:bg-spruce-800"
                        >
                          {cat}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-spruce-800 dark:text-spruce-200">
                    Menu Label / Short Title
                  </label>
                  <Input
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="e.g. Hardware Power Cycle, Clear Browser Cache"
                    required
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Dynamic Interpolation Variable Chips */}
              <div className="space-y-1.5 p-3 rounded-lg bg-spruce-100/60 dark:bg-spruce-950/70 border border-spruce-200 dark:border-spruce-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-spruce-700 dark:text-spruce-300">
                    Insert Dynamic Placeholder Tokens
                  </span>
                  <span className="text-[10px] text-spruce-500">
                    Click a pill to insert into response at cursor
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {VARIABLE_PILLS.map((pill) => (
                    <button
                      key={pill.token}
                      type="button"
                      onClick={() => handleInsertToken(pill.token)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium border border-spruce-300 dark:border-spruce-700 bg-white dark:bg-spruce-900 hover:bg-spruce-200/80 dark:hover:bg-spruce-800 text-spruce-800 dark:text-spruce-200 transition-colors shadow-2xs"
                    >
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">+</span>
                      <span>{pill.token}</span>
                      <span className="text-[10px] text-spruce-500 font-sans">({pill.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Textarea */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-spruce-800 dark:text-spruce-200">
                  Response Template Content
                </label>
                <textarea
                  ref={textareaRef}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Write the full response message here with {{customer_name}}, {{ticket_id}}, etc..."
                  rows={5}
                  required
                  className="w-full rounded-md border border-spruce-300 bg-white p-3 text-xs shadow-sm text-spruce-900 focus:outline-none focus:ring-2 focus:ring-spruce-500 dark:border-spruce-700 dark:bg-spruce-950 dark:text-spruce-100 font-sans leading-relaxed"
                />
              </div>

              {/* Live Preview Box */}
              {formContent.trim() && (
                <div className="space-y-1.5 p-3 rounded-lg border border-dashed border-spruce-300 dark:border-spruce-700 bg-white dark:bg-spruce-950/40">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-spruce-500">
                    Live Sample Preview (with interpolated mock data)
                  </span>
                  <div className="text-xs text-spruce-900 dark:text-spruce-100 whitespace-pre-wrap font-sans bg-spruce-50/50 dark:bg-spruce-900/40 p-2.5 rounded border border-spruce-200 dark:border-spruce-800">
                    {livePreview}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetForm}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="text-xs font-semibold bg-spruce-800 hover:bg-spruce-900 text-white dark:bg-spruce-300 dark:hover:bg-spruce-200 dark:text-spruce-950"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingId
                    ? 'Update Template'
                    : 'Save New Template'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3.5 rounded-xl border border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/60 shadow-xs">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant={activeCategory === cat ? 'default' : 'outline'}
              onClick={() => setActiveCategory(cat)}
              className="text-xs h-8"
            >
              {cat}
            </Button>
          ))}
        </div>

        <Input
          placeholder="Search templates by keyword or variable..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-72 text-xs h-8"
        />
      </div>

      {/* Templates Grid / Table */}
      <div className="space-y-3">
        {filteredTemplates.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-spruce-200 dark:border-spruce-800 text-spruce-500 text-xs">
            No canned response templates found matching your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className="border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/50 shadow-xs flex flex-col justify-between hover:border-spruce-300 dark:hover:border-spruce-700 transition-colors"
              >
                <CardHeader className="p-3.5 pb-2 border-b border-spruce-100 dark:border-spruce-800/80 flex flex-row items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-spruce-900 dark:text-white truncate">
                        {template.label}
                      </span>
                      {template.isSystem ? (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1 bg-spruce-100 dark:bg-spruce-800 text-spruce-700 dark:text-spruce-300">
                          System
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-[9px] py-0 px-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-none">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-spruce-500 block">
                      {template.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(template)}
                      className="h-7 px-2 text-xs text-spruce-600 hover:text-spruce-950 dark:text-spruce-300 dark:hover:text-white"
                    >
                      Edit
                    </Button>
                    {deleteConfirmId === template.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(template.id)}
                          className="h-7 px-2 text-[10px]"
                        >
                          Confirm
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(null)}
                          className="h-7 px-1.5 text-[10px]"
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirmId(template.id)}
                        className="h-7 px-2 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-500/10"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-3.5 pt-2.5 flex-1 flex flex-col justify-between space-y-2">
                  <p className="text-xs text-spruce-700 dark:text-spruce-300 whitespace-pre-wrap line-clamp-4 font-sans leading-relaxed">
                    {template.content}
                  </p>

                  <div className="pt-2 border-t border-spruce-50 dark:border-spruce-800/50 flex items-center justify-between text-[10px] text-spruce-400">
                    <span>
                      Variables: {template.content.includes('{{') ? 'Interpolated' : 'Static'}
                    </span>
                    <span className="font-mono text-[9px]">
                      {template.content.length} chars
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
