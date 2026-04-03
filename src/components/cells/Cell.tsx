import { h, Fragment } from 'preact';
import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import { Property, SelectOption, TagColor, TAG_COLORS, makeId, makeSelectOption } from '../../types';
import { useStore } from '../../store';

interface CellProps {
  prop: Property;
  rowId: string;
  value: any;
  readonly?: boolean;
}

export function Cell({ prop, rowId, value, readonly }: CellProps) {
  const { dispatch } = useStore();

  const commit = useCallback((v: any) => {
    dispatch({ type: 'UPDATE_CELL', rowId, propId: prop.id, value: v });
  }, [dispatch, rowId, prop.id]);

  if (readonly) return <ReadonlyCell prop={prop} value={value} />;

  switch (prop.type) {
    case 'text':    return <TextCell value={value} commit={commit} />;
    case 'number':  return <NumberCell value={value} commit={commit} />;
    case 'checkbox':return <CheckboxCell value={value} commit={commit} />;
    case 'date':    return <DateCell value={value} commit={commit} />;
    case 'select':  return <SelectCell prop={prop} value={value} commit={commit} />;
    case 'multi_select': return <MultiSelectCell prop={prop} value={value} commit={commit} />;
    case 'url':     return <UrlCell value={value} commit={commit} />;
    case 'email':   return <EmailCell value={value} commit={commit} />;
    default:        return <TextCell value={value} commit={commit} />;
  }
}

// ─── Readonly ────────────────────────────────────────────────────────────────

function ReadonlyCell({ prop, value }: { prop: Property; value: any }) {
  if (prop.type === 'checkbox') return <span class="ne-cell-checkbox">{value ? '✓' : ''}</span>;
  if (prop.type === 'select' && value) {
    const opt = prop.options?.find(o => o.id === value || o.label === value);
    return <Tag opt={opt ?? { id: '', label: String(value), color: 'default' }} />;
  }
  if (prop.type === 'multi_select' && Array.isArray(value)) {
    return (
      <span class="ne-cell-tags">
        {value.map((v: string) => {
          const opt = prop.options?.find(o => o.id === v || o.label === v);
          return <Tag key={v} opt={opt ?? { id: v, label: v, color: 'default' }} />;
        })}
      </span>
    );
  }
  if (prop.type === 'url' && value) return <a href={value} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{value}</a>;
  if (prop.type === 'email' && value) return <a href={`mailto:${value}`} onClick={e => e.stopPropagation()}>{value}</a>;
  return <span>{value ?? ''}</span>;
}

// ─── Text ────────────────────────────────────────────────────────────────────

function TextCell({ value, commit }: { value: any; commit: (v: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const start = () => { setDraft(value ?? ''); setEditing(true); };
  const end   = () => { commit(draft); setEditing(false); };

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <input
        ref={ref}
        class="ne-cell-input"
        value={draft}
        onInput={e => setDraft((e.target as HTMLInputElement).value)}
        onBlur={end}
        onKeyDown={e => { if (e.key === 'Enter') end(); if (e.key === 'Escape') setEditing(false); }}
      />
    );
  }
  return <span class="ne-cell-text" onClick={start}>{value ?? <span class="ne-cell-empty" />}</span>;
}

// ─── Number ──────────────────────────────────────────────────────────────────

function NumberCell({ value, commit }: { value: any; commit: (v: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const start = () => { setDraft(value != null ? String(value) : ''); setEditing(true); };
  const end   = () => { const n = parseFloat(draft); commit(isNaN(n) ? null : n); setEditing(false); };

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        class="ne-cell-input ne-cell-number"
        value={draft}
        onInput={e => setDraft((e.target as HTMLInputElement).value)}
        onBlur={end}
        onKeyDown={e => { if (e.key === 'Enter') end(); if (e.key === 'Escape') setEditing(false); }}
      />
    );
  }
  return <span class="ne-cell-text ne-cell-number" onClick={start}>{value ?? <span class="ne-cell-empty" />}</span>;
}

// ─── Checkbox ────────────────────────────────────────────────────────────────

function CheckboxCell({ value, commit }: { value: any; commit: (v: any) => void }) {
  return (
    <span class="ne-cell-checkbox-wrap" onClick={() => commit(!value)}>
      <span class={`ne-cell-checkbox ${value ? 'is-checked' : ''}`}>{value ? '✓' : ''}</span>
    </span>
  );
}

// ─── Date ────────────────────────────────────────────────────────────────────

function DateCell({ value, commit }: { value: any; commit: (v: any) => void }) {
  return (
    <input
      type="date"
      class="ne-cell-input ne-cell-date"
      value={value ?? ''}
      onChange={e => commit((e.target as HTMLInputElement).value || null)}
    />
  );
}

// ─── URL / Email ─────────────────────────────────────────────────────────────

function UrlCell({ value, commit }: { value: any; commit: (v: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const start = () => { setDraft(value ?? ''); setEditing(true); };
  const end   = () => { commit(draft || null); setEditing(false); };

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <input ref={ref} class="ne-cell-input" type="url" value={draft}
        onInput={e => setDraft((e.target as HTMLInputElement).value)}
        onBlur={end} onKeyDown={e => { if (e.key === 'Enter') end(); if (e.key === 'Escape') setEditing(false); }} />
    );
  }
  if (value) return <a class="ne-cell-link" href={value} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{value}</a>;
  return <span class="ne-cell-text" onClick={start}><span class="ne-cell-empty" /></span>;
}

function EmailCell({ value, commit }: { value: any; commit: (v: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const start = () => { setDraft(value ?? ''); setEditing(true); };
  const end   = () => { commit(draft || null); setEditing(false); };

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  if (editing) {
    return (
      <input ref={ref} class="ne-cell-input" type="email" value={draft}
        onInput={e => setDraft((e.target as HTMLInputElement).value)}
        onBlur={end} onKeyDown={e => { if (e.key === 'Enter') end(); if (e.key === 'Escape') setEditing(false); }} />
    );
  }
  if (value) return <a class="ne-cell-link" href={`mailto:${value}`} onClick={e => e.stopPropagation()}>{value}</a>;
  return <span class="ne-cell-text" onClick={start}><span class="ne-cell-empty" /></span>;
}

// ─── Select ──────────────────────────────────────────────────────────────────

function SelectCell({ prop, value, commit }: { prop: Property; value: any; commit: (v: any) => void }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const opts = prop.options ?? [];
  const filtered = opts.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const current = opts.find(o => o.id === value);

  const select = (opt: SelectOption) => {
    commit(opt.id === value ? null : opt.id);
    setOpen(false);
  };

  const createOpt = () => {
    const label = search.trim();
    if (!label) return;
    const opt = makeSelectOption(label);
    const updated = { ...prop, options: [...(prop.options ?? []), opt] };
    dispatch({ type: 'UPDATE_PROPERTY', prop: updated });
    commit(opt.id);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={ref} class="ne-cell-select">
      <div class="ne-cell-select-trigger" onClick={() => setOpen(o => !o)}>
        {current ? <Tag opt={current} /> : <span class="ne-cell-empty" />}
      </div>
      {open && (
        <div class="ne-popover ne-select-popover">
          <input
            class="ne-popover-search"
            placeholder="Search or create..."
            value={search}
            onInput={e => setSearch((e.target as HTMLInputElement).value)}
            autoFocus
          />
          <div class="ne-popover-opts">
            {filtered.map(opt => (
              <div key={opt.id} class={`ne-popover-opt ${opt.id === value ? 'is-selected' : ''}`}
                onClick={() => select(opt)}>
                <Tag opt={opt} />
                {opt.id === value && <span class="ne-check">✓</span>}
              </div>
            ))}
            {search && !filtered.find(o => o.label.toLowerCase() === search.toLowerCase()) && (
              <div class="ne-popover-create" onClick={createOpt}>
                Create <Tag opt={{ id: '', label: search, color: 'blue' }} />
              </div>
            )}
          </div>
          <div class="ne-popover-color-section">
            {current && <ColorPicker opt={current} prop={prop} dispatch={dispatch} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Multi-select ────────────────────────────────────────────────────────────

function MultiSelectCell({ prop, value, commit }: { prop: Property; value: any; commit: (v: any) => void }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected: string[] = Array.isArray(value) ? value : [];
  const opts = prop.options ?? [];
  const filtered = opts.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const toggle = (optId: string) => {
    const next = selected.includes(optId)
      ? selected.filter(id => id !== optId)
      : [...selected, optId];
    commit(next.length ? next : null);
  };

  const createOpt = () => {
    const label = search.trim();
    if (!label) return;
    const opt = makeSelectOption(label);
    const updated = { ...prop, options: [...(prop.options ?? []), opt] };
    dispatch({ type: 'UPDATE_PROPERTY', prop: updated });
    commit([...selected, opt.id]);
    setSearch('');
  };

  return (
    <div ref={ref} class="ne-cell-select">
      <div class="ne-cell-select-trigger ne-cell-multi" onClick={() => setOpen(o => !o)}>
        {selected.length === 0
          ? <span class="ne-cell-empty" />
          : selected.map(id => {
              const opt = opts.find(o => o.id === id);
              return opt ? <Tag key={id} opt={opt} /> : null;
            })
        }
      </div>
      {open && (
        <div class="ne-popover ne-select-popover">
          <input
            class="ne-popover-search"
            placeholder="Search or create..."
            value={search}
            onInput={e => setSearch((e.target as HTMLInputElement).value)}
            autoFocus
          />
          <div class="ne-popover-opts">
            {filtered.map(opt => (
              <div key={opt.id} class={`ne-popover-opt ${selected.includes(opt.id) ? 'is-selected' : ''}`}
                onClick={() => toggle(opt.id)}>
                <Tag opt={opt} />
                {selected.includes(opt.id) && <span class="ne-check">✓</span>}
              </div>
            ))}
            {search && !filtered.find(o => o.label.toLowerCase() === search.toLowerCase()) && (
              <div class="ne-popover-create" onClick={createOpt}>
                Create <Tag opt={{ id: '', label: search, color: 'blue' }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function Tag({ opt }: { opt: SelectOption }) {
  return <span class={`ne-tag ne-tag-${opt.color}`}>{opt.label}</span>;
}

function ColorPicker({ opt, prop, dispatch }: { opt: SelectOption; prop: Property; dispatch: any }) {
  const setColor = (color: TagColor) => {
    const updatedOpts = (prop.options ?? []).map(o => o.id === opt.id ? { ...o, color } : o);
    dispatch({ type: 'UPDATE_PROPERTY', prop: { ...prop, options: updatedOpts } });
  };
  return (
    <div class="ne-color-picker">
      <span class="ne-color-label">Color</span>
      <div class="ne-color-swatches">
        {TAG_COLORS.map(c => (
          <div key={c} class={`ne-color-swatch ne-tag-${c} ${c === opt.color ? 'is-active' : ''}`}
            onClick={() => setColor(c)} />
        ))}
      </div>
    </div>
  );
}
