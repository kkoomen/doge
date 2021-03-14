import { SyntaxNode } from 'tree-sitter';
import { BaseParserService } from './base-parser.service';
import { CustomParserService } from './custom-parser-service.interface';

enum NodeType {
  ARROW_FUNCTION = 'arrow_function',
  FUNCTION = 'function',
  FUNCTION_DECLARATION = 'function_declaration',
  FUNCTION_SIGNATURE = 'function_signature',
  METHOD_DEFINITION = 'method_definition',
  GENERATOR_FUNCTION_DECLARATION = 'generator_function_declaration',
  GENERATOR_FUNCTION = 'generator_function',
  CLASS_DECLARATION = 'class_declaration',
  CLASS = 'class',
  MEMBER_EXPRESSION = 'member_expression',
}

export class TypeScriptParserService
  extends BaseParserService
  implements CustomParserService {
  constructor(
    readonly rootNode: SyntaxNode,
    private readonly lineNumber: number,
    private readonly nodeTypes: string[],
  ) {
    super();
  }

  public traverse(node: SyntaxNode): void {
    if (
      node.startPosition.row === this.lineNumber &&
      this.nodeTypes.includes(node.type) &&
      this.done === false
    ) {
      switch (node.type) {
        case NodeType.MEMBER_EXPRESSION: {
          const prototypeIdentifier = node.child(0)?.children.pop();
          if (prototypeIdentifier?.text === 'prototype') {
            this.result = {
              functionName: null,
              propertyName: null,
              generator: false,
              async: false,
              typeParameters: [],
              parameters: [],
              returnType: null,
              exceptions: [],
            };
            this.runNodeParser(this.parsePrototypeFunction, node);
          }
          break;
        }

        case NodeType.CLASS:
        case NodeType.CLASS_DECLARATION: {
          this.result = {
            name: null,
            typeParameters: [],
            parentName: null,
            interfaceName: null,
          };
          this.runNodeParser(this.parseClass, node);
          break;
        }

        case NodeType.ARROW_FUNCTION:
        case NodeType.FUNCTION:
        case NodeType.FUNCTION_DECLARATION:
        case NodeType.FUNCTION_SIGNATURE:
        case NodeType.METHOD_DEFINITION:
        case NodeType.GENERATOR_FUNCTION:
        case NodeType.GENERATOR_FUNCTION_DECLARATION: {
          this.result = {
            visibility: null,
            static: false,
            generator: false,
            async: false,
            name: null,
            typeParameters: [],
            parameters: [],
            returnType: null,
            exceptions: [],
          };
          this.runNodeParser(this.parseFunction, node);
          break;
        }

        default: {
          console.error(`Unable to handle node type: ${node.type}`);
          break;
        }
      }
    } else if (node.childCount > 0) {
      node.children.forEach((childNode: SyntaxNode) => {
        this.traverse(childNode);
      });
    }
  }

  private parseClass(node: SyntaxNode): void {
    node.children.forEach((childNode: SyntaxNode) => {
      switch (childNode.type) {
        case 'type_identifier': {
          this.result.name = childNode.text;
          break;
        }

        case 'type_parameters': {
          childNode.children
            .filter((n: SyntaxNode) => n.type === 'type_parameter')
            .forEach((cn: SyntaxNode) => {
              const typeparam: Record<string, any> = {
                name: null,
                default: null,
              };

              cn.children.forEach((tpn: SyntaxNode) => {
                if (tpn.type === 'type_identifier') {
                  typeparam.name = tpn.text;
                }

                if (tpn.type === 'default_type') {
                  typeparam.default = tpn.children.pop()?.text;
                }
              });

              this.result.typeParameters.push(typeparam);
            });
          break;
        }

        case 'class_heritage': {
          childNode.children.forEach((cn: SyntaxNode) => {
            if (cn.type === 'extends_clause') {
              cn.children.forEach((n: SyntaxNode) => {
                if (n.type === 'generic_type') {
                  this.result.parentName = n.children
                    .filter((c: SyntaxNode) =>
                      ['type_identifier', 'nested_type_identifier'].includes(
                        c.type,
                      ),
                    )
                    .shift()?.text;
                }

                // prettier-ignore
                if (['type_identifier', 'nested_type_identifier'].includes(n.type)) {
                  this.result.parentName = n.text;
                }
              });
            }

            if (cn.type === 'implements_clause') {
              cn.children.forEach((c: SyntaxNode) => {
                if (c.type === 'generic_type') {
                  this.result.interfaceName = c.children
                    .filter((n) => n.type === 'type_identifier')
                    .shift()?.text;
                }

                if (c.type === 'type_identifier') {
                  this.result.interfaceName = c.text;
                }
              });
            }
          });
          break;
        }

        default:
          break;
      }
    });
  }

  private parsePrototypeFunction(node: SyntaxNode): void {
    node.children.forEach((childNode: SyntaxNode) => {
      switch (childNode.type) {
        case 'member_expression': {
          this.result.functionName = childNode.child(0)?.text;
          break;
        }

        case 'property_identifier': {
          this.result.propertyName = childNode.text;
          break;
        }

        default:
          break;
      }
    });

    const funcNode = node?.parent?.children.pop();
    if (funcNode) {
      this.parseFunction(funcNode);
    }
  }

  private parseFunction(node: SyntaxNode): void {
    let isSingleParamArrowFunc = false;

    const isGeneratorFunction = [
      NodeType.GENERATOR_FUNCTION_DECLARATION,
      NodeType.GENERATOR_FUNCTION,
    ].includes(node.type as NodeType);

    if (isGeneratorFunction) {
      this.result.generator = true;
    }

    if (
      ['arrow_function', 'function'].includes(node.type) &&
      node.parent?.type === 'variable_declarator'
    ) {
      // handle scenario: const foo = (bar) => bar;
      this.result.name = node.parent?.child(0)?.text;

      if (node.child(0)?.type === 'identifier') {
        // handle scenario: const foo = bar => bar;
        this.result.parameters.push({
          name: node?.child(0)?.text,
          type: null,
          default: null,
          optional: false,
        });
        isSingleParamArrowFunc = true;
      }
    }

    node.children.forEach((childNode: SyntaxNode) => {
      switch (childNode.type) {
        case 'property_identifier':
        case 'identifier': {
          if (childNode?.parent?.parent?.type !== 'variable_declarator') {
            this.result.name = childNode.text;
          }
          break;
        }

        case 'accessibility_modifier': {
          this.result.visibility = childNode.text;
          break;
        }

        case 'async': {
          this.result.async = true;
          break;
        }

        case 'static': {
          this.result.static = true;
          break;
        }

        case 'type_parameters': {
          childNode.children
            .filter((n: SyntaxNode) => n.type === 'type_parameter')
            .forEach((cn: SyntaxNode) => {
              const typeparam: Record<string, any> = {
                name: null,
                default: null,
              };

              cn.children.forEach((tpn: SyntaxNode) => {
                if (tpn.type === 'type_identifier') {
                  typeparam.name = tpn.text;
                }

                if (tpn.type === 'default_type') {
                  typeparam.default = tpn.children.pop()?.text;
                }
              });

              this.result.typeParameters.push(typeparam);
            });
          break;
        }

        case 'type_annotation': {
          this.result.returnType = childNode.children
            .filter((n) => n.type !== ':')
            .shift()?.text;
          break;
        }

        case 'formal_parameters': {
          if (!isSingleParamArrowFunc) {
            childNode.children
              .filter((cn: SyntaxNode) =>
                [
                  'required_parameter',
                  'rest_parameter',
                  'optional_parameter',
                ].includes(cn.type),
              )
              .forEach((cn: SyntaxNode) => {
                const param: Record<string, any> = {
                  name: null,
                  type: null,
                  default: null,
                  optional: cn.type === 'optional_parameter',
                };
                const subparams: Array<Record<string, any>> = [];

                cn.children.forEach((pn: SyntaxNode) => {
                  if (pn.type === 'identifier') {
                    param.name = pn.text;
                  }

                  if (pn.type === 'type_annotation') {
                    param.type = pn.children
                      .filter((tc: SyntaxNode) => tc.type !== ':')
                      .shift()?.text;
                  }

                  if (pn.previousSibling?.type === '=') {
                    param.default = pn.text;
                    param.optional = true;
                  }

                  // Check for destructuring patterns.
                  if (pn.type === 'object_pattern') {
                    pn.children
                      .filter((spn: SyntaxNode) =>
                        [
                          'pair_pattern',
                          'shorthand_property_identifier_pattern',
                          'object_assignment_pattern',
                        ].includes(spn.type),
                      )
                      .forEach((spn: SyntaxNode) => {
                        const subparam: Record<string, any> = {
                          property: true,
                          name: null,
                          type: null,
                          default: null,
                          optional: false,
                        };

                        if (spn.type === 'shorthand_property_identifier_pattern') {
                          subparam.name = spn.text;
                        }

                        if (spn.type === 'object_assignment_pattern') {
                          subparam.name = spn.children.shift()?.text;
                          subparam.optional = true;
                        }

                        if (spn.type === 'pair_pattern') {
                          subparam.name = spn.children.shift()?.text;
                          const paramTypeChild = spn.children.pop();
                          if (
                            paramTypeChild?.type === 'assignment_expression'
                          ) {
                            subparam.type = paramTypeChild.children.shift()?.text;
                            subparam.default = paramTypeChild.children.pop()?.text;
                            subparam.optional = true;
                          } else {
                            subparam.type = paramTypeChild?.text;
                          }
                        }

                        subparams.push({
                          ...subparam,
                          name: `!name.${subparam.name}`,
                        });
                      });
                  }
                });

                this.result.parameters.push(param);
                this.result.parameters.push(...subparams);
              });
          }
          break;
        }

        case 'statement_block':
        case 'class_body': {
          this.parseExceptions(childNode);
          break;
        }

        default:
          break;
      }
    });
  }

  private parseExceptions(node: SyntaxNode): void {
    if (node.type === 'throw_statement') {
      const exception: Record<string, any> = { name: null };

      const name = node.children
        .filter((n: SyntaxNode) => n.type === 'new_expression')
        .shift()
        ?.children.filter((n: SyntaxNode) => n.type === 'identifier')
        .shift()?.text;
      if (name) {
        exception.name = name;
      }

      this.result.exceptions.push(exception);
    }

    if (node.childCount > 0) {
      node.children.forEach((childNode: SyntaxNode) => {
        this.parseExceptions(childNode);
      });
    }
  }
}
