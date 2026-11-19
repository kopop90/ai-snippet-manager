'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Layers,
  Hash,
  FolderCode,
  Pin,
  Lock,
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
  is_pinned?: boolean;
}

export default function Home() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(true);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Global Keyboard Shortcuts (Ctrl+K / Cmd+K to focus search, Esc to clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (document.activeElement === searchInputRef.current) {
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
        if (editingId) setEditingId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingId]);

  useEffect(() => {
    fetchSnippets();
  }, []);

  const showNotice = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 3500);
  };

  const fetchSnippets = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('snippets')
      .select('*')
      .order('is_pinned', { ascending: false })
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

      if (res.status === 429) {
        showNotice('Rate limit reached (10 req/min). Saved without AI analysis.');
      }

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
        is_pinned: false,
      };

      const { data, error } = await supabase
        .from('snippets')
        .insert([newRecord])
        .select()
        .single();

      if (!error && data) {
        setSnippets((prev) => {
          const pinned = prev.filter((item) => item.is_pinned);
          const unpinned = prev.filter((item) => !item.is_pinned);
          return [...pinned, data, ...unpinned];
        });
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

  const handleTogglePin = async (item: Snippet) => {
    const nextPinned = !item.is_pinned;
    setSnippets((prev) =>
      prev
        .map((s) => (s.id === item.id ? { ...s, is_pinned: nextPinned } : s))
        .sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)))
    );
    await supabase
      .from('snippets')
      .update({ is_pinned: nextPinned })
      .eq('id', item.id);
  };

  const handleDelete = async (item: Snippet) => {
    if (item.is_pinned) {
      showNotice('Pinned showcase entry is locked. Unpin first to delete.');
      return;
    }
    const previous = snippets;
    setSnippets((prev) => prev.filter((s) => s.id !== item.id));
    const { error } = await supabase.from('snippets').delete().eq('id', item.id);
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

  const codeCount = useMemo(
    () => snippets.filter((s) => s.type === 'code').length,
    [snippets]
  );
  const linkCount = useMemo(
    () => snippets.filter((s) => s.type === 'link').length,
    [snippets]
  );

  const languageStats = useMemo(() => {
    const map: Record<string, number> = {};
    snippets
      .filter((s) => s.type === 'code' && s.language && s.language !== 'url')
      .forEach((s) => {
        const l = s.language.toLowerCase();
        map[l] = (map[l] || 0) + 1;
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [snippets]);

  const popularTags = useMemo(() => {
    const map: Record<string, number> = {};
    snippets.forEach((s) => {
      (s.tags || []).forEach((tag) => {
        const clean = tag.toLowerCase();
        map[clean] = (map[clean] || 0) + 1;
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
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
      {/* Full-Width Sticky Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#09090B]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1680px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-200">
              <Terminal className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-tight text-zinc-100">
                SnippetVault
              </span>
              <span className="hidden rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline-block">
                v1.1
              </span>
            </div>
          </div>

          {/* Center Search Bar with Ctrl+K Hint */}
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search snippets, URLs, summaries, or #tags..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/70 py-1.5 pl-8 pr-16 text-xs text-zinc-200 placeholder-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-zinc-800 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline-block">
                Ctrl K
              </kbd>
            )}
          </div>

          {/* Toggle Composer Button */}
          <button
            onClick={() => setIsComposerOpen((prev) => !prev)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800"
          >
            {isComposerOpen ? (
              <>
                <X className="h-3.5 w-3.5 text-zinc-400" />
                <span className="hidden sm:inline">Hide Editor</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                <span>New Entry</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Toast Notification Banner */}
      {statusBanner && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-200 shadow-lg">
          <Lock className="h-3.5 w-3.5 text-amber-400" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Full-Width Workspace Container */}
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-start lg:px-8">
        {/* Left Sidebar Navigation */}
        <aside className="w-full shrink-0 space-y-6 lg:sticky lg:top-20 lg:w-56">
          {/* Library Section */}
          <div>
            <p className="mb-2 px-2.5 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Library
            </p>
            <nav className="flex gap-1 overflow-x-auto lg:flex-col">
              <button
                onClick={() => {
                  setTypeFilter('all');
                  setLangFilter('all');
                }}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  typeFilter === 'all' && langFilter === 'all'
                    ? 'bg-zinc-800/90 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-zinc-400" />
                  All Entries
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {snippets.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setTypeFilter('code');
                  setLangFilter('all');
                }}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  typeFilter === 'code' && langFilter === 'all'
                    ? 'bg-zinc-800/90 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Code2 className="h-3.5 w-3.5 text-zinc-400" />
                  Snippets
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {codeCount}
                </span>
              </button>

              <button
                onClick={() => {
                  setTypeFilter('link');
                  setLangFilter('all');
                }}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  typeFilter === 'link'
                    ? 'bg-zinc-800/90 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <LinkIcon className="h-3.5 w-3.5 text-zinc-400" />
                  Bookmarks
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {linkCount}
                </span>
              </button>
            </nav>
          </div>

          {/* Languages Section */}
          {languageStats.length > 0 && (
            <div>
              <p className="mb-2 px-2.5 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Languages
              </p>
              <div className="flex flex-wrap gap-1 lg:flex-col">
                {languageStats.map(([lang, count]) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setTypeFilter('code');
                      setLangFilter(langFilter === lang ? 'all' : lang);
                    }}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition ${
                      langFilter === lang
                        ? 'bg-zinc-800/90 font-medium text-zinc-100'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-mono text-[11px]">
                      <FolderCode className="h-3.5 w-3.5 text-zinc-500" />
                      {lang}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Popular Tags Section */}
          {popularTags.length > 0 && (
            <div className="hidden lg:block">
              <p className="mb-2 px-2.5 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Quick Tags
              </p>
              <div className="flex flex-wrap gap-1.5 px-2">
                {popularTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() =>
                      setSearchQuery(searchQuery === tag ? '' : tag)
                    }
                    className={`inline-flex items-center gap-0.5 rounded-md border px-2 py-0.5 font-mono text-[11px] transition ${
                      searchQuery === tag
                        ? 'border-zinc-600 bg-zinc-800 text-zinc-100'
                        : 'border-zinc-800/80 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <Hash className="h-2.5 w-2.5 text-zinc-500" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Right Main Content Area */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* Collapsible Composer Panel */}
          {isComposerOpen && (
            <section className="rounded-xl border border-zinc-800/90 bg-[#111114] p-4 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Type Switcher */}
                  <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
                    <button
                      type="button"
                      onClick={() => setType('code')}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                        type === 'code'
                          ? 'bg-zinc-800 text-zinc-100'
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
                          ? 'bg-zinc-800 text-zinc-100'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      Bookmark
                    </button>
                  </div>

                  {/* Title Input */}
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Entry title (leave blank for AI auto-title)"
                    className="min-w-[200px] flex-1 rounded-lg border border-zinc-800/80 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 transition focus:border-zinc-700 focus:outline-none"
                  />

                  {/* Language Select */}
                  {type === 'code' && (
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="rounded-lg border border-zinc-800/80 bg-zinc-950/70 px-2.5 py-1.5 text-xs text-zinc-300 transition focus:border-zinc-700 focus:outline-none"
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
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste code snippet here..."
                    className="w-full resize-y rounded-lg border border-zinc-800/80 bg-zinc-950/90 p-3 font-mono text-xs leading-relaxed text-zinc-200 placeholder-zinc-600 transition focus:border-zinc-700 focus:outline-none"
                  />
                ) : (
                  <input
                    type="url"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-zinc-800/80 bg-zinc-950/90 px-3 py-2.5 font-mono text-xs text-zinc-200 placeholder-zinc-600 transition focus:border-zinc-700 focus:outline-none"
                  />
                )}

                <div className="flex items-center justify-between pt-0.5">
                  <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <Sparkles className="h-3 w-3 text-zinc-400" />
                    AI generates Thai summary, title & tags automatically
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
                        Save to Vault
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Active Filter Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="font-medium text-zinc-200">
                {typeFilter === 'all'
                  ? 'All Entries'
                  : typeFilter === 'code'
                  ? 'Code Snippets'
                  : 'Web Bookmarks'}
              </span>
              {langFilter !== 'all' && (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
                  {langFilter}
                </span>
              )}
              {searchQuery && (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200">
                  &ldquo;{searchQuery}&rdquo;
                </span>
              )}
              <span className="text-zinc-600">
                ({filteredSnippets.length})
              </span>
            </div>

            {(typeFilter !== 'all' || langFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setTypeFilter('all');
                  setLangFilter('all');
                  setSearchQuery('');
                }}
                className="text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* 2-Column Cards Grid */}
          <main className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
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
              <div className="col-span-full py-16 text-center text-xs text-zinc-500">
                Loading vault...
              </div>
            ) : filteredSnippets.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-zinc-800 py-14 text-center">
                <p className="text-xs text-zinc-500">
                  No entries found matching your criteria.
                </p>
              </div>
            ) : (
              filteredSnippets.map((item) => {
                const isEditing = editingId === item.id;
                const lineCount = item.content.split('\n').length;
                const isLongCode = item.type === 'code' && lineCount > 12;
                const isExpanded = !!expandedIds[item.id];

                return (
                  <article
                    key={item.id}
                    className={`group flex flex-col justify-between rounded-xl border p-5 transition-colors ${
                      item.is_pinned
                        ? 'border-zinc-800 bg-[#121216] hover:border-zinc-700'
                        : 'border-zinc-800/80 bg-[#111114] hover:border-zinc-700/90'
                    }`}
                  >
                    {isEditing ? (
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
                              setEditForm({
                                ...editForm,
                                language: e.target.value,
                              })
                            }
                            className="w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-100 focus:outline-none"
                            placeholder="Language"
                          />
                        </div>

                        <textarea
                          rows={2}
                          value={editForm.ai_summary}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              ai_summary: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none"
                          placeholder="Summary"
                        />

                        <textarea
                          rows={6}
                          value={editForm.content}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              content: e.target.value,
                            })
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
                          placeholder="Tags separated by comma"
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
                      <>
                        <div>
                          {/* Card Top Bar */}
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
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

                            {/* Card Actions */}
                            <div className="flex shrink-0 items-center gap-1 opacity-75 transition-opacity group-hover:opacity-100">
                              <button
                                onClick={() => handleTogglePin(item)}
                                title={item.is_pinned ? 'Pinned (Protected)' : 'Pin entry'}
                                className={`rounded-md p-1.5 transition ${
                                  item.is_pinned
                                    ? 'text-amber-400/90 hover:bg-zinc-900'
                                    : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'
                                }`}
                              >
                                <Pin className="h-3.5 w-3.5" />
                              </button>

                              <button
                                onClick={() => handleCopy(item.id, item.content)}
                                title="Copy"
                                className="flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-[11px] text-zinc-400 transition hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-200"
                              >
                                {copiedId === item.id ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">
                                      Copied
                                    </span>
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
                                onClick={() => handleDelete(item)}
                                title={
                                  item.is_pinned
                                    ? 'Protected demo item'
                                    : 'Delete'
                                }
                                className={`rounded-md p-1.5 transition ${
                                  item.is_pinned
                                    ? 'cursor-not-allowed text-zinc-700'
                                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-red-400'
                                }`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* AI Summary Callout */}
                          {item.ai_summary && (
                            <div className="mb-3.5 flex flex-col justify-between gap-1 border-l-2 border-zinc-700 pl-3 py-0.5">
                              <p className="text-xs leading-relaxed text-zinc-300">
                                {item.ai_summary}
                              </p>
                              {item.ai_model && (
                                <span className="font-mono text-[10px] text-zinc-500">
                                  via {item.ai_model}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Code Block or Link */}
                          {item.type === 'code' ? (
                            <div className="relative overflow-hidden rounded-lg border border-zinc-800/80 bg-[#0d0d10]">
                              <div
                                className={
                                  isLongCode && !isExpanded
                                    ? 'max-h-[220px] overflow-hidden'
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
                                    fontSize: '0.76rem',
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
                        </div>

                        {/* Tags */}
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
    </div>
  );
}