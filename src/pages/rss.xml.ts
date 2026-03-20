import rss from '@astrojs/rss';
import { marked } from 'marked';
import matter from 'gray-matter';

export const GET = async (context: any) => {
  // Use import.meta.glob to avoid Node.js 'fs' and 'path' which can be problematic in some build environments
  const posts = import.meta.glob('../content/blog/*.md', { query: '?raw', import: 'default', eager: true });

  const items = await Promise.all(
    Object.entries(posts).map(async ([file, raw]) => {
      try {
        const { data, content } = matter(raw as string);
        const slug = file.split('/').pop()?.replace(/\.md$/, '') ?? '';

        return {
          title: data.title || 'Untitled',
          description: data.description || '',
          pubDate: data.pubDate ? new Date(data.pubDate) : new Date(),
          link: `/blog/${slug}`,
          content: await marked.parse(content),
        };
      } catch (e) {
        console.error(`Error processing post ${file}:`, e);
        return null;
      }
    })
  );

  const validItems = items
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  const feed = await rss({
    title: 'rakshithsajjan.com',
    description: 'Notes, experiments, and writing from Rakshith Sajjan.',
    site: context.site || 'https://rakshithsajjan.com',
    items: validItems,
  });

  // Ensure we return a standard Response with the correct content-type
  return new Response(feed.body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
};
