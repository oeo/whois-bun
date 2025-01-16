#!/usr/bin/env bun

import {
  analyzePattern,
  generateCombinations,
  processPatterns,
  Bitmap,
  type PatternAnalysis
} from './lib';

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';

// CLI-specific constants
const VERSION = '1.0.0';
const DEFAULT_DELAY_MS = 100;  // 100ms between checks
const DEFAULT_PARALLEL = 2;    // Default to 2 parallel checks
let lastCheckTime = Date.now();

// File handling
let HISTORY_FILE = resolve('./domain-check-history.bitmap');
let AVAILABLE_FILE = resolve('./available-domains.txt');
let checkedDomains: Bitmap;

// Initialize bitmap with reasonable defaults
const initBitmap = () => {
  const bitmap = new Bitmap(1_000_000);
  console.log('Initialized bitmap:', bitmap.debug());
  return bitmap;
};

const saveHistory = () => {
  writeFileSync(HISTORY_FILE, checkedDomains.serialize());
};

const loadHistory = () => {
  if (existsSync(HISTORY_FILE)) {
    try {
      const data = readFileSync(HISTORY_FILE, 'utf8');
      checkedDomains = Bitmap.deserialize(data);
      console.log('Loaded bitmap state:', checkedDomains.debug());
    } catch (e) {
      console.error(`Error reading history file: ${HISTORY_FILE}, starting fresh`);
      checkedDomains = initBitmap();
    }
  } else {
    checkedDomains = initBitmap();
  }
};

const printUsage = () => {
  const name = 'domain-check';
  console.log(`Usage: ${name} --pattern <pattern> [options]

Description:
  Check domain name availability using whois lookups.
  Patterns can be provided as arguments, file, or piped through stdin.

Options:
  --pattern PATTERN       Domain name pattern to check
                          Special chars: c (consonant), v (vowel), n (number),
                          l (letter), - (hyphen), _ (any char), LITERAL (exact text)
  --extensions LIST       Comma-separated list of extensions to check
                          Default: .com
  --file PATH             Read patterns from file
  --file-history PATH     Path to history file
                          Default: ./domain-check-history.bitmap
  --file-available PATH   Path to available domains output file
                          Default: ./available-domains.txt
  --parallel N            Number of parallel whois lookups (default: 2)
  --delayms N             Delay between checks in milliseconds (default: 100)
  --help, -h              Display this help and exit
  --version, -v           Output version information and exit

Examples:
  ${name} --pattern "ccvvn"     Check pattern with consonants, vowels, number
  ${name} --pattern "ll-ll"     Check pattern with letters and hyphen
  ${name} --pattern "a_b"           Check pattern with wildcards
  ${name} --parallel 2              Run 2 whois lookups in parallel
  ${name} --delayms 100             Use 100ms delay between checks
  ${name} --file patterns.txt       Read patterns from file
  cat patterns.txt | ${name}        Pipe patterns from file
  echo "example.com" | ${name}      Check specific domains

Pattern File Format:
  # Comments start with #
  pattern ; extensions=.com,.net     # Inline comments supported
  ccvv                              # Simple pattern
  test-_ ; extensions=.dev,.com     # Multiple extensions

Exit Status:
  0  if OK
  1  if invalid arguments
  2  if serious trouble (e.g., cannot access input file)`);
  process.exit(1);
};

const showVersion = () => {
  console.log(`domain-check ${VERSION}`);
  process.exit(0);
};

const getStdin = async (): Promise<string> => {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString().trim();
};

const parseArgs = (args: string[]) => {
  // Handle help and version first, before any other output
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
  }

  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
  }

  const patternIndex = args.indexOf('--pattern');
  const extensionsIndex = args.indexOf('--extensions');
  const fileIndex = args.indexOf('--file');
  const historyFileIndex = args.indexOf('--file-history');
  const availableFileIndex = args.indexOf('--file-available');
  const parallelIndex = args.indexOf('--parallel');
  const delayMsIndex = args.indexOf('--delayms');

  return {
    pattern: patternIndex !== -1 ? args[patternIndex + 1] : null,
    extensions: extensionsIndex !== -1
      ? args[extensionsIndex + 1].split(',')
      : ['.com'],
    file: fileIndex !== -1 ? args[fileIndex + 1] : null,
    historyFile: historyFileIndex !== -1 ? resolve(args[historyFileIndex + 1]) : resolve('./domain-check-history.bitmap'),
    availableFile: availableFileIndex !== -1 ? resolve(args[availableFileIndex + 1]) : resolve('./available-domains.txt'),
    parallel: parallelIndex !== -1 ? Math.max(1, parseInt(args[parallelIndex + 1]) || DEFAULT_PARALLEL) : DEFAULT_PARALLEL,
    delayMs: delayMsIndex !== -1 ? Math.max(0, parseInt(args[delayMsIndex + 1]) || DEFAULT_DELAY_MS) : DEFAULT_DELAY_MS
  };
};

const readPatternsFile = (filepath: string): string => {
  try {
    return readFileSync(resolve(filepath), 'utf-8');
  } catch (error) {
    console.error(`Error reading patterns file: ${filepath}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
};

const saveAvailable = (domain: string) => {
  writeFileSync(AVAILABLE_FILE, `${domain}\n`, { flag: 'a' });
};

const delay = async (delayMs: number) => {
  const now = Date.now();
  const elapsed = now - lastCheckTime;
  if (elapsed < delayMs) {
    await new Promise(resolve => setTimeout(resolve, delayMs - elapsed));
  }
  lastCheckTime = Date.now();
};

const checkDomain = async (domain: string): Promise<{ available: boolean, success: boolean }> => {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      whois.kill();
      console.log(`\nTimeout checking ${domain}`);
      resolve({ available: false, success: false });  // Indicate check failed
    }, 5000);  // 5 second timeout

    const whois = spawn('whois', [domain]);
    let output = '';

    whois.stdout.on('data', (data) => {
      output += data.toString();
    });

    whois.stderr.on('data', (data) => {
      console.error(`\nError checking ${domain}:`, data.toString());
    });

    whois.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        console.error(`\nwhois process exited with code ${code}`);
        resolve({ available: false, success: false });  // Indicate check failed
        return;
      }

      const availablePatterns = [
        'No match for',
        'NOT FOUND',
        'Domain not found',
        'Status: AVAILABLE',
        'Domain Status: free',
        'Status: free',
        'No Data Found',
      ];

      const isAvailable = availablePatterns.some(pattern =>
        output.toUpperCase().includes(pattern.toUpperCase())
      );

      resolve({ available: isAvailable, success: true });  // Indicate successful check
    });
  });
};

async function main() {
  const args = process.argv.slice(2);
  const { pattern, extensions, file, historyFile, availableFile, parallel, delayMs } = parseArgs(args);
  
  // Update file paths if specified
  HISTORY_FILE = historyFile;
  AVAILABLE_FILE = availableFile;

  // Load history
  loadHistory();

  let patternsToCheck: { pattern: string, extensions: string[], comment?: string }[] = [];
  
  if (pattern) {
    patternsToCheck = [{ pattern, extensions }];
  } else if (file) {
    const fileContent = readPatternsFile(file);
    patternsToCheck = processPatterns(fileContent);
  } else {
    const stdin = await getStdin();
    if (stdin) {
      patternsToCheck = processPatterns(stdin);
    } else {
      printUsage();
    }
  }

  // Show startup banner only when we have patterns to check
  console.log('Starting domain availability checker...');
  console.log('Press Ctrl+C to stop at any time. Progress will be saved.');

  console.log('Validating patterns...');
  const analyses: PatternAnalysis[] = [];
  let totalDomainsToCheck = 0;

  for (const entry of patternsToCheck) {
    const result = analyzePattern(entry);
    if (typeof result === 'string') {
      console.error(`Invalid pattern "${entry.pattern}": ${result}`);
      process.exit(1);
    }
    analyses.push(result);
    totalDomainsToCheck += result.totalDomains;
  }

  console.log(`Found ${analyses.length} valid patterns`);
  console.log(`Total possible domains: ${totalDomainsToCheck}`);

  // Process each pattern
  for (const analysis of analyses) {
    console.log('\nPattern analysis:');
    if (analysis.comment) {
      console.log(`Description: ${analysis.comment}`);
    }
    console.log(`Pattern: ${analysis.pattern}`);
    console.log(`Extensions: ${analysis.extensions.join(', ')}`);
    console.log(`Total possible combinations: ${analysis.combinations}`);

    let globalCount = 0;
    let availableCount = 0;
    let skippedCount = 0;
    const checkPromises = new Set<Promise<void>>();

    for (const base of generateCombinations(analysis.parts)) {
      if (base.startsWith('-') || base.endsWith('-')) {
        continue;
      }

      for (const ext of analysis.extensions) {
        const domain = base + ext;

        // Skip if already checked
        if (checkedDomains.test(domain)) {
          skippedCount++;
          continue;
        }

        globalCount++;

        // Wait if we have too many checks in progress
        while (checkPromises.size >= parallel) {
          await Promise.race(Array.from(checkPromises));
        }

        const percentage = ((globalCount / (totalDomainsToCheck - skippedCount)) * 100).toFixed(2);
        process.stdout.write(
          `\rChecking ${domain}... (${globalCount}/${totalDomainsToCheck - skippedCount} - ${percentage}%) (found: ${availableCount})`
        );

        const domainToCheck = domain;  // Capture for closure
        const checkPromise = new Promise<void>(async (resolve) => {
          try {
            const checkResult = await checkDomain(domainToCheck);

            if (checkResult.success) {
              checkedDomains.add(domainToCheck);

              if (checkResult.available) {
                availableCount++;
                console.log(`\nFound available domain: ${domainToCheck}`);
                saveAvailable(domainToCheck);
              }

              // Save history more frequently
              if (globalCount % 5 === 0) {
                saveHistory();
              }
            } else {
              globalCount--;
            }

            await delay(delayMs);
          } finally {
            checkPromises.delete(checkPromise);
            resolve();
          }
        });

        checkPromises.add(checkPromise);
      }
    }

    // Wait for all remaining checks to complete
    if (checkPromises.size > 0) {
      await Promise.all(Array.from(checkPromises));
    }

    // Save history after each pattern is complete
    saveHistory();
  }

  console.log('\nFinished checking all patterns');
  // Final save of history
  saveHistory();
}

// Handle interruptions
process.on('SIGINT', () => {
  console.log('\nSaving progress before exit');
  saveHistory();
  process.exit();
});

// Run the script
main().catch(err => console.error(err));