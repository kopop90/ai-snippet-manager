'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Code2, Link as LinkIcon, Plus, Search, Trash2, Copy, Check } from 'lucide-react';

interface Snippet {
  id: string;
  created_at: string;
  title: string;
  type: 'code' | 'link';
  content: string;
  language: string;
  ai_summary: string | null;
  tags: string[];
}

export default function Home() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'code' | 'link'>('code');
  const [language, setLanguage] = useState('typescript');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

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

  // บันทึกข้อมูลใหม่ลง Supabase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSaving(true);
    const { error } = await supabase.from('snippets').insert([
      {
        title,
        type,
        language: type === 'code' ? language : 'url',
        content,
        tags: [type, type === 'code' ? language : 'bookmark'],
      },
    ]);

    if (!error) {
      setTitle('');
      setContent('');
      fetchSnippets();
    } else {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
    setSaving(false);
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

  // กรองรายการตามช่องค้นหา
  const filteredSnippets = snippets.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              AI Snippet & Bookmark Manager
            </h1>
            <p className="text-slate-400 text-sm mt-1">คลังเก็บโค้ดและลิงก์ส่วนตัวของเด็ก IT</p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือ โค้ด..."
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
              placeholder="หัวข้อ (เช่น วิธีต่อ Supabase ใน Next.js)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              required
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
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" />
              {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </form>

        {/* รายการที่บันทึกไว้ */}
        <section className="space-y-4">
          {loading ? (
            <p className="text-center text-slate-500 py-8">กำลังโหลดข้อมูลจากฐานข้อมูล...</p>
          ) : filteredSnippets.length === 0 ? (
            <p className="text-center text-slate-500 py-8">ยังไม่มีรายการที่บันทึก ลองเพิ่มรายการแรกด้านบนเลย!</p>
          ) : (
            filteredSnippets.map((item) => (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(item.id, item.content)}
                      className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 rounded-lg transition"
                      title="คัดลอก"
                    >
                      {copiedId === item.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
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

                {item.type === 'code' ? (
                  <pre className="bg-slate-950 border border-slate-800/80 rounded-lg p-3.5 text-xs font-mono text-slate-300 overflow-x-auto">
                    <code>{item.content}</code>
                  </pre>
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
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}