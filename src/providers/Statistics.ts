// import * as path from 'path';
// import * as fs from "fs";
import { getEditor, getActiveFountainDocument } from "../utils";
import { FountainConfig, getFountainConfig } from "../configloader";
import * as afterparser from "../afterwriting-parser";
import { retrieveScreenPlayStatistics } from "../statistics";

export async function getDocumentStatistics(documentText: string, config: FountainConfig) {
    var parsed = afterparser.parse(documentText, config, false);
    const stats = await retrieveScreenPlayStatistics(documentText, parsed, config, undefined);
    return stats;
}

export async function getStatistics() {
    let editor = getEditor(getActiveFountainDocument());
    if (!editor) {
        throw new Error("Not a valid fountain file");
    }

    let config = getFountainConfig(editor.document.fileName);
    return getDocumentStatistics(editor.document.getText(), config);
}