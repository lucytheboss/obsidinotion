import { h, Fragment } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Property, Row, makeId, PropType, PROP_ICON } from '../../types';
import { useStore, useRows, applyFilters, applySorts, applySearch } from '../../store';
import { Cell } from '../cells/Cell';
import { RowModal } from '../RowModal';

const PAGE_SIZES = [10, 25, 50, 100, 0] as const; // 0 = All

export function TableView() {
  const { schema, dispatch } = useStore();
  const allRows = useRows();
  const view = schema.views.find(v => v.id === schema.activeViewId)!;
  const isSourced = !!schema.source;
  const groupByFolder = isSourced && !!schema.source?.groupByFolder;
  const visibleProps = schema.properties.filter(p => !p.hidden);

  const [pageSize, setPageSize] = useState<number>(25);
  const [expandedRow, setExpandedRow] = useState<Row | null>(null);

  let rows = applyFilters(allRows, view.filters ?? []);
  rows = applySorts(rows, view.sorts ?? []);
  rows = applySearch(rows, schema._search ?? '');

  // folder-tree mode: sort by folder path then name; exclude root-level files (no subfolder)
  if (groupByFolder) {
    rows = rows
      .filter(r => !!(r._folder))           // skip files directly in source root
      .sort((a, b) => {
        const fa = a._folder ?? '';
        const fb = b._folder ?? '';
        if (fa !== fb) return fa.localeCompare(fb);
        return (a._title ?? '').localeCompare(b._title ?? '');
      });
  }

  const totalRows = rows.length;
  const displayRows = pageSize === 0 ? rows : rows.slice(0, pageSize);
  const colSpan = visibleProps.length + (isSourced ? 1 : 2);

  return (
    <div class="ne-table-wrap">
      {expandedRow && (
        <RowModal
          row={expandedRow}
          props={visibleProps}
          isSourced={isSourced}
          onClose={() => setExpandedRow(null)}
        />
      )}
      <table class="ne-table">
        <thead>
          <tr>
            <th class="ne-th ne-th-index">#</th>
            {visibleProps.map(p => <HeaderCell key={p.id} prop={p} isSourced={isSourced} />)}
            {!isSourced && (
              <th class="ne-th ne-th-add">
                <button class="ne-add-prop-btn"
                  onClick={() => dispatch({ type: 'ADD_PROPERTY', prop: { id: makeId(), label: `Col ${schema.properties.length + 1}`, type: 'text', width: 160 } })}>
                  +
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {groupByFolder
            ? <FolderGroupedBody rows={displayRows} props={visibleProps} colSpan={colSpan} onExpand={setExpandedRow} />
            : displayRows.map((row, i) => (
                <TableRow key={row._id} row={row} index={i + 1} props={visibleProps} isSourced={isSourced} onExpand={setExpandedRow} />
              ))
          }
          {!isSourced && (
            <tr class="ne-tr-add">
              <td class="ne-td-index" />
              <td colSpan={visibleProps.length + 1}>
                <button class="ne-add-row-btn" onClick={() => dispatch({ type: 'ADD_ROW', row: {} })}>
                  <span style="font-size:18px;margin-top:-2px;">+</span> New
                </button>
              </td>
            </tr>
          )}
        </tbody>
        {/* Summary row — bottom */}
        <tfoot>
          <tr class="ne-calculate-row">
            <td class="ne-td-index" />
            {visibleProps.map(p => <CalculateCell key={p.id} prop={p} rows={displayRows} />)}
            {!isSourced && <td />}
          </tr>
        </tfoot>
      </table>

      {isSourced && rows.length === 0 && !groupByFolder && (
        <div class="ne-empty-state">No files in <code>{schema.source!.folder || '/'}</code></div>
      )}

      {/* Footer bar: row count + page size chooser */}
      <div class="ne-table-footer">
        <span class="ne-table-footer-count">
          {pageSize === 0 || totalRows <= pageSize
            ? `${totalRows} row${totalRows !== 1 ? 's' : ''}`
            : `Showing ${pageSize} of ${totalRows}`}
        </span>
        <div class="ne-page-size">
          <span class="ne-page-size-label">Show:</span>
          {PAGE_SIZES.map((n, i) => (
            <>
              {i > 0 && <span class="ne-page-size-sep">·</span>}
              <button
                key={n}
                class={`ne-page-size-link ${pageSize === n ? 'is-active' : ''}`}
                onClick={() => setPageSize(n)}
              >
                {n === 0 ? 'All' : n}
              </button>
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tree node ────────────────────────────────────────────────────────────────

interface TreeNode {
  segment: string;
  fullPath: string;
  files: Row[];
  children: TreeNode[];
}

function buildTree(rows: Row[]): TreeNode {
  const root: TreeNode = { segment: '', fullPath: '', files: [], children: [] };

  for (const row of rows) {
    const folder = row._folder ?? '';
    const segments = folder ? folder.split('/') : [];
    let node = root;
    let pathSoFar = '';
    for (const seg of segments) {
      pathSoFar = pathSoFar ? `${pathSoFar}/${seg}` : seg;
      let child = node.children.find(c => c.segment === seg);
      if (!child) {
        child = { segment: seg, fullPath: pathSoFar, files: [], children: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.files.push(row);
  }

  const sortNode = (n: TreeNode) => {
    n.children.sort((a, b) => a.segment.localeCompare(b.segment));
    n.children.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

// ─── Folder-grouped body ──────────────────────────────────────────────────────

function FolderGroupedBody({ rows, props, colSpan, onExpand }: { rows: Row[]; props: Property[]; colSpan: number; onExpand: (row: Row) => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const counter = { n: 0 };

  const toggle = (path: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const tree = buildTree(rows);
  // root.files are skipped (user doesn't want to see root-level files in tree mode)

  return (
    <>
      {tree.children.map(child => (
        <FolderSubtree key={child.fullPath} node={child} props={props} colSpan={colSpan}
          depth={0} collapsed={collapsed} toggle={toggle} counter={counter} onExpand={onExpand} />
      ))}
    </>
  );
}

function FolderSubtree({ node, props, colSpan, depth, collapsed, toggle, counter, onExpand }: {
  node: TreeNode; props: Property[]; colSpan: number; depth: number;
  collapsed: Set<string>; toggle: (p: string) => void; counter: { n: number };
  onExpand: (row: Row) => void;
}) {
  const isCollapsed = collapsed.has(node.fullPath);
  const indent = depth * 20;

  return (
    <>
      <tr class="ne-ftree-row" onClick={() => toggle(node.fullPath)}>
        <td class="ne-ftree-index-cell" />
        <td colSpan={colSpan - 1} class="ne-ftree-header-cell">
          <div class="ne-ftree-header" style={`padding-left: ${indent}px`}>
            <span class={`ne-ftree-arrow ${isCollapsed ? 'is-collapsed' : ''}`}>▾</span>
            <span class="ne-ftree-icon">{isCollapsed ? '📁' : '📂'}</span>
            <span class="ne-ftree-name">{node.segment}</span>
            <span class="ne-ftree-count">{node.files.length}</span>
          </div>
        </td>
      </tr>
      {!isCollapsed && (
        <>
          {node.files.map(row => {
            counter.n++;
            return <TableRow key={row._id} row={row} index={counter.n} props={props} isSourced depth={depth + 1} onExpand={onExpand} />;
          })}
          {node.children.map(child => (
            <FolderSubtree key={child.fullPath} node={child} props={props} colSpan={colSpan}
              depth={depth + 1} collapsed={collapsed} toggle={toggle} counter={counter} onExpand={onExpand} />
          ))}
        </>
      )}
    </>
  );
}

function countAll(node: TreeNode): number {
  return node.files.length + node.children.reduce((s, c) => s + countAll(c), 0);
}

// ─── Header Cell ──────────────────────────────────────────────────────────────

function HeaderCell({ prop, isSourced }: { prop: Property; isSourced: boolean }) {
  const { dispatch } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(prop.label);
  const thRef = useRef<HTMLTableCellElement>(null);
  const liveWidthRef = useRef<number>(prop.width ?? 160);

  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = prop.width ?? 160;
    liveWidthRef.current = startW;

    const resizeEl = (e.currentTarget as HTMLElement);
    resizeEl.classList.add('is-dragging');

    const onMove = (e: MouseEvent) => {
      const newW = Math.max(80, startW + e.clientX - startX);
      liveWidthRef.current = newW;
      if (thRef.current) thRef.current.style.width = `${newW}px`;
    };
    const onUp = () => {
      resizeEl.classList.remove('is-dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      dispatch({ type: 'UPDATE_PROPERTY', prop: { ...prop, width: liveWidthRef.current } });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const commitRename = () => {
    const t = label.trim();
    if (t) dispatch({ type: 'UPDATE_PROPERTY', prop: { ...prop, label: t } });
    setRenaming(false); setMenuOpen(false);
  };

  const isSystem = prop.id === '_title';

  return (
    <th ref={thRef} class="ne-th" style={{ width: `${prop.width ?? 160}px`, minWidth: '80px' }}>
      <div class="ne-th-inner" onClick={() => !isSystem && setMenuOpen(o => !o)}>
        <span class="ne-prop-icon">{PROP_ICON[prop.type]}</span>
        <span class="ne-prop-label">{prop.label}</span>
        {isSystem && <span class="ne-prop-system">🔒</span>}
      </div>
      <div class="ne-col-resize" onMouseDown={startResize} />
      {menuOpen && !isSystem && (
        <div class="ne-popover ne-header-menu">
          {renaming ? (
            <input class="ne-popover-search" value={label}
              onInput={e => setLabel((e.target as HTMLInputElement).value)}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setRenaming(false); setLabel(prop.label); } }}
              onBlur={commitRename} autoFocus />
          ) : (
            <>
              {!isSourced && <div class="ne-menu-item" onClick={() => setRenaming(true)}>Rename</div>}
              <div class="ne-menu-item" onClick={() => { dispatch({ type: 'UPDATE_PROPERTY', prop: { ...prop, hidden: true } }); setMenuOpen(false); }}>Hide column</div>
              {!isSourced && (
                <>
                  <PropTypeMenu prop={prop} dispatch={dispatch} onClose={() => setMenuOpen(false)} />
                  <div class="ne-menu-sep" />
                  <div class="ne-menu-item ne-menu-danger" onClick={() => { dispatch({ type: 'DELETE_PROPERTY', propId: prop.id }); setMenuOpen(false); }}>Delete</div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </th>
  );
}

function PropTypeMenu({ prop, dispatch, onClose }: { prop: Property; dispatch: any; onClose: () => void }) {
  const types: PropType[] = ['text','number','checkbox','date','select','multi_select','url','email'];
  return (
    <>
      <div class="ne-menu-sep" />
      <div class="ne-menu-label">Change type</div>
      {types.map(t => (
        <div key={t} class={`ne-menu-item ne-menu-type ${t === prop.type ? 'is-active' : ''}`}
          onClick={() => { dispatch({ type: 'UPDATE_PROPERTY', prop: { ...prop, type: t } }); onClose(); }}>
          <span class="ne-prop-icon">{PROP_ICON[t]}</span> {t.replace('_', ' ')}
        </div>
      ))}
    </>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function TableRow({ row, index, props, isSourced, depth = 0, onExpand }: {
  row: Row; index: number; props: Property[]; isSourced: boolean; depth?: number;
  onExpand: (row: Row) => void;
}) {
  const { dispatch, app } = useStore();
  const [hovered, setHovered] = useState(false);
  const [isDragOver, setIsDragOver] = useState<'top' | 'bottom' | null>(null);
  const indent = depth * 20;

  const openFile = () => {
    if (row._filePath) (app as any).workspace.openLinkText(row._filePath, '', false);
  };

  const onDragStart = (e: DragEvent) => {
    if (isSourced) return;
    e.dataTransfer?.setData('text/plain', row._id);
  };

  const onDragOver = (e: DragEvent) => {
    if (isSourced) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    setIsDragOver(e.clientY < mid ? 'top' : 'bottom');
  };

  const onDragLeave = () => setIsDragOver(null);

  const onDrop = (e: DragEvent) => {
    if (isSourced) return;
    e.preventDefault();
    const draggedId = e.dataTransfer?.getData('text/plain');
    if (!draggedId || draggedId === row._id) { setIsDragOver(null); return; }
    if (isDragOver === 'top') {
      // find the row before this one and use it as afterId
      dispatch({ type: 'MOVE_ROW', rowId: draggedId, afterId: null }); // simplified: drop before = move to null first then re-handle
      // Actually: drop on top of this row = insert after the row before this one
      // We'll dispatch MOVE_ROW with afterId = null to indicate "before current"
      // But MOVE_ROW only supports afterId. We'll use a workaround: use MOVE_ROW to put after "previous" row
      // For simplicity: if top half, afterId = null means insert at top; we'll handle properly below
    }
    // Use bottom/top to decide afterId
    const afterId = isDragOver === 'bottom' ? row._id : null;
    dispatch({ type: 'MOVE_ROW', rowId: draggedId, afterId });
    setIsDragOver(null);
  };

  const trClass = [
    'ne-tr',
    isDragOver === 'top' ? 'is-drag-over-top' : '',
    isDragOver === 'bottom' ? 'is-drag-over-bottom' : '',
  ].filter(Boolean).join(' ');

  return (
    <tr
      class={trClass}
      draggable={!isSourced}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <td class="ne-td ne-td-index">
        {hovered && !isSourced
          ? <div style="display:flex;align-items:center;gap:2px;">
              <span class="ne-drag-handle" title="Drag to reorder">⠿</span>
              <button class="ne-row-del" onClick={() => dispatch({ type: 'DELETE_ROW', rowId: row._id })}>✕</button>
              <button class="ne-row-dup" title="Duplicate row" onClick={() => dispatch({ type: 'DUPLICATE_ROW', rowId: row._id })}>⧉</button>
            </div>
          : hovered && isSourced
          ? <button class="ne-row-open" onClick={openFile} title="Open file">↗</button>
          : <span class="ne-row-num">{index}</span>
        }
      </td>
      {props.map((p, i) => (
        <td key={p.id} class="ne-td" style={{ width: `${p.width ?? 160}px` }}>
          {i === 0
            ? <div class="ne-name-cell" style={indent > 0 ? `padding-left: ${indent + 8}px` : ''}>
                {row._ext && row._ext !== 'md' && (
                  <span class={`ne-ext-badge ne-ext-${row._ext}`}>{row._ext.toUpperCase()}</span>
                )}
                <Cell prop={p} rowId={row._id} value={row[p.id]} readonly={p.id === '_title'} />
                <button class="ne-row-open-notion" onClick={() => onExpand(row)}>
                  OPEN
                </button>
              </div>
            : <Cell prop={p} rowId={row._id} value={row[p.id]} readonly={p.id === '_title'} />
          }
        </td>
      ))}
      {!isSourced && <td class="ne-td" />}
    </tr>
  );
}

// ─── Calculate row ────────────────────────────────────────────────────────────

type CalcFn = 'none' | 'count' | 'sum' | 'avg' | 'min' | 'max';

function CalculateCell({ prop, rows }: { prop: Property; rows: Row[] }) {
  const [fn, setFn] = useState<CalcFn>('none');
  const [open, setOpen] = useState(false);
  const available: CalcFn[] = prop.type === 'number'
    ? ['none','count','sum','avg','min','max']
    : ['none','count'];

  const result = () => {
    const vals = rows.map(r => r[prop.id]).filter(v => v != null);
    switch (fn) {
      case 'count': return vals.length;
      case 'sum':   return vals.reduce((a, b) => a + Number(b), 0);
      case 'avg':   return vals.length ? (vals.reduce((a, b) => a + Number(b), 0) / vals.length).toFixed(2) : '-';
      case 'min':   return vals.length ? Math.min(...vals.map(Number)) : '-';
      case 'max':   return vals.length ? Math.max(...vals.map(Number)) : '-';
      default:      return null;
    }
  };

  return (
    <td class="ne-td ne-calc-cell" style={{ width: `${prop.width ?? 160}px` }}>
      <div class="ne-calc-inner" onClick={() => setOpen(o => !o)}>
        {fn === 'none' ? <span class="ne-calc-hint">Calculate</span> : <span class="ne-calc-result">{fn.toUpperCase()} {result()}</span>}
      </div>
      {open && (
        <div class="ne-popover ne-calc-popover">
          {available.map(f => (
            <div key={f} class={`ne-menu-item ${f === fn ? 'is-active' : ''}`}
              onClick={() => { setFn(f); setOpen(false); }}>
              {f === 'none' ? 'None' : f.toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </td>
  );
}
