## Attribution

This project is a fork of [betterfountain](https://github.com/piersdeseilligny/betterfountain) by Piers Deseilligny, stripped of a lot of functionality and decoupled from VScode to allow for configurable PDF and HTML exports of a .fountain file in CLI environments.
##
This is an fork of an extension for Visual Studio Code which allows you to write screenplays using the [fountain](https://fountain.io/) syntax quickly and efficiently. [(If you're already confused click here)](https://github.com/piersdeseilligny/betterfountain/blob/master/FAQ.md).

Unlike other screenwriting software (such as Final Draft) BetterFountain focuses on removing friction between you and the text - there's no page breaks, no large unintuitive menus and overlapping windows, no delays when you press "Enter" after having written some dialogue, no slow loading documents, none of that. Just text and a handfull of unintruding features which remove even more friction between the story in your head and a finished screenplay.

And because it's an a CLI tool, you can use it in Github Actions to automate a publishing workflow.
## Features (courtesy of Piers)
* Industry-standard PDF generation
    * Includes scenes and sections as PDF bookmarks, for easy navigation in your reader of choice
    * Possible to highlight any specified characters in the PDF
* Custom font support (Add "Font:" at the top of your .fountain screenplay, with the other title page keys, followed by the name of a font installed on your system) (untested)
* Approximation of a screenplay's duration (with -i flag, untested)
## Why?

Writing with fountain lets you focus on the essential. With the addition of autocomplete and syntax highlighting, you have the ultimate clutter-free ultra-fast solution for writing screenplays. And because it's an extension for vscode, it's free and cross-platform, and you get lots of other cool features such as integrated source control and near-infinite extensibility.

## Usage
```sh
npm install -g fountainpub

# Convert to PDF
fountainpub script.fountain -p
fountainpub script.fountain -p script.pdf

# Convert to HTML
fountainpub script.fountain -h
fountainpub script.fountain -h script.html

# Convert to both
fountainpub script.fountain -p -h
fountainpub script.fountain -p script.pdf -h script.html

# With custom configuration
fountainpub script.fountain -p script.pdf --config .fountainpubrc
```

```
fountainpub <source.fountain> -[p|h|i]

-p, -p <o.pdf>  generates a pdf in the 
                same directory with the 
                same base name, unless 
                another name is provided

-h, -h <o.html> generates a html in the 
                same directory with the 
                same base name, unless 
                another name is provided

-i:             prints screenplay 
                statistics
```
## Configuration
```yaml
print_profile: 'usletter'  # or 'a4'
scenes_numbers: 'left'     # 'left', 'right', 'both', or false
embolden_character_names: true
show_page_numbers: true
text_contd: "(CONT'D)"
text_more: "(MORE)"
```

### CI/CD
Please see [FountainPub.template](https://github.com/alextorma/FountainPub.template) for potential integration ideas!


## To Do

I mean this is my first npm package and it was crudely ripped out of vscode, so I'm sure it can be cleaned up. PRs welcome.

## Thanks / Third-party licenses

* Most of all, thanks to Piers Deseilligny for his amazing BetterFountain extension and beautifully generated pdf and html files.

* The fountain parsing uses elements from the [Fountain.js](https://github.com/mattdaly/Fountain.js) library by Matt Daly, covered by the [MIT License](https://github.com/mattdaly/Fountain.js/blob/master/LICENSE.md)

* The fountain parsing and PDF generation feature is based on Piotr Jamróz's [Afterwriting](https://github.com/ifrost/afterwriting-labs), also covered by the [MIT License](https://github.com/ifrost/afterwriting-labs)

* The project includes Kevin Decker's [`jsdiff`](https://github.com/kpdecker/jsdiff) library, covered by the [BSD License](https://raw.githubusercontent.com/kpdecker/jsdiff/master/LICENSE)

* The PDF Parser uses [Mozilla's PDF.JS](https://github.com/mozilla/pdf.js), covered by the [Apache-2.0 License](https://github.com/mozilla/pdf.js/blob/master/LICENSE)

* The project was built using Microsoft's [language server example extension](https://github.com/Microsoft/vscode-extension-samples/tree/master/lsp-sample) as a boilerplate.

* The default font used in the preview and in the exported PDF is ["Courier Prime"](https://quoteunquoteapps.com/courierprime/), more specifically [a version](http://dimkanovikov.pro/courierprime/) which adds support for Azerbaijani, Belorussian, Kazakh, Russian, and Ukrainian
