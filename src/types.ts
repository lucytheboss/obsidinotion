// ─── Property Types ───────────────────────────────────────────────────────────

export type PropType =
  | 'text' | 'number' | 'checkbox' | 'date'
  | 'select' | 'multi_select' | 'url' | 'email';

export const PROP_ICON: Record<PropType, string> = {
  text:         'Aa',
  number:       '#',
  checkbox:     '✓',
  date:         '📅',
  select:       '◉',
  multi_select: '◈',
  url:          '🔗',
  email:        '✉',
};

export type TagColor =
  | 'default' | 'gray' | 'brown' | 'orange' | 'yellow'
  | 'green' | 'blue' | 'purple' | 'pink' | 'red';

export const TAG_COLORS: TagColor[] = [
  'default','gray','brown','orange','yellow',
  'green','blue','purple','pink','red',
];

export interface SelectOption {
  id: string;
  label: string;
  color: TagColor;
}

export interface Property {
  id: string;       // for sourced DBs: id === frontmatter key (or '_title')
  label: string;
  type: PropType;
  width?: number;
  hidden?: boolean;
  options?: SelectOption[];
  coverProp?: boolean;
}

// ─── Source ───────────────────────────────────────────────────────────────────

export interface DbSource {
  type: 'folder';
  folder: string;          // vault-relative path, e.g. "Projects" or "Projects/2024"
  groupByFolder?: boolean; // group & sort rows by their subfolder
}

// ─── Row ─────────────────────────────────────────────────────────────────────

export interface Row {
  _id: string;          // unique — for manual: random id; for sourced: file.path
  _filePath?: string;   // set for sourced rows
  _title?: string;      // file basename (no extension) for sourced rows
  [key: string]: any;
}

// ─── Views ───────────────────────────────────────────────────────────────────

export type ViewType = 'table' | 'board' | 'gallery';

export interface FilterRule {
  propId: string;
  op: 'contains' | 'equals' | 'is_empty' | 'is_not_empty' | 'gt' | 'lt'
    | 'does_not_contain' | 'is_not' | 'starts_with' | 'neq' | 'gte' | 'lte'
    | 'is_checked' | 'is_not_checked' | 'is_before' | 'is_after';
  value: string;
}

export interface SortRule {
  propId: string;
  dir: 'asc' | 'desc';
}

export interface ViewConfig {
  id: string;
  label: string;
  type: ViewType;
  groupBy?: string;
  filters?: FilterRule[];
  sorts?: SortRule[];
}

// ─── Schema ──────────────────────────────────────────────────────────────────

export interface DbSchema {
  title: string;
  hideTitle?: boolean;
  source?: DbSource;       // if set: rows come from vault, not schema.rows
  properties: Property[];
  rows: Row[];             // only used when source is NOT set
  views: ViewConfig[];
  activeViewId: string;
  _search?: string;        // transient search query
}

export function emptySchema(): DbSchema {
  const viewId = makeId();
  return {
    title: 'Untitled',
    properties: [{ id: makeId(), label: 'Name', type: 'text', width: 280 }],
    rows: [],
    views: [{ id: viewId, label: 'Table', type: 'table' }],
    activeViewId: viewId,
  };
}

export function parseSchema(raw: string): DbSchema {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '{}') return emptySchema();
  try {
    const p = JSON.parse(trimmed);
    if (!Array.isArray(p.views) || p.views.length === 0) {
      const viewId = makeId();
      p.views = [{ id: viewId, label: 'Table', type: 'table' }];
      p.activeViewId = viewId;
    }
    return {
      title:        p.title        ?? 'Untitled',
      hideTitle:    p.hideTitle    ?? false,
      source:       p.source       ?? undefined,
      properties:   Array.isArray(p.properties) ? p.properties : [],
      rows:         Array.isArray(p.rows)        ? p.rows       : [],
      views:        p.views,
      activeViewId: p.activeViewId ?? p.views[0].id,
    };
  } catch { return emptySchema(); }
}

export function serializeSchema(s: DbSchema): string {
  return JSON.stringify(s, null, 2);
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function makeSelectOption(label: string): SelectOption {
  const colors: TagColor[] = ['blue','green','orange','pink','purple','red','yellow','gray'];
  return { id: makeId(), label, color: colors[Math.floor(Math.random() * colors.length)] };
}

// Frontmatter keys to skip when auto-detecting properties
export const SKIP_FM_KEYS = new Set([
  'position','cssclass','cssClasses','banner','icon','publish','tags','aliases',
]);

// Infer a property type from a sample frontmatter value
export function inferType(value: any): PropType {
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number')  return 'number';
  if (Array.isArray(value))       return 'multi_select';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value))               return 'date';
    if (/^https?:\/\//.test(value))                      return 'url';
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))       return 'email';
  }
  return 'text';
}
