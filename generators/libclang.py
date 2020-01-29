#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# vim: fenc=utf-8 ts=4 sw=4 et

"""
Python binding of the clang tool used to extract information of an expression.

Prerequisites (MacOS):
- pip3 install clang
- brew install llvm

--------------------------------------------------------------------------------

If you've installed clang via your package manager then you might have a file
called 'libclang.so.<libclang-major-version>' somewhere in your system, for
example: 'libclang.so.8'. Go into the directory where this file exists using
'cd' and create a symlink:

    ln -s libclang.so.<libclang-major-version> libclang.so

Now it should be detectable via python if you do:

    $ python3
    >>> from clang.cindex import Index
    >>> Index.create()
    >>> <clang.cindex.Index object at 0x1084763d0>

--------------------------------------------------------------------------------

If you compiled manually:
Make sure that your $PATH and $LD_LIBRARY_PATH are set correctly.
The libclang binary its location should be defined in the $LD_LIBRARY_PATH.
"""
from clang.cindex import (
    Index,
    CursorKind,
    Cursor,
    SourceLocation,
    CompilationDatabase,
    CompilationDatabaseError,
)
import sys
import json
import vim
import os
import tempfile
from typing import Union
from optparse import OptionParser, OptionGroup

def get_next_token(node: Cursor, key: str) -> Union[str, None]:
    """
    Get the next token from a node.

    :param node clang.cindex.Cursor: The node itself.
    :param key str: The key to get from the next token.
    :rtype str/none: The requested token or None otherwise.
    """
    try:
        token = next(node.get_tokens())
        return getattr(token, key)
    except Exception:
        return None


def find_node(node: Cursor, line: int) -> Union[Cursor, bool]:
    """
    Find a node based on a given line number.

    :param node clang.cindex.Cursor: The node itself.
    :param line int: The line number where the node is located at.
    :rtype clang.cindex.Cursor/bool: The found node or False otherwise.
    """
    if node.location.line == line:
        return node
    for child in node.get_children():
        result = find_node(child, line)
        if result:
            return result
    return False

def print_field_decl(node: Cursor):
    """
    Parse a FIELD_DECL expression and print its output.

    :param node Cursor: The node to parse.
    """
    has_children = sum(1 for _ in node.get_children())
    if not has_children:
        output = {}
        output['name'] = node.spelling
        print(json.dumps(output))

def print_struct_decl(node: Cursor):
    """
    Parse a STRUCT_DECL expression and print its output.

    :param node Cursor: The node to parse.
    """
    if node.spelling:
        output = {}
        output['name'] = node.spelling
        output['parameters'] = []

        # The code below will result in listing out all the properties as well.
        # ---------------------------------------------------------------------
        # for child in node.get_children():
        #     has_children = sum(1 for _ in child.get_children())
        #     if child.kind == CursorKind.FIELD_DECL and not has_children:
        #         output['parameters'].append({
        #             'name': child.spelling,
        #         })

        print(json.dumps(output))

def print_func_decl(node: Cursor):
    """
    Parse a function-like expression and print its output.

    :param node Cursor: The node to parse.
    """
    output = {}
    output["name"] = node.spelling
    output["returnType"] = node.result_type.spelling
    output["parameters"] = []
    for child in node.get_children():
        if child.kind in [CursorKind.PARM_DECL, CursorKind.TEMPLATE_TYPE_PARAMETER]:
            param_type = "param"
            if child.kind == CursorKind.TEMPLATE_TYPE_PARAMETER:
                param_type = "tparam"
            output["parameters"].append(
                {"param-type": param_type, "name": child.spelling}
            )
    print(json.dumps(output))


def check_file_with_compile_flags(filename, args, filters, line, column):
    """
    Check the actual cpp file with the compile arguments retrieved from compile_commands.json.

    :param filename: file to check
    :param args: arguments to pass to libclang
    :param filters: the filters to check results for
    :param line: the single line where the token is located
    :param column: the column where the token is located
    """
    index = Index.create()
    tu = index.parse(filename, args=args)
    if tu:
        sourceLocation = SourceLocation.from_position(
            tu, tu.get_file(filename), line, column
        )
        node = Cursor.from_location(tu, sourceLocation)
        if node and node.kind in filters:
            if node.kind == CursorKind.FIELD_DECL:
                print_field_decl(node)
            elif node.kind == CursorKind.STRUCT_DECL:
                print_struct_decl(node)
            elif node.kind in [
                CursorKind.CONSTRUCTOR,
                CursorKind.CXX_METHOD,
                CursorKind.FUNCTION_DECL,
                CursorKind.FUNCTION_TEMPLATE,
                CursorKind.CLASS_TEMPLATE,
            ]:
                print_func_decl(node)


def check_file_with_transformation(filename, args, filters, line):
    """
    Check a file with the old mechanism of normalizing the signature to a signle line.

    :param filename: file to check
    :param args: arguments to pass to libclang
    :param filters: the filters to check results for
    :param line: the single line where the token is located
    """
    index = Index.create()
    tu = index.parse(filename, args=args)
    if tu:
        node = find_node(tu.cursor, line)
        if node and node.kind in filters:
            if node.kind == CursorKind.FIELD_DECL:
                print_field_decl(node)
            elif node.kind == CursorKind.STRUCT_DECL:
                print_struct_decl(node)
            elif node.kind in [
                CursorKind.CONSTRUCTOR,
                CursorKind.CXX_METHOD,
                CursorKind.FUNCTION_DECL,
                CursorKind.FUNCTION_TEMPLATE,
                CursorKind.CLASS_TEMPLATE,
            ]:
                print_func_decl(node)


def main():
    # This script should be run using filters and only those nodes who match the
    # filter types will be processed.
    #
    # Example:
    #   ./libclang.py CXX_METHOD FUNCTION_DECL
    filters = [getattr(CursorKind, arg) for arg in sys.argv]

    file_ext = vim.eval("expand('%:p:e')")
    ext = file_ext if file_ext else vim.eval("&filetype")
    workdir = os.getcwd()
    possible_compilation_db = os.path.join(workdir, "compile_commands.json")
    filename_rel = vim.eval("expand('%')")
    filename = os.path.join(workdir, filename_rel)
    current_line = int(vim.eval("line('.')"))
    current_column = int(vim.eval("col('.')"))

    if os.path.exists(possible_compilation_db):
        try:
            compdb = CompilationDatabase.fromDirectory(workdir)
            ccs = compdb.getCompileCommands(filename_rel)
            if ccs is not None:
                ccargs = list(ccs[0].arguments)[1:-1]
            else:
                ccargs = []
        except CompilationDatabaseError:
            ccargs = []

        try:
            check_file_with_compile_flags(filename, ccargs, filters, current_line, current_column)
        except Exception as e:
            print(e)

    else:
        # Normalize the expression by transforming everything into 1 line.
        opener_pos = int(vim.eval("search('\m[{;]', 'n')"))
        normalized_expr = vim.eval("join(map(getline(line('.'), {}), 'doge#helpers#trim(v:val)'), ' ')".format(opener_pos))
        workdir = vim.eval("expand('%:p:h')")
        lines = vim.eval("getline(line(1), line('$'))")
        del lines[current_line-1:opener_pos]
        lines.insert(current_line-1, normalized_expr)

        try:
            args = vim.eval('g:doge_clang_args')
        except vim.error:
            args = []

        # Save the lines to a temp file and parse that file.
        fd, filename = tempfile.mkstemp(dir=workdir, prefix='vim-doge-', suffix='.{}'.format(ext))
        try:
            with os.fdopen(fd, 'w') as tmp:
                tmp.write('\n'.join(lines))
            check_file_with_transformation(filename, args, filters, current_line)
        except Exception as e:
            print(e)
        finally:
            os.remove(filename)


if __name__ == "__main__":
    main()
