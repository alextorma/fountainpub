// import { previews } from "./providers/Preview";
import { FountainStructureProperties } from "./afterwriting-parser";
import * as parser from "./afterwriting-parser";
import * as path from "path";
import * as sceneNumbering from './scenenumbering';
import * as fs from "fs";

/**
 * @returns {string | undefined} Path to the fountain document provided as CLI argument, or undefined if not found
 */
export function getActiveFountainDocument(): string | undefined {
    const filePath = process.argv[2];
    if (!filePath) return undefined;
    // Check if it's a fountain file by extension
    const ext = path.extname(filePath).toLowerCase();
    const validExtensions = ['.fountain', '.betterfountain', '.spmd', '.txt'];
    if (!validExtensions.includes(ext)) return undefined;
    return filePath;
}

/**
 * @param uri the path of the fountain document
 * @returns an editor-like object with .document.fileName and .document.getText()
 */
export function getEditor(uri: string | undefined): { document: { fileName: string, getText: () => string } } | undefined {
    if (!uri) return undefined;
    const content = fs.readFileSync(uri, 'utf8');
    return {
        document: {
            fileName: uri,
            getText: () => content
        }
    };
}

//var syllable = require('syllable');

export function slugify(text: string): string
{
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w-]+/g, '')       // Remove all non-word chars
    .replace(/-{2,}/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

/**
 * Trims character extensions, for example the parantheses part in `JOE (on the radio)`
 */
export const trimCharacterExtension = (character: string): string => character.replace(/[ \t]*(\(.*\))[ \t]*([ \t]*\^)?$/, "");

export const parseLocationInformation = (scene_heading:RegExpMatchArray) => {
	//input group 1 is int/ext, group 2 is location and time, group 3 is scene number
	let splitLocationFromTime = scene_heading[2].match(/(.*)[-–—−](.*)/)
	if (scene_heading != null && scene_heading.length>=3) {
		return {
			name: splitLocationFromTime ? splitLocationFromTime[1].trim() : scene_heading[2].trim(),
			interior: scene_heading[1].indexOf('I') != -1,
			exterior: scene_heading[1].indexOf('EX') != -1|| scene_heading[1].indexOf('E.')!= -1,
			time_of_day: splitLocationFromTime ? splitLocationFromTime[2].trim() : ""
		}
	}
	return null;
}

/**
 * Trims the `@` symbol necessary in character names if they contain lower-case letters, i.e. `@McCONNOR`
 */
export const trimCharacterForceSymbol = (character: string): string => character.replace(/^[ \t]*@/, "");

/**
 * Character names containing lowercase letters need to be prefixed with an `@` symbol
 */
export const addForceSymbolToCharacter = (characterName: string): string => {
	const containsLowerCase = (text: string): boolean =>((/[\p{Ll}]/u).test(text));
	return containsLowerCase(characterName) ? `@${characterName}` : characterName;
}

export const getCharactersWhoSpokeBeforeLast = (parsedDocument: any, line: number) => {
    let searchIndex = 0;
    if(parsedDocument.tokenLines[line-1]){
        searchIndex = parsedDocument.tokenLines[line-1];
    }
    let stopSearch = false;
    let previousCharacters: string[] = []
    let lastCharacter = undefined;
    while(searchIndex>0 && !stopSearch){
        var token = parsedDocument.tokens[searchIndex-1];
        if(token.type=="character"){
            var name = trimCharacterForceSymbol(trimCharacterExtension(token.text)).trim();
            if(lastCharacter==undefined){
                lastCharacter = name;
            }
            else if(name != lastCharacter && previousCharacters.indexOf(name)==-1){
                previousCharacters.push(name);
            }
        }
        else if(token.type=="scene_heading"){
            stopSearch=true;
        }
        searchIndex--;
    }
    if(lastCharacter!=undefined)
        previousCharacters.push(lastCharacter);
    return previousCharacters;
}

export const findCharacterThatSpokeBeforeTheLast = (
    content: string,
    line: number,
    fountainDocProps: FountainStructureProperties,
): string => {
    const isAlreadyMentionedCharacter = (text: string): boolean => fountainDocProps.characters.has(text);
    const lines = content.split('\n');

    let characterBeforeLast = "";
    let lineToInspect = 1;
    let foundLastCharacter = false;
    do {
        if (line - lineToInspect < 0) break;
        let potentialCharacterLine = lines[line - lineToInspect].trimRight();
        potentialCharacterLine = trimCharacterExtension(potentialCharacterLine);
        potentialCharacterLine = trimCharacterForceSymbol(potentialCharacterLine);
        if (isAlreadyMentionedCharacter(potentialCharacterLine)) {
            if (foundLastCharacter) {
                characterBeforeLast = potentialCharacterLine;
            } else {
                foundLastCharacter = true;
            }
        }
        lineToInspect++;
    } while (!characterBeforeLast);

    return characterBeforeLast;
}

/**
 * Calculate an approximation of how long a line of dialogue would take to say
 */
export const calculateDialogueDuration = (dialogue:string): number =>{
	var duration = 0;

	//According to this paper: http://www.office.usp.ac.jp/~klinger.w/2010-An-Analysis-of-Articulation-Rates-in-Movies.pdf
	//The average amount of syllables per second in the 14 movies analysed is 5.13994 (0.1945548s/syllable)
	var sanitized = dialogue.replace(/[^\w]/gi, '');
	duration+=((sanitized.length)/3)*0.1945548;
	//duration += syllable(dialogue)*0.1945548;

	//According to a very crude analysis involving watching random movie scenes on youtube and measuring pauses with a stopwatch
	//A comma in the middle of a sentence adds 0.4sec and a full stop/excalmation/question mark adds 0.8 sec.
	var punctuationMatches=dialogue.match(/(\.|\?|\!|\:) |(\, )/g);
	if(punctuationMatches){
		if(punctuationMatches[0]) duration+=0.75*punctuationMatches[0].length;
		if(punctuationMatches[1]) duration+=0.3*punctuationMatches[1].length;
	}
	return duration
}

export const isMonologue = (seconds:number): boolean => {
	if(seconds>30) return true;
	else return false;
}

function padZero(i: any) {
	if (i < 10) {
		i = "0" + i;
	}
	return i;
}

export function secondsToString(seconds:number):string{
	var time = new Date(null);
	time.setHours(0);
	time.setMinutes(0);
	time.setSeconds(seconds);
	return padZero(time.getHours()) + ":" + padZero(time.getMinutes()) + ":" + padZero(time.getSeconds());
}

export function secondsToMinutesString(seconds:number):string{
	if(seconds<1) return undefined;
	var time = new Date(null);
	time.setHours(0);
	time.setMinutes(0);
	time.setSeconds(seconds);
	if(seconds>=3600)
		return padZero(time.getHours()) + ":" + padZero(time.getMinutes()) + ":" + padZero(time.getSeconds());
	else
		return padZero(time.getHours()*60 + time.getMinutes()) + ":" + padZero(time.getSeconds());
	
}

export const overwriteSceneNumbers = (content: string): string => {
    const clearedText = clearSceneNumbers(content);
    return writeSceneNumbers(clearedText);
}

export const updateSceneNumbers = (content: string): string => {
    return writeSceneNumbers(content);
}

const clearSceneNumbers = (fullText: string): string => {
    const regexSceneHeadings = new RegExp(parser.regex.scene_heading.source, "igm");
    const newText = fullText.replace(regexSceneHeadings, (heading: string) => heading.replace(/ #.*#$/, ""))
    return newText
}

const writeSceneNumbers = (fullText: string): string => {
    // collect existing numbers (they mostly shouldn't change)
    const oldNumbers: string[] = [];
    const regexSceneHeadings = new RegExp(parser.regex.scene_heading.source, "igm");
    const numberingSchema = sceneNumbering.makeSceneNumberingSchema(sceneNumbering.SceneNumberingSchemas.Standard);
    var m;
    while (m = regexSceneHeadings.exec(fullText)) {
        const matchExisting = m[0].match(/#(.+)#$/);

        if (!matchExisting) oldNumbers.push(null) /* no match = no number = new number required in this slot */
        else if (numberingSchema.canParse(matchExisting[1])) oldNumbers.push(matchExisting[1]); /* existing scene number */
        /* ELSE: didn't parse - custom scene numbers are skipped */
    }

    // work out what they should actually be, according to the schema
    const newNumbers = sceneNumbering.generateSceneNumbers(oldNumbers);
    if (newNumbers) {
        // replace scene numbers
        return fullText.replace(regexSceneHeadings, (heading) => {
            const matchExisting = heading.match(/#(.+)#$/);
            if (matchExisting && !numberingSchema.canParse(matchExisting[1]))
                return heading; /* skip re-writing custom scene numbers */

            const noPrevHeadingNumbers = heading.replace(/ #.+#$/, "")
            const newHeading = `${noPrevHeadingNumbers} #${newNumbers.shift()}#`
            return newHeading
        });
    }
    return fullText;
}

export const last = function (array: any[]): any {
	return array[array.length - 1];
}

export function fileToBase64(fspath:string){
    let data = fs.readFileSync(fspath);
	return data.toString('base64');
}

export function openFile(p:string){
	let cmd = "xdg-open"
	switch (process.platform) { 
		case 'darwin' : cmd = 'open'; break;
		case 'win32' : cmd = ''; break;
		default : cmd = 'xdg-open';
	}
	var exec = require('child_process').exec;
	exec(`${cmd} "${p}"`); 
}
export function revealFile(p:string){
	var cmd = "";
	if(process.platform == "win32"){
		cmd = `explorer.exe /select,${p}`
	}
	else if(process.platform == "darwin"){
		cmd = `open -R ${p}`
	}
	else{
		p = path.parse(p).dir;
		cmd = `open "${p}"`
	}
	var exec = require('child_process').exec;
	exec(cmd); 
}

export function assetsPath(): string{
    return __dirname;
}

//Simple n-bit hash
function nPearsonHash(message: string, n = 8): number {
	// Ideally, this table would be shuffled...
	// 256 will be the highest value provided by this hashing function
	var table = [...new Array(2**n)].map((_, i) => i)

	return message.split('').reduce((hash, c) => {
		return table[(hash + c.charCodeAt(0)) % (table.length - 1)]
	}, message.length % (table.length - 1))
}

function HSVToRGB(h: number, s: number, v: number): Array<number> {
	var [r, g, b] = [0, 0 ,0];
    
	var i = Math.floor(h * 6);
	var f = h * 6 - i;
	var p = v * (1 - s);
	var q = v * (1 - f * s);
	var t = v * (1 - (1 - f) * s);
	switch (i % 6) {
		case 0: r = v, g = t, b = p; break;
		case 1: r = q, g = v, b = p; break;
		case 2: r = p, g = v, b = t; break;
		case 3: r = p, g = q, b = v; break;
		case 4: r = t, g = p, b = v; break;
		case 5: r = v, g = p, b = q; break;
	}
	return [Math.round(r * 255),Math.round(g * 255),Math.round(b * 255)]
}

//We are using colors with same value and saturation as highlighters
export function wordToColor(word: string, s:number = 0.5, v:number = 1): Array<number> {
	const n = 5; //so that colors are spread apart
	const h = nPearsonHash(word, n)/2**(8-n);
	return HSVToRGB(h, s, v)
}

export function mapToObject(map:any):any{
    let jsonObject:any = {};  
    map.forEach((value:any, key:any) => {  
        jsonObject[key] = value  
    });  
    return jsonObject;
}

function componentToHex(c:number) {
  var hex = c.toString(16);
  return hex.length == 1 ? "0" + hex : hex;
}

export function rgbToHex(rgb:number[]):string {
  return "#" + componentToHex(rgb[0]) + componentToHex(rgb[1]) + componentToHex(rgb[2]);
}

export function median (values:number[]):number {
	if(values.length == 0) return 0;
    values.sort( function(a,b) {return a - b;} );
    var half = Math.floor(values.length/2);
    if(values.length % 2)
        return values[half];
    else
		return (values[half-1] + values[half]) / 2.0;
}