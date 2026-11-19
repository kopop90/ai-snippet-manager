'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Code2,
  Link as LinkIcon,
  Search,
  Plus,
  Copy,
  Check,
  Pencil,
  Trash2,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Terminal,
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Snippet {
  id: string;
  created_at: string;
  title: string;
  type: 'code' | 'link';
  content: string;
  language: string;
  ai_summary: string | null;
  ai_model: string | null;
  tags: string[];
}

export default function Home() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'code' | 'link'>('code');
  const [language, setLanguage] = useState('auto');
  const [content, setContent] = useState('');

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'code' | 'link'>('all');
  const [langFilter, setLangFilter] = useState<string>('all');

  // Card Interaction States
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    language: '',
    ai_summary: '',
    tags: '',
  });

  useEffect(() => {
    fetchSnippets();
  }, []);

  const fetchSnippets = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('snippets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSnippets(data);
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type, content, language }),
      });

      const aiData = res.ok ? await res.json() : null;

      const finalTitle =
        title.trim() ||
        aiData?.suggestedTitle ||
        (type === 'link' ? 'Saved Bookmark' : 'Code Snippet');

      const finalLang =
        language !== 'auto'
          ? language
          : aiData?.detectedLanguage || (type === 'link' ? 'url' : 'plaintext');

      const newRecord = {
        title: finalTitle,
        type,
        content: content.trim(),
        language: finalLang.toLowerCase(),
        ai_summary: aiData?.summary || null,
        ai_model: aiData?.model || null,
        tags: aiData?.tags?.length ? aiData.tags : [type],
      };

      const { data, error } = await supabase
        .from('snippets')
        .insert([newRecord])
        .select()
        .single();

      if (!error && data) {
        setSnippets((prev) => [data, ...prev]);
        setTitle('');
        setContent('');
        setLanguage('auto');
      }
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const previous = snippets;
    setSnippets((prev) => prev.filter((item) => item.id !== id));
    const { error } = await supabase.from('snippets').delete().eq('id', id);
    if (error) setSnippets(previous);
  };

  const startEdit = (item: Snippet) => {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      content: item.content,
      language: item.language,
      ai_summary: item.ai_summary || '',
      tags: (item.tags || []).join(', '),
    });
  };

  const saveEdit = async (id: string) => {
    const updatedTags = editForm.tags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const updates = {
      title: editForm.title.trim() || 'Untitled',
      content: editForm.content.trim(),
      language: editForm.language.trim().toLowerCase() || 'plaintext',
      ai_summary: editForm.ai_summary.trim() || null,
      tags: updatedTags,
    };

    const { error } = await supabase.from('snippets').update(updates).eq('id', id);
    if (!error) {
      setSnippets((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
      setEditingId(null);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const availableLanguages = useMemo(() => {
    const langs = new Set(
      snippets
        .filter((s) => s.type === 'code' && s.language && s.language !== 'url')
        .map((s) => s.language.toLowerCase())
    );
    return Array.from(langs).sort();
  }, [snippets]);

  const filteredSnippets = useMemo(() => {
    return snippets.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (langFilter !== 'all' && item.language.toLowerCase() !== langFilter)
        return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(q);
        const inContent = item.content.toLowerCase().includes(q);
        const inSummary = item.ai_summary?.toLowerCase().includes(q);
        const inTags = item.tags?.some((t) => t.toLowerCase().includes(q));
        return inTitle || inContent || inSummary || inTags;
      }
      return true;
    });
  }, [snippets, typeFilter, langFilter, searchQuery]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 selection:bg-zinc-700 selection:text-white">
      {/* Subtle Top Border Accent */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200 shadow-inner">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
                Snippet Vault
              </h1>
              <p className="text-xs text-zinc-500">
                Personal code & bookmark archive with Gemini auto-indexing
              </p>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, code, or #tag..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-1.5 pl-8 pr-7 text-xs text-zinc-200 placeholder-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* Composer Card */}
        <section className="mb-8 rounded-xl border border-zinc-800/90 bg-[#111114] p-4 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Top Controls Row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Segmented Type Switch */}
              <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
                <button
                  type="button"
                  onClick={() => setType('code')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    type === 'code'
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  Code
                </button>
                <button
                  type="button"
                  onClick={() => setType('link')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    type === 'link'
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  Bookmark
                </button>
              </div>

              {/* Optional Title */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional — AI will generate if empty)"
                className="min-w-[200px] flex-1 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 transition focus:border-zinc-700 focus:bg-zinc-950 focus:outline-none"
              />

              {/* Language Selector (Only for Code) */}
              {type === 'code' && (
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-2.5 py-1.5 text-xs text-zinc-300 transition focus:border-zinc-700 focus:outline-none"
                >
                  <option value="auto">Auto-detect lang</option>
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="sql">SQL</option>
                  <option value="bash">Bash</option>
                  <option value="html">HTML</option>
                  <option value="css">CSS</option>
                  <option value="json">JSON</option>
                </select>
              )}
            </div>

            {/* Content Input */}
            {type === 'code' ? (
              <textarea
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your code snippet here..."
                className="w-full resize-y rounded-lg border border-zinc-800/80 bg-zinc-950/80 p-3 font-mono text-xs leading-relaxed text-zinc-200 placeholder-zinc-600 transition focus:border-zinc-700 focus:outline-none"
              />
            ) : (
              <input
                type="url"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-2.5 font-mono text-xs text-zinc-200 placeholder-zinc-600 transition focus:border-zinc-700 focus:outline-none"
              />
            )}

            {/* Footer Action */}
            <div className="flex items-center justify-between pt-0.5">
              <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Sparkles className="h-3 w-3 text-zinc-400" />
                Auto-summarizes & tags on save
              </span>

              <button
                type="submit"
                disabled={!content.trim() || isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-1.5 text-xs font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Save Entry
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Filter Bar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-1.5">
            {(['all', 'code', 'link'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTypeFilter(t);
                  if (t === 'link') setLangFilter('all');
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  typeFilter === t
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
                }`}
              >
                {t === 'all' && `All (${snippets.length})`}
                {t === 'code' && 'Snippets'}
                {t === 'link' && 'Bookmarks'}
              </button>
            ))}
          </div>

          {availableLanguages.length > 0 && typeFilter !== 'link' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setLangFilter('all')}
                className={`rounded-md px-2 py-0.5 font-mono text-[11px] transition ${
                  langFilter === 'all'
                    ? 'bg-zinc-800 text-zinc-200'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                all-langs
              </button>
              {availableLanguages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLangFilter(lang)}
                  className={`rounded-md px-2 py-0.5 font-mono text-[11px] transition ${
                    langFilter === lang
                      ? 'bg-zinc-800 text-zinc-200'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Feed List */}
        <main className="space-y-4">
          {/* Optimistic Skeleton Loader while AI is analyzing */}
          {isSubmitting && (
            <div className="animate-pulse rounded-xl border border-zinc-800 bg-[#111114] p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="h-4 w-48 rounded bg-zinc-800" />
                <div className="h-4 w-16 rounded bg-zinc-800" />
              </div>
              <div className="mb-4 h-10 w-full rounded bg-zinc-900" />
              <div className="h-24 w-full rounded bg-zinc-950" />
            </div>
          )}

          {isLoading ? (
            <div className="py-16 text-center text-xs text-zinc-500">
              Loading archive...
            </div>
          ) : filteredSnippets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 py-14 text-center">
              <p className="text-xs text-zinc-500">
                No entries match your current filter.
              </p>
            </div>
          ) : (
            filteredSnippets.map((item) => {
              const isEditing = editingId === item.id;
              const lineCount = item.content.split('\n').length;
              const isLongCode = item.type === 'code' && lineCount > 14;
              const isExpanded = !!expandedIds[item.id];

              return (
                <article
                  key={item.id}
                  className="group rounded-xl border border-zinc-800/90 bg-[#111114] p-5 transition-colors hover:border-zinc-700/90"
                >
                  {isEditing ? (
                    /* Inline Edit Form */
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) =>
                            setEditForm({ ...editForm, title: e.target.value })
                          }
                          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
                          placeholder="Title"
                        />
                        <input
                          type="text"
                          value={editForm.language}
                          onChange={(e) =>
                            setEditForm({ ...editForm, language: e.target.value })
                          }
                          className="w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
                          placeholder="Language"
                        />
                      </div>

                      <textarea
                        rows={2}
                        value={editForm.ai_summary}
                        onChange={(e) =>
                          setEditForm({ ...editForm, ai_summary: e.target.value })
                        }
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none"
                        placeholder="Summary"
                      />

                      <textarea
                        rows={6}
                        value={editForm.content}
                        onChange={(e) =>
                          setEditForm({ ...editForm, content: e.target.value })
                        }
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 focus:outline-none"
                      />

                      <input
                        type="text"
                        value={editForm.tags}
                        onChange={(e) =>
                          setEditForm({ ...editForm, tags: e.target.value })
                        }
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-300 focus:outline-none"
                        placeholder="Tags separated by comma (e.g. react, hooks, api)"
                      />

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-zinc-800 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-900"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(item.id)}
                          className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-950 hover:bg-white"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Standard Display View */
                    <>
                      {/* Card Header */}
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2.5">
                          {item.type === 'code' ? (
                            <Code2 className="h-4 w-4 shrink-0 text-zinc-400" />
                          ) : (
                            <LinkIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                          )}
                          <h2 className="text-sm font-medium text-zinc-100">
                            {item.title}
                          </h2>
                          <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                            {item.language}
                          </span>
                          <span className="text-[11px] text-zinc-600">
                            {formatDate(item.created_at)}
                          </span>
                        </div>

                        {/* Subtle Hover Actions */}
                        <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => handleCopy(item.id, item.content)}
                            title="Copy"
                            className="flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-[11px] text-zinc-400 transition hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-200"
                          >
                            {copiedId === item.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-emerald-400">Copied</span>
                              </>
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => startEdit(item)}
                            title="Edit"
                            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(item.id)}
                            title="Delete"
                            className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-900 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Clean Left-Border AI Summary Callout */}
                      {item.ai_summary && (
                        <div className="mb-3.5 border-l-2 border-zinc-700 pl-3 py-0.5">
                          <p className="text-xs leading-relaxed text-zinc-300">
                            {item.ai_summary}
                          </p>
                          {item.ai_model && (
                            <span className="mt-1 inline-block font-mono text-[10px] text-zinc-500">
                              via {item.ai_model}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Code Block or Bookmark Link */}
                      {item.type === 'code' ? (
                        <div className="relative overflow-hidden rounded-lg border border-zinc-800/80 bg-[#0d0d10]">
                          <div
                            className={
                              isLongCode && !isExpanded
                                ? 'max-h-[260px] overflow-hidden'
                                : ''
                            }
                          >
                            <SyntaxHighlighter
                              language={item.language}
                              style={vscDarkPlus}
                              showLineNumbers
                              customStyle={{
                                margin: 0,
                                padding: '0.875rem 1rem',
                                background: 'transparent',
                                fontSize: '0.78rem',
                                lineHeight: '1.55',
                              }}
                              lineNumberStyle={{
                                minWidth: '2.25em',
                                paddingRight: '1em',
                                color: '#52525b',
                                userSelect: 'none',
                              }}
                            >
                              {item.content}
                            </SyntaxHighlighter>
                          </div>

                          {isLongCode && (
                            <button
                              onClick={() => toggleExpand(item.id)}
                              className="flex w-full items-center justify-center gap-1 border-t border-zinc-800/80 bg-zinc-900/60 py-1.5 text-[11px] text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-3.5 w-3.5" />
                                  Collapse ({lineCount} lines)
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3.5 w-3.5" />
                                  Show all {lineCount} lines
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        <a
                          href={item.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950/70 px-3.5 py-2.5 font-mono text-xs text-zinc-300 transition hover:border-zinc-700 hover:text-white"
                        >
                          <span className="truncate">{item.content}</span>
                          <ExternalLink className="ml-2 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                        </a>
                      )}

                      {/* Tags Footer */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                          {item.tags.map((tag, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSearchQuery(tag)}
                              className="rounded-md bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            })
          )}
        </main>
      </div>
    </div>
  );
}