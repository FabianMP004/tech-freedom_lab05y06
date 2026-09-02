import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const PLACEHOLDER = /^(?:<[^>]+>|replace-with(?:-[\w-]+)*|changeme|change-me|example|your-[\w-]+|set-in-runtime|runtime-only)$/i;
const TEXT_EXTENSIONS = new Set(['', '.cjs', '.css', '.env', '.example', '.html', '.js', '.json', '.mjs', '.md', '.sh', '.txt', '.ts', '.yaml', '.yml']);
const ASSIGNMENT = /\b([A-Z][A-Z0-9_-]*(?:MNEMONIC|PRIVATE[_-]?KEY|SECRET|TOKEN|PASSWORD|API[_-]?KEY|AUTH[_-]?TOKEN))\b\s*[:=]\s*["'`]([^"'`\r\n]+)["'`]?/gi;
const PRIVATE_KEY = /\b(?:0x)?[a-f0-9]{64}\b/i;
const CREDENTIAL_PREFIX = /\b(?:sk|pk|ghp|github_pat|xoxb|xapp|AIza)[_-][A-Za-z0-9_-]{16,}\b/;
const MNEMONIC_WORDS = new Set('abandon ability able about above absent absorb abstract absurd abuse access accident account accuse achieve acid acoustic acquire across act action actor actress actual adapt add addict address adjust admit adult advance advice aerobic affair afford afraid again age agent agree ahead aim air airport aisle alarm album alcohol alert alien all alley allow almost alone alpha already also alter always amateur amazing among amount amused analyst anchor ancient anger angle angry animal ankle announce annual another answer antenna antique anxiety any apart apology appear apple approve april arch arctic area arena argue arm armed armor army around arrange arrest arrive arrow art artefact artist artwork ask aspect assault asset assist assume asthma athlete atom attack attend attitude attract auction audit august aunt author auto autumn average avocado avoid awake aware away awesome awful awkward axis'.split(' '));

function isPlaceholder(value) {
  return PLACEHOLDER.test(value.trim().replace(/[;,]+$/, ''));
}

function hasMnemonic(value) {
  const words = value.trim().split(/\s+/);
  return words.length >= 12 && words.length <= 24 && words.every((word) => MNEMONIC_WORDS.has(word.toLowerCase()));
}

export function scanText(text, fileName = 'fixture') {
  const findings = [];
  const add = (line, reason) => findings.push(`${fileName}:${line}: ${reason}`);

  text.split(/\r?\n/).forEach((lineText, index) => {
    const line = index + 1;
    for (const match of lineText.matchAll(ASSIGNMENT)) {
      const value = match[2].trim();
      if (isPlaceholder(value) || /bolt11/i.test(lineText)) continue;
      if (/MNEMONIC/i.test(match[1]) && hasMnemonic(value)) add(line, 'mnemonic assignment');
      else if (/PRIVATE[_-]?KEY/i.test(match[1]) && PRIVATE_KEY.test(value)) add(line, 'private-key assignment');
      else if (/(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY|AUTH[_-]?TOKEN)/i.test(match[1]) && (CREDENTIAL_PREFIX.test(value) || value.length >= 24)) add(line, 'credential assignment');
    }
    if (!/bolt11/i.test(lineText) && PRIVATE_KEY.test(lineText)) add(line, 'private-key material');
    if (!/bolt11/i.test(lineText) && CREDENTIAL_PREFIX.test(lineText)) add(line, 'credential material');
  });
  return [...new Set(findings)];
}

function textFiles(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    if (entry === '.git' || entry === 'node_modules' || entry === 'coverage') continue;
    const file = join(directory, entry);
    if (statSync(file).isDirectory()) textFiles(file, files);
    else if (TEXT_EXTENSIONS.has(extname(entry).toLowerCase())) files.push(file);
  }
  return files;
}

function main() {
  const files = textFiles(process.cwd());
  const findings = files.flatMap((file) => scanText(readFileSync(file, 'utf8'), file));
  if (findings.length > 0) {
    console.error(findings.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`Secret scan passed (${files.length} text files).`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
