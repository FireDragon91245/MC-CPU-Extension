import * as vscode from 'vscode';
import { matchAll, RegexResult, readAllLines } from './definition';
import * as fsPath from 'path';
import { log } from 'console';
import * as fs from 'fs';


class DocumentContent {
    constructor(public uri: vscode.Uri, public lines: string[]) { }
}

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

export async function getAllSymbolsWorkspaceQueried(query: string): Promise<vscode.SymbolInformation[]> {
    const queryLower = query.trim().toLowerCase();
    const symbols = await getAllSymbolsWorkspace();
    const queriedSymbols = symbols.filter(
        (sym) =>
            sym.name.toLowerCase().includes(queryLower) || sym.containerName.toLowerCase().includes(queryLower)
    );
    return queriedSymbols;
}

export async function getAllSymbolsWorkspace(): Promise<vscode.SymbolInformation[]> {
    if (vscode.workspace.workspaceFolders === undefined) {
        return new Array<vscode.SymbolInformation>();
    }
    const documentContents = await getDocumentContents();
    let symbols = new Array<vscode.SymbolInformation>();
    for (const documentContent of documentContents) {
        var lineNo = 0;
        var inMemoryLayoutClause = false;
        for (const line of documentContent.lines) {
            const lineLower = line.trim().toLowerCase();
            if(isNullOrEmpty(lineLower))
            {
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

async function getDocumentContents(): Promise<DocumentContent[]> {
    const documentUris = await vscode.workspace.findFiles('**/*.mccpu', null, 1000);

    const documentContents = await Promise.all(
        documentUris.map(async (documentUri) => {
            const document = await vscode.workspace.openTextDocument(documentUri);
            const lines = document.getText().split('\n');
            return new DocumentContent(documentUri, lines);
        })
    );

    return documentContents;
}

function isNullOrEmpty(str: string | undefined | null): boolean {
    return !str || str.trim().length === 0;
}