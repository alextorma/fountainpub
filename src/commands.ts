'use strict';
import { getFountainConfig, ExportConfig } from "./configloader";
import * as afterparser from "./afterwriting-parser";
import { GeneratePdf } from "./pdf/pdf";
import { getActiveFountainDocument, getEditor } from "./utils";
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function exportPdf(source: string, outputPath?: string, highlightCharacters: string[] = [], highlightChanges?: { commitHash?: string, highlightColor?: string }, config?: any, parsed?: any) {
  // If config and parsed are not provided, fall back to loading them (for backwards compatibility)
  if (!config || !parsed) {
    const editor = getEditor(getActiveFountainDocument());
    config = getFountainConfig(getActiveFountainDocument());
    parsed = await afterparser.parse(editor.document.getText(), config, false);
  }

  const exportconfig: ExportConfig = { 
    highlighted_characters: [], 
    highlighted_changes: { lines: [], highlightColor: [] }
  };

  // Handle character highlighting
  if (highlightCharacters.length > 0) {
    exportconfig.highlighted_characters = highlightCharacters;
    const filenameCharacters = [...highlightCharacters]; //clone array
    if (filenameCharacters.length > 3) {
      filenameCharacters.length = 3;
      filenameCharacters.push('+' + (highlightCharacters.length - 3)); //add "+n" if there's over 3 highlighted characters
    }
    source += '(' + filenameCharacters.map(v => v.replace(' ', '')).join(',') + ')'; //remove spaces from names and join
  }

  // Handle change highlighting using Git
  if (highlightChanges?.commitHash) {
    try {
      // Get the diff for the specified commit
      const { stdout: diffOutput } = await execAsync(`git diff ${highlightChanges.commitHash} -- "${source}"`);
      
      const lineNumbers: number[] = [];
      const lines = diffOutput.split('\n');
      let newLineNum = 0;
      const hunkHeaderRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
    
      for (const line of lines) {
        if (line.startsWith('@@')) {
          const match = hunkHeaderRegex.exec(line);
          if (match) {
            newLineNum = parseInt(match[1], 10) - 1;
          }
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
          newLineNum++;
          lineNumbers.push(newLineNum);
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          // Removed line, do not increment newLineNum
        } else {
          // Unchanged line
          newLineNum++;
        }
      }

      if (lineNumbers.length > 0) {
        const highlightColorMap = {
          yellow: [255, 252, 82],
          green: [117, 255, 82],
          blue: [82, 194, 255],
          red: [252, 101, 96],
          magenta: [252, 114, 222],
          cyan: [122, 250, 250],
          orange: [252, 186, 78],
          brown: [181, 140, 101]
        };

        exportconfig.highlighted_changes.lines = lineNumbers;
        exportconfig.highlighted_changes.highlightColor = highlightColorMap[highlightChanges.highlightColor as keyof typeof highlightColorMap] || highlightColorMap.yellow;
      }
    } catch (error) {
      console.error('Error getting Git diff:', error);
    }
  }

  // If no output path specified, use source filename with .pdf extension
  const filename = outputPath || source.replace(/(\.(((better)?fountain)|spmd|txt))$/, '') + '.pdf';

  // Ensure the output directory exists
  const outputDir = path.dirname(filename);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await GeneratePdf(filename, config, exportconfig, parsed);
  return filename;
}