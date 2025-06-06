#!/usr/bin/env node

import { Command } from 'commander';
import { exportHtml } from './providers/StaticHtml';
import { getStatistics } from './providers/Statistics';
import { getDocumentStatistics } from './providers/Statistics';
import { exportPdf } from './commands';
import { getFountainConfig } from './configloader';
import * as afterparser from './afterwriting-parser';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { inspect } from 'util';

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

const program = new Command();

program
    .name('fountainpub')
    .description('Convert Fountain screenplay files to HTML and PDF')
    .version(packageJson.version)
    .argument('<source>', 'Source Fountain file')
    .option('-p, --pdf [output]', 'Output PDF file (uses source name if not specified)')
    .option('-h, --html [output]', 'Output HTML file (uses source name if not specified)')
    .option('-i, --info', 'Print statistics and info')
    .option('--preview', 'Preview mode: export HTML, stats, and PDF (if HTML changed) to /tmp/fountainpub_preview/')
    .option('--highlight-chars <characters...>', 'Highlight specific characters in the output')
    .option('--highlight-changes <commit>', 'Highlight changes from a specific Git commit')
    .option('--highlight-color <color>', 'Color for highlighted changes (yellow, green, blue, red, magenta, cyan, orange, brown)')
    .action(async (source, options) => {
        try {
            // Expand tilde (~) to home directory
            if (source.startsWith('~/')) {
                source = path.join(os.homedir(), source.slice(2));
            }

            const baseName = path.basename(source, path.extname(source));
            const content = fs.readFileSync(source, 'utf8');
            const config = getFountainConfig(source);
            const parsed = afterparser.parse(content, config, true);

            if (options.preview) {
                try {
                    const previewDir = '/tmp/fountainpub_preview';

                    // Ensure the preview directory exists
                    if (!fs.existsSync(previewDir)) {
                        fs.mkdirSync(previewDir, { recursive: true });
                    }

                    const htmlPath = path.join(previewDir, `${baseName}.html`);
                    const statsPath = path.join(previewDir, `${baseName}-stats.json`);
                    const pdfPath = path.join(previewDir, `${baseName}.pdf`);
                    const previousHtmlPath = path.join(previewDir, `${baseName}-previous.html`);

                    const generateOutputs = async () => {
                        try {
                            // Re-read content and re-parse for fresh data
                            const freshContent = fs.readFileSync(source, 'utf8');
                            const freshConfig = getFountainConfig(source);
                            const freshParsed = afterparser.parse(freshContent, freshConfig, true);

                            // Always generate HTML (like -h option)
                            await exportHtml(freshParsed, freshConfig, source, htmlPath);

                            // Always generate statistics (like -i option)
                            const stats = await getDocumentStatistics(freshContent, freshConfig);
                            fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));

                            // Check if HTML has changed by comparing with previous version
                            let shouldGeneratePdf = true;
                            if (fs.existsSync(previousHtmlPath)) {
                                const previousHtml = fs.readFileSync(previousHtmlPath, 'utf8');
                                const currentHtml = fs.readFileSync(htmlPath, 'utf8');
                                shouldGeneratePdf = previousHtml !== currentHtml;
                            }

                            // Generate PDF only if HTML has changed (like -p option)
                            if (shouldGeneratePdf) {
                                // Use child process to generate PDF to avoid process exit issues
                                const { spawn } = require('child_process');

                                const pdfProcess = spawn('node', [
                                    path.join(__dirname, 'cli.js'),
                                    source,
                                    '-p',
                                    pdfPath
                                ], {
                                    stdio: ['ignore', 'pipe', 'pipe']
                                });

                                let stderr = '';

                                if (pdfProcess.stderr) {
                                    pdfProcess.stderr.on('data', (data: Buffer) => {
                                        stderr += data.toString();
                                    });
                                }

                                pdfProcess.on('close', (code: number | null) => {
                                    if (code === 0) {
                                        // Save current HTML as previous for next comparison
                                        fs.copyFileSync(htmlPath, previousHtmlPath);
                                    } else {
                                        if (stderr) {
                                            console.error('PDF generation failed:', stderr);
                                        }
                                        // Still save the HTML for comparison, but don't crash
                                        fs.copyFileSync(htmlPath, previousHtmlPath);
                                    }
                                });

                                pdfProcess.on('error', (error: Error) => {
                                    console.error('PDF generation process error:', error.message);
                                    // Still save the HTML for comparison, but don't crash
                                    fs.copyFileSync(htmlPath, previousHtmlPath);
                                });
                            } else {
                                // Save current HTML as previous for next comparison even when PDF not generated
                                fs.copyFileSync(htmlPath, previousHtmlPath);
                            }
                        } catch (error: any) {
                            console.error(`Error during generation:`, error.message);
                        }
                    };

                    // Initial generation
                    await generateOutputs();

                    // Watch for file changes
                    console.error(`Watching ${source} for changes... Press Ctrl+C to exit.`);

                    const watcher = fs.watch(source, (eventType: string) => {
                        if (eventType === 'change') {
                            generateOutputs();
                        }
                    });

                    // Cleanup function
                    const cleanup = () => {
                        console.error('\nStopping preview mode...');
                        watcher.close();
                        clearInterval(keepAliveInterval);

                        // Clean up temporary directory
                        try {
                            if (fs.existsSync(previewDir)) {
                                fs.rmSync(previewDir, { recursive: true, force: true });
                                console.error('Cleaned up preview directory.');
                            }
                        } catch (err) {
                            console.error('Warning: Could not clean up preview directory:', err.message);
                        }

                        process.exit(0);
                    };

                    // Handle graceful shutdown
                    process.on('SIGINT', cleanup);
                    process.on('SIGTERM', cleanup);

                    // Keep the process alive
                    const keepAliveInterval = setInterval(() => {
                        // Do nothing, just keep the event loop alive
                    }, 30000); // Check every 30 seconds

                    // Return a promise that never resolves to keep the action function alive
                    return new Promise<void>(() => {
                        // This promise never resolves, keeping the process alive
                    });
                } catch (err: any) {
                    console.error('Error in preview mode:', err.message);
                    process.exit(1);
                }
            }

            if (options.info) {
                try {
                    const stats = await getStatistics();
                    console.log('Statistics:');
                    console.log(inspect(stats, { 
                        colors: true, 
                        depth: null, 
                        compact: false,
                        breakLength: 80 
                    }));
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

            if (!options.html && !options.pdf && !options.info && !options.preview) {
                console.error('Error: At least one output format must be specified (-h, -p, -i, or --preview)');
                process.exit(1);
            }
        } catch (err) {
            console.error('Fatal error in CLI action:', err.stack || err.message);
            process.exit(1);
        }
    });

program.parse();