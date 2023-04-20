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
exports.getAllSymbolsWorkspace = exports.getAllSymbolsWorkspaceQuerryed = exports.getAllSymbolsDocument = void 0;
const vscode = __importStar(require("vscode"));
const definition_1 = require("./definition");
const fsPath = __importStar(require("path"));
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
async function getAllSymbolsWorkspaceQuerryed(query) {
    return getAllSymbolsWorkspace().then(symbols => {
        const queryLower = query.trim().toLowerCase();
        let queryedSymbols = new Array();
        for (const sym of symbols) {
            if (sym.name.includes(queryLower) || sym.containerName.includes(queryLower)) {
                queryedSymbols.push(sym);
            }
        }
        return queryedSymbols;
    });
}
exports.getAllSymbolsWorkspaceQuerryed = getAllSymbolsWorkspaceQuerryed;
async function getAllSymbolsWorkspace() {
    if (vscode.workspace.workspaceFolders === undefined) {
        return new Array();
    }
    return vscode.workspace.findFiles('**/*.mccpu', null, 1000000).then(fileUris => {
        let symbols = new Array();
        for (const fileUri of fileUris) {
            var fileLine = 0;
            var inMemoryLayoutClause = false;
            const fileLines = (0, definition_1.readAllLines)(fileUri.fsPath);
            for (const line of fileLines) {
                const lineLower = line.trim().toLowerCase();
                if (lineLower.startsWith("#endmemorylayout")) {
                    inMemoryLayoutClause = false;
                }
                if (inMemoryLayoutClause) {
                    symbols.push(new vscode.SymbolInformation(lineLower, vscode.SymbolKind.Variable, fsPath.parse(fileUri.fsPath).base, new vscode.Location(fileUri, new vscode.Range(fileLine, 0, fileLine, line.length))));
                }
                if (lineLower.startsWith("#macro")) {
                    symbols.push(new vscode.SymbolInformation(lineLower, vscode.SymbolKind.Method, fsPath.parse(fileUri.fsPath).base, new vscode.Location(fileUri, new vscode.Range(fileLine, 0, fileLine, line.length))));
                }
                if (lineLower.startsWith("#memorylayout")) {
                    inMemoryLayoutClause = true;
                }
                fileLine++;
            }
        }
        return symbols;
    });
}
exports.getAllSymbolsWorkspace = getAllSymbolsWorkspace;
//# sourceMappingURL=symbols.js.map