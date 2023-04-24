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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const definition_1 = require("./definition");
const symbols_1 = require("./symbols");
const hover_json_1 = __importDefault(require("./hover.json"));
function activate(context) {
    //vscode.window.showInformationMessage('Hello World from test!');
    //
    //let disposable = vscode.commands.registerCommand('test.helloWorld', () => {
    //	vscode.window.showInformationMessage('Hello World from test!');
    //});
    //context.subscriptions.push(disposable);
    context.subscriptions.push(vscode.languages.registerHoverProvider('mccpu', {
        provideHover(document, position, token) {
            const range = document.getWordRangeAtPosition(position);
            const word = document.getText(range);
            const wordLower = word.toLowerCase();
            let value = '';
            hover_json_1.default.hover.forEach(currHover => {
                if (currHover.regex) {
                    if (currHover.aliases.some(alias => {
                        const reg = RegExp(alias);
                        return reg.test(wordLower);
                    })) {
                        value = currHover.value.join('\n');
                    }
                }
                else {
                    if (currHover.aliases.some(alias => alias === wordLower)) {
                        value = currHover.value.join('\n');
                    }
                }
            });
            if (value === '') {
                return;
            }
            const markdown = new vscode.MarkdownString(value, false);
            return new vscode.Hover(markdown);
        }
    }));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider('mccpu', {
        provideDefinition(document, position, token) {
            const line = document.lineAt(position.line);
            const lineLower = line.text.slice(line.firstNonWhitespaceCharacterIndex).toLowerCase();
            const includeDef = (0, definition_1.findIncludeDefinition)(document, position, lineLower);
            if (includeDef !== null) {
                return includeDef;
            }
            const macroDef = (0, definition_1.findMacroDefinition)(document, position, lineLower);
            if (macroDef !== null) {
                return macroDef;
            }
            return new vscode.Location(document.uri, position);
        }
    }));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider('mccpu', {
        provideDocumentSymbols(document, token) {
            return (0, symbols_1.getAllSymbolsDocument)(document);
        }
    }));
    context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider({
        async provideWorkspaceSymbols(query, token) {
            return (0, symbols_1.getAllSymbolsWorkspaceQueried)(query);
        },
    }));
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('mccpu');
    findDiagnostics(diagnosticCollection);
}
exports.activate = activate;
function findDiagnostics(diagnosticCollection) {
    vscode.workspace.onDidChangeTextDocument(async (changeEvent) => {
        const document = changeEvent.document;
        const lines = document.getText().split(/\r?\n/);
        const files = await (0, symbols_1.loadIncludedFilesAll)(new Array(new symbols_1.DocumentContent(document.uri, lines)));
        const symbols = (0, symbols_1.getSymbolsFromDocCollection)(files);
        let insideMacro = false;
        let insideMemorylayout = false;
        let memoryLayoutLine = 0;
        let macroLine = 0;
        let diagnostics = new Array();
        let lineNo = 0;
        for (const line of lines) {
            const lineLower = line.trim().toLowerCase();
            if (lineLower.startsWith('#endmemorylayout')) {
                insideMemorylayout = false;
            }
            else if (lineLower.startsWith('#endmacro')) {
                insideMacro = false;
            }
            else if (lineLower.startsWith('#macro')) {
                insideMacro = true;
                macroLine = lineNo;
            }
            else if (lineLower.startsWith('//') || lineLower.startsWith('#includemacrofile')) {
                lineNo++;
                continue;
            }
            else if (lineLower.startsWith('#memorylayout')) {
                insideMemorylayout = true;
                memoryLayoutLine = lineNo;
                const declarationType = ((lineLower.includes('static') || lineLower.includes('static auto')) ? 1 : 0) + (lineLower.includes('explicit') ? 1 : 0);
                const balancingType = (lineLower.includes('incremental') ? 1 : 0) + (lineLower.includes('balanced') ? 1 : 0);
                if (declarationType > 1) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNo, 0, lineNo, line.length), 'More then 1 Declaration Type on #memorylayout', vscode.DiagnosticSeverity.Warning));
                }
                else if (declarationType === 0) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNo, 0, lineNo, line.length), 'No Declaration Type on #memorylayout', vscode.DiagnosticSeverity.Warning));
                }
                if (balancingType > 1) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNo, 0, lineNo, line.length), 'More then 1 Balancing Type on #memorylayout', vscode.DiagnosticSeverity.Warning));
                }
                else if (balancingType === 0) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNo, 0, lineNo, line.length), 'No Balancing Type on #memorylayout', vscode.DiagnosticSeverity.Warning));
                }
            }
            else if (lineLower.startsWith('#comment')) {
                if (!insideMacro) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNo, 0, lineNo, line.length), '#comment outsie of macro', vscode.DiagnosticSeverity.Error));
                }
            }
            else if (insideMemorylayout) {
                if (!lineLower.match(/[a-z][0-9a-z]*/g)) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNo, 0, lineNo, line.length), 'Variable declaration cant start with a number and must be alpha numeric', vscode.DiagnosticSeverity.Error));
                }
            }
            else if (insideMacro || !insideMemorylayout) {
                if (!symbols.some(sym => (0, symbols_1.matchSymbol)(sym, lineLower))) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNo, 0, lineNo, line.length), `Symbol ${(0, definition_1.macroUsageToDeclatation)(lineLower)} is not defined or included`, vscode.DiagnosticSeverity.Error));
                }
            }
            lineNo++;
        }
        if (insideMemorylayout) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(memoryLayoutLine, 0, lines.length, 0), 'Expectet #endmemorylayout ofter #memorylayout', vscode.DiagnosticSeverity.Error));
        }
        if (insideMacro) {
            diagnostics.push(new vscode.Diagnostic(new vscode.Range(macroLine, 0, lines.length, 0), 'Expectet #endmacro ofter #macro', vscode.DiagnosticSeverity.Error));
        }
        diagnosticCollection.set(document.uri, diagnostics);
    });
}
// This method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map