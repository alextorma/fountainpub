import * as fs from 'fs';
import * as path from 'path';
import * as afterparser from '../afterwriting-parser';
import { getFountainConfig } from '../configloader';
import { getActiveFountainDocument, getEditor } from '../utils';

export async function exportHtml(parsed?: any, fountainconfig?: any, sourcePath?: string, outputPath?: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            if (!parsed || !fountainconfig) {
                const activeDoc = getActiveFountainDocument();
                if (!activeDoc) {
                    reject(new Error('No active document'));
                    return;
                }
                const editor = getEditor(activeDoc);
                fountainconfig = getFountainConfig(editor.document.fileName);
                parsed = afterparser.parse(editor.document.getText(), fountainconfig, true);
                sourcePath = activeDoc;
            }

            const sourceFile = sourcePath || parsed.source;

            if (!sourceFile) {
                reject(new Error('Source file path is required'));
                return;
            }

            const finalOutputPath = outputPath || path.join(path.dirname(sourceFile), path.basename(sourceFile, '.fountain') + '.html');

            // Ensure output directory exists
            const outputDir = path.dirname(finalOutputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Load HTML template
            const templatePath = path.join(__dirname, '..', 'assets', 'StaticExports.html');
            let templateHtml: string;

            try {
                templateHtml = fs.readFileSync(templatePath, 'utf8');
            } catch (templateErr) {
                // Fallback to compiled assets location
                const compiledTemplatePath = path.join(__dirname, '..', '..', 'out', 'assets', 'StaticExports.html');
                templateHtml = fs.readFileSync(compiledTemplatePath, 'utf8');
            }

            // Replace template variables
            let finalHtml = templateHtml;

            // Replace title page content
            finalHtml = finalHtml.replace('$TITLEPAGE$', parsed.titleHtml || '');

            // Replace screenplay content
            finalHtml = finalHtml.replace('$SCREENPLAY$', parsed.scriptHtml || '');
            
            // Replace print profile (a4 or us-letter)
            const printProfile = fountainconfig.print_profile === 'usletter' ? 'us-letter' : fountainconfig.print_profile || 'us-letter';
            finalHtml = finalHtml.replace('$PRINTPROFILE$', printProfile);
            
            // Handle title display (show/hide title page)
            // Only replace $TITLEDISPLAY$ if we actually want to hide the title
            if (!(parsed.titleHtml && parsed.titleHtml.trim())) {
                finalHtml = finalHtml.replace('$TITLEDISPLAY$', 'hidden');
            }
            // If titleDisplay is empty string, leave $TITLEDISPLAY$ placeholder unchanged

            // Handle script class for scene numbers
            let scriptClass = 'innerpage';
            if (fountainconfig.scenes_numbers || fountainconfig.scene_numbers) {
                const sceneNumbers = fountainconfig.scenes_numbers || fountainconfig.scene_numbers;
                if (sceneNumbers === 'left') {
                    scriptClass += ' numberonleft';
                } else if (sceneNumbers === 'right') {
                    scriptClass += ' numberonright';
                } else if (sceneNumbers === 'both') {
                    scriptClass += ' numberonboth';
                } else {
                    scriptClass += ' screenplay';
                }
            } else {
                scriptClass += ' screenplay';
            }
            finalHtml = finalHtml.replace('$SCRIPTCLASS$', scriptClass);

            // Load and embed font files as base64
            const fontDir = path.join(__dirname, '..', 'courierprime');

            // Load all courier prime font variants
            const courierPrime = fs.readFileSync(path.join(fontDir, 'courier-prime.ttf'));
            const courierPrimeBold = fs.readFileSync(path.join(fontDir, 'courier-prime-bold.ttf'));
            const courierPrimeItalic = fs.readFileSync(path.join(fontDir, 'courier-prime-italic.ttf'));
            const courierPrimeBoldItalic = fs.readFileSync(path.join(fontDir, 'courier-prime-bold-italic.ttf'));

            // Convert to base64 and replace template variables
            finalHtml = finalHtml.replace('$COURIERPRIME$', courierPrime.toString('base64'));
            finalHtml = finalHtml.replace('$COURIERPRIME-BOLD$', courierPrimeBold.toString('base64'));
            finalHtml = finalHtml.replace('$COURIERPRIME-ITALIC$', courierPrimeItalic.toString('base64'));
            finalHtml = finalHtml.replace('$COURIERPRIME-BOLDITALIC$', courierPrimeBoldItalic.toString('base64'));

            fs.writeFileSync(finalOutputPath, finalHtml);
            resolve();
        } catch (err) {
            reject(err);
        }
    });
}