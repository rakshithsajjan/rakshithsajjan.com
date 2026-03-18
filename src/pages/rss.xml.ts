import rss from '@astrojs/rss';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

interface Post {
  title: string;
  description: string;
  pubDate: string;
  content: string;
  url: string;
}

export const GET = async () => {
  const contentDir = path.resolve('src/content/blog');
  const files = await fs.readdir(contentDir);
  const posts: Post[] = await Promise.all(
    files
      .filter((file: string) => file.endsWith('.md'))
      .map(async (file: string) => {
        const slug = file.replace(/\.md$/, '');
        const raw = await fs.readFile(path.join(contentDir, file), 'utf-8');
        const { data, content } = matter(raw);
        return {
          title: data.title as string,
          description: data.description as string,
          pubDate: data.pubDate as string,
          content: await marked.parse(content),
          url: `/blog/${slug}`
        };
      })
  );

  const items = posts
    .filter((post: Post) => post.pubDate)
    .sort((a: Post, b: Post) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  const feed = await rss({
    title: 'rakshithsajjan.com',
    description: 'Notes, experiments, and writing from Rakshith Sajjan.',
    site: 'https://rakshithsajjan.com',
    items: items.map((post: Post) => ({
      title: post.title,
      link: post.url,
      description: post.description,
      pubDate: new Date(post.pubDate),
      content: post.content
    }))
  });

  return new Response(feed.body, {
    headers: {
      'content-type': 'application/xml'
    }
  });
};
