#!/usr/bin/env node

import { Command } from 'commander';
import { exportHtml } from './providers/StaticHtml';
import { getStatistics } from './providers/Statistics';
import { exportPdf } from './commands';
import { getFountainConfig } from './configloader';
import * as afterparser from './afterwriting-parser';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

program
    .name('fountainpub')
    .description('Convert Fountain screenplay files to HTML and PDF')
    .version('1.0.0')
    .argument('<source>', 'Source Fountain file')
    .option('-p, --pdf [output]', 'Output PDF file (uses source name if not specified)')
    .option('-h, --html [output]', 'Output HTML file (uses source name if not specified)')
    .option('-i, --info', 'Print statistics and info')
    .option('--highlight-chars <characters...>', 'Highlight specific characters in the output')
    .option('--highlight-changes <commit>', 'Highlight changes from a specific Git commit')
    .option('--highlight-color <color>', 'Color for highlighted changes (yellow, green, blue, red, magenta, cyan, orange, brown)')
    .action(async (source, options) => {
        try {
            const baseName = path.basename(source, path.extname(source));
            const content = fs.readFileSync(source, 'utf8');
            const config = getFountainConfig(source);
            const parsed = afterparser.parse(content, config, true);
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
                    await exportHtml(parsed, config, source, htmlOutput);
                } catch (err) {
                    console.error('Error in exportHtml:', err.stack || err.message);
                    process.exit(1);
                }
            }

            if (options.pdf) {
                const pdfOutput = options.pdf || `${baseName}.pdf`;
                try {
                    const highlightChanges = options.highlightChanges ? {
                        commitHash: options.highlightChanges,
                        highlightColor: options.highlightColor
                    } : undefined;
                    await exportPdf(source, pdfOutput, options.highlightChars, highlightChanges, config, parsed);
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