import * as vscode from 'vscode';
import { matchAll, RegexResult, readAllLines } from './definition';
import * as fsPath from 'path';
import { log } from 'console';
import * as fs from 'fs';

export function getAllSymbolsDocument(document: vscode.TextDocument): vscode.SymbolInformation[] {
    let symbols = new Array<vscode.SymbolInformation>();
    var inMemoryLayoutClause: boolean = false;
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
            symbols.push(
                new vscode.SymbolInformation(lineLower, vscode.SymbolKind.Variable, fsPath.parse(document.uri.fsPath).base, new vscode.Location(document.uri, currLine.range))
            );
        }

        if (lineLower.startsWith("#macro")) {
            symbols.push(
                new vscode.SymbolInformation(lineLower, vscode.SymbolKind.Method, fsPath.parse(document.uri.fsPath).base, new vscode.Location(document.uri, currLine.range))
            );
        }

        if (lineLower.startsWith("#memorylayout")) {
            inMemoryLayoutClause = true;
        }
    }

    return symbols;
}

export async function getAllSymbolsWorkspaceQuerryed(query: string): Promise<vscode.SymbolInformation[]> {
    return getAllSymbolsWorkspace().then(symbols => {
        const queryLower = query.trim().toLowerCase();
        let queryedSymbols = new Array<vscode.SymbolInformation>();
        for (const sym of symbols) {
            if (sym.name.includes(queryLower) || sym.containerName.includes(queryLower)) {
                queryedSymbols.push(sym);
            }
        }
        return queryedSymbols;
    });
}

export async function getAllSymbolsWorkspace(): Promise<vscode.SymbolInformation[]> {
    if (vscode.workspace.workspaceFolders === undefined) {
        return new Array<vscode.SymbolInformation>();
    }
    return vscode.workspace.findFiles('**/*.mccpu', null, 1_000_000).then(fileUris => {
        let symbols = new Array<vscode.SymbolInformation>();
        for (const fileUri of fileUris) {
            var fileLine = 0;
            var inMemoryLayoutClause = false;
            const fileLines = readAllLines(fileUri.fsPath);
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