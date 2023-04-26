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
exports.findDiagnostics = exports.findDiagnosticsChange = void 0;
const vscode = __importStar(require("vscode"));
const definition_1 = require("./definition");
const symbols_1 = require("./symbols");
const definition_2 = require("./definition");
var MacroArgTypes;
(function (MacroArgTypes) {
    MacroArgTypes[MacroArgTypes["register"] = 0] = "register";
    MacroArgTypes[MacroArgTypes["number"] = 1] = "number";
    MacroArgTypes[MacroArgTypes["address"] = 2] = "address";
    MacroArgTypes[MacroArgTypes["variable"] = 3] = "variable";
    MacroArgTypes[MacroArgTypes["label"] = 4] = "label";
})(MacroArgTypes || (MacroArgTypes = {}));
const stdInstructions = new Array("add %register, %register", "sub %register, %register", "div %register, %register", "mult %register, %register", "inc %register", "dec %register", "call %number", "call %label", "ret", "jmp %label", "jmpz %label", "jmps %label", "jmpb %label", "jmpe %label", "jmp %number", "jmpz %number", "jmps %number", "jmpb %number", "jmpe %number", "cmp %register, %register", "push %register", "pop %register", "cpy %register, %register", "load %register, %number", "mcpy %address, %address", "mcpy %variable, %variable", "mload %address, %number", "mload %variable, %number", "mget %register, %address", "mget %register, %variable", "mset %address, %register", "mset %variable, %register", "and %register, %register", "or %register, %register", "not %register", "shl %register", "shr %register", "nop", "halt");
async function findDiagnosticsChange(changeEvent, diagnosticCollection) {
    findDiagnostics(changeEvent.document, diagnosticCollection);
}
exports.findDiagnosticsChange = findDiagnosticsChange;
async function findDiagnostics(document, diagnosticCollection) {
    const lines = document.getText().split(/\r?\n/);
    const files = await (0, symbols_1.loadIncludedFilesAll)(new Array(new symbols_1.DocumentContent(document.uri, lines)));
    const symbols = (0, symbols_1.getSymbolsFromDocCollection)(files);
    let insideMacro = false;
    let insideMemorylayout = false;
    let memoryLayoutLine = 0;
    let macroLine = 0;
    let currMacroTypes = new Array();
    let diagnostics = new Array();
    let lineNo = 0;
    for (const line of lines) {
        const lineLower = line.trim().toLowerCase();
        if ((0, symbols_1.isNullOrEmpty)(lineLower)) {
            lineNo++;
            continue;
        }
        else if (lineLower.startsWith('#endmemorylayout')) {
            insideMemorylayout = false;
        }
        else if (lineLower.startsWith('#endmacro')) {
            insideMacro = false;
        }
        else if (lineLower.startsWith('#macro')) {
            insideMacro = true;
            macroLine = lineNo;
            currMacroTypes = getMacroArgTypes(lineLower);
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
            if (insideMacro) {
                const lineResolved = (0, definition_1.macroUsageToDeclatation)(resolveMacroArgRefs(lineLower, currMacroTypes));
                if (!symbols.some(sym => (0, symbols_1.matchSymbol)(sym, lineResolved)) && !stdInstructions.some(sym => (0, symbols_1.matchSymbolStr)(sym, lineResolved))) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNo, 0, lineNo, line.length), `Symbol ${lineResolved} is not defined or included`, vscode.DiagnosticSeverity.Error));
                }
            }
            else {
                const variables = (0, definition_2.matchAll)(/\*([a-zA-Z][a-zA-Z0-9]*)/g, lineLower);
                for (const gMatch of variables.groupMatches) {
                    if (!symbols.some(sym => {
                        if (sym.kind !== vscode.SymbolKind.Variable) {
                            return false;
                        }
                        if (sym.name.trim().toLocaleLowerCase() === gMatch.toLocaleLowerCase().trim()) {
                            return true;
                        }
                        return false;
                    })) {
                        diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNo, 0, lineNo, line.length), `Variable ${gMatch} is not defined`, vscode.DiagnosticSeverity.Error));
                    }
                }
                const lables = (0, definition_2.matchAll)(/~([a-zA-Z][a-zA-Z0-9_-]*)/g, lineLower);
                for (const gMatch of lables.groupMatches) {
                    if (!symbols.some(sym => {
                        if (sym.kind !== vscode.SymbolKind.Constant) // Constant = Lable
                         {
                            return false;
                        }
                        if (sym.name.trim().toLocaleLowerCase() === gMatch.toLocaleLowerCase().trim() + ':') {
                            return true;
                        }
                        return false;
                    })) {
                        diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNo, 0, lineNo, line.length), `Lable ${gMatch}: is not defined`, vscode.DiagnosticSeverity.Error));
                    }
                }
                if (!symbols.some(sym => (0, symbols_1.matchSymbol)(sym, lineLower)) && !stdInstructions.some(sym => (0, symbols_1.matchSymbolStr)(sym, lineLower))) {
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(lineNo, 0, lineNo, line.length), `Symbol ${(0, definition_1.macroUsageToDeclatation)(lineLower)} is not defined or included`, vscode.DiagnosticSeverity.Error));
                }
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
}
exports.findDiagnostics = findDiagnostics;
function resolveMacroArgRefs(line, types) {
    let lineCpy = line.slice();
    for (let i = 0; i < types.length; i++) {
        lineCpy = lineCpy.replace(`%${i + 1}`, `%${MacroArgTypes[types[i]]}`);
    }
    return lineCpy;
}
function getMacroArgTypes(macroLine) {
    let res = new Array();
    const matches = (0, definition_2.matchAll)(/(%register|%number|%address|%variable|%label)/g, macroLine);
    for (const gMatch of matches.groupMatches) {
        switch (gMatch) {
            case '%register':
                res.push(MacroArgTypes.register);
                break;
            case '%number':
                res.push(MacroArgTypes.number);
                break;
            case '%address':
                res.push(MacroArgTypes.address);
                break;
            case '%variable':
                res.push(MacroArgTypes.variable);
                break;
            case '%label':
                res.push(MacroArgTypes.label);
                break;
        }
    }
    return res;
}
//# sourceMappingURL=diagnostics.js.map