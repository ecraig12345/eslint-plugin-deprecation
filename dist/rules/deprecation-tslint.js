"use strict";
/**
 * @license
 * Copyright 2018 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
var tsutils_1 = require("tsutils");
var experimental_utils_1 = require("@typescript-eslint/experimental-utils");
var ts = require("typescript");
// function walk(ctx: Lint.WalkContext, tc: ts.TypeChecker) {
//   return ts.forEachChild(ctx.sourceFile, function cb(node): void {
//     if (isIdentifier(node)) {
//       // START HERE
//       if (!isDeclaration(node)) {
//         const deprecation = getDeprecation(node, tc);
//         if (deprecation !== undefined) {
//           ctx.addFailureAtNode(
//             node,
//             Rule.FAILURE_STRING(node.text, deprecation),
//           );
//         }
//       }
//     } else {
//       switch (node.kind) {
//         case ts.SyntaxKind.ImportDeclaration:
//         case ts.SyntaxKind.ImportEqualsDeclaration:
//         case ts.SyntaxKind.ExportDeclaration:
//         case ts.SyntaxKind.ExportAssignment:
//           return;
//       }
//       return ts.forEachChild(node, cb);
//     }
//   });
// }
var createRule = experimental_utils_1.ESLintUtils.RuleCreator(function () { return 'https://github.com/gund/eslint-plugin-deprecation'; });
exports.default = createRule({
    name: 'deprecation',
    meta: {
        type: 'problem',
        docs: {
            description: 'Do not use deprecated APIs.',
            category: 'Best Practices',
            recommended: 'warn',
            requiresTypeChecking: true,
        },
        messages: {
            deprecated: "'{{name}}' is deprecated. {{reason}}",
        },
        schema: [],
    },
    defaultOptions: [],
    create: function (context) {
        var _a, _b;
        var services = context.parserServices;
        if (!(((_a = services) === null || _a === void 0 ? void 0 : _a.program) && ((_b = services) === null || _b === void 0 ? void 0 : _b.esTreeNodeToTSNodeMap))) {
            return {};
        }
        return {
            'Identifier, JSXIdentifier': function (id) {
                var node = services.esTreeNodeToTSNodeMap.get(id);
                if (node && !isDeclaration(node)) {
                    var deprecation = getDeprecation(node, services.program.getTypeChecker());
                    if (deprecation !== undefined) {
                        context.report({
                            node: id,
                            messageId: 'deprecated',
                            data: {
                                name: id.name,
                                reason: deprecation,
                            },
                        });
                    }
                }
            },
        };
    },
});
function isDeclaration(identifier) {
    var parent = identifier.parent;
    switch (parent.kind) {
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.ClassExpression:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeParameter:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.LabeledStatement:
        case ts.SyntaxKind.JsxAttribute:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.MethodSignature:
        case ts.SyntaxKind.PropertySignature:
        case ts.SyntaxKind.TypeAliasDeclaration:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
        case ts.SyntaxKind.EnumDeclaration:
        case ts.SyntaxKind.ModuleDeclaration:
            return true;
        case ts.SyntaxKind.VariableDeclaration:
        case ts.SyntaxKind.Parameter:
        case ts.SyntaxKind.PropertyDeclaration:
        case ts.SyntaxKind.EnumMember:
        case ts.SyntaxKind.ImportEqualsDeclaration:
            return parent.name === identifier;
        case ts.SyntaxKind.PropertyAssignment:
            return (parent.name === identifier &&
                !tsutils_1.isReassignmentTarget(identifier.parent.parent));
        case ts.SyntaxKind.BindingElement:
            // return true for `b` in `const {a: b} = obj"`
            return (parent.name === identifier &&
                parent.propertyName !== undefined);
        default:
            return false;
    }
}
function getCallExpresion(node) {
    var parent = node.parent;
    if (tsutils_1.isPropertyAccessExpression(parent) && parent.name === node) {
        node = parent;
        parent = node.parent;
    }
    return tsutils_1.isTaggedTemplateExpression(parent) ||
        ((tsutils_1.isCallExpression(parent) || tsutils_1.isNewExpression(parent)) &&
            parent.expression === node)
        ? parent
        : undefined;
}
function getDeprecation(node, tc) {
    var callExpression = getCallExpresion(node);
    if (callExpression) {
        var result = getSignatureDeprecation(tc.getResolvedSignature(callExpression));
        if (result) {
            return result;
        }
    }
    var symbol;
    var parent = node.parent;
    if (parent.kind === ts.SyntaxKind.BindingElement) {
        symbol = tc.getTypeAtLocation(parent.parent).getProperty(node.text);
    }
    else if ((tsutils_1.isPropertyAssignment(parent) && parent.name === node) ||
        (tsutils_1.isShorthandPropertyAssignment(parent) &&
            parent.name === node &&
            tsutils_1.isReassignmentTarget(node))) {
        symbol = tc.getPropertySymbolOfDestructuringAssignment(node);
    }
    else {
        symbol = tc.getSymbolAtLocation(node);
    }
    if (symbol && tsutils_1.isSymbolFlagSet(symbol, ts.SymbolFlags.Alias)) {
        symbol = tc.getAliasedSymbol(symbol);
    }
    if (!symbol ||
        // if this is a CallExpression and the declaration is a function or method,
        // stop here to avoid collecting JsDoc of all overload signatures
        (callExpression && isFunctionOrMethod(symbol.declarations))) {
        return undefined;
    }
    return getSymbolDeprecation(symbol);
}
function findDeprecationTag(tags) {
    for (var _i = 0, tags_1 = tags; _i < tags_1.length; _i++) {
        var tag = tags_1[_i];
        if (tag.name === 'deprecated') {
            return tag.text || '';
        }
    }
    return undefined;
}
function getSymbolDeprecation(symbol) {
    if (symbol.getJsDocTags) {
        return findDeprecationTag(symbol.getJsDocTags());
    }
    // for compatibility with typescript@<2.3.0
    return getDeprecationFromDeclarations(symbol.declarations);
}
function getSignatureDeprecation(signature) {
    var _a;
    if (!signature) {
        return undefined;
    }
    if ((_a = signature) === null || _a === void 0 ? void 0 : _a.getJsDocTags) {
        return findDeprecationTag(signature.getJsDocTags());
    }
    // for compatibility with typescript@<2.3.0
    return !signature.declaration
        ? undefined
        : getDeprecationFromDeclaration(signature.declaration);
}
function getDeprecationFromDeclarations(declarations) {
    if (!declarations) {
        return undefined;
    }
    var declaration;
    for (var _i = 0, declarations_1 = declarations; _i < declarations_1.length; _i++) {
        declaration = declarations_1[_i];
        if (tsutils_1.isBindingElement(declaration)) {
            declaration = tsutils_1.getDeclarationOfBindingElement(declaration);
        }
        if (tsutils_1.isVariableDeclaration(declaration)) {
            declaration = declaration.parent;
        }
        if (tsutils_1.isVariableDeclarationList(declaration)) {
            declaration = declaration.parent;
        }
        return getDeprecationFromDeclaration(declaration);
    }
    return undefined;
}
function getDeprecationFromDeclaration(declaration) {
    for (var _i = 0, _a = tsutils_1.getJsDoc(declaration); _i < _a.length; _i++) {
        var comment = _a[_i];
        if (!comment.tags) {
            continue;
        }
        for (var _b = 0, _c = comment.tags; _b < _c.length; _b++) {
            var tag = _c[_b];
            if (tag.tagName.text === 'deprecated') {
                return tag.comment || '';
            }
        }
    }
    return undefined;
}
function isFunctionOrMethod(declarations) {
    var _a;
    if (!((_a = declarations) === null || _a === void 0 ? void 0 : _a.length)) {
        return false;
    }
    switch (declarations[0].kind) {
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.MethodSignature:
            return true;
        default:
            return false;
    }
}
//# sourceMappingURL=deprecation-tslint.js.map