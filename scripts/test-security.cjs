// Local-only probes. A parent deadline bounds synchronous compiler execution.
// Run after build; optional arguments point to installed runtime/compiler roots.
const assert = require('node:assert/strict')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { pathToFileURL } = require('node:url')

async function main() {
  if (process.argv[2] === '--worker') {
    const [root, compilerRoot, entry, input] = process.argv.slice(3)
    const { JSDOM } = require('jsdom')
    const dom = new JSDOM('<!doctype html><html><body></body></html>')
    global.document = dom.window.document
    const source =
      input === 'valid'
        ? '<div>Hello {{ name }}</div>'
        : input === 'old-community-regression'
        ? '<div><script>' + 'a'.repeat(20) + '</textarea></div>'
        : '<textarea>' +
          (input === 'less-than'
            ? '<'.repeat(256 * 1024)
            : '</textarea '.repeat(32768))
    assert.ok(source.length < 512 * 1024)
    const compiler =
      entry === 'legacy'
        ? require(compilerRoot)
        : entry === 'sfc-esm'
        ? await import(pathToFileURL(path.join(root, 'compiler-sfc/index.mjs')))
        : entry.includes('.esm')
        ? (await import(pathToFileURL(path.join(root, entry)))).default
        : require(path.join(root, entry))
    const started = performance.now()
    let result
    if (entry === 'legacy') result = compiler.compile(source)
    else if (entry.startsWith('sfc') || entry === 'compiler-sfc') {
      result = compiler.compileTemplate({
        source,
        filename: 'local.vue',
        id: 'audit'
      })
      if (input === 'valid') assert.equal(result.errors.length, 0)
      assert.equal(typeof result.code, 'string')
    } else {
      assert.equal(
        compiler.version,
        require(path.join(root, 'package.json')).version
      )
      compiler.config.silent = true
      result = compiler.compile(source)
      assert.equal(typeof result.render, 'function')
      if (input === 'valid') {
        const vm = new compiler({ data: { name: 'world' }, ...result })
        assert.equal(vm._render().children[0].text, 'Hello world')
      }
    }
    if (entry === 'legacy') {
      assert.equal(typeof result.render, 'string')
      if (input === 'valid') assert.equal(result.errors.length, 0)
    }
    console.log(Math.round(performance.now() - started) + 'ms')
    dom.window.close()
    return
  }
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..'))
  const compilerRoot = path.resolve(
    process.argv[3] || path.join(root, 'packages/template-compiler')
  )
  const version = require(path.join(root, 'package.json')).version
  assert.equal(
    require(path.join(compilerRoot, 'package.json')).version,
    version
  )
  const entries = [
    'dist/vue.common.dev.js',
    'dist/vue.common.prod.js',
    'dist/vue.js',
    'dist/vue.min.js',
    'dist/vue.esm.js',
    'dist/vue.esm.browser.js',
    'dist/vue.esm.browser.min.js',
    'compiler-sfc',
    'sfc-esm',
    'legacy'
  ]
  for (const entry of entries) {
    for (const input of [
      'valid',
      'old-community-regression',
      'less-than',
      'closing-prefix'
    ]) {
      const result = spawnSync(
        process.execPath,
        [__filename, '--worker', root, compilerRoot, entry, input],
        { encoding: 'utf8', timeout: 3000, maxBuffer: 1024 * 1024 }
      )
      assert.ifError(result.error)
      assert.equal(result.status, 0, `${entry}/${input}: ${result.stderr}`)
      console.log(`PASS ${entry}/${input}: ${result.stdout.trim()}`)
    }
  }
}
main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
