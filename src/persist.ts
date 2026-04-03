import { App, TFile, MarkdownSectionInformation } from 'obsidian';
import { DbSchema, serializeSchema } from './types';

export async function saveSchema(
  app: App,
  filePath: string,
  schema: DbSchema,
  info: MarkdownSectionInformation,
): Promise<void> {
  const file = app.vault.getFileByPath(filePath) as TFile | null;
  if (!file) return;
  await app.vault.process(file, (content: string) => {
    const lines = content.split('\n');
    if (info.lineStart >= lines.length || info.lineEnd >= lines.length) return content;
    const openFence  = lines[info.lineStart];
    const closeFence = lines[info.lineEnd];
    const replacement = [openFence, serializeSchema(schema), closeFence];
    lines.splice(info.lineStart, info.lineEnd - info.lineStart + 1, ...replacement);
    return lines.join('\n');
  });
}
