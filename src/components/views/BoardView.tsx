import { h } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Property, Row, SelectOption, makeId, makeSelectOption } from '../../types';
import { useStore, useRows, applyFilters, applySorts, applySearch } from '../../store';
import { Cell, Tag } from '../cells/Cell';

export function BoardView() {
  const { schema, dispatch } = useStore();
  const allRows = useRows();
  const view = schema.views.find(v => v.id === schema.activeViewId)!;
  const isSourced = !!schema.source;

  const groupPropId = view.groupBy;
  const groupProp = schema.properties.find(p => p.id === groupPropId && p.type === 'select');

  if (!groupProp) return <GroupByPicker />;

  let rows = applyFilters(allRows, view.filters ?? []);
  rows = applySorts(rows, view.sorts ?? []);
  rows = applySearch(rows, schema._search ?? '');

  const options = groupProp.options ?? [];
  const columns = [
    ...options.map(opt => ({ opt, rows: rows.filter(r => r[groupPropId!] === opt.id) })),
    { opt: null, rows: rows.filter(r => !groupPropId || !options.some(o => o.id === r[groupPropId])) },
  ];

  return (
    <div class="ne-board">
      {columns.map(col => (
        <BoardColumn key={col.opt?.id ?? '__none__'}
          opt={col.opt} rows={col.rows} groupProp={groupProp}
          allProps={schema.properties.filter(p => !p.hidden && p.id !== groupPropId)}
          isSourced={isSourced}
        />
      ))}
      {!isSourced && <AddColumnButton groupProp={groupProp} />}
    </div>
  );
}

function GroupByPicker() {
  const { schema, dispatch } = useStore();
  const view = schema.views.find(v => v.id === schema.activeViewId)!;
  const selectProps = schema.properties.filter(p => p.type === 'select');
  return (
    <div class="ne-board-picker">
      <p>Choose a <strong>Select</strong> property to group by:</p>
      {selectProps.length === 0
        ? <p class="ne-muted">No select properties found.</p>
        : selectProps.map(p => (
            <button key={p.id} class="ne-btn ne-btn-secondary"
              onClick={() => dispatch({ type: 'UPDATE_VIEW', view: { ...view, groupBy: p.id } })}>
              {p.label}
            </button>
          ))
      }
    </div>
  );
}

function BoardColumn({ opt, rows, groupProp, allProps, isSourced }: {
  opt: SelectOption | null; rows: Row[]; groupProp: Property; allProps: Property[]; isSourced: boolean;
}) {
  const { dispatch } = useStore();
  const [dragOver, setDragOver] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const rowId = e.dataTransfer?.getData('text/plain');
    if (rowId) dispatch({ type: 'UPDATE_CELL', rowId, propId: groupProp.id, value: opt?.id ?? null });
  };

  return (
    <div class={`ne-board-col ${dragOver ? 'is-drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
      <div class="ne-board-col-header">
        {opt ? <Tag opt={opt} /> : <span class="ne-board-col-none">No status</span>}
        <span class="ne-board-col-count">{rows.length}</span>
      </div>
      <div class="ne-board-cards">
        {rows.map(row => <BoardCard key={row._id} row={row} props={allProps} isSourced={isSourced} />)}
      </div>
      {!isSourced && (
        <button class="ne-board-add-card"
          onClick={() => { const r: any = {}; if (opt) r[groupProp.id] = opt.id; dispatch({ type: 'ADD_ROW', row: r }); }}>
          + New
        </button>
      )}
    </div>
  );
}

function BoardCard({ row, props, isSourced }: { row: Row; props: Property[]; isSourced: boolean }) {
  const { dispatch, app } = useStore();
  const [hovered, setHovered] = useState(false);
  const titleProp = props[0];

  const openFile = () => { if (row._filePath) (app as any).workspace.openLinkText(row._filePath, '', false); };

  return (
    <div class="ne-board-card" draggable
      onDragStart={e => e.dataTransfer!.setData('text/plain', row._id)}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {hovered && !isSourced && (
        <button class="ne-card-del" onClick={() => dispatch({ type: 'DELETE_ROW', rowId: row._id })}>✕</button>
      )}
      {hovered && isSourced && (
        <button class="ne-card-del" onClick={openFile} title="Open file" style="color:var(--interactive-accent)">↗</button>
      )}
      {titleProp && (
        <div class="ne-card-title">
          <Cell prop={titleProp} rowId={row._id} value={row[titleProp.id]} readonly={titleProp.id === '_title'} />
        </div>
      )}
      {props.slice(1).map(p => (
        <div key={p.id} class="ne-card-prop">
          <span class="ne-card-prop-label">{p.label}</span>
          <Cell prop={p} rowId={row._id} value={row[p.id]} />
        </div>
      ))}
    </div>
  );
}

function AddColumnButton({ groupProp }: { groupProp: Property }) {
  const { dispatch } = useStore();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');

  const commit = () => {
    const t = label.trim();
    if (t) dispatch({ type: 'UPDATE_PROPERTY', prop: { ...groupProp, options: [...(groupProp.options ?? []), makeSelectOption(t)] } });
    setLabel(''); setAdding(false);
  };

  if (adding) {
    return (
      <div class="ne-board-col ne-board-col-new">
        <input class="ne-cell-input" placeholder="Column name" value={label}
          onInput={e => setLabel((e.target as HTMLInputElement).value)}
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setAdding(false); }}
          autoFocus />
      </div>
    );
  }
  return <button class="ne-board-add-col" onClick={() => setAdding(true)}>+ Add column</button>;
}
