import * as vscode from 'vscode';
import { macroUsageToDeclatation } from './definition';
import { loadIncludedFilesAll, DocumentContent, getSymbolsFromDocCollection, matchSymbol, isNullOrEmpty, matchSymbolStr } from './symbols';
import { matchAll } from './definition';

enum MacroArgTypes {
	register,
	number,
	address,
	variable,
	label
}

const stdInstructions = new Array<string>(
	"add %register, %register",
	"sub %register, %register",
	"div %register, %register",
	"mult %register, %register",
	"inc %register",
	"dec %register",
	"call %number",
	"call %label",
	"ret",
	"jmp %label",
	"jmpz %label",
	"jmps %label",
	"jmpb %label",
	"jmpe %label",
	"jmp %number",
	"jmpz %number",
	"jmps %number",
	"jmpb %number",
	"jmpe %number",
	"cmp %register, %register",
	"push %register",
	"pop %register",
	"cpy %register, %register",
	"load %register, %number",
	"mcpy %address, %address",
	"mcpy %variable, %variable",
	"mload %address, %number",
	"mload %variable, %number",
	"mget %register, %address",
	"mget %register, %variable",
	"mset %address, %register",
	"mset %variable, %register",
	"and %register, %register",
	"or %register, %register",
	"not %register",
	"shl %register",
	"shr %register",
	"nop",
	"halt",
);

export async function findDiagnosticsChange(changeEvent: vscode.TextDocumentChangeEvent, diagnosticCollection: vscode.DiagnosticCollection) {
	findDiagnostics(changeEvent.document, diagnosticCollection);
}

export async function findDiagnostics(document: vscode.TextDocument, diagnosticCollection: vscode.DiagnosticCollection): Promise<void> {
	const lines = document.getText().split(/\r?\n/);
	const files = await loadIncludedFilesAll(new Array<DocumentContent>(new DocumentContent(document.uri, lines)));
	const symbols = getSymbolsFromDocCollection(files);
	let insideMacro = false;
	let insideMemorylayout = false;
	let memoryLayoutLine = 0;
	let macroLine = 0;
	let currMacroTypes = new Array<MacroArgTypes>();
	let diagnostics = new Array<vscode.Diagnostic>();
	let lineNo = 0;
	for (const line of lines) {
		const lineLower = line.trim().toLowerCase();
		if (isNullOrEmpty(lineLower)) {
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
			if (!insideMacro) {
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
			if (!lineLower.match(/[a-z][0-9a-z]*/g)) {
				diagnostics.push(
					new vscode.Diagnostic(
						new vscode.Range(lineNo, 0, lineNo, line.length),
						'Variable declaration cant start with a number and must be alpha numeric',
						vscode.DiagnosticSeverity.Error
					)
				);
			}
		}
		else if (insideMacro || !insideMemorylayout) {
			if (insideMacro) {
				const lineResolved = macroUsageToDeclatation(resolveMacroArgRefs(lineLower, currMacroTypes));
				if (!symbols.some(sym => matchSymbol(sym, lineResolved)) && !stdInstructions.some(sym => matchSymbolStr(sym, lineResolved))) {
					diagnostics.push(
						new vscode.Diagnostic(
							new vscode.Range(lineNo, 0, lineNo, line.length),
							`Symbol ${lineResolved} is not defined or included`,
							vscode.DiagnosticSeverity.Error
						)
					);
				}
			}
			else {
				const variables = matchAll(/\*([a-zA-Z][a-zA-Z0-9]*)/g, lineLower);
				for(const gMatch of variables.groupMatches)
				{
					if(!symbols.some(sym => {
						if(sym.kind !== vscode.SymbolKind.Variable)
						{
							return false;
						}
						if(sym.name.trim().toLocaleLowerCase() === gMatch.toLocaleLowerCase().trim())
						{
							return true;
						}
						return false;
					}))
					{
						diagnostics.push(
							new vscode.Diagnostic(
								new vscode.Range(lineNo, 0, lineNo, line.length),
								`Variable ${gMatch} is not defined`,
								vscode.DiagnosticSeverity.Error
							)
						);
					}
				}
				const lables = matchAll(/~([a-zA-Z][a-zA-Z0-9_-]*)/g, lineLower);
				for(const gMatch of lables.groupMatches)
				{
					if(!symbols.some(sym => {
						if(sym.kind !== vscode.SymbolKind.Constant) // Constant = Lable
						{
							return false;
						}
						if(sym.name.trim().toLocaleLowerCase() === gMatch.toLocaleLowerCase().trim() + ':')
						{
							return true;
						}
						return false;
					}))
					{
						diagnostics.push(
							new vscode.Diagnostic(
								new vscode.Range(lineNo, 0, lineNo, line.length),
								`Lable ${gMatch}: is not defined`,
								vscode.DiagnosticSeverity.Error
							)
						);
					}
				}
				if (!symbols.some(sym => matchSymbol(sym, lineLower)) && !stdInstructions.some(sym => matchSymbolStr(sym, lineLower))) {
					diagnostics.push(
						new vscode.Diagnostic(
							new vscode.Range(lineNo, 0, lineNo, line.length),
							`Symbol ${macroUsageToDeclatation(lineLower)} is not defined or included`,
							vscode.DiagnosticSeverity.Error
						)
					);
				}
			}
		}
		lineNo++;
	}
	if (insideMemorylayout) {
		diagnostics.push(
			new vscode.Diagnostic(
				new vscode.Range(memoryLayoutLine, 0, lines.length, 0),
				'Expectet #endmemorylayout ofter #memorylayout',
				vscode.DiagnosticSeverity.Error
			)
		);
	}
	if (insideMacro) {
		diagnostics.push(
			new vscode.Diagnostic(
				new vscode.Range(macroLine, 0, lines.length, 0),
				'Expectet #endmacro ofter #macro',
				vscode.DiagnosticSeverity.Error
			)
		);
	}
	diagnosticCollection.set(document.uri, diagnostics);
}

function resolveMacroArgRefs(line: string, types: Array<MacroArgTypes>): string {
	let lineCpy = line.slice();
	for (let i = 0; i < types.length; i++) {
		lineCpy = lineCpy.replace(`%${i + 1}`, `%${MacroArgTypes[types[i]]}`);
	}
	return lineCpy;
}

function getMacroArgTypes(macroLine: string): Array<MacroArgTypes> {
	let res = new Array<MacroArgTypes>();
	const matches = matchAll(/(%register|%number|%address|%variable|%label)/g, macroLine);
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