#!/usr/bin/env node

import { Command } from 'commander';
import { exportHtml } from './providers/StaticHtml';
import { getStatistics } from './providers/Statistics';
import { exportPdf } from './commands';
import { getFountainConfig } from './configloader';
import * as afterparser from './afterwriting-parser';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const program = new Command();

program
    .name('fountainpub')
    .description('Convert Fountain screenplay files to HTML and PDF')
    .version('1.0.2')
    .argument('<source>', 'Source Fountain file')
    .option('-p, --pdf [output]', 'Output PDF file (uses source name if not specified)')
    .option('-h, --html [output]', 'Output HTML file (uses source name if not specified)')
    .option('-i, --info', 'Print statistics and info')
    .option('--highlight-chars <characters...>', 'Highlight specific characters in the output')
    .option('--highlight-changes <commit>', 'Highlight changes from a specific Git commit')
    .option('--highlight-color <color>', 'Color for highlighted changes (yellow, green, blue, red, magenta, cyan, orange, brown)')
    .action(async (source, options) => {
        try {
            // Expand tilde (~) to home directory
            if (source.startsWith('~/')) {
                source = path.join(os.homedir(), source.slice(2));
            }
            
            // console.log('DEBUG: Starting CLI with source:', source); // DEBUG
            const baseName = path.basename(source, path.extname(source));
            // console.log('DEBUG: Base name:', baseName); // DEBUG
            // console.log('DEBUG: Reading file...'); // DEBUG
            const content = fs.readFileSync(source, 'utf8');
            // console.log('DEBUG: File read, length:', content.length); // DEBUG
            // console.log('DEBUG: Loading config...'); // DEBUG
            const config = getFountainConfig(source);
            // console.log('DEBUG: Config loaded, parsing...'); // DEBUG
            const parsed = afterparser.parse(content, config, true);
            // console.log('DEBUG: Parsing completed'); // DEBUG
            if (options.info) {
                try {
                    const stats = await getStatistics();
                    console.log('Statistics:', stats);
                } catch (err) {
                    console.error('Error:', err.message);
                    process.exit(1);
                }
            }

            if (options.html) {
                try {
                    const htmlOutput = options.html === true ? undefined : options.html;
                    // console.log('DEBUG HTML: Output path:', htmlOutput || 'default'); // DEBUG
                    // console.log('DEBUG HTML: Starting export...'); // DEBUG
                    await exportHtml(parsed, config, source, htmlOutput);
                    // console.log('DEBUG HTML: Export completed'); // DEBUG
                } catch (err) {
                    console.error('Error in exportHtml:', err.stack || err.message);
                    process.exit(1);
                }
            }

            if (options.pdf) {
                const pdfOutput = (typeof options.pdf === 'string')
                    ? options.pdf
                    : path.join(path.dirname(source), `${baseName}.pdf`);
                // console.log('DEBUG PDF: Output path:', pdfOutput); // DEBUG
                try {
                    const highlightChanges = options.highlightChanges ? {
                        commitHash: options.highlightChanges,
                        highlightColor: options.highlightColor
                    } : undefined;
                    // console.log('DEBUG PDF: Starting export...'); // DEBUG
                    await exportPdf(source, pdfOutput, options.highlightChars, highlightChanges, config, parsed);
                    // console.log('DEBUG PDF: Export completed'); // DEBUG
                } catch (err) {
                    console.error('Error:', err.message);
                    process.exit(1);
                }
            }

            if (!options.html && !options.pdf && !options.info) {
                console.error('Error: At least one output format must be specified (-h, -p, or -i)');
                process.exit(1);
            }
        } catch (err) {
            console.error('Fatal error in CLI action:', err.stack || err.message);
            process.exit(1);
        }
    });

program.parse(); 