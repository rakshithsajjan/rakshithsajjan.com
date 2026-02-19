import rss from '@astrojs/rss';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const contentDir = path.resolve('src/content/blog');

interface Post {
  title: string;
  description: string;
  pubDate: string;
  content: string;
  url: string;
}

export const GET = async () => {
  const files = await fs.readdir(contentDir);
  const posts: Post[] = await Promise.all(
    files
      .filter((file) => file.endsWith('.md'))
      .map(async (file) => {
        const slug = file.replace(/\.md$/, '');
        const raw = await fs.readFile(path.join(contentDir, file), 'utf-8');
        const { data, content } = matter(raw);
        return {
          title: data.title as string,
          description: data.description as string,
          pubDate: data.pubDate as string,
          content: marked(content) as string,
          url: `/blog/${slug}`
        };
      })
  );

  const items = posts
    .filter((post) => post.pubDate)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .map((post) => ({
      title: post.title,
      link: post.url,
      description: post.description,
      pubDate: new Date(post.pubDate),
      content: post.content
    }));

  const response = await rss({
    title: 'rakshithsajjan.com',
    description: 'Notes, experiments, and writing from Rakshith Sajjan.',
    site: 'https://rakshithsajjan.com',
    items
  });

  return new Response(response.body, {
    headers: {
      'Content-Type': 'application/xml'
    }
  });
};
