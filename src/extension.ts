import * as vscode from 'vscode';
import * as tsParser from '@typescript-eslint/parser';

type Node = {
    type: string;
    [key: string]: any;
};

/**
 * Calculates cyclomatic complexity by traversing the TypeScript AST.
 * @param code Source code to analyze.
 * @returns Complexity score or null if parsing fails.
 */
function getComplexity(code: string): number | null {
    try {
        const ast = tsParser.parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            range: true
        }) as unknown as Node;

        let complexity = 1;

        function visit(node: Node | null | undefined): void {
            if (!node || typeof node !== 'object') {
                return;
            }

            switch (node.type) {
                case 'IfStatement':
                case 'ForStatement':
                case 'ForInStatement':
                case 'ForOfStatement':
                case 'WhileStatement':
                case 'DoWhileStatement':
                case 'CatchClause':
                case 'ConditionalExpression':
                    complexity++;
                    break;

                case 'LogicalExpression':
                    if (node.operator === '&&' || node.operator === '||' || node.operator === '??') {
                        complexity++;
                    }
                    break;

                case 'SwitchCase':
                    if (node.test) {
                        complexity++;
                    }
                    break;
            }

            for (const [key, value] of Object.entries(node)) {
                if (key === 'parent' || key === 'loc' || key === 'range') {
                    continue;
                }

                if (Array.isArray(value)) {
                    for (const child of value) {
                        if (child && typeof child === 'object') {
                            visit(child as Node);
                        }
                    }
                } else if (value && typeof value === 'object') {
                    visit(value as Node);
                }
            }
        }

        visit(ast);
        return complexity;
    } catch {
        return null;
    }
}

/**
 * Provides CodeLens actions for functions and arrow functions in a document.
 */
class FunctionDropdownProvider implements vscode.CodeLensProvider {
    /**
     * Finds function symbols and adds a CodeLens action to each one.
     * @param document Document to analyze.
     * @returns CodeLens actions for detected functions.
     */
    async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
        const symbols = await vscode.commands.executeCommand<
            (vscode.DocumentSymbol | vscode.SymbolInformation)[]
        >('vscode.executeDocumentSymbolProvider', document.uri);

        if (!symbols) {
            return [];
        }

        const lenses: vscode.CodeLens[] = [];

        const visit = (items: (vscode.DocumentSymbol | vscode.SymbolInformation)[]) => {
            for (const item of items) {
                const range = 'location' in item ? item.location.range : item.range;
                const code = document.getText(range);

                const isFunction = [
                    vscode.SymbolKind.Function,
                    vscode.SymbolKind.Method,
                    vscode.SymbolKind.Constructor
                ].includes(item.kind);

                const isVariable = [
                    vscode.SymbolKind.Variable,
                    vscode.SymbolKind.Constant,
                    vscode.SymbolKind.Property,
                    vscode.SymbolKind.Field
                ].includes(item.kind);

                if (isFunction || (isVariable && code.includes('=>'))) {
                    lenses.push(new vscode.CodeLens(range, {
                        title: `actions: ${item.name}`,
                        command: 'cyclomatic-complexity-estimator.openDropdown',
                        arguments: [item.name, range]
                    }));
                }

                if ('children' in item) {
                    visit(item.children);
                }
            }
        };

        visit(symbols);
        return lenses;
    }
}

/**
 * Activates the extension and registers its commands and CodeLens provider.
 * @param context VS Code extension context.
 */
export function activate(context: vscode.ExtensionContext) {
    const command = vscode.commands.registerCommand(
        'cyclomatic-complexity-estimator.openDropdown',
        async (name: string, range: vscode.Range) => {
            const selected = await vscode.window.showQuickPick(
                ['Estimate complexity'],
                { placeHolder: `Select action for ${name}` }
            );

            if (selected !== 'Estimate complexity') {
                return;
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const complexity = getComplexity(editor.document.getText(range));

            if (complexity === null) {
                vscode.window.showErrorMessage('Unable to parse function');
                return;
            }

            vscode.window.showInformationMessage(
                `Cyclomatic complexity: ${complexity}`
            );
        }
    );

    const provider = vscode.languages.registerCodeLensProvider(
        { scheme: 'file' },
        new FunctionDropdownProvider()
    );

    context.subscriptions.push(command, provider);
}

/**
 * Deactivates the extension.
 */
export function deactivate() {}