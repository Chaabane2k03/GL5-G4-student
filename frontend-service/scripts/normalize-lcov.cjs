const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const coverageFile = path.join(root, 'coverage', 'cursus-frontend', 'lcov.info');
const srcRoot = path.join(root, 'src');
const sources = new Map();

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      sources.set(entry.name, path.relative(root, fullPath).split(path.sep).join('/'));
    }
  }
}

if (!fs.existsSync(coverageFile)) {
  console.error(`Missing coverage report: ${coverageFile}`);
  process.exit(1);
}

walk(srcRoot);

const lcov = fs.readFileSync(coverageFile, 'utf8');
const normalized = lcov.replace(/^SF:(.+)$/gm, (line, sourcePath) => {
  const normalizedPath = sourcePath.replace(/\\/g, '/');
  const relativePath = sources.get(path.basename(normalizedPath));
  return relativePath ? `SF:${relativePath}` : line;
});

fs.writeFileSync(coverageFile, normalized);
