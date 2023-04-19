import * as vscode from 'vscode';
import * as fs from 'fs';
import * as fsPath from 'path';

class LinePathCollection {
    constructor(path: string, lines: Array<string>) {
        this.path = path;
        this.lines = lines;
    }

    public path: string;
    public lines: Array<string>;
}

const importReg = /<([a-z|0-9|A-Z|.|_|-]+)>/g;

const extension = vscode.extensions.getExtension("FireDragon91245.mccpu-language");

export function findMacroDefinition(document: vscode.TextDocument, position: vscode.Position, lineLower: string): vscode.Definition | null {
    const macroDefString = macroUsageToDeclatation(lineLower);
    let includeLines = new Array() as string[];
    for (var i = 0; i < document.lineCount; i++) {
        if (i === position.line) {
            continue;
        }
        const currLine = document.lineAt(i);
        if (currLine.isEmptyOrWhitespace) {
            continue;
        }
        const currLineLower = currLine.text.slice(currLine.firstNonWhitespaceCharacterIndex).toLowerCase();
        if (currLineLower.startsWith('#macro')) {
            if (currLineLower.includes(macroDefString)) {
                return new vscode.Location(document.uri, currLine.range);
            }
        }
        else if (currLineLower.startsWith('#includemacrofile')) {
            includeLines.push(currLineLower);
        }
    }

    let includeFileLines = new Array<LinePathCollection>();

    includeLines.forEach(line => {
        importReg.lastIndex = 0;
        let matches = importReg.exec(line);
        if (matches !== null) {
            matches.forEach(match => {
                includeFileLines = getFileLinesAndIncludes(match, includeFileLines, document);
            });
        }
    });

    for (let coll of includeFileLines) {
        let lineNo = 0;
        for (var line of coll.lines) {
            const lineLower = line.trim().toLowerCase();
            if (lineLower.startsWith('#macro')) {
                if (lineLower.includes(macroDefString)) {
                    return new vscode.Location(vscode.Uri.file(coll.path), new vscode.Range(lineNo, 0, lineNo, line.length));
                }
            }
            lineNo++;
        };
    };

    return null;
}

const regexTypeMap = new Map<RegExp, string>([
    [/(&r[0-9]{1,3})/g, "%register"],
    [/(0x[0-9A-Fa-f]{1,2}|[0-9]{1,3})/g, "%number"],
    [/(\*0x[0-9A-Fa-f]{1,2}|\*[0-9]{1,3})/g, "%address"],
    [/(\*[a-zA-Z][a-zA-Z0-9]*)/g, "%variable"],
    [/(~[a-zA-Z][a-zA-Z0-9_-]*)/g, "%label"]
]);

function macroUsageToDeclatation(macroLine: string): string {
    regexTypeMap.forEach((type, reg) => {
        macroLine = macroLine.replace(reg, type);
    });
    return macroLine;
}

function readAllLines(path: string): Array<string> {
    return fs.readFileSync(path).toString().split("\n");
}

function getFileLinesAndIncludes(path: string, lineColl: Array<LinePathCollection>, document: vscode.TextDocument): Array<LinePathCollection> {
    if (extension !== undefined) {
        const nativeMccpuPath = extension.extensionPath + "/mccpu/" + path + ".mccpu";
        if(lineColl.some(coll => coll.path === nativeMccpuPath))
        {
            return lineColl;
        }
        if (fs.existsSync(nativeMccpuPath)) {
            const lines = readAllLines(nativeMccpuPath);

            lineColl.push(new LinePathCollection(nativeMccpuPath, lines));
            
            lines.forEach(line => {
                const currLineLower = line.trim().toLowerCase();
                if (currLineLower.startsWith("#includemacrofile")) {
                    importReg.lastIndex = 0;
                    const matches = importReg.exec(line);
                    if (matches !== null) {
                        matches.forEach(match => {
                            lineColl = getFileLinesAndIncludes(match, lineColl, document);
                        });
                    }
                }
            });
            return lineColl;
        }
    }
    const currPath = fsPath.dirname(document.uri.fsPath) + "/" + path;
    if(lineColl.some(coll => coll.path == currPath))
    {
        return lineColl;
    }
    if (fs.existsSync(currPath)) {
        const lines = readAllLines(currPath);

        lineColl.push(new LinePathCollection(currPath, lines));

        lines.forEach(line => {
            const currLineLower = line.trim().toLocaleLowerCase();
            if (currLineLower.startsWith("#includemacrofile")) {
                importReg.lastIndex = 0;
                const matches = importReg.exec(line);
                if (matches !== null) {
                    matches.forEach(match => {
                        lineColl = getFileLinesAndIncludes(match, lineColl, document);
                    });
                }
            }
        });
        return lineColl;
    }
    return lineColl;
}