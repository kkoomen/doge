" ==============================================================================
" The Python documentation should follow one of the following conventions:
" - reST: http://daouzli.com/blog/docstring.html#restructuredtext
" - Numpy: http://daouzli.com/blog/docstring.html#numpydoc
" - Google: https://github.com/google/styleguide/blob/gh-pages/pyguide.md
" - Sphinx: https://sphinx-rtd-tutorial.readthedocs.io/en/latest/docstrings.html
" ==============================================================================

let s:save_cpo = &cpoptions
set cpoptions&vim

if !exists('g:doge_python_settings')
  let g:doge_python_settings = {
  \  'single_quotes': 0,
  \}
endif

let b:doge_parser = 'python'
let b:doge_insert = 'below'

let b:doge_supported_doc_standards = doge#buffer#get_supported_doc_standards([
      \ 'reST',
      \ 'numpy',
      \ 'google',
      \ 'sphinx',
      \ ])
let b:doge_doc_standard = doge#buffer#get_doc_standard('python')
let b:doge_patterns = doge#buffer#get_patterns()

" ==============================================================================
"
" Define the pattern types.
"
" ==============================================================================
let s:function_pattern = {
\  'nodeTypes': ['function_definition'],
\}


" ==============================================================================
"
" Define the doc standards.
"
" ==============================================================================

call doge#buffer#register_doc_standard('reST', [
\  doge#helpers#deepextend(s:function_pattern, {
\    'parameters': {
\      'format': ':param {name} {type|!type}: !description',
\    },
\    'exceptions': {
\      'format': ':raises {name|!name}: !description',
\    },
\    'template': [
\      '"""',
\      '!description',
\      '',
\      '%(parameters|{parameters})%',
\      '%(returnType|:rtype {returnType}: !description)%',
\      '%(exceptions|{exceptions})%',
\      '"""',
\    ],
\  }),
\])

call doge#buffer#register_doc_standard('sphinx', [
\  doge#helpers#deepextend(s:function_pattern, {
\    'parameters': {
\      'format': [
\        ':param {name}: !description%(default|, defaults to {default})%',
\        ':type {name}: {type|!type}%(default|, optional)%',
\      ],
\    },
\    'exceptions': {
\      'format': ':raises {name|!name}: !description',
\    },
\    'template': [
\      '"""',
\      '!description',
\      '',
\      '%(parameters|{parameters})%',
\      '%(returnType|:return: !description)%',
\      '%(returnType|:rtype: {returnType})%',
\      '%(exceptions|{exceptions})%',
\      '"""',
\    ],
\  }),
\])

call doge#buffer#register_doc_standard('numpy', [
\  doge#helpers#deepextend(s:function_pattern, {
\    'parameters': {
\      'format': [
\        '{name} : {type|!type}',
\        '\t!description',
\      ],
\    },
\    'exceptions': {
\      'format': [
\        '{name|!name}:',
\        '\t!description',
\      ],
\    },
\    'template': [
\      '"""\',
\      '!summary',
\      '',
\      '!description',
\      '%(parameters|)%',
\      '%(parameters|Parameters)%',
\      '%(parameters|----------)%',
\      '%(parameters|{parameters})%',
\      '%(returnType|)%',
\      '%(returnType|Returns)%',
\      '%(returnType|-------)%',
\      '%(returnType|{returnType})%',
\      '%(returnType|\t!description)%',
\      '%(exceptions|)%',
\      '%(exceptions|Raises)%',
\      '%(exceptions|------)%',
\      '%(exceptions|{exceptions})%',
\      '"""',
\    ],
\  }),
\])

call doge#buffer#register_doc_standard('google', [
\  doge#helpers#deepextend(s:function_pattern, {
\    'parameters': {
\      'format': '{name|!name}: !description',
\    },
\    'exceptions': {
\      'format': '{name|!name}: !description',
\    },
\    'template': [
\      '"""!summary',
\      '',
\      '!description',
\      '%(parameters|)%',
\      '%(parameters|Args:)%',
\      '%(parameters|\t{parameters})%',
\      '%(returnType|)%',
\      '%(returnType|Returns:)%',
\      '%(returnType|\t{returnType}: !description)%',
\      '%(exceptions|)%',
\      '%(exceptions|Raises:)%',
\      '%(exceptions|\t{exceptions})%',
\      '"""',
\    ],
\  }),
\])

let &cpoptions = s:save_cpo
unlet s:save_cpo
