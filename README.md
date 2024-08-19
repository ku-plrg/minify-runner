# minify-runner

- thin cli wrapper for calling minifier with specific version

## manuals

- set `MINIFY_RUNNER_CACHE_DIR` env if you want to change env directory.
- if not set, minify-runner creates new cache directory. check `misc/cache.ts`.

```sh
deno install -n minify-runner -A ./mod.ts --import-map ./deno.json
```
