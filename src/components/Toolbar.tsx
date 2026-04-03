import { h } from 'preact';
import { useState } from 'preact/hooks';
import { ViewConfig, ViewType, FilterRule, SortRule, Property, PropType, PROP_ICON, makeId } from '../types';
import { useStore, applyFilters } from '../store';

const ICON_FOLDER = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>;
const ICON_FILTER = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
const ICON_SORT   = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>;
const ICON_PROPS  = <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;

const VIEW_ICONS: Record<ViewType, any> = {
  table: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/></svg>,
  board: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 9v12"/><path d="M15 9v12"/></svg>,
  gallery: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 12h18"/><path d="M12 3v18"/></svg>,
};

export function Toolbar() {
  const { schema, dispatch } = useStore();
  const [panel, setPanel] = useState<'filter' | 'sort' | 'props' | null>(null);

  const view = schema.views.find(v => v.id === schema.activeViewId)!;
  const togglePanel = (p: typeof panel) => setPanel(prev => prev === p ? null : p);

  return (
    <div class="ne-toolbar">
      <div class="ne-view-tabs">
        {schema.views.map(v => (
          <ViewTab key={v.id} view={v} active={v.id === schema.activeViewId} />
        ))}
        <AddViewButton />
      </div>

      <div class="ne-toolbar-actions">
        <div class="ne-search-wrap">
          <span class="ne-search-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
          <input
            class="ne-search-input"
            placeholder="Search..."
            value={schema._search ?? ''}
            onInput={e => dispatch({ type: 'SET_SEARCH', query: (e.target as HTMLInputElement).value })}
          />
        </div>

        {schema.source && (
          <button
            class={`ne-tool-btn ne-tool-icon ${schema.source.groupByFolder ? 'is-active' : ''}`}
            onClick={() => dispatch({ type: 'UPDATE_SOURCE', patch: { groupByFolder: !schema.source!.groupByFolder } })}
            title="Folders: Toggle grouping by subfolder"
          >
            {ICON_FOLDER}
          </button>
        )}
        <button class={`ne-tool-btn ne-tool-icon ${panel === 'filter' ? 'is-active' : ''}`}
          onClick={() => togglePanel('filter')}
          title="Filter">
          {ICON_FILTER} {(view.filters?.length ?? 0) > 0 && <span class="ne-badge">{view.filters!.length}</span>}
        </button>
        <button class={`ne-tool-btn ne-tool-icon ${panel === 'sort' ? 'is-active' : ''}`}
          onClick={() => togglePanel('sort')}
          title="Sort">
          {ICON_SORT} {(view.sorts?.length ?? 0) > 0 && <span class="ne-badge">{view.sorts!.length}</span>}
        </button>
        {view.type === 'board' && <GroupByButton view={view} />}
        <button class={`ne-tool-btn ne-tool-icon ${panel === 'props' ? 'is-active' : ''}`}
          onClick={() => togglePanel('props')}
          title="Properties">
          {ICON_PROPS}
        </button>
        <button class="ne-tool-btn ne-tool-new" onClick={() => dispatch({ type: 'ADD_ROW', row: {} })}>
          New
        </button>
      </div>

      {/* Panels */}
      {panel === 'filter' && <FilterPanel view={view} props={schema.properties} allFilterProps={
        schema.source
          ? [...schema.properties, { id: '_folder', label: 'Folder', type: 'text' as PropType, width: 160 }]
          : schema.properties
      } />}
      {panel === 'sort'   && <SortPanel   view={view} props={schema.properties} />}
      {panel === 'props'  && <PropsPanel  props={schema.properties} />}
    </div>
  );
}

// ─── View Tabs ────────────────────────────────────────────────────────────────

function ViewTab({ view, active }: { view: ViewConfig; active: boolean }) {
  const { dispatch } = useStore();
  return (
    <button
      class={`ne-view-tab ${active ? 'is-active' : ''}`}
      onClick={() => dispatch({ type: 'SET_ACTIVE_VIEW', viewId: view.id })}
    >
      <span class="ne-view-icon">{VIEW_ICONS[view.type]}</span>
      {view.label}
    </button>
  );
}

function AddViewButton() {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const types: ViewType[] = ['table', 'board', 'gallery'];

  return (
    <div class="ne-add-view-wrap">
      <button class="ne-view-tab ne-add-view" onClick={() => setOpen(o => !o)}>+ Add view</button>
      {open && (
        <div class="ne-popover ne-add-view-menu">
          {types.map(t => (
            <div key={t} class="ne-menu-item"
              onClick={() => {
                const id = makeId();
                dispatch({ type: 'ADD_VIEW', view: { id, label: t.charAt(0).toUpperCase() + t.slice(1), type: t } });
                dispatch({ type: 'SET_ACTIVE_VIEW', viewId: id });
                setOpen(false);
              }}>
              <span class="ne-view-icon" style="margin-right:8px;display:inline-flex;align-items:center;">{VIEW_ICONS[t]}</span>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Group By Button ──────────────────────────────────────────────────────────

function GroupByButton({ view }: { view: ViewConfig }) {
  const { schema, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const selectProps = schema.properties.filter(p => p.type === 'select');
  const current = schema.properties.find(p => p.id === view.groupBy);

  return (
    <div class="ne-add-view-wrap">
      <button class={`ne-tool-btn ${view.groupBy ? 'is-active' : ''}`} onClick={() => setOpen(o => !o)}>
        Group: {current?.label ?? 'None'}
      </button>
      {open && (
        <div class="ne-popover">
          <div class="ne-menu-item" onClick={() => { dispatch({ type: 'UPDATE_VIEW', view: { ...view, groupBy: undefined } }); setOpen(false); }}>None</div>
          {selectProps.map(p => (
            <div key={p.id} class={`ne-menu-item ${p.id === view.groupBy ? 'is-active' : ''}`}
              onClick={() => { dispatch({ type: 'UPDATE_VIEW', view: { ...view, groupBy: p.id } }); setOpen(false); }}>
              {p.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPanel({ view, props, allFilterProps }: { view: ViewConfig; props: Property[]; allFilterProps: Property[] }) {
  const { dispatch } = useStore();
  const filters = view.filters ?? [];

  const update = (f: FilterRule[]) => dispatch({ type: 'UPDATE_VIEW', view: { ...view, filters: f } });

  const add = () => {
    const firstProp = allFilterProps[0];
    const ops = getOpsForType(firstProp?.type ?? 'text');
    update([...filters, { propId: firstProp?.id ?? '', op: ops[0].value, value: '' }]);
  };
  const remove = (i: number) => update(filters.filter((_, j) => j !== i));
  const change = (i: number, patch: Partial<FilterRule>) => update(filters.map((f, j) => j === i ? { ...f, ...patch } : f));

  const changeProp = (i: number, propId: string) => {
    const prop = allFilterProps.find(p => p.id === propId);
    const ops = getOpsForType(prop?.type ?? 'text');
    change(i, { propId, op: ops[0].value, value: '' });
  };

  return (
    <div class="ne-panel">
      <div class="ne-panel-title">Filters</div>
      {filters.map((f, i) => {
        const prop = allFilterProps.find(p => p.id === f.propId);
        const ops = getOpsForType(prop?.type ?? 'text');
        const opDef = ops.find(o => o.value === f.op);
        const noValue = opDef?.noValue ?? false;
        return (
          <div key={i} class="ne-filter-row">
            {i === 0 && <span class="ne-filter-where">Where</span>}
            <button class="ne-filter-prop-btn">
              <span class="ne-filter-prop-icon">{prop ? PROP_ICON[prop.type] : ''}</span>
              <select
                style="border:none;background:transparent;cursor:pointer;font-size:13px;color:inherit;padding:0;"
                value={f.propId}
                onChange={e => changeProp(i, (e.target as HTMLSelectElement).value)}
              >
                {allFilterProps.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </button>
            <select class="ne-select-sm" value={f.op} onChange={e => change(i, { op: (e.target as HTMLSelectElement).value as FilterRule['op'] })}>
              {ops.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
            {!noValue && (
              <input class="ne-input-sm" value={f.value} onInput={e => change(i, { value: (e.target as HTMLInputElement).value })} placeholder="value" />
            )}
            <button class="ne-icon-btn" onClick={() => remove(i)}>✕</button>
          </div>
        );
      })}
      <button class="ne-btn-text" onClick={add}>+ Add filter</button>
    </div>
  );
}

function SortPanel({ view, props }: { view: ViewConfig; props: Property[] }) {
  const { dispatch } = useStore();
  const sorts = view.sorts ?? [];

  const update = (s: SortRule[]) => dispatch({ type: 'UPDATE_VIEW', view: { ...view, sorts: s } });

  const add = () => update([...sorts, { propId: props[0]?.id ?? '', dir: 'asc' }]);
  const remove = (i: number) => update(sorts.filter((_, j) => j !== i));
  const change = (i: number, patch: Partial<SortRule>) => update(sorts.map((s, j) => j === i ? { ...s, ...patch } : s));

  return (
    <div class="ne-panel">
      <div class="ne-panel-title">Sort</div>
      {sorts.map((s, i) => (
        <div key={i} class="ne-panel-row">
          <select class="ne-select-sm" value={s.propId} onChange={e => change(i, { propId: (e.target as HTMLSelectElement).value })}>
            {props.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button class="ne-dir-btn" onClick={() => change(i, { dir: s.dir === 'asc' ? 'desc' : 'asc' })}>
            {s.dir === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
          <button class="ne-icon-btn" onClick={() => remove(i)}>✕</button>
        </div>
      ))}
      <button class="ne-btn-text" onClick={add}>+ Add sort</button>
    </div>
  );
}

function PropsPanel({ props }: { props: Property[] }) {
  const { dispatch } = useStore();

  return (
    <div class="ne-panel">
      <div class="ne-panel-title">Properties</div>
      {props.map(p => (
        <div key={p.id} class="ne-panel-row ne-panel-prop-row">
          <input
            type="checkbox"
            checked={!p.hidden}
            onChange={() => dispatch({ type: 'UPDATE_PROPERTY', prop: { ...p, hidden: !p.hidden } })}
          />
          <span class="ne-prop-label">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

type OpDef = { label: string; value: FilterRule['op']; noValue?: boolean };

const OPS_BY_TYPE: Record<string, OpDef[]> = {
  text: [
    { label: 'contains',         value: 'contains' },
    { label: 'does not contain', value: 'does_not_contain' },
    { label: 'is',               value: 'equals' },
    { label: 'is not',           value: 'is_not' },
    { label: 'starts with',      value: 'starts_with' },
    { label: 'is empty',         value: 'is_empty',     noValue: true },
    { label: 'is not empty',     value: 'is_not_empty', noValue: true },
  ],
  number: [
    { label: '=',          value: 'equals' },
    { label: '≠',          value: 'neq' },
    { label: '>',          value: 'gt' },
    { label: '≥',          value: 'gte' },
    { label: '<',          value: 'lt' },
    { label: '≤',          value: 'lte' },
    { label: 'is empty',   value: 'is_empty',     noValue: true },
    { label: 'is not empty', value: 'is_not_empty', noValue: true },
  ],
  checkbox: [
    { label: 'is checked',     value: 'is_checked',     noValue: true },
    { label: 'is not checked', value: 'is_not_checked', noValue: true },
  ],
  select: [
    { label: 'is',           value: 'equals' },
    { label: 'is not',       value: 'is_not' },
    { label: 'is empty',     value: 'is_empty',     noValue: true },
    { label: 'is not empty', value: 'is_not_empty', noValue: true },
  ],
  multi_select: [
    { label: 'is',           value: 'equals' },
    { label: 'is not',       value: 'is_not' },
    { label: 'is empty',     value: 'is_empty',     noValue: true },
    { label: 'is not empty', value: 'is_not_empty', noValue: true },
  ],
  date: [
    { label: 'is',         value: 'equals' },
    { label: 'is before',  value: 'is_before' },
    { label: 'is after',   value: 'is_after' },
    { label: 'is empty',   value: 'is_empty',     noValue: true },
    { label: 'is not empty', value: 'is_not_empty', noValue: true },
  ],
};

function getOpsForType(type: string): OpDef[] {
  return OPS_BY_TYPE[type] ?? OPS_BY_TYPE['text'];
}
