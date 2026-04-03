import esbuild from 'esbuild';
import { argv } from 'process';

const watch = argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'main.js',
  external: ['obsidian', 'electron'],
  format: 'cjs',
  target: 'es2018',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  sourcemap: 'inline',
  treeShaking: true,
  logLevel: 'info',
});

if (watch) {
  await ctx.watch();
  console.log('Watching for changes…');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
