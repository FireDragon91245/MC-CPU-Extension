"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findMacroDefinition = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const fsPath = __importStar(require("path"));
class LinePathCollection {
    constructor(path, lines) {
        this.path = path;
        this.lines = lines;
    }
}
const importReg = /<([a-z|0-9|A-Z|.|_|-]+)>/g;
const extension = vscode.extensions.getExtension("FireDragon91245.mccpu-language");
function findMacroDefinition(document, position, lineLower) {
    const macroDefString = macroUsageToDeclatation(lineLower);
    let includeLines = new Array();
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
    let includeFileLines = new Array();
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
        }
        ;
    }
    ;
    return null;
}
exports.findMacroDefinition = findMacroDefinition;
const regexTypeMap = new Map([
    [/(&r[0-9]{1,3})/g, "%register"],
    [/(0x[0-9A-Fa-f]{1,2}|[0-9]{1,3})/g, "%number"],
    [/(\*0x[0-9A-Fa-f]{1,2}|\*[0-9]{1,3})/g, "%address"],
    [/(\*[a-zA-Z][a-zA-Z0-9]*)/g, "%variable"],
    [/(~[a-zA-Z][a-zA-Z0-9_-]*)/g, "%label"]
]);
function macroUsageToDeclatation(macroLine) {
    regexTypeMap.forEach((type, reg) => {
        macroLine = macroLine.replace(reg, type);
    });
    return macroLine;
}
function readAllLines(path) {
    return fs.readFileSync(path).toString().split("\n");
}
function getFileLinesAndIncludes(path, lineColl, document) {
    if (extension !== undefined) {
        const nativeMccpuPath = extension.extensionPath + "/mccpu/" + path + ".mccpu";
        if (lineColl.some(coll => coll.path === nativeMccpuPath)) {
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
    if (lineColl.some(coll => coll.path == currPath)) {
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
//# sourceMappingURL=definition.js.map