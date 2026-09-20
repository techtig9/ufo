import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/landing/nav';
import { Footer } from '@/components/landing/footer';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { listPosts, draftsVisible } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Notes on AI-assisted UI and UX design, from the team building ufo.',
  alternates: { canonical: '/blog' },
};

export default function BlogIndex() {
  const posts = listPosts();
  const showingDrafts = draftsVisible();

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="font-display text-display-md font-semibold tracking-tight">Blog</h1>
        <p className="mt-3 text-fg-muted">
          Notes on AI-assisted UI and UX design, from the team building ufo.
        </p>

        {posts.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              title="Nothing published yet"
              description="Posts live in content/blog as MDX files and go live when draft is set to false."
            />
          </div>
        ) : (
          <ul className="mt-12 space-y-4">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link href={`/blog/${post.slug}`}>
                  <Panel hover className="h-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <time dateTime={post.date} className="font-mono text-xs text-fg-faint">
                        {new Date(post.date).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </time>
                      <span className="text-xs text-fg-faint">· {post.readingMinutes} min read</span>
                      {/* Only ever visible in development — listPosts filters
                          drafts out in production entirely. */}
                      {post.draft ? <Badge>Draft</Badge> : null}
                    </div>
                    <h2 className="mt-2 font-display text-lg font-medium">{post.title}</h2>
                    {post.description ? (
                      <p className="mt-1.5 text-sm text-fg-muted">{post.description}</p>
                    ) : null}
                  </Panel>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {showingDrafts ? (
          <p className="mt-10 rounded-lg border border-edge bg-surface-subtle p-4 text-xs text-fg-faint">
            Drafts are listed because this is a development build. In production they are not
            listed <strong>and not reachable</strong> — requesting one returns 404, so unfinished
            copy cannot be indexed.
          </p>
        ) : null}
      </main>
      <Footer />
    </>
  );
}
