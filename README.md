# minify-runner

The `minify-runner` is a command-line tool designed to minify JavaScript code using different minifiers. It currently supports both SWC and Terser minifiers and allows specifying the minifier version.

## Installation

To use the `minify-runner`, ensure you have [Deno](https://deno.land/) installed.

You can install the cli command with following command: 
```sh
deno install --global -n minify-runner -A ./mod.ts --import-map ./deno.json
```

- Set `MINIFY_RUNNER_CACHE_DIR` env if you want to change env directory
- If not set, minify-runner creates new cache directory. Check `misc/cache.ts`.

## Usage

The `minify-runner` command provides the following options and arguments:

### Options

- `-v, --version <name@semver:string>`: Specifies the minifier name along with its version in the format `name@semver`. The default value is `swc@1.6.7`.
- `-f, --file`: Indicates that the code is provided by filename instead of a string.

### Arguments

- `<codeOrFilePath:string>`: The code to be minified or the path to the file containing the code.

### Minifier Options
The minifier options are stored in configuration files and are automatically applied when the minifier is executed:

- SWC: The configuration options for SWC are stored in the `.swcrc` file. 
- Terser: The configuration options for Terser are stored in the `.terserrc` file. 

### Example commands

#### Directly Input Code
```sh
minify-runner -v swc@1.7.0 "const x = 1; console.log(x)"
```

#### Use File Path
```sh
minify-runner -v swc@1.7.0 -f tmp.js
```
