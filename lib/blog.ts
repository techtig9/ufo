import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

/**
 * File-backed blog posts.
 *
 * Posts are MDX files in `content/blog/`. There is no database table and no
 * CMS: posts are reviewed in pull requests like the rest of the product, which
 * is the right trade for a handful of marketing pages and means a post cannot
 * appear on the site without someone approving the diff.
 *
 * `draft: true` is the important field. A draft is invisible in production —
 * not merely unlinked, but 404 — while still rendering in development so it
 * can be written and previewed. An "unlisted" post that is still reachable by
 * URL is how unfinished copy ends up indexed.
 */
const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  draft: boolean;
  readingMinutes: number;
}

export interface Post extends PostMeta {
  body: string;
}

/** Drafts are readable in development only. */
export function draftsVisible(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * YAML dates are the trap here. `date: 2026-09-18` unquoted parses to a **Date
 * object**, not a string — so a `typeof data.date !== 'string'` guard rejects
 * every correctly-written post, and the index renders empty while looking like
 * the drafts filter is doing its job. Both forms are accepted and normalised
 * to an ISO date string.
 */
function toIsoDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  return null;
}

function parse(fileName: string): Post | null {
  const slug = fileName.replace(/\.mdx?$/, '');
  const raw = fs.readFileSync(path.join(BLOG_DIR, fileName), 'utf8');
  const { data, content } = matter(raw);

  // A post missing a title or date is a mistake, not something to render with
  // "undefined" in the <h1>. Skipped rather than thrown: one malformed file
  // should not take down the whole index.
  const date = toIsoDate(data.date);
  if (typeof data.title !== 'string' || date === null) return null;

  return {
    slug,
    title: data.title,
    description: typeof data.description === 'string' ? data.description : '',
    date,
    author: typeof data.author === 'string' ? data.author : 'ufo',
    draft: data.draft === true,
    // ~200 words per minute, floored at 1 so nothing reads "0 min read".
    readingMinutes: Math.max(1, Math.round(content.trim().split(/\s+/).length / 200)),
    body: content,
  };
}

function allPosts(): Post[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .map(parse)
    .filter((p): p is Post => p !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Posts for the index. Drafts only in development. */
export function listPosts(): PostMeta[] {
  const visible = draftsVisible() ? allPosts() : allPosts().filter((p) => !p.draft);
  return visible.map(({ body: _body, ...meta }) => meta);
}

/** One post, or null when it does not exist or is a draft in production. */
export function getPost(slug: string): Post | null {
  const post = allPosts().find((p) => p.slug === slug) ?? null;
  if (!post) return null;
  if (post.draft && !draftsVisible()) return null;
  return post;
}

/** Slugs the sitemap should list — published only, in every environment. */
export function publishedSlugs(): string[] {
  return allPosts()
    .filter((p) => !p.draft)
    .map((p) => p.slug);
}
