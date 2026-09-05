import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';

/**
 * Lets `node --test` import the app's TypeScript modules directly.
 *
 * The app is bundled by Next, which resolves extensionless specifiers like
 * `./errors` or `../supabase/admin`. Node's ESM resolver does not, so a test
 * that imports a lib module fails on the first internal import. This hook
 * appends `.ts`/`.tsx`/`/index.ts` when the bare specifier does not resolve —
 * exactly what the bundler does — so the tests exercise the real modules
 * rather than copies with adjusted import paths.
 */
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import fs from 'node:fs';
      import { fileURLToPath } from 'node:url';
      export async function resolve(specifier, context, nextResolve) {
        try {
          return await nextResolve(specifier, context);
        } catch (err) {
          if (!specifier.startsWith('.') && !specifier.startsWith('/')) throw err;
          const parent = context.parentURL ?? import.meta.url;
          for (const suffix of ['.ts', '.tsx', '/index.ts']) {
            const candidate = new URL(specifier + suffix, parent);
            try {
              if (fs.existsSync(fileURLToPath(candidate))) {
                return await nextResolve(specifier + suffix, context);
              }
            } catch {}
          }
          throw err;
        }
      }
    `),
  pathToFileURL('./')
);
