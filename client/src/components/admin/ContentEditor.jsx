import { useState } from 'react'
import {
  LayoutList, Type, Code2, Plus, ChevronUp, ChevronDown, Trash2,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Content editor with THREE authoring modes — Blocks, Plain text, HTML.
// Always compiles to an HTML string (so the public site renders it unchanged via
// dangerouslySetInnerHTML), and remembers the chosen mode + its source so you can
// reopen in the same mode without lossy round-tripping.
//
//   value:   { html, format?, text?, blocks? }
//   onChange({ html, format, text, blocks })
// ─────────────────────────────────────────────────────────────────────────────

const esc = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const uid = () => Math.random().toString(36).slice(2, 8)

const BLOCK_TYPES = [
  { type: 'h2', label: 'Heading', sample: 'Section heading' },
  { type: 'h3', label: 'Subheading', sample: 'Subheading' },
  { type: 'p', label: 'Text', sample: '' },
  { type: 'ul', label: 'List', sample: 'First item\nSecond item' },
  { type: 'quote', label: 'Quote', sample: 'A standout quote.' },
  { type: 'img', label: 'Image', sample: '' },
  { type: 'button', label: 'Button', sample: 'Learn more' },
]

function blockToHtml(b) {
  switch (b.type) {
    case 'h2': return `<h2>${esc(b.text || '')}</h2>`
    case 'h3': return `<h3>${esc(b.text || '')}</h3>`
    case 'p': return `<p>${esc(b.text || '').replace(/\n/g, '<br>')}</p>`
    case 'ul': return `<ul>${(b.text || '').split('\n').map((s) => s.trim()).filter(Boolean).map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`
    case 'quote': return `<blockquote><p>${esc(b.text || '')}</p></blockquote>`
    case 'img': return b.url ? `<img src="${b.url}" alt="${esc(b.alt || '')}" />` : ''
    case 'button': return b.href ? `<p><a href="${b.href}">${esc(b.text || 'Learn more')}</a></p>` : ''
    default: return ''
  }
}
const blocksToHtml = (blocks) => blocks.map(blockToHtml).filter(Boolean).join('\n')
const textToHtml = (t = '') => t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n')

const stripInline = (s = '') =>
  s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
const htmlToText = (h = '') =>
  h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h2|h3|li|blockquote)>/gi, '\n\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim()

// Best-effort HTML → blocks (so switching into Blocks mode keeps your content).
function htmlToBlocks(html = '') {
  const out = []
  const re = /<(h2|h3|p|ul|ol|blockquote)\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*>/gi
  let m
  while ((m = re.exec(html))) {
    if (m[0].toLowerCase().startsWith('<img')) {
      const src = (m[0].match(/src="([^"]+)"/) || [])[1]
      const alt = (m[0].match(/alt="([^"]*)"/) || [])[1] || ''
      if (src) out.push({ id: uid(), type: 'img', url: src.replace(/^%BASE%/, '/'), alt })
      continue
    }
    const tag = m[1].toLowerCase(); const inner = m[2]
    if (tag === 'h2' || tag === 'h3') out.push({ id: uid(), type: tag, text: stripInline(inner) })
    else if (tag === 'p') out.push({ id: uid(), type: 'p', text: stripInline(inner) })
    else if (tag === 'blockquote') out.push({ id: uid(), type: 'quote', text: stripInline(inner) })
    else if (tag === 'ul' || tag === 'ol') out.push({ id: uid(), type: 'ul', text: [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => stripInline(x[1])).join('\n') })
  }
  if (out.length) return out
  const t = htmlToText(html)
  return t ? [{ id: uid(), type: 'p', text: t }] : [{ id: uid(), type: 'p', text: '' }]
}

const inputCls = 'w-full rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-brand focus:outline-none'

export default function ContentEditor({ value = {}, onChange }) {
  const initialHtml = value.html || ''
  const [mode, setMode] = useState(value.format || (value.blocks?.length ? 'blocks' : initialHtml ? 'html' : 'blocks'))
  const [blocks, setBlocks] = useState(value.blocks?.length ? value.blocks.map((b) => ({ id: uid(), ...b })) : (initialHtml ? htmlToBlocks(initialHtml) : [{ id: uid(), type: 'p', text: '' }]))
  const [text, setText] = useState(value.text ?? (value.format === 'text' ? htmlToText(initialHtml) : ''))
  const [raw, setRaw] = useState(initialHtml)

  // Compile current mode → html and bubble up.
  const emit = (next = {}) => {
    const m = next.mode ?? mode
    const bl = next.blocks ?? blocks
    const tx = next.text ?? text
    const rw = next.raw ?? raw
    const html = m === 'blocks' ? blocksToHtml(bl) : m === 'text' ? textToHtml(tx) : rw
    onChange?.({ html, format: m, text: tx, blocks: bl.map(({ id, ...b }) => b) })
  }

  const switchMode = (m) => {
    if (m === mode) return
    const currentHtml = mode === 'blocks' ? blocksToHtml(blocks) : mode === 'text' ? textToHtml(text) : raw
    if (m === 'blocks') { const b = htmlToBlocks(currentHtml); setBlocks(b); setMode('blocks'); emit({ mode: 'blocks', blocks: b }) }
    else if (m === 'text') { const t = htmlToText(currentHtml); setText(t); setMode('text'); emit({ mode: 'text', text: t }) }
    else { setRaw(currentHtml); setMode('html'); emit({ mode: 'html', raw: currentHtml }) }
  }

  const setBlock = (id, patch) => {
    const b = blocks.map((x) => (x.id === id ? { ...x, ...patch } : x)); setBlocks(b); emit({ blocks: b })
  }
  const addBlock = (type) => {
    const def = BLOCK_TYPES.find((t) => t.type === type)
    const nb = { id: uid(), type, text: def?.sample || '', url: '', alt: '', href: '' }
    const b = [...blocks, nb]; setBlocks(b); emit({ blocks: b })
  }
  const move = (id, dir) => {
    const i = blocks.findIndex((x) => x.id === id); const j = i + dir
    if (j < 0 || j >= blocks.length) return
    const b = blocks.slice(); [b[i], b[j]] = [b[j], b[i]]; setBlocks(b); emit({ blocks: b })
  }
  const remove = (id) => { const b = blocks.filter((x) => x.id !== id); setBlocks(b); emit({ blocks: b }) }

  const TABS = [
    { id: 'blocks', label: 'Blocks', icon: LayoutList },
    { id: 'text', label: 'Plain text', icon: Type },
    { id: 'html', label: 'HTML', icon: Code2 },
  ]

  return (
    <div className="rounded-lg border border-white/10 bg-black/20">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 border-b border-white/8 p-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => switchMode(id)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold ${mode === id ? 'bg-brand text-white' : 'text-slate-400 hover:bg-white/8 hover:text-white'}`}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <div className="p-3">
        {mode === 'blocks' && (
          <div className="space-y-2">
            {blocks.map((b, i) => (
              <div key={b.id} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{BLOCK_TYPES.find((t) => t.type === b.type)?.label || b.type}</span>
                  <div className="flex items-center gap-1 text-slate-600">
                    <button type="button" onClick={() => move(b.id, -1)} disabled={i === 0} className="hover:text-white disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button type="button" onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1} className="hover:text-white disabled:opacity-30"><ChevronDown size={14} /></button>
                    <button type="button" onClick={() => remove(b.id)} className="hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                </div>
                {b.type === 'img' ? (
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input className={inputCls} placeholder="Image URL" value={b.url || ''} onChange={(e) => setBlock(b.id, { url: e.target.value })} />
                    <input className={inputCls} placeholder="Alt text" value={b.alt || ''} onChange={(e) => setBlock(b.id, { alt: e.target.value })} />
                  </div>
                ) : b.type === 'button' ? (
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input className={inputCls} placeholder="Button label" value={b.text || ''} onChange={(e) => setBlock(b.id, { text: e.target.value })} />
                    <input className={inputCls} placeholder="Link (/contact or https://…)" value={b.href || ''} onChange={(e) => setBlock(b.id, { href: e.target.value })} />
                  </div>
                ) : (b.type === 'h2' || b.type === 'h3') ? (
                  <input className={inputCls} placeholder="Heading text" value={b.text || ''} onChange={(e) => setBlock(b.id, { text: e.target.value })} />
                ) : (
                  <textarea className={`${inputCls} resize-none`} rows={b.type === 'ul' ? 3 : 2} placeholder={b.type === 'ul' ? 'One item per line' : 'Write…'} value={b.text || ''} onChange={(e) => setBlock(b.id, { text: e.target.value })} />
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mr-1">Add</span>
              {BLOCK_TYPES.map((t) => (
                <button key={t.type} type="button" onClick={() => addBlock(t.type)} className="flex items-center gap-1 rounded border border-white/12 px-2 py-1 text-[11px] text-slate-300 hover:border-brand/50 hover:text-white">
                  <Plus size={11} /> {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'text' && (
          <textarea className={`${inputCls} resize-none`} rows={8} placeholder="Write in plain text. Leave a blank line between paragraphs." value={text} onChange={(e) => { setText(e.target.value); emit({ text: e.target.value }) }} />
        )}

        {mode === 'html' && (
          <textarea className={`${inputCls} resize-none font-mono text-xs`} rows={8} placeholder="<p>Raw HTML…</p>" value={raw} onChange={(e) => { setRaw(e.target.value); emit({ raw: e.target.value }) }} />
        )}
      </div>
    </div>
  )
}
