import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { TFolder } from 'obsidian';
import { DbSource, makeId } from '../types';
import { useStore, autoDetectProperties, fetchSourcedRows } from '../store';
import { DbSchema } from '../types';

interface FolderInfo {
  path: string;
  name: string;
  fileCount: number;
}

function getAllFolders(app: any): FolderInfo[] {
  const files = app.vault.getMarkdownFiles();
  const folderMap = new Map<string, number>();

  for (const f of files) {
    const p = f.parent?.path ?? '/';
    folderMap.set(p, (folderMap.get(p) ?? 0) + 1);
  }

  return [...folderMap.entries()]
    .map(([path, fileCount]) => ({
      path,
      name: path === '/' ? '/ (root)' : path,
      fileCount,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function Onboarding() {
  const { schema, app, dispatch, save } = useStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const folders = useMemo(() => getAllFolders(app), []);

  const filtered = search
    ? folders.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : folders;

  const selectedFolder = selected ? folders.find(f => f.path === selected) : null;

  const selectedSource: DbSource | null = selected
    ? { type: 'folder', folder: selected.replace(/^\//, '').replace(/\/$/, '') }
    : null;

  const previewProps = useMemo(() => {
    if (!selectedSource) return [];
    return autoDetectProperties(app, selectedSource);
  }, [selected]);

  const confirm = () => {
    if (!selectedSource) return;
    const viewId = makeId();
    const newSchema: DbSchema = {
      title: selectedFolder?.name.split('/').pop() ?? 'Database',
      source: selectedSource,
      properties: previewProps,
      rows: [],
      views: [{ id: viewId, label: 'Table', type: 'table' }],
      activeViewId: viewId,
    };
    dispatch({ type: 'SET_SCHEMA', schema: newSchema });
    save(newSchema);
  };

  return (
    <div class="ne-onboard">
      <div class="ne-onboard-inner">
        <div class="ne-onboard-header">
          <div class="ne-onboard-emoji">📂</div>
          <h2 class="ne-onboard-title">Link a folder</h2>
          <p class="ne-onboard-sub">
            Choose a vault folder — every file in it becomes a row, and its frontmatter becomes columns.
          </p>
        </div>

        {/* Search */}
        <input
          class="ne-onboard-search"
          placeholder="Search folders…"
          value={search}
          onInput={e => setSearch((e.target as HTMLInputElement).value)}
          autoFocus
        />

        {/* Folder list */}
        <div class="ne-onboard-folder-list">
          {filtered.length === 0 && (
            <div class="ne-onboard-empty">No folders found</div>
          )}
          {filtered.map(f => (
            <button
              key={f.path}
              class={`ne-onboard-folder-row ${selected === f.path ? 'is-selected' : ''}`}
              onClick={() => setSelected(f.path === selected ? null : f.path)}
            >
              <span class="ne-onboard-folder-icon">📁</span>
              <span class="ne-onboard-folder-name">{f.name}</span>
              <span class="ne-onboard-folder-count">{f.fileCount} file{f.fileCount !== 1 ? 's' : ''}</span>
            </button>
          ))}
        </div>

        {/* Column preview */}
        {selected && (
          <div class="ne-onboard-preview-wrap">
            <div class="ne-onboard-preview-header">
              <span class="ne-onboard-preview-title">
                {previewProps.length} column{previewProps.length !== 1 ? 's' : ''} detected
              </span>
              <span class="ne-onboard-preview-hint">You can hide any of these later</span>
            </div>
            <div class="ne-onboard-cols">
              {previewProps.map(p => (
                <span key={p.id} class="ne-onboard-col-chip">
                  <span class="ne-onboard-col-type">{p.type === 'text' ? 'Aa' : p.type === 'number' ? '#' : p.type === 'checkbox' ? '✓' : p.type === 'date' ? '📅' : p.type === 'select' ? '◉' : p.type === 'multi_select' ? '◈' : p.type === 'url' ? '🔗' : '✉'}</span>
                  {p.label}
                </span>
              ))}
              {previewProps.length === 0 && (
                <span class="ne-onboard-no-cols">No frontmatter found — columns can be added manually</span>
              )}
            </div>
            <button class="ne-onboard-confirm" onClick={confirm}>
              Open as database →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
