import { createContext } from 'preact';
import { useContext, useReducer, useCallback, useState, useEffect } from 'preact/hooks';
import { App, TFile, TFolder } from 'obsidian';
import { MarkdownSectionInformation } from 'obsidian';
import {
  DbSchema, Row, Property, ViewConfig, FilterRule, SortRule,
  DbSource, makeId, makeSelectOption, inferType, SKIP_FM_KEYS,
} from './types';
import { saveSchema } from './persist';

// ─── Actions ─────────────────────────────────────────────────────────────────

export type Action =
  | { type: 'SET_TITLE'; title: string }
  | { type: 'SET_ACTIVE_VIEW'; viewId: string }
  | { type: 'ADD_VIEW'; view: ViewConfig }
  | { type: 'UPDATE_VIEW'; view: ViewConfig }
  | { type: 'DELETE_VIEW'; viewId: string }
  | { type: 'ADD_ROW'; row?: Partial<Row> }
  | { type: 'UPDATE_CELL'; rowId: string; propId: string; value: any }
  | { type: 'DELETE_ROW'; rowId: string }
  | { type: 'ADD_PROPERTY'; prop: Property }
  | { type: 'UPDATE_PROPERTY'; prop: Property }
  | { type: 'DELETE_PROPERTY'; propId: string }
  | { type: 'UPDATE_SOURCE'; patch: Partial<DbSource> }
  | { type: 'TOGGLE_TITLE' }
  | { type: 'SET_SCHEMA'; schema: DbSchema }
  | { type: 'MOVE_ROW'; rowId: string; afterId: string | null }
  | { type: 'DUPLICATE_ROW'; rowId: string }
  | { type: 'SET_SEARCH'; query: string };

function reducer(state: DbSchema, action: Action): DbSchema {
  switch (action.type) {
    case 'SET_SEARCH':
      return { ...state, _search: action.query } as any; // Temporary UI state in schema object
    case 'SET_TITLE':
      return { ...state, title: action.title };
    case 'SET_ACTIVE_VIEW':
      return { ...state, activeViewId: action.viewId };
    case 'ADD_VIEW':
      return { ...state, views: [...state.views, action.view] };
    case 'UPDATE_VIEW':
      return { ...state, views: state.views.map(v => v.id === action.view.id ? action.view : v) };
    case 'DELETE_VIEW': {
      const views = state.views.filter(v => v.id !== action.viewId);
      return { ...state, views, activeViewId: state.activeViewId === action.viewId ? (views[0]?.id ?? '') : state.activeViewId };
    }
    case 'ADD_ROW':
      return { ...state, rows: [...state.rows, { _id: makeId(), ...action.row }] };
    case 'UPDATE_CELL':
      return { ...state, rows: state.rows.map(r => r._id === action.rowId ? { ...r, [action.propId]: action.value } : r) };
    case 'DELETE_ROW':
      return { ...state, rows: state.rows.filter(r => r._id !== action.rowId) };
    case 'ADD_PROPERTY':
      return { ...state, properties: [...state.properties, action.prop] };
    case 'UPDATE_PROPERTY':
      return { ...state, properties: state.properties.map(p => p.id === action.prop.id ? action.prop : p) };
    case 'DELETE_PROPERTY':
      return { ...state, properties: state.properties.filter(p => p.id !== action.propId) };
    case 'UPDATE_SOURCE':
      return state.source ? { ...state, source: { ...state.source, ...action.patch } } : state;
    case 'TOGGLE_TITLE':
      return { ...state, hideTitle: !state.hideTitle };
    case 'SET_SCHEMA':
      return action.schema;
    case 'MOVE_ROW': {
      const moving = state.rows.find(r => r._id === action.rowId);
      if (!moving) return state;
      const rest = state.rows.filter(r => r._id !== action.rowId);
      if (action.afterId === null) return { ...state, rows: [moving, ...rest] };
      const idx = rest.findIndex(r => r._id === action.afterId);
      rest.splice(idx + 1, 0, moving);
      return { ...state, rows: rest };
    }
    case 'DUPLICATE_ROW': {
      const src = state.rows.find(r => r._id === action.rowId);
      if (!src) return state;
      const copy = { ...src, _id: makeId() };
      const idx = state.rows.findIndex(r => r._id === action.rowId);
      const rows = [...state.rows];
      rows.splice(idx + 1, 0, copy);
      return { ...state, rows };
    }
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface StoreCtx {
  schema: DbSchema;
  app: App;
  dispatch: (action: Action) => void;
  save: (s: DbSchema) => Promise<void>;
}

export const StoreContext = createContext<StoreCtx>(null as any);
export function useStore() { return useContext(StoreContext); }

interface StoreProviderProps {
  initialSchema: DbSchema;
  filePath: string;
  info: MarkdownSectionInformation;
  app: App;
  children: any;
}

export function StoreProvider({ initialSchema, filePath, info, app, children }: StoreProviderProps) {
  const [schema, dispatch] = useReducer(reducer, initialSchema);

  const save = useCallback(async (s: DbSchema) => {
    await saveSchema(app, filePath, s, info);
  }, [app, filePath, info]);

  const dispatchAndSave = useCallback(async (action: Action) => {
    // Sourced rows: UPDATE_CELL writes to frontmatter instead of schema.rows
    if (action.type === 'UPDATE_CELL' && schema.source) {
      const file = app.vault.getFileByPath(action.rowId);
      if (file instanceof TFile) {
        await (app as any).fileManager.processFrontMatter(file, (fm: Record<string, any>) => {
          fm[action.propId] = action.value;
        });
      }
      return;
    }
    dispatch(action);
    const next = reducer(schema, action);
    await save(next);
  }, [schema, save, app]);

  return (
    <StoreContext.Provider value={{ schema, app, dispatch: dispatchAndSave as any, save }}>
      {children}
    </StoreContext.Provider>
  );
}

// ─── Live rows from vault ─────────────────────────────────────────────────────

const SUPPORTED_EXTS = new Set(['md', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp4', 'mov', 'mp3', 'wav', 'txt', 'canvas']);

export function fetchSourcedRows(app: App, source: DbSource): Row[] {
  // Normalise: strip leading/trailing slashes
  const folder = source.folder.replace(/^\//, '').replace(/\/$/, '');
  return app.vault.getFiles()
    .filter(f => {
      if (!SUPPORTED_EXTS.has(f.extension.toLowerCase())) return false;
      if (!folder) return true;
      return f.path.startsWith(folder + '/');
    })
    .map(f => {
      // Only markdown files have frontmatter
      const cache = f.extension === 'md'
        ? (app as any).metadataCache.getFileCache(f)
        : null;
      const fm: Record<string, any> = cache?.frontmatter ?? {};

      // _folder: subfolder relative to source root ('' = directly inside source folder)
      const relativePath = folder ? f.path.slice(folder.length + 1) : f.path;
      const slashIdx = relativePath.lastIndexOf('/');
      const subFolder = slashIdx === -1 ? '' : relativePath.slice(0, slashIdx);

      const row: Row = { _id: f.path, _filePath: f.path, _title: f.basename, _folder: subFolder, _ext: f.extension };
      for (const [k, v] of Object.entries(fm)) {
        if (SKIP_FM_KEYS.has(k) || k === 'position') continue;
        row[k] = v;
      }
      return row;
    });
}

/** Hook: returns live rows. For sourced DBs, queries vault and re-renders on changes. */
export function useRows(): Row[] {
  const { schema, app } = useStore();

  const [liveRows, setLiveRows] = useState<Row[]>(() =>
    schema.source ? fetchSourcedRows(app, schema.source) : []
  );

  useEffect(() => {
    if (!schema.source) return;
    const refresh = () => setLiveRows(fetchSourcedRows(app, schema.source!));
    refresh();
    const mc = (app as any).metadataCache;
    const vault = app.vault;
    const r1 = mc.on('changed', refresh);
    const r2 = vault.on('create', refresh);
    const r3 = vault.on('delete', refresh);
    const r4 = vault.on('rename', refresh);
    return () => {
      mc.offref(r1); vault.offref(r2); vault.offref(r3); vault.offref(r4);
    };
  }, [schema.source?.folder]);

  return schema.source ? liveRows : schema.rows;
}

// ─── Auto-detect properties from folder ──────────────────────────────────────

export function autoDetectProperties(app: App, source: DbSource): Property[] {
  const rows = fetchSourcedRows(app, source);

  // Count key frequency and collect sample values
  const freq = new Map<string, number>();
  const samples = new Map<string, any>();
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (k.startsWith('_')) continue;
      freq.set(k, (freq.get(k) ?? 0) + 1);
      if (!samples.has(k) && v != null) samples.set(k, v);
    }
  }

  const props: Property[] = [
    // First column: file name (always)
    { id: '_title', label: 'Name', type: 'text', width: 280 },
  ];

  // Sort by frequency desc, add as properties
  [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([key]) => {
      props.push({
        id: key,
        label: key,
        type: inferType(samples.get(key)),
        width: 160,
      });
    });

  return props;
}

// ─── Derived helpers ─────────────────────────────────────────────────────────

export function applyFilters(rows: Row[], filters: FilterRule[]): Row[] {
  if (!filters || filters.length === 0) return rows;
  return rows.filter(row => filters.every(f => {
    const val = f.propId === '_folder' ? (row['_folder'] ?? '') : row[f.propId];
    const str = val == null ? '' : String(val).toLowerCase();
    const fv  = f.value.toLowerCase();
    switch (f.op) {
      case 'contains':         return str.includes(fv);
      case 'does_not_contain': return !str.includes(fv);
      case 'equals':           return str === fv;
      case 'is_not':           return str !== fv;
      case 'starts_with':      return str.startsWith(fv);
      case 'is_empty':         return val == null || str === '';
      case 'is_not_empty':     return val != null && str !== '';
      case 'gt':               return parseFloat(str) > parseFloat(fv);
      case 'lt':               return parseFloat(str) < parseFloat(fv);
      case 'gte':              return parseFloat(str) >= parseFloat(fv);
      case 'lte':              return parseFloat(str) <= parseFloat(fv);
      case 'neq':              return parseFloat(str) !== parseFloat(fv);
      case 'is_checked':       return val === true || val === 'true' || val === 1;
      case 'is_not_checked':   return val !== true && val !== 'true' && val !== 1;
      case 'is_before':        return str < fv;
      case 'is_after':         return str > fv;
      default:                 return true;
    }
  }));
}

export function applySearch(rows: Row[], query: string): Row[] {
  if (!query) return rows;
  const q = query.toLowerCase();
  return rows.filter(row => {
    // Check title/ID and all properties
    if ((row._title ?? '').toLowerCase().includes(q)) return true;
    for (const [k, v] of Object.entries(row)) {
      if (k.startsWith('_')) continue;
      if (v != null && String(v).toLowerCase().includes(q)) return true;
    }
    return false;
  });
}

export function applySorts(rows: Row[], sorts: SortRule[]): Row[] {
  if (!sorts || sorts.length === 0) return rows;
  return [...rows].sort((a, b) => {
    for (const s of sorts) {
      const av = a[s.propId] ?? '';
      const bv = b[s.propId] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      if (cmp !== 0) return s.dir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
}
