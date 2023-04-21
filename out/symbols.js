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
const fsPath = __importStar(require("path"));
class DocumentContent {
    constructor(uri, lines) {
        this.uri = uri;
        this.lines = lines;
    }
}
function getAllSymbolsDocument(document) {
    let symbols = new Array();
    var inMemoryLayoutClause = false;
    for (var i = 0; i < document.lineCount; i++) {
        const currLine = document.lineAt(i);
        if (currLine.isEmptyOrWhitespace) {
            continue;
        }
        const lineLower = currLine.text.slice(currLine.firstNonWhitespaceCharacterIndex);
        if (lineLower.startsWith("#endmemorylayout")) {
            inMemoryLayoutClause = false;
        }
        if (inMemoryLayoutClause) {
            symbols.push(new vscode.SymbolInformation(lineLower, vscode.SymbolKind.Variable, fsPath.parse(document.uri.fsPath).base, new vscode.Location(document.uri, currLine.range)));
        }
        if (lineLower.startsWith("#macro")) {
            symbols.push(new vscode.SymbolInformation(lineLower, vscode.SymbolKind.Method, fsPath.parse(document.uri.fsPath).base, new vscode.Location(document.uri, currLine.range)));
        }
        if (lineLower.startsWith("#memorylayout")) {
            inMemoryLayoutClause = true;
        }
    }
    return symbols;
}
exports.getAllSymbolsDocument = getAllSymbolsDocument;
async function getAllSymbolsWorkspaceQueried(query) {
    const queryLower = query.trim().toLowerCase();
    const symbols = await getAllSymbolsWorkspace();
    const queriedSymbols = symbols.filter((sym) => sym.name.toLowerCase().includes(queryLower) || sym.containerName.toLowerCase().includes(queryLower));
    return queriedSymbols;
}
exports.getAllSymbolsWorkspaceQueried = getAllSymbolsWorkspaceQueried;
async function getAllSymbolsWorkspace() {
    if (vscode.workspace.workspaceFolders === undefined) {
        return new Array();
    }
    const documentContents = await getDocumentContents();
    let symbols = new Array();
    for (const documentContent of documentContents) {
        var lineNo = 0;
        var inMemoryLayoutClause = false;
        for (const line of documentContent.lines) {
            const lineLower = line.trim().toLowerCase();
            if (isNullOrEmpty(lineLower)) {
                continue;
            }
            if (lineLower.startsWith("#endmemorylayout")) {
                inMemoryLayoutClause = false;
            }
            else if (inMemoryLayoutClause) {
                symbols.push(new vscode.SymbolInformation(lineLower, vscode.SymbolKind.Variable, getFileName(documentContent.uri), new vscode.Location(documentContent.uri, new vscode.Range(lineNo, 0, lineNo, line.length))));
            }
            else if (lineLower.startsWith("#memorylayout")) {
                inMemoryLayoutClause = true;
            }
            else if (lineLower.startsWith("#macro")) {
                symbols.push(new vscode.SymbolInformation(lineLower, vscode.SymbolKind.Method, getFileName(documentContent.uri), new vscode.Location(documentContent.uri, new vscode.Range(lineNo, 0, lineNo, line.length))));
            }
            lineNo++;
        }
    }
    return symbols;
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
function getFileName(uri) {
    const path = uri.fsPath;
    const lastSlashIndex = path.lastIndexOf("/");
    const fileName = path.slice(lastSlashIndex + 1);
    return fileName;
}
//# sourceMappingURL=symbols.js.map