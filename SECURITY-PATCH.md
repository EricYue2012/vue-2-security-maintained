# Internal Vue 2 parser patch

This fork's scoped release candidate is `@ericyue/vue-2-security-maintained@2.7.18`,
based on official Vue 2.7.16. It is not an official Vue release or a general
security-support commitment. Scope is CVE-2024-9506 and the related malformed
plaintext closing-tag processing found during review.

The parser locates a fixed case-insensitive closing prefix, then finds the next
`>` once. Neither search retries a variable-length tail for every prefix. This
preserves the original permissive closing suffix, casing, text and source offsets.
Both CommonJS and ESM `vue/compiler-sfc` entry points use the locally built SFC
compiler. Its external dependencies are declared by the root package; the runtime
package no longer fetches the unpatched official SFC compiler.

Use the matching companion package for consumers that still load the legacy
template compiler. Its exact runtime version check remains enabled. Stable
version 2.7.18 satisfies ordinary Vue 2 peer ranges, unlike the previous prerelease
version, and should not require `legacy-peer-deps`.

## Validation and release preparation

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm run ts-check
corepack pnpm run test:unit
corepack pnpm run test:sfc
corepack pnpm run build
corepack pnpm run build:types
corepack pnpm run test:security
corepack pnpm pack
corepack pnpm --dir packages/template-compiler pack
```

The security runner uses separate Node processes with a three-second deadline
including startup, input capped at 512 KiB, and no network/application requests.
It covers full runtime dev/production builds, CJS/ESM SFC entries, and the legacy
compiler, including valid interpolation and both known malformed-input families.
The source tests check casing, Unicode offsets, permissive suffixes, missing
terminators and textarea newlines. CI runs these gates on the security branch.

Before publication, install both tarballs in a disposable consumer under the
names `vue` and `vue-template-compiler` and repeat the security runner with paths:

```sh
node scripts/test-security.cjs /absolute/consumer/node_modules/vue /absolute/consumer/node_modules/vue-template-compiler
```

After reviewing and publishing both scoped packages, consumer manifests should pin:

```json
{
  "dependencies": {
    "vue": "npm:@ericyue/vue-2-security-maintained@2.7.18"
  },
  "devDependencies": {
    "vue-template-compiler": "npm:@ericyue/vue-template-compiler-security-maintained@2.7.18"
  }
}
```

Remove the temporary `legacy-peer-deps=true` workaround in the two i2i consumers
and regenerate their locks. In the viewer, change the Babel preset from `@vue/app`
to `@vue/cli-plugin-babel/preset` so resolution does not rely on dependency hoisting.
These consumer changes are separate from this fork. Verify normal `npm ci`, both
production builds, and the compiled bundle identities before deployment.

Retain MIT notices. Keep the penetration-test finding open pending template-input
tracing, code review, integration/browser QA, deployed asset hashes and tester
retest. Local compiler tests do not establish exploitability or UAT remediation.

## Local verification (22 September 2026)

- Frozen lockfile install, source type check, full build and declaration build passed.
- 1,452 unit tests and 144 SFC tests passed.
- Packed consumer: 40 bounded probes passed across 10 compiler entry points,
  including full ESM builds. The incomplete-closing-prefix case took roughly
  2–6 ms; the previous published `.2` production runtime timed out at three seconds
  on the same input. Timings are machine-specific, not a universal performance guarantee.
- Ordinary npm install and npm ci passed in a disposable tarball consumer with
  Vue Axios 3.2.4 and Vuex 3.6.2, with no peer overrides. Both use the same runtime.
- The matching legacy compiler loaded successfully; a TypeScript consumer imported
  the runtime, SFC compiler and legacy compiler declarations without errors.
- Upstream tooling emits deprecation warnings on Node 24. No browser workflow,
  deployment or live denial-of-service test was run. Packages are not published.
