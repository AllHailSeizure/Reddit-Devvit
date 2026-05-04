import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const bundle = readFileSync('./webroot/bundle.js', 'utf8');
mkdirSync('./src/server/generated', { recursive: true });
writeFileSync(
  './src/server/generated/client-bundle.ts',
  `// AUTO-GENERATED — do not edit\nexport const CLIENT_BUNDLE: string = ${JSON.stringify(bundle)};\n`,
);
console.log(`Embedded client bundle (${bundle.length} chars)`);
