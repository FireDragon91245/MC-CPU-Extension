import * as vscode from 'vscode';
import { matchAll, importReg, extension } from './definition';
import * as fsPath from 'path';
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

function getSymbolsFromDocCollection(documents: DocumentContent[]): vscode.SymbolInformation[] {
    let symbols = new Array<vscode.SymbolInformation>();
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

export async function getAllSymbolsWorkspace(): Promise<vscode.SymbolInformation[]> {
    if (vscode.workspace.workspaceFolders === undefined) {
        return new Array<vscode.SymbolInformation>();
    }
    let documentContents = await getDocumentContents();
    documentContents = await loadIncludedFilesNativOnly(documentContents);
    return getSymbolsFromDocCollection(documentContents);
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

async function loadIncludedFilesNativOnly(documentContents: DocumentContent[]): Promise<DocumentContent[]> {
    if (extension === undefined) {
        return documentContents;
    }
    for (const documentContent of documentContents) {
        for (const line of documentContent.lines) {
            const trimmedLine = line.trim().toLowerCase();
            if (trimmedLine.startsWith("#includemacrofile")) {
                const matches = matchAll(importReg, trimmedLine);
                for (const match of matches.groupMatches) {
                    const fullPath = fsPath.join(extension.extensionPath, "mccpu", match + ".mccpu");
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

async function loadIncludedFilesWokspaceOnly(documentContents: DocumentContent[]): Promise<DocumentContent[]> {
    for (const documentContent of documentContents) {
        for (const line of documentContent.lines) {
            const trimmedLine = line.trim().toLowerCase();
            if (trimmedLine.startsWith("#includemacrofile")) {
                const matches = matchAll(importReg, trimmedLine);
                for (const match of matches.groupMatches) {
                    const fullPath = fsPath.join(fsPath.dirname(documentContent.uri.fsPath), match);
                    try {
                        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(fullPath));
                        documentContents.push(new DocumentContent(doc.uri, doc.getText().split(/\r?\n/)));
                    }
                    catch (error) { }
                }
            }
        }
    }
    return documentContents;
}