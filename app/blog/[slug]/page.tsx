import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { Nav } from '@/components/landing/nav';
import { Footer } from '@/components/landing/footer';
import { Badge } from '@/components/ui/badge';
import { getPost, publishedSlugs, draftsVisible } from '@/lib/blog';

/**
 * Only PUBLISHED slugs are pre-rendered. A draft is reachable in development
 * through the dynamic path, and in production `getPost` returns null for it,
 * so it 404s rather than being quietly served to anyone who guesses the URL.
 */
export function generateStaticParams() {
  return publishedSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: 'Not found' };

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      publishedTime: post.date,
    },
    // A draft previewed in development must never be indexable, even if the
    // preview URL is shared.
    ...(post.draft ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-20">
        <Link href="/blog" className="font-mono text-xs text-fg-faint hover:text-fg">
          ← All posts
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <time dateTime={post.date} className="font-mono text-xs text-fg-faint">
            {new Date(post.date).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </time>
          <span className="text-xs text-fg-faint">· {post.readingMinutes} min read</span>
          {post.draft ? <Badge>Draft — not published</Badge> : null}
        </div>

        <h1 className="mt-3 font-display text-display-md font-semibold tracking-tight">
          {post.title}
        </h1>
        {post.description ? <p className="mt-3 text-lg text-fg-muted">{post.description}</p> : null}

        {/* Prose styling is scoped here rather than global: the generated
            prototype markup also renders arbitrary HTML, and a global
            `h2 { ... }` rule would leak into it. */}
        <article
          className="mt-10 space-y-4 text-fg-secondary
            [&_a]:text-brand-text [&_a]:underline
            [&_code]:rounded [&_code]:bg-surface-subtle [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]
            [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-fg
            [&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-fg
            [&_li]:ml-5 [&_li]:list-disc
            [&_ol_li]:list-decimal
            [&_p]:leading-relaxed"
        >
          <MDXRemote source={post.body} />
        </article>
      </main>
      <Footer />
    </>
  );
}
