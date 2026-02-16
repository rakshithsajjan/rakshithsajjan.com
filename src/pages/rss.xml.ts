import rss from '@astrojs/rss';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const contentDir = path.resolve('src/content/blog');
const files = await fs.readdir(contentDir);

type Post = {
  title: string;
  description: string;
  pubDate: string;
  content: string | Promise<string>;
  url: string;
};

const posts: Post[] = await Promise.all(
  files
    .filter((file: string) => file.endsWith('.md'))
    .map(async (file: string) => {
      const slug = file.replace(/\.md$/, '');
      const raw = await fs.readFile(path.join(contentDir, file), 'utf-8');
      const { data, content } = matter(raw);
      return {
        title: data.title,
        description: data.description,
        pubDate: data.pubDate,
        content: marked(content),
        url: `/blog/${slug}`
      };
    })
);

const items = posts
  .filter((post: Post) => post.pubDate)
  .sort((a: Post, b: Post) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

export const GET = async () => {
  const feed = await rss({
    title: 'rakshithsajjan.com',
    description: 'Notes, experiments, and writing from Rakshith Sajjan.',
    site: 'https://rakshithsajjan.com',
    items: items.map((post: Post) => ({
      title: post.title,
      link: post.url,
      description: post.description,
      pubDate: new Date(post.pubDate),
      content: post.content as string
    }))
  });
  return new Response(feed.body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};
