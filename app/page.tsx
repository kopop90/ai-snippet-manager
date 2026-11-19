'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Code2,
  Link as LinkIcon,
  Plus,
  Search,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Tag,
  Pencil,
  X,
  Save,
  Filter,
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter states
  const [filterType, setFilterType] = useState<'all' | 'code' | 'link'>('all');
  const [filterLang, setFilterLang] = useState<string>('all');

  // Create Form states
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'code' | 'link'>('code');
  const [language, setLanguage] = useState('auto');
  const [content, setContent] = useState('');
  const [statusText, setStatusText] = useState('');

  // Edit Mode states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLanguage, setEditLanguage] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editTags, setEditTags] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // ดึงข้อมูลจาก Supabase
  const fetchSnippets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('snippets')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSnippets(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSnippets();
  }, []);

  // ส่งให้ AI วิเคราะห์ก่อนบันทึกลง Supabase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setStatusText('AI กำลังวิเคราะห์ ตั้งชื่อ และตรวจจับภาษา...');

    let finalTitle = title.trim();
    let finalLanguage = type === 'link' ? 'url' : language === 'auto' ? 'plaintext' : language;
    let aiSummary = null;
    let aiModel = null;
    let aiTags = [type];

    try {
      const aiRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: finalTitle, type, content, language }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        if (!finalTitle && aiData.suggestedTitle) {
          finalTitle = aiData.suggestedTitle;
        }
        if (type === 'code' && language === 'auto' && aiData.detectedLanguage) {
          finalLanguage = aiData.detectedLanguage;
        }
        aiSummary = aiData.summary;
        aiModel = aiData.model;
        if (aiData.tags && aiData.tags.length > 0) {
          aiTags = aiData.tags;
        }
      }
    } catch (err) {
      console.error('AI fetch failed, saving with fallback values:', err);
    }

    if (!finalTitle) {
      finalTitle = type === 'code' ? `Code Snippet (${finalLanguage})` : content.slice(0, 40);
    }

    setStatusText('กำลังบันทึกลงฐานข้อมูล...');

    const { error } = await supabase.from('snippets').insert([
      {
        title: finalTitle,
        type,
        language: finalLanguage,
        content,
        ai_summary: aiSummary,
        ai_model: aiModel,
        tags: aiTags,
      },
    ]);

    if (!error) {
      setTitle('');
      setContent('');
      fetchSnippets();
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
    setStatusText('');
  };

  // เริ่มโหมดแก้ไข
  const startEditing = (item: Snippet) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditLanguage(item.language);
    setEditContent(item.content);
    setEditSummary(item.ai_summary || '');
    setEditTags(item.tags ? item.tags.join(', ') : '');
  };

  // ยกเลิกการแก้ไข
  const cancelEditing = () => {
    setEditingId(null);
  };

  // บันทึกข้อมูลที่แก้ไขลง Supabase
  const handleUpdate = async (id: string) => {
    if (!editTitle.trim() || !editContent.trim()) return;
    setIsUpdating(true);

    const parsedTags = editTags
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
      .filter(Boolean);

    const { error } = await supabase
      .from('snippets')
      .update({
        title: editTitle.trim(),
        language: editLanguage.trim().toLowerCase() || 'plaintext',
        content: editContent,
        ai_summary: editSummary.trim() || null,
        tags: parsedTags,
      })
      .eq('id', id);

    if (!error) {
      setEditingId(null);
      fetchSnippets();
    } else {
      alert('อัปเดตข้อมูลไม่สำเร็จ: ' + error.message);
    }
    setIsUpdating(false);
  };

  // ลบข้อมูล
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('snippets').delete().eq('id', id);
    if (!error) {
      setSnippets(snippets.filter((item) => item.id !== id));
    }
  };

  // คัดลอกโค้ด/ลิงก์
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ดึงรายชื่อภาษาที่มีอยู่ทั้งหมด (ไม่ซ้ำกัน) เพื่อทำปุ่ม Filter
  const availableLanguages = Array.from(
    new Set(snippets.filter((s) => s.type === 'code').map((s) => s.language))
  ).sort();

  // กรองรายการตาม Type, Language และคำค้นหา
  const filteredSnippets = snippets.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (filterLang !== 'all' && item.language !== filterLang) return false;

    const q = search.toLowerCase();
    if (!q) return true;

    return (
      item.title.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q) ||
      item.language.toLowerCase().includes(q) ||
      (item.ai_summary && item.ai_summary.toLowerCase().includes(q)) ||
      (item.tags && item.tags.some((tag) => tag.toLowerCase().includes(q)))
    );
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              AI Snippet & Bookmark Manager
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              คลังเก็บโค้ดและลิงก์ส่วนตัว พร้อม AI ตั้งชื่อ ตรวจจับภาษา สรุป และติดแท็กอัตโนมัติ
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, ภาษา, โค้ด หรือ tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </header>

        {/* Form เพิ่มข้อมูล */}
        <form onSubmit={handleSave} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="หัวข้อ (ปล่อยว่างได้ เดี๋ยว AI ตั้งชื่อให้)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'code' | 'link')}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="code">Code Snippet</option>
              <option value="link">Web Bookmark</option>
            </select>
            {type === 'code' && (
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="auto">✨ ให้ AI ตรวจจับภาษา</option>
                <option value="typescript">TypeScript / JS</option>
                <option value="python">Python</option>
                <option value="sql">SQL</option>
                <option value="bash">Bash / Terminal</option>
                <option value="html">HTML / CSS</option>
              </select>
            )}
          </div>

          <textarea
            rows={4}
            placeholder={type === 'code' ? 'วางโค้ดของคุณที่นี่...' : 'วาง URL เว็บไซต์ที่นี่ (https://...)'}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm font-mono focus:outline-none focus:border-indigo-500"
            required
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={statusText !== ''}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
            >
              {statusText ? <Sparkles className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {statusText || 'บันทึกและให้ AI วิเคราะห์'}
            </button>
          </div>
        </form>

        {/* แถบตัวกรองแยกตามประเภทและภาษา */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> ประเภท:
            </span>
            {(['all', 'code', 'link'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setFilterType(t);
                  if (t === 'link') setFilterLang('all');
                }}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                  filterType === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {t === 'all' ? `ทั้งหมด (${snippets.length})` : t === 'code' ? 'Code' : 'Bookmark'}
              </button>
            ))}
          </div>

          {filterType !== 'link' && availableLanguages.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 mr-1">ภาษา:</span>
              <button
                onClick={() => setFilterLang('all')}
                className={`text-xs px-2.5 py-1 rounded-md transition ${
                  filterLang === 'all'
                    ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                    : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
                }`}
              >
                ทุกภาษา
              </button>
              {availableLanguages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setFilterLang(lang)}
                  className={`text-xs px-2.5 py-1 rounded-md transition ${
                    filterLang === lang
                      ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                      : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* รายการที่บันทึกไว้ */}
        <section className="space-y-4">
          {loading ? (
            <p className="text-center text-slate-500 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</p>
          ) : filteredSnippets.length === 0 ? (
            <p className="text-center text-slate-500 py-8">ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา</p>
          ) : (
            filteredSnippets.map((item) => (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                {editingId === item.id ? (
                  /* --- โหมดแก้ไขข้อมูล (Edit Mode) --- */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-medium text-indigo-400 flex items-center gap-1.5">
                        <Pencil className="w-3.5 h-3.5" /> กำลังแก้ไขรายการ
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={cancelEditing}
                          className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition"
                        >
                          <X className="w-3.5 h-3.5" /> ยกเลิก
                        </button>
                        <button
                          onClick={() => handleUpdate(item.id)}
                          disabled={isUpdating}
                          className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium transition"
                        >
                          <Save className="w-3.5 h-3.5" /> {isUpdating ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="หัวข้อ"
                        className="flex-1 min-w-[200px] bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                      />
                      {item.type === 'code' && (
                        <input
                          type="text"
                          value={editLanguage}
                          onChange={(e) => setEditLanguage(e.target.value)}
                          placeholder="ภาษา เช่น typescript, python"
                          className="w-40 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
                        />
                      )}
                    </div>

                    <textarea
                      rows={5}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">คำอธิบายสรุป:</label>
                      <textarea
                        rows={2}
                        value={editSummary}
                        onChange={(e) => setEditSummary(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Tags (คั่นด้วยเครื่องหมายจุลภาค , ):</label>
                      <input
                        type="text"
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="เช่น react, hooks, api"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ) : (
                  /* --- โหมดแสดงผลปกติ (View Mode) --- */
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {item.type === 'code' ? (
                          <Code2 className="w-5 h-5 text-indigo-400 shrink-0" />
                        ) : (
                          <LinkIcon className="w-5 h-5 text-cyan-400 shrink-0" />
                        )}
                        <h2 className="font-semibold text-lg">{item.title}</h2>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full">
                          {item.language}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleCopy(item.id, item.content)}
                          className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 rounded-lg transition"
                          title="คัดลอก"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => startEditing(item)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 bg-slate-800/60 rounded-lg transition"
                          title="แก้ไข"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 bg-slate-800/60 rounded-lg transition"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* กล่องแสดงผลสรุปจาก AI พร้อมป้ายบอกชื่อโมเดล */}
                    {item.ai_summary && (
                      <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-lg p-3 space-y-2 text-sm text-indigo-200">
                        <div className="flex items-start gap-2.5">
                          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          <p className="flex-1">{item.ai_summary}</p>
                        </div>
                        {item.ai_model && (
                          <div className="flex justify-end">
                            <span className="text-[11px] font-mono text-indigo-300/80 bg-indigo-900/50 border border-indigo-500/20 px-2 py-0.5 rounded">
                              สรุปโดย {item.ai_model}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* แสดงโค้ดพร้อม Syntax Highlighting หรือแสดง URL */}
                    {item.type === 'code' ? (
                      <div className="rounded-lg overflow-hidden border border-slate-800/80 text-xs">
                        <SyntaxHighlighter
                          language={item.language === 'plaintext' ? 'text' : item.language}
                          style={vscDarkPlus}
                          showLineNumbers
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            backgroundColor: '#020617', // slate-950
                            fontSize: '0.8rem',
                          }}
                        >
                          {item.content}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <a
                        href={item.content}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm text-cyan-400 hover:underline truncate"
                      >
                        {item.content}
                      </a>
                    )}

                    {/* แสดง Tags ที่ AI สร้างให้ */}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        <Tag className="w-3.5 h-3.5 text-slate-500" />
                        {item.tags.map((tag, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSearch(tag)}
                            className="text-xs bg-slate-800/80 hover:bg-slate-700 text-cyan-300 px-2 py-0.5 rounded transition"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}