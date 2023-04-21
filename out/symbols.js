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
exports.getAllSymbolsWorkspace = exports.getAllSymbolsWorkspaceQueried = exports.getAllSymbolsDocument = void 0;
const vscode = __importStar(require("vscode"));
const definition_1 = require("./definition");
const fsPath = __importStar(require("path"));
const fs = __importStar(require("fs"));
class DocumentContent {
    constructor(uri, lines) {
        this.uri = uri;
        this.lines = lines;
    }
}
async function getAllSymbolsDocument(document) {
    let documents = new Array(new DocumentContent(document.uri, document.getText().split(/\r?\n/)));
    return getSymbolsFromDocCollection(documents);
}
exports.getAllSymbolsDocument = getAllSymbolsDocument;
async function getAllSymbolsWorkspaceQueried(query) {
    const queryLower = query.trim().toLowerCase();
    const symbols = await getAllSymbolsWorkspace();
    const queriedSymbols = symbols.filter((sym) => sym.name.toLowerCase().includes(queryLower) || sym.containerName.toLowerCase().includes(queryLower));
    return queriedSymbols;
}
exports.getAllSymbolsWorkspaceQueried = getAllSymbolsWorkspaceQueried;
function getSymbolsFromDocCollection(documents) {
    let symbols = new Array();
    for (const documentContent of documents) {
        var lineNo = 0;
        var inMemoryLayoutClause = false;
        for (const line of documentContent.lines) {
            const lineLower = line.trim().toLowerCase();
            if (isNullOrEmpty(lineLower)) {
                lineNo++;
                continue;
            }
            if (lineLower.startsWith("#endmemorylayout")) {
                inMemoryLayoutClause = false;
            }
            else if (inMemoryLayoutClause) {
                symbols.push(new vscode.SymbolInformation(lineLower, vscode.SymbolKind.Variable, documentContent.uri.fsPath, new vscode.Location(documentContent.uri, new vscode.Range(lineNo, 0, lineNo, line.length))));
            }
            else if (lineLower.startsWith("#memorylayout")) {
                inMemoryLayoutClause = true;
            }
            else if (lineLower.startsWith("#macro")) {
                symbols.push(new vscode.SymbolInformation(lineLower, vscode.SymbolKind.Method, documentContent.uri.fsPath, new vscode.Location(documentContent.uri, new vscode.Range(lineNo, 0, lineNo, line.length))));
            }
            lineNo++;
        }
    }
    return symbols;
}
async function getAllSymbolsWorkspace() {
    if (vscode.workspace.workspaceFolders === undefined) {
        return new Array();
    }
    let documentContents = await getDocumentContents();
    documentContents = await loadIncludedFilesNativOnly(documentContents); // fine to use this here because "documentContents" includes all documents that can import std lib macros
    return getSymbolsFromDocCollection(documentContents);
}
exports.getAllSymbolsWorkspace = getAllSymbolsWorkspace;
async function getDocumentContents() {
    const documentUris = await vscode.workspace.findFiles('**/*.mccpu', null, 1000);
    const documentContents = await Promise.all(documentUris.map(async (documentUri) => {
        const document = await vscode.workspace.openTextDocument(documentUri);
        const lines = document.getText().split('\n');
        return new DocumentContent(documentUri, lines);
    }));
    return documentContents;
}
function isNullOrEmpty(str) {
    return !str || str.trim().length === 0;
}
/*
WARNING: this function only realy finds all std lib inclusions if you pass all documents that include std lib inclusion

that means the function will not find the #includemacrofile <stdinstruction> in this example

- programm.mccpu
    #includemacrofile <test.mccpu>
    testmacro &r1

- test.mccpu
    #includemacrofile <stdinstructions>                 <---- this will not be found by this function if only programm.mccpu is provided

    #macro testmacro %register
    not %1
    #endmacro
*/
async function loadIncludedFilesNativOnly(documentContents) {
    if (definition_1.extension === undefined) {
        return documentContents;
    }
    let i = 0;
    while (i < documentContents.length) {
        const documentContent = documentContents[i];
        i++;
        for (const line of documentContent.lines) {
            const trimmedLine = line.trim().toLowerCase();
            if (trimmedLine.startsWith("#includemacrofile")) {
                const matches = (0, definition_1.matchAll)(definition_1.importReg, trimmedLine);
                for (const match of matches.groupMatches) {
                    const fullPath = fsPath.join(definition_1.extension.extensionPath, "mccpu", match + ".mccpu");
                    if (fs.existsSync(fullPath)) {
                        const content = fs.readFileSync(fullPath).toString();
                        documentContents.push(new DocumentContent(vscode.Uri.file(fullPath), content.split(/\r?\n/)));
                    }
                }
            }
        }
    }
    return documentContents;
}
/*
other then at the "loadIncludedFilesNativOnly" function this will recusivly scann everything
*/
async function loadIncludedFilesAll(documentContents) {
    let i = 0;
    while (i < documentContents.length) {
        const documentContent = documentContents[i];
        i++;
        for (const line of documentContent.lines) {
            const trimmedLine = line.trim().toLowerCase();
            if (trimmedLine.startsWith("#includemacrofile")) {
                const matches = (0, definition_1.matchAll)(definition_1.importReg, trimmedLine);
                for (const match of matches.groupMatches) {
                    const fullPathWorkspace = fsPath.join(fsPath.dirname(documentContent.uri.fsPath), match);
                    try {
                        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPathWorkspace));
                        documentContents.push(new DocumentContent(doc.uri, doc.getText().split(/\r?\n/)));
                    }
                    catch (error) { }
                    if (definition_1.extension !== undefined) {
                        const fullPathStdLib = fsPath.join(definition_1.extension.extensionPath, "mccpu", match + ".mccpu");
                        if (fs.existsSync(fullPathStdLib)) {
                            const content = fs.readFileSync(fullPathStdLib).toString();
                            documentContents.push(new DocumentContent(vscode.Uri.file(fullPathStdLib), content.split(/\r?\n/)));
                        }
                    }
                }
            }
        }
    }
    return documentContents;
}
//# sourceMappingURL=symbols.js.map