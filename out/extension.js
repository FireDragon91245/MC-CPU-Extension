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
const hover_json_1 = __importDefault(require("./hover.json"));
function activate(context) {
    vscode.window.showInformationMessage('Hello World from test!');
    let disposable = vscode.commands.registerCommand('test.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from test!');
    });
    context.subscriptions.push(disposable);
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
        },
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
        },
    }));
}
exports.activate = activate;
// This method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map