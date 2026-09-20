import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

/**
 * The blog's one real guarantee: a post marked `draft: true` is invisible in
 * production — not merely unlinked, but 404 and absent from the sitemap. An
 * "unlisted" post that is still reachable by URL is how unfinished copy ends
 * up indexed.
 *
 * lib/blog.ts reads NODE_ENV at call time, so each case sets it explicitly and
 * restores it. The module is re-imported per case; its functions read the
 * filesystem on every call, so there is no cached state to defeat.
 */
const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

async function withNodeEnv<T>(value: string, run: (m: typeof import('../lib/blog.ts')) => T) {
  // Node's `process.env` proxy rejects defineProperty with a full descriptor
  // ("only accepts a configurable, writable, and enumerable data descriptor"),
  // so assignment is the only way in — and NODE_ENV is typed as a readonly
  // literal union, hence the cast rather than a direct write.
  const env = process.env as Record<string, string | undefined>;
  const saved = env.NODE_ENV;
  env.NODE_ENV = value;
  try {
    return run(await import('../lib/blog.ts'));
  } finally {
    if (saved === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = saved;
  }
}

test('every post file has the frontmatter the renderer requires', () => {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'));
  assert.ok(files.length > 0, 'there should be at least one post file');

  for (const file of files) {
    const { data } = matter(fs.readFileSync(path.join(BLOG_DIR, file), 'utf8'));
    assert.equal(typeof data.title, 'string', `${file}: title`);
    assert.equal(typeof data.description, 'string', `${file}: description`);
    assert.ok(data.date, `${file}: date`);
    // gray-matter parses an unquoted YAML date into a Date; either is fine as
    // long as it is a real date, because the page calls new Date() on it.
    assert.ok(!Number.isNaN(new Date(data.date as string).getTime()), `${file}: date parses`);
    assert.equal(typeof data.draft, 'boolean', `${file}: draft must be explicit`);
  }
});

test('the scaffold ships its posts as drafts, not live copy', () => {
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx'));
  for (const file of files) {
    const { data } = matter(fs.readFileSync(path.join(BLOG_DIR, file), 'utf8'));
    assert.equal(data.draft, true, `${file} is placeholder copy and must stay draft: true`);
  }
});

test('production hides drafts from the index', async () => {
  await withNodeEnv('production', (blog) => {
    assert.equal(blog.draftsVisible(), false);
    assert.deepEqual(blog.listPosts(), [], 'every shipped post is a draft, so the index is empty');
  });
});

test('production 404s a draft requested by its exact URL', async () => {
  await withNodeEnv('production', (blog) => {
    assert.equal(blog.getPost('what-ai-ux-tools-get-wrong'), null);
  });
});

test('development shows drafts so they can be written and previewed', async () => {
  await withNodeEnv('development', (blog) => {
    assert.equal(blog.draftsVisible(), true);
    const posts = blog.listPosts();
    assert.ok(posts.length >= 3);
    assert.ok(posts.every((p) => p.draft));
    assert.ok(blog.getPost('what-ai-ux-tools-get-wrong'));
  });
});

test('the sitemap never lists a draft, in any environment', async () => {
  for (const env of ['production', 'development', 'test']) {
    await withNodeEnv(env, (blog) => {
      assert.deepEqual(blog.publishedSlugs(), [], `${env}: a draft must never reach the sitemap`);
    });
  }
});

test('posts come back newest first', async () => {
  await withNodeEnv('development', (blog) => {
    const dates = blog.listPosts().map((p) => new Date(p.date).getTime());
    for (let i = 1; i < dates.length; i += 1) {
      assert.ok(dates[i - 1] >= dates[i], 'index must be reverse-chronological');
    }
  });
});

test('reading time is never zero', async () => {
  await withNodeEnv('development', (blog) => {
    for (const p of blog.listPosts()) {
      assert.ok(p.readingMinutes >= 1, `${p.slug}: "0 min read" is not a thing`);
    }
  });
});

/**
 * Regression: the date guard was `typeof data.date !== 'string'`, but an
 * unquoted YAML date (`date: 2026-09-18`) parses to a Date object. Every post
 * was therefore rejected as malformed, and the index rendered empty — which
 * looked exactly like the drafts filter working correctly. The bug was
 * invisible precisely because its symptom matched the intended behaviour.
 */
test('an unquoted YAML date is accepted, not silently rejected', async () => {
  await withNodeEnv('development', (blog) => {
    const posts = blog.listPosts();
    assert.equal(posts.length, 3, 'all three scaffold posts must parse');
    for (const p of posts) {
      assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/, `${p.slug}: normalised to an ISO date`);
    }
  });
});

test('flipping draft to false publishes the post everywhere it should appear', async () => {
  // Proves the publish path works, rather than only proving posts are hidden.
  // Uses a temp file so the shipped scaffold stays draft.
  const tmp = path.join(BLOG_DIR, '__test-published.mdx');
  fs.writeFileSync(
    tmp,
    ['---', 'title: A published post', 'description: Visible.', 'date: 2030-01-01', 'draft: false', '---', '', 'Body text.'].join('\n')
  );
  try {
    await withNodeEnv('production', (blog) => {
      assert.ok(blog.listPosts().some((p) => p.slug === '__test-published'), 'listed');
      assert.ok(blog.getPost('__test-published'), 'reachable');
      assert.ok(blog.publishedSlugs().includes('__test-published'), 'in the sitemap');
    });
  } finally {
    fs.unlinkSync(tmp);
  }
});

test('a post with no date at all is skipped without taking down the index', async () => {
  const tmp = path.join(BLOG_DIR, '__test-broken.mdx');
  fs.writeFileSync(tmp, ['---', 'title: Broken', 'draft: false', '---', '', 'Body.'].join('\n'));
  try {
    await withNodeEnv('development', (blog) => {
      assert.doesNotThrow(() => blog.listPosts());
      assert.ok(!blog.listPosts().some((p) => p.slug === '__test-broken'));
      assert.equal(blog.listPosts().length, 3, 'the good posts still render');
    });
  } finally {
    fs.unlinkSync(tmp);
  }
});
