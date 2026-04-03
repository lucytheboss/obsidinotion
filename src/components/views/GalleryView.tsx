import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Property, Row } from '../../types';
import { useStore, useRows, applyFilters, applySorts, applySearch } from '../../store';
import { Cell } from '../cells/Cell';

export function GalleryView() {
  const { schema, dispatch } = useStore();
  const allRows = useRows();
  const view = schema.views.find(v => v.id === schema.activeViewId)!;
  const isSourced = !!schema.source;

  let rows = applyFilters(allRows, view.filters ?? []);
  rows = applySorts(rows, view.sorts ?? []);
  rows = applySearch(rows, schema._search ?? '');

  const visibleProps = schema.properties.filter(p => !p.hidden);
  const coverProp = visibleProps.find(p => p.coverProp && p.type === 'url') ?? visibleProps.find(p => p.type === 'url');
  const titleProp = visibleProps.find(p => p.type === 'text') ?? visibleProps[0];
  const bodyProps = visibleProps.filter(p => p.id !== coverProp?.id && p.id !== titleProp?.id);

  return (
    <div class="ne-gallery">
      {rows.map(row => (
        <GalleryCard key={row._id} row={row} coverProp={coverProp} titleProp={titleProp}
          bodyProps={bodyProps} isSourced={isSourced} />
      ))}
      {!isSourced && (
        <div class="ne-gallery-card ne-gallery-add" onClick={() => dispatch({ type: 'ADD_ROW', row: {} })}>
          <span class="ne-gallery-add-icon">+</span>
          <span>New card</span>
        </div>
      )}
    </div>
  );
}

function GalleryCard({ row, coverProp, titleProp, bodyProps, isSourced }: {
  row: Row; coverProp?: Property; titleProp?: Property; bodyProps: Property[]; isSourced: boolean;
}) {
  const { dispatch, app } = useStore();
  const [hovered, setHovered] = useState(false);
  const coverUrl = coverProp ? row[coverProp.id] : null;

  const openFile = () => { if (row._filePath) (app as any).workspace.openLinkText(row._filePath, '', false); };

  return (
    <div class="ne-gallery-card" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {hovered && !isSourced && (
        <button class="ne-card-del" onClick={() => dispatch({ type: 'DELETE_ROW', rowId: row._id })}>✕</button>
      )}
      {hovered && isSourced && (
        <button class="ne-card-del" onClick={openFile} title="Open file" style="color:var(--interactive-accent)">↗</button>
      )}
      <div class="ne-gallery-cover">
        {coverUrl ? <img src={coverUrl} alt="" class="ne-gallery-img" /> : <div class="ne-gallery-cover-empty" />}
      </div>
      <div class="ne-gallery-body">
        {titleProp && (
          <div class="ne-gallery-title">
            <Cell prop={titleProp} rowId={row._id} value={row[titleProp.id]} readonly={titleProp.id === '_title'} />
          </div>
        )}
        {bodyProps.map(p => (
          <div key={p.id} class="ne-gallery-prop">
            <span class="ne-gallery-prop-label">{p.label}</span>
            <Cell prop={p} rowId={row._id} value={row[p.id]} />
          </div>
        ))}
      </div>
    </div>
  );
}
