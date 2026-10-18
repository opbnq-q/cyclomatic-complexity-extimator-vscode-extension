import * as vscode from 'vscode';

class FunctionDropdownProvider implements vscode.CodeLensProvider {
    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const symbols = await vscode.commands.executeCommand<
            (vscode.DocumentSymbol | vscode.SymbolInformation)[]
        >('vscode.executeDocumentSymbolProvider', document.uri);

        if (!symbols || !Array.isArray(symbols)) {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];

        const findFunctions = (items: (vscode.DocumentSymbol | vscode.SymbolInformation)[]) => {
            for (const item of items) {
                if (
                    item.kind === vscode.SymbolKind.Function ||
                    item.kind === vscode.SymbolKind.Method
                ) {
                    const range = 'range' in item ? item.range : item.location.range;

                    lenses.push(
                        new vscode.CodeLens(range, {
                            title: `$(chevron-down) Действия: ${item.name}`,
                            command: 'cyclomatic-complexity-estimator.openDropdown',
                            arguments: [item.name, range]
                        })
                    );
                }

                if ('children' in item && Array.isArray(item.children) && item.children.length > 0) {
                    findFunctions(item.children);
                }
            }
        };

        findFunctions(symbols);
        return lenses;
    }
}

export function activate(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand(
        'cyclomatic-complexity-estimator.openDropdown',
        async (fnName: string, range: vscode.Range) => {
            const selected = await vscode.window.showQuickPick(
                ['Estimate complexity'],
                { placeHolder: `Pick action for ${fnName}` }
            );

            if (selected === 'Оценить сложность') {
                const editor = vscode.window.activeTextEditor;
                if (editor && range) {
                    const fnCode = editor.document.getText(range);
                    vscode.window.showInformationMessage(`Length: ${fnName}: ${fnCode.length}`);
                }
            }
        }
    );

    const lensProvider = vscode.languages.registerCodeLensProvider(
        { scheme: 'file' },
        new FunctionDropdownProvider()
    );

    context.subscriptions.push(command, lensProvider);
}

export function deactivate() {}