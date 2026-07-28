// Inlines src/ files into a single self-contained index.html. No dependencies.
import { readFileSync, writeFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

let html = read('./src/template.html');
const parts = {
  '/*INLINE:STYLE*/': read('./src/style.css'),
  '/*INLINE:ENGINE*/': read('./src/engine.js'),
  '/*INLINE:LESSONS*/': read('./src/lessons.js'),
  '/*INLINE:APP*/': read('./src/app.js'),
};

for (const [marker, content] of Object.entries(parts)) {
  if (!html.includes(marker)) {
    console.error(`build: marker ${marker} missing from template`);
    process.exit(1);
  }
  // safety: inline <script> content must not contain a closing script tag
  if (marker !== '/*INLINE:STYLE*/' && content.includes('</script>')) {
    console.error(`build: ${marker} content contains </script>`);
    process.exit(1);
  }
  html = html.replace(marker, content);
}

writeFileSync(new URL('./index.html', import.meta.url), html);
console.log(`build: index.html written (${(html.length / 1024).toFixed(1)} KB)`);

// LLM-friendly guide: same lesson data, plain markdown, one file per audience.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const engine = require('./src/engine.js');
const lessons = require('./src/lessons.js');

const guide = [
  lessons.guideMarkdown(engine, 'linux'),
  '\n---\n\n> macOS: identical to the Linux guide above (same commands, same 5 daemons).\n\n---\n',
  lessons.guideMarkdown(engine, 'windows'),
].join('\n');

writeFileSync(new URL('./llms.txt', import.meta.url), guide);
writeFileSync(new URL('./GUIDE.md', import.meta.url), guide);
console.log(`build: llms.txt + GUIDE.md written (${(guide.length / 1024).toFixed(1)} KB)`);
