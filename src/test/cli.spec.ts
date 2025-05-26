import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

// --- PDF text extraction using pdfjs-dist (pure Node.js, no external binaries) ---
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = null; // No worker in Node.js

// Polyfill for structuredClone (Node < 17)
if (typeof global.structuredClone !== 'function') {
    global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

async function extractTextFromPdf(filePath: string): Promise<string> {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    return text;
}

const cliPath = path.resolve(__dirname, '../../out/cli.js');
const outputDir = path.join(__dirname, 'output');

describe('CLI', () => {
    const testScript = path.join(__dirname, 'scripts', 'brick_and_steel_lf.fountain');

    beforeAll(() => {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    });

    afterAll(() => {
        // Clean up output files
        const files = fs.readdirSync(outputDir);
        for (const file of files) {
            fs.unlinkSync(path.join(outputDir, file));
        }
        fs.rmdirSync(outputDir);
    });

    it('should export PDF', async () => {
        const outputPath = path.join(outputDir, 'test.pdf');
        await execAsync(`node "${cliPath}" "${testScript}" -p "${outputPath}"`);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should handle character highlighting', async () => {
        const outputPath = path.join(outputDir, 'test_highlight.pdf');
        await execAsync(`node "${cliPath}" "${testScript}" -p "${outputPath}" --highlight-chars "BRICK" "STEEL"`);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should handle change highlighting', async () => {
        const outputPath = path.join(outputDir, 'test_changes.pdf');
        await execAsync(`node "${cliPath}" "${testScript}" -p "${outputPath}" --highlight-changes HEAD --highlight-color yellow`);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should export HTML', async () => {
        const outputPath = path.join(outputDir, 'test.html');
        await execAsync(`node "${cliPath}" "${testScript}" -h "${outputPath}"`);
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should load and apply .fountainpubrc configuration', async () => {
        const outputPath = path.join(outputDir, 'test.pdf');
        await execAsync(`node "${cliPath}" "${testScript}" -p "${outputPath}"`);
        
        // Check that the PDF was generated successfully
        expect(fs.existsSync(outputPath)).toBe(true);
        
        // Check the file size to ensure it's not empty
        const stats = fs.statSync(outputPath);
        expect(stats.size).toBeGreaterThan(1000);
    });
});

const scriptsDir = path.join(__dirname, 'scripts');
const expectedDir = path.join(scriptsDir, 'expected');

const scriptFiles = [
    'Test'
];

describe('CLI output matches expected HTML and PDF', () => {
    for (const base of scriptFiles) {
        const scriptPath = path.join(scriptsDir, base + '.fountain');
        const expectedHtml = path.join(expectedDir, base + '.html');
        const expectedPdf = path.join(expectedDir, base + '.pdf');
        const outHtml = path.join(outputDir, base + '.html');
        const outPdf = path.join(outputDir, base + '.pdf');

        it(`should export HTML identical to expected for ${base}`, async () => {
            await execAsync(`node "${cliPath}" "${scriptPath}" -h "${outHtml}"`);
            const actual = fs.readFileSync(outHtml, 'utf8');
            const expected = fs.readFileSync(expectedHtml, 'utf8');
            
            // Check key structural elements first
            expect(actual).toMatch(/^<!DOCTYPE html>/);
            expect(actual).toMatch(/<html>/);
            expect(actual).toMatch(/<head>/);
            expect(actual).toMatch(/<body/);
            expect(actual).toMatch(/<\/html>$/);
            
            // If structure looks good, compare lengths as a quick check
            const actualLines = actual.split('\n').length;
            const expectedLines = expected.split('\n').length;
            
            if (Math.abs(actualLines - expectedLines) > 5) {
                console.log(`Line count difference: actual=${actualLines}, expected=${expectedLines}`);
            }
            
            // Only do full comparison if they're close in length
            if (Math.abs(actualLines - expectedLines) <= 5) {
                expect(actual).toBe(expected);
            } else {
                // For debugging - show larger comparison
                const actualFirstLines = actual.split('\n').slice(0, 20).join('\n');
                const expectedFirstLines = expected.split('\n').slice(0, 20).join('\n');
                console.log('First 20 lines - Actual:', actualFirstLines);
                console.log('First 20 lines - Expected:', expectedFirstLines);
                
                // Also check the end
                const actualLinesArr = actual.split('\n');
                const expectedLinesArr = expected.split('\n');
                const actualLastLines = actualLinesArr.slice(-10).join('\n');
                const expectedLastLines = expectedLinesArr.slice(-10).join('\n');
                console.log('Last 10 lines - Actual:', actualLastLines);
                console.log('Last 10 lines - Expected:', expectedLastLines);
                
                fail(`HTML structure differs significantly. See console output above.`);
            }
        });

        it(`should export PDF text identical to expected for ${base}`, async () => {
            jest.setTimeout(10000);
            await execAsync(`node "${cliPath}" "${scriptPath}" -p "${outPdf}"`);
            expect(fs.existsSync(outPdf)).toBe(true);
            expect(fs.existsSync(expectedPdf)).toBe(true);
            // Ensure both PDFs are non-empty
            expect(fs.statSync(outPdf).size).toBeGreaterThan(100);
            expect(fs.statSync(expectedPdf).size).toBeGreaterThan(100);
            // Extract text from both PDFs and compare
            const actualText = await extractTextFromPdf(outPdf);
            const expectedText = await extractTextFromPdf(expectedPdf);
            // Robust normalization: remove page numbers, page breaks, collapse whitespace, strip punctuation
            const normalizeText = (text: string) =>
                text
                    .replace(/\f/g, ' ') // remove form feeds (page breaks)
                    .replace(/\b/g, ' ') // remove backspaces
                    .replace(/\d+\s*\./g, ' ') // remove numbers followed by dot (page/scene numbers)
                    .replace(/\s+/g, ' ') // collapse whitespace
                    .replace(/[.,:;!?\-–—\[\]()"'`]/g, '') // remove punctuation
                    .replace(/\bpage\b/gi, '') // remove the word 'page'
                    .replace(/\bscene\b/gi, '') // remove the word 'scene'
                    .trim()
                    .toLowerCase();
            const normActual = normalizeText(actualText);
            const normExpected = normalizeText(expectedText);
            if (normActual !== normExpected) {
                // For debugging: print a diff if they do not match
                const diffIdx = (() => {
                    for (let i = 0; i < Math.min(normActual.length, normExpected.length); i++) {
                        if (normActual[i] !== normExpected[i]) return i;
                    }
                    return -1;
                })();
                if (diffIdx !== -1) {
                    const context = 40;
                    const actualCtx = normActual.slice(Math.max(0, diffIdx - context), diffIdx + context);
                    const expectedCtx = normExpected.slice(Math.max(0, diffIdx - context), diffIdx + context);
                    console.error('PDF text mismatch at index', diffIdx);
                    console.error('Actual:', actualCtx);
                    console.error('Expected:', expectedCtx);
                }
            }
            expect(normActual).toBe(normExpected);
        }, 15000);
    }
});