// Patch PDF.js worker for Node so pdf-parse works (for pdfjs-dist v2.x)
const pdfjsLib = require('pdfjs-dist/build/pdf.js');
pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.js');
module.exports = require('pdf-parse');
