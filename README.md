# minify-runner

The `minify-runner` is a command-line tool designed to minify JavaScript code using different minifiers. It currently supports both SWC and Terser minifiers and allows specifying the minifier version.

### Run the Server

```bash
deno run --allow-net --allow-read --allow-run mod.ts
```

### Test the Server

```bash
curl "http://127.0.0.1:8000/?codeOrFilePath=console.log%28%27Hello%20World%27%29%3B&version=swc@1.4.6"
```
