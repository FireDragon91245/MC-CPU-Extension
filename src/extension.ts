import * as vscode from 'vscode';

import { findMacroDefinition, findIncludeDefinition, macroUsageToDeclatation } from './definition';
import { getAllSymbolsDocument, getAllSymbolsWorkspaceQueried, loadIncludedFilesAll, DocumentContent, getSymbolsFromDocCollection, matchSymbol } from './symbols';

import hover from './hover.json';

export function activate(context: vscode.ExtensionContext) {


	//vscode.window.showInformationMessage('Hello World from test!');
//
	//let disposable = vscode.commands.registerCommand('test.helloWorld', () => {
	//	vscode.window.showInformationMessage('Hello World from test!');
	//});

	//context.subscriptions.push(disposable);

	context.subscriptions.push(
		vscode.languages.registerHoverProvider('mccpu', {
			provideHover(document, position, token) {

				const range = document.getWordRangeAtPosition(position);
				const word = document.getText(range);
				const wordLower = word.toLowerCase();

				let value: string = '';
				hover.hover.forEach(currHover => {
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
		})
	);

	context.subscriptions.push(
		vscode.languages.registerDefinitionProvider('mccpu', {
			provideDefinition(document, position, token) {
				const line = document.lineAt(position.line);
				const lineLower = line.text.slice(line.firstNonWhitespaceCharacterIndex).toLowerCase();

				const includeDef = findIncludeDefinition(document, position, lineLower);

				if(includeDef !== null)
				{
					return includeDef;
				}

				const macroDef = findMacroDefinition(document, position, lineLower);

				if(macroDef !== null)
				{
					return macroDef;
				}

				return new vscode.Location(document.uri, position);
			}
		})
	);

	context.subscriptions.push(
		vscode.languages.registerDocumentSymbolProvider('mccpu', {
			provideDocumentSymbols(document, token) {
				return getAllSymbolsDocument(document);
			}
		})
	);

	context.subscriptions.push(
		vscode.languages.registerWorkspaceSymbolProvider({
			async provideWorkspaceSymbols(query, token) {
				return getAllSymbolsWorkspaceQueried(query);
			},
		})
	);

	const diagnosticCollection = vscode.languages.createDiagnosticCollection('mccpu');
	findDiagnostics(diagnosticCollection);
}

function findDiagnostics(diagnosticCollection: vscode.DiagnosticCollection) {
	vscode.workspace.onDidChangeTextDocument(async (changeEvent) => {
		const document = changeEvent.document;
		const lines = document.getText().split(/\r?\n/);
		const files = await loadIncludedFilesAll(new Array<DocumentContent>(new DocumentContent(document.uri, lines)));
		const symbols = getSymbolsFromDocCollection(files);
		let insideMacro = false;
		let insideMemorylayout = false;
		let memoryLayoutLine = 0;
		let macroLine = 0;
		let diagnostics = new Array<vscode.Diagnostic>();
		let lineNo = 0;
		for (const line of lines) {
			const lineLower = line.trim().toLowerCase();
			if(lineLower.startsWith('#endmemorylayout'))
			{
				insideMemorylayout = false;
			}
			else if(lineLower.startsWith('#endmacro'))
			{
				insideMacro = false;
			}
			else if (lineLower.startsWith('#macro')) {
				insideMacro = true;
				macroLine = lineNo;
			}
			else if(lineLower.startsWith('//') || lineLower.startsWith('#includemacrofile'))
			{
				lineNo++;
				continue;
			}
			else if (lineLower.startsWith('#memorylayout')) {
				insideMemorylayout = true;
				memoryLayoutLine = lineNo;
				const declarationType = ((lineLower.includes('static') || lineLower.includes('static auto')) ? 1 : 0) + (lineLower.includes('explicit') ? 1 : 0);
				const balancingType = (lineLower.includes('incremental') ? 1 : 0) + (lineLower.includes('balanced') ? 1 : 0);
				if (declarationType > 1) {
					diagnostics.push(
						new vscode.Diagnostic(
							new vscode.Range(lineNo, 0, lineNo, line.length),
							'More then 1 Declaration Type on #memorylayout',
							vscode.DiagnosticSeverity.Warning
						)
					);
				}
				else if (declarationType === 0) {
					diagnostics.push(
						new vscode.Diagnostic(
							new vscode.Range(lineNo, 0, lineNo, line.length),
							'No Declaration Type on #memorylayout',
							vscode.DiagnosticSeverity.Warning
						)
					);
				}
				if (balancingType > 1) {
					diagnostics.push(
						new vscode.Diagnostic(
							new vscode.Range(lineNo, 0, lineNo, line.length),
							'More then 1 Balancing Type on #memorylayout',
							vscode.DiagnosticSeverity.Warning
						)
					);
				}
				else if (balancingType === 0) {
					diagnostics.push(
						new vscode.Diagnostic(
							new vscode.Range(lineNo, 0, lineNo, line.length),
							'No Balancing Type on #memorylayout',
							vscode.DiagnosticSeverity.Warning
						)
					);
				}
			}
			else if (lineLower.startsWith('#comment')) {
				if(!insideMacro)
				{
				diagnostics.push(
					new vscode.Diagnostic(
						new vscode.Range(lineNo, 0, lineNo, line.length),
						'#comment outsie of macro',
						vscode.DiagnosticSeverity.Error
					)
				);
					}
			}
			else if (insideMemorylayout) {
				if(!lineLower.match(/[a-z][0-9a-z]*/g))
				{
					diagnostics.push(
						new vscode.Diagnostic(
							new vscode.Range(lineNo, 0, lineNo, line.length),
							'Variable declaration cant start with a number and must be alpha numeric',
							vscode.DiagnosticSeverity.Error
						)
					);
				}
			}
			else if(insideMacro || !insideMemorylayout)
			{
				if(!symbols.some(sym => matchSymbol(sym, lineLower)))
				{
					diagnostics.push(
						new vscode.Diagnostic(
							new vscode.Range(lineNo, 0, lineNo, line.length),
							`Symbol ${macroUsageToDeclatation(lineLower)} is not defined or included`,
							vscode.DiagnosticSeverity.Error
						)
					);
				}
			}
			lineNo++;
		}
		if(insideMemorylayout)
		{
			diagnostics.push(
				new vscode.Diagnostic(
					new vscode.Range(memoryLayoutLine, 0, lines.length, 0),
					'Expectet #endmemorylayout ofter #memorylayout',
					vscode.DiagnosticSeverity.Error
				)
			);
		}
		if(insideMacro)
		{
			diagnostics.push(
				new vscode.Diagnostic(
					new vscode.Range(macroLine, 0, lines.length, 0),
					'Expectet #endmacro ofter #macro',
					vscode.DiagnosticSeverity.Error
				)
			);
		}
		diagnosticCollection.set(document.uri, diagnostics);
	});
}

// This method is called when your extension is deactivated
export function deactivate() { }
