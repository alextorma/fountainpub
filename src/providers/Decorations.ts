import { token } from '../token';

var DialogueNumbers: { line: number; text: string; takeNumber: number }[] = [];

export function AddDialogueNumberDecoration(thistoken: token) {
    DialogueNumbers.push({
        line: thistoken.line,
        text: thistoken.text,
        takeNumber: thistoken.takeNumber
    });
}

export function clearDecorations() {
    DialogueNumbers = [];
}

export function showDecorations() {
    return DialogueNumbers;
}