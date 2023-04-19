import * as vscode from 'vscode';
import * as fs from 'fs';
import readline from 'readline';
import path from 'path';

class LinePathCollection
{
    constructor(path: string, lines: Array<string>)
    {
        this.path = path;
        this.lines = lines;
    }

    public path: string;
    public lines: Array<string>;
}

const importReg = /<([a-z|0-9|A-Z]+)>/g;

const extension = vscode.extensions.getExtension("FireDragon91245.mccpu-language");

export function findMacroDefinition(document: vscode.TextDocument, position: vscode.Position, lineLower: string): vscode.Definition | null
{
    const macroDefString = macroUsageToDeclatation(lineLower);
    let includeLines = new Array() as string[];
    for(var i = 0; i < document.lineCount; i++)
    {
        if(i === position.line)
        {
            continue;
        }
        const currLine = document.lineAt(i);
        if(currLine.isEmptyOrWhitespace)
        {
            continue;
        }
        const currLineLower = currLine.text.slice(currLine.firstNonWhitespaceCharacterIndex).toLowerCase();
        if(currLineLower.startsWith('#macro'))
        {
            if(currLineLower.includes(macroDefString))
            {
                return new vscode.Location(document.uri, currLine.range);
            }
        }
        else if(currLineLower.startsWith('#includemacrofile'))
        {
            includeLines.push(currLineLower);
        }
    }

    let includeFileLines = new Array<LinePathCollection>();

    includeLines.forEach(line => {
        let matches = importReg.exec(line);
        if(matches !== null)
        {
            matches.forEach(match => {
                if(extension !== undefined)
                {
                    const nativeMccpuPath = extension.extensionPath + "/mccpu/" + match + ".mccpu";
                    const currPath = path.dirname(document.uri.fsPath) +"/"+match;
                    if(fs.existsSync(nativeMccpuPath))
                    {
                        includeFileLines.push(new LinePathCollection(nativeMccpuPath, readAllLines(nativeMccpuPath)));
                    }
                    else if(fs.existsSync(currPath+"/"+match))
                    {
                        includeFileLines.push(new LinePathCollection(currPath, readAllLines(currPath)));
                    }
                }
            });
        }
    });

    includeFileLines.forEach(coll => {
        let lineNo = 0;
        coll.lines.forEach(line => {
            lineNo++;
            const lineLower = line.trim().toLowerCase();
            if(lineLower.startsWith('#macro'))
            {
                if(line.includes(macroDefString))
                {
                    return new vscode.Location(vscode.Uri.file(coll.path), new vscode.Range(lineNo, 0, lineNo, line.length));
                }
            }
        });
    });

    return null;
}

const regexTypeMap = new Map<RegExp, string>([
    [ /(&r[0-9]{1,3})/g, "%register" ],
    [ /(0x[0-9A-Fa-f]{1,2}|[0-9]{1,3})/g, "%number" ],
    [ /(\*0x[0-9A-Fa-f]{1,2}|\*[0-9]{1,3})/g, "%address" ],
    [ /(\*[a-zA-Z][a-zA-Z0-9]*)/g, "%variable" ],
    [ /(~[a-zA-Z][a-zA-Z0-9_-]*)/g, "%label" ]
]);

function macroUsageToDeclatation(macroLine: string): string
{
    regexTypeMap.forEach((type, reg) => {
        macroLine = macroLine.replace(reg, type);
    });
    return macroLine;
}

function readAllLines(path: string): Array<string>
{
    let lines = new Array<string>();
    var rd = readline.createInterface({
        input: fs.createReadStream('/path/to/file')
    });
    
    rd.on('line', function(line) {
        lines.push(line);
    });

    rd.close();

    return lines;
}