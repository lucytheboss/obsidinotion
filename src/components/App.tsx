import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useStore } from '../store';
import { DbSchema } from '../types';
import { Toolbar } from './Toolbar';
import { TableView } from './views/TableView';
import { BoardView } from './views/BoardView';
import { GalleryView } from './views/GalleryView';
import { Onboarding } from './Onboarding';

function isFreshDb(schema: DbSchema): boolean {
  return !schema.source && schema.rows.length === 0 && schema.properties.length === 1;
}

export function App() {
  const { schema, dispatch } = useStore();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  if (isFreshDb(schema)) {
    return <div class="ne-root"><Onboarding /></div>;
  }

  const view = schema.views.find(v => v.id === schema.activeViewId);

  const commitTitle = () => {
    const t = titleDraft.trim();
    if (t) dispatch({ type: 'SET_TITLE', title: t });
    setEditingTitle(false);
  };

  return (
    <div class="ne-root">
      <div class="ne-title-row">
        {/* Source badge */}
        {schema.source && (
          <span class="ne-source-badge" title={schema.source.folder}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
            {schema.source.folder || '/'}
          </span>
        )}

        {/* Title — hidden when hideTitle is on */}
        {!schema.hideTitle && (
          editingTitle ? (
            <input
              class="ne-title-input"
              value={titleDraft}
              onInput={e => setTitleDraft((e.target as HTMLInputElement).value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
              autoFocus
            />
          ) : (
            <h2 class="ne-title" onClick={() => { setTitleDraft(schema.title); setEditingTitle(true); }}>
              {schema.title}
            </h2>
          )
        )}

        {/* Show/hide title toggle — always visible, floated right */}
        <button
          class={`ne-title-toggle ${schema.hideTitle ? 'is-hidden' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_TITLE' })}
          title={schema.hideTitle ? 'Show title' : 'Hide title'}
        >
          {schema.hideTitle ? 'Show Title' : 'Hide Title'}
        </button>
      </div>

      <Toolbar />

      <div class="ne-view-body">
        {view?.type === 'table'   && <TableView />}
        {view?.type === 'board'   && <BoardView />}
        {view?.type === 'gallery' && <GalleryView />}
      </div>
    </div>
  );
}
