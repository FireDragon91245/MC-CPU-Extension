import * as vscode from 'vscode';

import hover from './hover_cfg/hover.json';

export function activate(context: vscode.ExtensionContext) {


	vscode.window.showInformationMessage('Hello World from test!');

	let disposable = vscode.commands.registerCommand('test.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from test!');
	});

	context.subscriptions.push(disposable);

	vscode.languages.registerHoverProvider('mccpu', {
		provideHover(document, position, token) {
			
			const range = document.getWordRangeAtPosition(position);
            const word = document.getText(range);
			const wordLower = word.toLowerCase();

			let value:string = '';
			hover.hover.forEach(currHover => {
				if(currHover.aliases.some(alias => alias === wordLower))
				{
					value = currHover.value.join('\n');
				}
			});

			if(value === '')
			{
				return;
			}

			const markdown = new vscode.MarkdownString(value, false);
			return new vscode.Hover(markdown);
		},
	});
}

// This method is called when your extension is deactivated
export function deactivate() {}
