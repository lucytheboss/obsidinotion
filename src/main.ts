import { Plugin, MarkdownPostProcessorContext } from 'obsidian';
import { render } from 'preact';
import { h } from 'preact';
import { App as DbApp } from './components/App';
import { StoreProvider } from './store';
import { parseSchema } from './types';

export default class NotionEnginePlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor('db-notion', (source, el, ctx) => {
      // Must capture info BEFORE mutating el
      const info = ctx.getSectionInfo(el);
      if (!info) {
        el.createDiv({ text: 'Notion Engine: cannot determine block position.' });
        return;
      }

      const schema = parseSchema(source);
      const filePath = ctx.sourcePath;

      // Use Intersection Observer for lazy mounting
      let mounted = false;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !mounted) {
            mounted = true;
            observer.disconnect();
            mountDb(el, schema, filePath, info, this.app);
          }
        },
        { root: null, rootMargin: '200px', threshold: 0 }
      );

      observer.observe(el);

      // Cleanup when block is removed from DOM
      this.register(() => {
        observer.disconnect();
      });
    });

    this.addCommand({
      id: 'insert-notion-db',
      name: 'Insert Notion Database block',
      editorCallback: (editor) => {
        editor.replaceRange('```db-notion\n{}\n```\n', editor.getCursor());
      },
    });
  }
}

function mountDb(
  el: HTMLElement,
  schema: ReturnType<typeof parseSchema>,
  filePath: string,
  info: any,
  app: any
) {
  const root = el.createDiv({ cls: 'ne-mount' });
  render(
    h(StoreProvider, { initialSchema: schema, filePath, info, app },
      h(DbApp, null)
    ),
    root
  );
}
