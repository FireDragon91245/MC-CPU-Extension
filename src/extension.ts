import * as vscode from 'vscode';

import { findMacroDefinition, findIncludeDefinition } from './definition';

import hover from './hover.json';

export function activate(context: vscode.ExtensionContext) {


	vscode.window.showInformationMessage('Hello World from test!');

	let disposable = vscode.commands.registerCommand('test.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from test!');
	});

	context.subscriptions.push(disposable);

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
			},
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
			},
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() { }
