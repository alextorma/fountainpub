// TODO: Extract pdfmaker to a separate library (+++++)

import * as fountainconfig from "../configloader";
import * as print from "./print";
import * as path from 'path';
import helpers from "../helpers";
import { trimCharacterExtension, wordToColor } from "../utils";
import * as he from 'he';
import * as addTextbox from 'textbox-for-pdfkit';
import { regex } from "../afterwriting-parser";
import { Base64Encode } from "base64-stream";

// import * as blobUtil from "blob-util";
export class Options {
    filepath: string;
    config: fountainconfig.FountainConfig;
    parsed: any;
    print: print.PrintProfile;
    font: string;
    exportconfig: fountainconfig.ExportConfig;
}
var PDFDocument = require('pdfkit'),
    //helper = require('../helpers'),
    BlobCtor = (typeof Blob !== 'undefined') ? Blob : null;

var create_simplestream = function (filepath: string) {
    var simplestream: any = {
        chunks: [],
        filepath: filepath,
        callbacks: {},
        on: function (event: any, callback: any) {
            this.callbacks[event] = callback;
        },
        once: function (event: any, callback: any) {
            this.callbacks[event] = callback;
        },
        removeListener: function (event: any, callback: any) {
            // Remove the listener for the event
            if (this.callbacks[event] === callback) {
                delete this.callbacks[event];
            }
        },
        emit: function (event: any, data?: any) {
            if (this.callbacks[event]) {
                this.callbacks[event](data);
            }
        },
        write: function (chunk: any) {
            this.chunks.push(chunk);
        },
        end: function () {
            if (simplestream.filepath) {
                var fsmodule = 'fs';
                var fs = require(fsmodule); // bypass requirejs minification/optimization
                var stream = fs.createWriteStream(simplestream.filepath, {
                    encoding: "binary"
                });
                
                stream.on('error', function (err: any) {
                    if (err.code == "ENOENT") {
                        console.error("Unable to export PDF! The specified location does not exist: " + err.path)
                    }
                    else if (err.code == "EPERM") {
                        console.error("Unable to export PDF! You do not have the permission to write the specified file: " + err.path)
                    }
                    else {
                        console.error(err.message);
                    }
                    simplestream.emit('error', err);
                });
                
                stream.on('finish', () => {
                    simplestream.emit('finish');
                });

                stream.on('open', function () {
                    simplestream.chunks.forEach(function (buffer: any) {
                        stream.write(Buffer.from(buffer.toString('base64'), 'base64'));
                    });
                    stream.end();
                });

            } else {
                if (BlobCtor) {
                    simplestream.blob = new BlobCtor(simplestream.chunks, {
                        type: "application/pdf"
                    });
                } else {
                    // Node.js fallback: use Buffer
                    simplestream.blob = Buffer.concat(simplestream.chunks.map((chunk: any) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
                }
                // simplestream.url = blobUtil.createObjectURL(this.blob);
                if (this.callbacks['finish']) {
                    this.callbacks['finish'](simplestream);
                }
            }
        }
    };
    return simplestream;
};

async function initDoc(opts: Options) {
    var print = opts.print;
    //var fonts = opts.config.fonts || null;
    var options = {
        compress: false,
        size: print.paper_size === "a4" ? 'A4' : 'LETTER',
        margins: {
            top: 0,
            left: 0,
            bottom: 0,
            right: 0
        }
    };
    var doc = new PDFDocument(options);

    /* if (opts.config.fonts) {
         doc.registerFont('ScriptNormal', fonts.normal.src, fonts.normal.family);
         doc.registerFont('ScriptBold', fonts.bold.src, fonts.bold.family);
         doc.registerFont('ScriptBoldOblique', fonts.bolditalic.src, fonts.bolditalic.family);
         doc.registerFont('ScriptOblique', fonts.italic.src, fonts.italic.family);
     }
     else {*/
    const fontFinder = require('font-finder');

    //Load Courier Prime by default, and replace the variants if requested and available
    var fp = __dirname.slice(0, __dirname.lastIndexOf(path.sep)) + path.sep + 'courierprime' + path.sep
    doc.registerFont('ScriptNormal', fp + 'courier-prime.ttf');
    doc.registerFont('ScriptBold', fp + 'courier-prime-bold.ttf');
    doc.registerFont('ScriptBoldOblique', fp + 'courier-prime-bold-italic.ttf');
    doc.registerFont('ScriptOblique', fp + 'courier-prime-italic.ttf');
    if (opts.font != "Courier Prime") {
        var variants = await fontFinder.listVariants(opts.font);
        variants.forEach((variant: any) => {
            switch (variant.style) {
                case "regular":
                    doc.registerFont('ScriptNormal', variant.path);
                    break;
                case "bold":
                    doc.registerFont('ScriptBold', variant.path);
                    break;
                case "italic":
                    doc.registerFont('ScriptOblique', variant.path);
                    break;
                case "boldItalic":
                    doc.registerFont('ScriptBoldOblique', variant.path);
                    break;
            }
        });
    }

    doc.font('ScriptNormal');
    doc.fontSize(print.font_size || 12);

    // convert points to inches for text
    doc.reset_format = function () {
        doc.format_state = {
            bold: false,
            italic: false,
            underline: false,
            override_color: null
        };
    };
    doc.reset_format();
    //var inner_text = doc.text;
    doc.simple_text = function () {
        doc.font('ScriptNormal');
        doc.text.apply(doc, arguments);
    };
    doc.format_text = function (text: string, x: number, y: number, options: any) {
        var cache_current_state = doc.format_state;
        doc.reset_format();
        doc.text2(text, x, y, options);
        doc.format_state = cache_current_state;
    };
    doc.text2 = function (text: string, x: number, y: number, options: any) {
        options = options || {};
        var color = options.color || 'black';
        color = doc.format_state.override_color ? doc.format_state.override_color : color;

        doc.fill(color);

        if (options.highlight) {
            doc.highlight(x * 72, (y * 72) + doc.currentLineHeight() / 2, doc.widthOfString(text), doc.currentLineHeight(), { color: options.highlightcolor });
        }
        if(options.asteriskMargin){
            doc.simple_text(' *',(print.page_width - print.right_margin)*72, (y * 72) + doc.currentLineHeight()/1.25);
        }

        if (print.note.italic) {
            text = text.replace(/\[\[/g, '*[[').replace(/\]\]/g, ']]*');
        }
        var links: { start: number, length: number, url: string }[] = [];
        if (options.links) {
            let match;
            //Clean up all the links, while keeping track of their offset in order to add them back in later.
            while ((match = regex.link.exec(text)) !== null) {
                match.index;
                var trimmed = match[3];
                links.push({
                    start: match.index,
                    length: trimmed.length,
                    url: match[6]
                });
                text = text.slice(0, match.index) + match[3] + text.slice(match.index + match[0].length);
            }
        }
        var split_for_formatting = [];
        //Split the text from the start (or from the previous link) until the current one
        //"This is a link: google.com and this is after"
        // |--------------|----------| - - - - - - - |
        var prevlink = 0;
        for (let i = 0; i < links.length; i++) {
            split_for_formatting.push(text.slice(prevlink, links[i].start));
            split_for_formatting.push(text.slice(links[i].start, links[i].start + links[i].length));
            prevlink = links[i].start + links[i].length;
        }
        //...And then add whatever is left over
        //"This is a link: google.com and this is after"
        // | - - - - - - -| - - - - -|----------------|
        var leftover = text.slice(prevlink, text.length);
        if (leftover) split_for_formatting.push(leftover);

        //Further sub-split for bold, italic, underline, etc...
        for (let i = 0; i < split_for_formatting.length; i++) {
            var innersplit = split_for_formatting[i].split(/(\\\*)|(\*{1,3})|(\\?_)|(\[\[)|(\]\])/g).filter(function (a) {
                return a;
            });
            split_for_formatting.splice(i, 1, ...innersplit);
            i += innersplit.length - 1;
        }

        // var font_width = print.font_width;
        var textobjects = [];
        var currentIndex = 0;
        for (var i = 0; i < split_for_formatting.length; i++) {
            var elem = split_for_formatting[i];
            if (elem === '***') {
                doc.format_state.italic = !doc.format_state.italic;
                doc.format_state.bold = !doc.format_state.bold;
            } else if (elem === '**') {
                doc.format_state.bold = !doc.format_state.bold;
            } else if (elem === '*') {
                doc.format_state.italic = !doc.format_state.italic;
            } else if (elem === '_') {
                doc.format_state.underline = !doc.format_state.underline;
            } else if (elem === '[[') {
                doc.format_state.override_color = (print.note && print.note.color) || '#000000';
            } else if (elem === ']]') {
                doc.format_state.override_color = null;
            } else {
                let font = 'ScriptNormal';
                if (doc.format_state.bold && doc.format_state.italic) {
                    font = 'ScriptBoldOblique';
                } else if (doc.format_state.bold || options.bold) {
                    font = 'ScriptBold';
                } else if (doc.format_state.italic) {
                    font = 'ScriptOblique';
                }
                if (elem === '\\_' || elem === '\\*') {
                    elem = elem.substr(1, 1);
                }
                var linkurl = undefined;
                for (const link of links) {
                    if (link.start <= currentIndex && currentIndex < link.start + link.length) {
                        linkurl = link.url;
                    }
                }
                textobjects.push({
                    text: elem,
                    link: linkurl,
                    font: font,
                    underline: linkurl || doc.format_state.underline,
                    color: doc.format_state.override_color ? doc.format_state.override_color : color
                });
            }
            currentIndex += elem.length;
            /*inner_text.call(doc, elem, x * 72, y * 72, {
                underline: doc.format_state.underline,
                lineBreak: options.line_break,
                width: options.width * 72,
                align: options.align
            });*/
        }
        var width = options.width !== undefined ? options.width : print.page_width;
        addTextbox(textobjects, doc, x * 72, y * 72, width * 72, {
            lineBreak: options.line_break,
            align: options.align,
            baseline: 'top'
        });

    };

    function splitBy(text:string, delimiter:string) {
        var 
          delimiterPATTERN = '(' + delimiter + ')', 
          delimiterRE = new RegExp(delimiterPATTERN, 'g');
      
        return text.split(delimiterRE).reduce(function(chunks, item){
          if (item.match(delimiterRE)){
            chunks.push(item)
          } else {
            chunks[chunks.length - 1] += item
          };
          return chunks
        }, [])
      }

    interface image{ path: string }
    doc.text2withImages = function (text: string, x: number, y: number, options: any) {
        let textparts = splitBy(text, regex.link.source);
        var parts:{text?:string,image?:image}[] = [];
        for (let i = 0; i < textparts.length; i++) {
            let match = regex.link.exec(textparts[i]);
            if(match.length>0){
                parts.push({image:{path:match[6]}});
                parts.push({text:textparts[i].slice(match[0].length)})
            }
            else{
                parts.push({text:textparts[i]});
            }
        }
        var additionalY = 0;
        for (const part of parts) {
            if(part.text){
                doc.text2(part.text, x, y+additionalY, options);
            }
        }
    }

    return doc;
}

function clearFormatting(text: string) {
    var clean = text.replace(/\*/g, '');
    clean = clean.replace(/_/g, '');
    return clean;
}

function inline(text: string) {
    return text.replace(/\n/g, ' ');
}

function finishDoc(doc: any, filepath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        var stream = create_simplestream(filepath);
        
        stream.on('finish', () => {
            resolve();
        });
        
        stream.on('error', (err: any) => {
            reject(err);
        });
        
        doc.pipe(stream);
        doc.end();
    });
}


var get_title_page_token = function (parsed: any, type: string): any {
    var result = null;
    if (parsed && parsed.title_page) {
        for (const section of Object.keys(parsed.title_page)) {
            parsed.title_page[section].forEach(function (token: any) {
                if (token.is(type)) {
                    result = token;
                }
            });
        }

    }
    return result;
};

async function generate(doc: any, opts: any, lineStructs?: Map<number, lineStruct>) {
    var parsed = opts.parsed,
        cfg = opts.config,
        print = opts.print,
        lines = parsed.lines,
        exportcfg = opts.exportconfig;

    var title_token = get_title_page_token(parsed, 'title');
    var author_token = get_title_page_token(parsed, 'author');
    if (!author_token) {
        author_token = get_title_page_token(parsed, 'authors');
    }

    doc.info.Title = title_token ? clearFormatting(inline(title_token.text)) : '';
    doc.info.Author = author_token ? clearFormatting(inline(author_token.text)) : '';
    doc.info.Creator = 'betterfountain';

    // helper
    var center = function (txt: string, y: number) {
        var txt_length = txt.replace(/\*/g, '').replace(/_/g, '').length;
        var feed = (print.page_width - txt_length * print.font_width) / 2;
        doc.text2(txt, feed, y);
    };

    //var title_y = print.title_page.top_start;

    /*var title_page_next_line = function() {
        title_y += print.line_spacing * print.font_height;
    };

    /*var title_page_main = function(parsed?:any, type?:string, options?:any) {
        options = options || {};
        if (arguments.length === 0) {
            title_page_next_line();
            return;
        }
        var token = get_title_page_token(parsed, type);
        if (token) {
            token.text.split('\n').forEach(function(line:string) {
                if (options.capitalize) {
                    line = line.toUpperCase();
                }
                center(line, title_y);
                title_page_next_line();
            });
        }
    };*/

    if (cfg.print_title_page && parsed.title_page) {
        const innerwidth = print.page_width - print.right_margin - print.right_margin;
        const innerheight = print.page_height - print.top_margin;
        const innerwidth_third = innerwidth / 3;
        const innerwidth_half = innerwidth / 2;
        const joinChar = '\n\n';
        //top left
        var tltext = parsed.title_page['tl'].sort(helpers.sort_index).map((x: any) => x.text).join(joinChar);
        var tltext_height = doc.heightOfString(tltext, { width: innerwidth_third * 72, align: 'left' });

        doc.text2(tltext, print.right_margin, print.top_margin, {
            width: innerwidth_third,
            align: 'left',
            links: true
        });

        //top center
        var tctext = parsed.title_page['tc'].sort(helpers.sort_index).map((x: any) => x.text).join(joinChar);
        var tctext_height = doc.heightOfString(tctext, { width: innerwidth_third * 72, align: 'center' });
        doc.text2(tctext, print.right_margin + innerwidth_third, print.top_margin, {
            width: innerwidth_third,
            align: 'center',
            links: true
        });

        //top right
        var trtext = parsed.title_page['tr'].sort(helpers.sort_index).map((x: any) => x.text).join(joinChar);
        var trtext_height = doc.heightOfString(trtext, { width: innerwidth_third * 72, align: 'right' });
        doc.text2(trtext, print.right_margin + innerwidth_third + innerwidth_third, print.top_margin, {
            width: innerwidth_third,
            align: 'right',
            links: true
        });

        //bottom left
        var bltext = parsed.title_page['bl'].sort(helpers.sort_index).map((x: any) => x.text).join(joinChar);
        var bltext_height = doc.heightOfString(bltext, { width: innerwidth_half * 72, align: 'left' });
        doc.text2(bltext, print.right_margin, innerheight - (bltext_height / 72), {
            width: innerwidth_half,
            align: 'left',
            links: true
        });

        //bottom right
        var brtext = parsed.title_page['br'].sort(helpers.sort_index).map((x: any) => x.text).join(joinChar);
        var brtext_height = doc.heightOfString(brtext, { width: innerwidth_half * 72, align: 'right' });
        doc.text2(brtext, print.right_margin + innerwidth_half, innerheight - (brtext_height / 72), {
            width: innerwidth_half,
            align: 'right',
            links: true
        });

        //center center
        var topheight = Math.max(tltext_height, tctext_height, trtext_height, 0);
        var bottomheight = Math.max(bltext_height, brtext_height, 0);

        var cctext = parsed.title_page['cc'].sort(helpers.sort_index).map((x: any) => x.text).join(joinChar);
        var cctext_height = doc.heightOfString(cctext, { width: innerwidth * 72, align: 'center' });
        var centerStart = (((innerheight * 72) - topheight - bottomheight) / 2) - (cctext_height / 2);
        doc.text2(cctext, print.right_margin, centerStart / 72, {
            width: innerwidth,
            align: 'center',
            links: true
        });

        /*
        // title page
        title_page_main(parsed, 'title', {
            capitalize: true
        });
        title_page_main();
        title_page_main();
        title_page_main(parsed, 'credit');
        title_page_main();
        title_page_main(parsed, 'author');
        title_page_main();
        title_page_main();
        title_page_main();
        title_page_main();
        title_page_main(parsed, 'source');

        var concat_types = function(parsed:any, prev:any, type:string) {
            var token = get_title_page_token(parsed, type);
            if (token) {
                prev = prev.concat(token.text.split('\n'));
            }
            return prev;
        };
        var left_side = print.title_page.left_side.reduce(concat_types.bind(null, parsed), []),
            right_side = print.title_page.right_side.reduce(concat_types.bind(null, parsed), []),
            title_page_extra = function(x:number) {
                return function(line:string) {
                    doc.text(line.trim(), x, title_y);
                    title_page_next_line();
                };
            };

        title_y = 8.5;
        left_side.forEach(title_page_extra(1.3));

        title_y = 8.5;
        right_side.forEach(title_page_extra(5));
*/
        // script
        doc.addPage();
    }

    if (opts.hooks && opts.hooks.before_script) {
        opts.hooks.before_script(doc);
    }

    var y = 0,
        page = 1,
        scene_number: string,
        prev_scene_continuation_header = '',
        scene_continuations: { [key: string]: any } = {},
        current_section_level = 0,
        current_section_number: any,
        current_section_token: any,
        section_number = helpers.version_generator(),
        text,
        after_section = false; // helpful to determine synopsis indentation

    var print_header_and_footer = function (continuation_header?: string) {
        if (cfg.print_header) {

            continuation_header = continuation_header || '';
            var offset = helpers.blank_text(continuation_header);
            if (helpers.get_indentation(cfg.print_header).length >= continuation_header.length) {
                offset = '';
            }
            if (offset) {
                offset += ' ';
            }

            doc.format_text(offset + cfg.print_header, 1.5, print.page_number_top_margin-0.1, {
                color: '#777777'
            });
        }
        if (cfg.print_footer) {
            doc.format_text(cfg.print_footer, 1.5, print.page_height - 0.5, {
                color: '#777777'
            });
        }
    };


    var print_watermark = function () {
        if (cfg.print_watermark) {
            var options = {
                origin: [0, 0]
            },
                font_size,
                angle = Math.atan(print.page_height / print.page_width) * 180 / Math.PI,
                diagonal,
                watermark, len;

            // underline and rotate pdfkit bug (?) workaround
            watermark = cfg.print_watermark.replace(/_/g, '');

            // unformat
            len = watermark.replace(/\*/g, '').length;

            diagonal = Math.sqrt(Math.pow(print.page_width, 2) + Math.pow(print.page_height, 2));
            diagonal -= 4;

            font_size = (1.667 * diagonal) / len * 72;
            doc.fontSize(font_size);
            doc.rotate(angle, options);
            doc.format_text(watermark, 2, -(font_size / 2) / 72, {
                color: '#eeeeee',
                line_break: false
            });
            doc.rotate(-angle, options);
            doc.fontSize(print.font_size || 12);
        }
    };



    function getOutlineChild(obj: any, targetDepth: number, currentDepth: number): any {
        if (currentDepth == targetDepth) {
            return obj;
        }
        if (obj.children.length > 0) {
            //get the last child
            currentDepth++;
            return getOutlineChild(obj.children[obj.children.length - 1], targetDepth, currentDepth);
        }
        else {
            return obj;
        }
    }

    let outline = doc.outline;
    let outlineDepth = 0;
    // let previousSectionDepth = 0;

    print_watermark();
    print_header_and_footer();

    let currentScene: string = "";
    let currentSections: string[] = [];
    let currentDuration: number = 0;
    lines.forEach(function (line: any) {

        if (line.type === "page_break") {

            if (cfg.scene_continuation_bottom && line.scene_split) {
                var scene_continued_text = '(' + (cfg.text_scene_continued || 'CONTINUED') + ')';
                var feed = print.action.feed + print.action.max * print.font_width - scene_continued_text.length * print.font_width;
                doc.simple_text(scene_continued_text, feed * 72, (print.top_margin + print.font_height * (y + 2)) * 72);
            }

            if (lineStructs) {
                if (line.token.line && !lineStructs.has(line.token.line)) {
                    lineStructs.set(line.token.line, { page: page, scene: currentScene, cumulativeDuration: currentDuration, sections: currentSections.slice(0) })
                }
            }

            y = 0;
            doc.addPage();
            page++;

            var number_y = print.page_number_top_margin;

            if (cfg.scene_continuation_top && line.scene_split) {
                scene_continuations[scene_number] = scene_continuations[scene_number] || 0;
                scene_continuations[scene_number]++;

                var scene_continued = (cfg.scenes_numbers !== 'none' && scene_number ? scene_number + ' ' : '') + (cfg.text_scene_continued || 'CONTINUED') + ':';
                scene_continued += scene_continuations[scene_number] > 1 ? ' (' + scene_continuations[scene_number] + ')' : '';

                scene_continued = scene_continued.replace(/\*/g, '');
                scene_continued = scene_continued.replace(/_/g, '');
                doc.simple_text(scene_continued, print.action.feed * 72, number_y * 72);
                prev_scene_continuation_header = scene_continued;
            }

            if (cfg.show_page_numbers) {
                var page_num = page.toFixed() + ".";
                var number_x = print.action.feed + print.action.max * print.font_width - page_num.length * print.font_width;
                doc.simple_text(page_num, number_x * 72, number_y * 72);
            }
            print_watermark();
            print_header_and_footer(prev_scene_continuation_header);
            prev_scene_continuation_header = '';

        } else if (line.type === "separator") {
            y++;
            if (lineStructs) {
                if (line.token.line && !lineStructs.has(line.token.line)) {
                    lineStructs.set(line.token.line, { page: page, scene: currentScene, cumulativeDuration: currentDuration, sections: currentSections.slice(0) })
                }
            }
        } else {
            // formatting not supported yet
            text = line.text;

            var color = (print[line.type] && print[line.type].color) || '#000000';

            var general_text_properties = {
                color: color,
                highlight: false,
                bold:false,
                highlightcolor: [0, 0, 0],
                asteriskMargin:false,
            }

            function get_text_properties(lline = line, expcfg = exportcfg, old_text_properties = general_text_properties) {
                var new_text_properties = Object.assign({}, old_text_properties)
                if (!!expcfg && lline.type === 'character') {
                    var character = trimCharacterExtension(lline.text)
                    // refer to Liner in ./liner.ts
                    character = character.replace(/([0-9]* - )/, "");
                    if (!!expcfg.highlighted_characters && expcfg.highlighted_characters.includes(character)) {
                        new_text_properties.highlight = true;
                        new_text_properties.highlightcolor = wordToColor(character);
                    };
                    if(cfg.embolden_character_names){
                        new_text_properties.bold = true;
                    }
                };
                if (!!expcfg && !!expcfg.highlighted_changes.lines && lline.token.original_line && expcfg.highlighted_changes.lines.includes(lline.token.original_line)) {
                    if(expcfg.highlighted_changes.highlightColor != undefined){
                        new_text_properties.highlight = true;
                        new_text_properties.highlightcolor = expcfg.highlighted_changes.highlightColor;
                    }
                    new_text_properties.asteriskMargin = true;
                };
                return new_text_properties
            }

            var text_properties = get_text_properties();

            if (line.type == "parenthetical" && !text.startsWith("(")) {
                text = " " + text;
            }

            if (line.type === 'centered') {
                center(text, print.top_margin + print.font_height * y++);
            } else {
                var feed: number = (print[line.type] || {}).feed || print.action.feed;
                if (line.type === "transition") {
                    feed = print.action.feed + print.action.max * print.font_width - line.text.length * print.font_width;
                }

                var hasInvisibleSection = (line.type === "scene_heading" && line.token.invisibleSections != undefined)
                function processSection(sectiontoken: any) {
                    let sectiontext = sectiontoken.text;
                    current_section_level = sectiontoken.level;
                    currentSections.length = sectiontoken.level - 1;

                    currentSections.push(he.encode(sectiontext));
                    if (!hasInvisibleSection)
                        feed += current_section_level * print.section.level_indent;
                    if (cfg.number_sections) {
                        if (sectiontoken !== current_section_token) {
                            current_section_number = section_number(sectiontoken.level);
                            current_section_token = sectiontoken;
                            sectiontext = current_section_number + '. ' + sectiontext;
                        } else {
                            sectiontext = Array(current_section_number.length + 3).join(' ') + sectiontext;
                        }

                    }
                    if (cfg.create_bookmarks) {
                        if (hasInvisibleSection && !cfg.invisible_section_bookmarks) return;
                        var oc = getOutlineChild(outline, sectiontoken.level - 1, 0);
                        if (oc != undefined)
                            oc.addItem(sectiontext);
                    }
                    if (!hasInvisibleSection) {
                        text = sectiontext;
                    }
                    outlineDepth = sectiontoken.level;
                }
                if (line.type === 'section' || hasInvisibleSection) {
                    if (hasInvisibleSection) {
                        for (let i = 0; i < line.token.invisibleSections.length; i++) {
                            processSection(line.token.invisibleSections[i]);
                        }
                    }
                    else {
                        processSection(line.token);
                    }

                }

                if (line.type === "scene_heading") {
                    if (cfg.create_bookmarks) {
                        getOutlineChild(outline, outlineDepth, 0).addItem(text);
                    }
                    currentScene = text;
                    if (cfg.embolden_scene_headers) {
                        text = '**' + text + '**';
                    }
                    if (cfg.underline_scene_headers) {
                        text = '_' + text + '_';
                    }
                }

                if (line.type === 'synopsis') {
                    feed += print.synopsis.padding || 0;
                    if (print.synopsis.feed_with_last_section && after_section) {
                        feed += current_section_level * print.section.level_indent;
                    } else {
                        feed = print.action.feed;
                    }
                }


                if (print[line.type] && print[line.type].italic && text) {
                    text = '*' + text + '*';
                }

                if (line.token && line.token.dual) {
                    if (line.right_column) {
                        var y_right = y;
                        line.right_column.forEach(function (right_line: any) {
                            var feed_right = (print[right_line.type] || {}).feed || print.action.feed;
                            feed_right -= (feed_right - print.left_margin) / 2;
                            feed_right += (print.page_width - print.right_margin - print.left_margin) / 2;
                            var right_text_properties = get_text_properties(right_line);
                            doc.text2(right_line.text, feed_right, print.top_margin + print.font_height * y_right++, right_text_properties);
                        });
                    }
                    feed -= (feed - print.left_margin) / 2;
                }

                doc.text2(text, feed, print.top_margin + print.font_height * y, text_properties);
                if (line.linediff) {
                    y += line.linediff;
                }

                if (line.number) {
                    scene_number = String(line.number);
                    var scene_text_length = scene_number.length;
                    if (cfg.embolden_scene_headers) {
                        scene_number = '**' + scene_number + '**';
                    }
                    if (cfg.underline_scene_headers) {
                        scene_number = '_' + scene_number + '_';
                    }

                    // Create scene number text properties with gray color
                    var scene_number_properties = Object.assign({}, text_properties);
                    scene_number_properties.color = '#999'; // Darker gray

                    var shift_scene_number;

                    if (cfg.scenes_numbers === 'both' || cfg.scenes_numbers === 'left') {
                        shift_scene_number = (scene_text_length + 4) * print.font_width;
                        doc.text2(scene_number, feed - shift_scene_number, print.top_margin + print.font_height * y, scene_number_properties);
                    }

                    if (cfg.scenes_numbers === 'both' || cfg.scenes_numbers === 'right') {
                        shift_scene_number = (print.scene_heading.max + 1) * print.font_width;
                        doc.text2(scene_number, feed + shift_scene_number, print.top_margin + print.font_height * y, scene_number_properties);
                    }
                }
                y++;
            }
            if (lineStructs) {
                if (line.token.line && !lineStructs.has(line.token.line)) {
                    if (line.token.time) currentDuration += line.token.time;
                    lineStructs.set(line.token.line, { page: page, scene: currentScene, sections: currentSections.slice(0), cumulativeDuration: currentDuration })
                }
            }
        }


        // clear after section
        if (line.type === 'section') {
            after_section = true;
        } else if (line.type !== 'separator' && line.type !== 'synopsis' && line.type !== 'page_break') {
            after_section = false;
        }

    });

}

export var get_pdf = async function (opts: Options, progress: { report: (value: { message?: string; increment?: number; }) => void; }) {
    if (progress && typeof progress.report === 'function') progress.report({ message: "Processing document", increment: 25 });
    var doc = await initDoc(opts);
    await generate(doc, opts);
    if (progress && typeof progress.report === 'function') progress.report({ message: "Writing to disk", increment: 25 });
    await finishDoc(doc, opts.filepath);
};

export type lineStruct = {
    sections: string[],
    scene: string,
    page: number,
    cumulativeDuration: number
}

export type pdfstats = {
    pagecount: number,
    pagecountReal: number,
    linemap: Map<number, lineStruct> //the structure of each line
}
export type PdfAsBase64 = {
    data:string;
    stats:pdfstats;
}

export var get_pdf_stats = async function (opts: Options): Promise<pdfstats> {
    var doc = await initDoc(opts);
    let stats: pdfstats = { pagecount: 1, pagecountReal: 1, linemap: new Map<number, lineStruct>() };
    stats.pagecount = opts.parsed.lines.length / opts.print.lines_per_page;
    doc.on('pageAdded', () => {
        stats.pagecountReal++;
    });

    await generate(doc, opts, stats.linemap);
    return stats;
}

const toBase64 = (doc:any):Promise<string> => {
    return new Promise((resolve, reject) => {
        try {
            const stream = doc.pipe(new Base64Encode());

            let base64Value = '';
            stream.on('data', (chunk:any) => {
                base64Value += chunk;
            });
            
            stream.on('end', () => {
                resolve(base64Value);
            });
        } catch (e) {
            reject(e);
        }
    });
};


export var get_pdf_base64 = async function(opts:Options): Promise<PdfAsBase64> {
    var doc = await initDoc(opts);
    let stats: pdfstats = { pagecount: 1, pagecountReal: 1, linemap: new Map<number, lineStruct>() };
    stats.pagecount = opts.parsed.lines.length / opts.print.lines_per_page;
    doc.on('pageAdded', () => {
        stats.pagecountReal++;
    });
    await generate(doc, opts, stats.linemap);
    doc.end();
    return{
        data: await toBase64(doc),
        stats: stats
    }
}