import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { Property, Row, PROP_ICON } from '../types';
import { useStore } from '../store';
import { Cell } from './cells/Cell';

interface Props {
  row: Row;
  props: Property[];
  isSourced: boolean;
  onClose: () => void;
}

export function RowModal({ row, props, isSourced, onClose }: Props) {
  const { app, dispatch } = useStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const openFile = () => {
    if (row._filePath) (app as any).workspace.openLinkText(row._filePath, '', false);
    onClose();
  };

  return (
    <div class="ne-modal-overlay" onClick={onClose}>
      <div class="ne-modal" onClick={e => e.stopPropagation()}>
        <div class="ne-modal-header" style="border:none;padding-bottom:0;">
          <div class="ne-modal-actions" style="width:100%;justify-content:space-between;">
             <div style="display:flex;gap:8px;">
               {row._filePath && (
                 <button class="ne-modal-action-btn" onClick={openFile} title="Open file">
                   ↗ Open as page
                 </button>
               )}
             </div>
             <button class="ne-modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        <div class="ne-modal-body" style="padding-top:0;">
          <div class="ne-modal-title" style="font-size:32px;margin:12px 0 24px;border:none;outline:none;" contentEditable={!isSourced} onBlur={e => {
            const t = (e.target as HTMLDivElement).innerText.trim();
            if (t) dispatch({ type: 'UPDATE_CELL', rowId: row._id, propId: '_title', value: t });
          }}>
            {row._title ?? row[props[0]?.id] ?? 'Untitled'}
          </div>

          <div class="ne-modal-props-grid">
            {props.map(p => (
              <div key={p.id} class="ne-modal-prop" style="border:none;padding:4px 0;">
                <div class="ne-modal-prop-label" style="width:120px;font-size:12px;opacity:0.6;">
                  <span class="ne-modal-prop-icon">{PROP_ICON[p.type]}</span>
                  {p.label}
                </div>
                <div class="ne-modal-prop-value" style="font-size:14px;">
                  <Cell prop={p} rowId={row._id} value={row[p.id]}
                    readonly={isSourced && p.id === '_title'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
