import rss from '@astrojs/rss';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const contentDir = path.resolve('src/content/blog');
const files = await fs.readdir(contentDir);

// Pre-parse markdown content once at module level to avoid per-request overhead
const posts = await Promise.all(
  files
    .filter((file) => file.endsWith('.md'))
    .map(async (file) => {
      const slug = file.replace(/\.md$/, '');
      const raw = await fs.readFile(path.join(contentDir, file), 'utf-8');
      const { data, content } = matter(raw);
      // In marked v17+, marked.parse is asynchronous
      const parsedContent = await marked.parse(content);
      return {
        title: data.title,
        description: data.description,
        pubDate: data.pubDate,
        content: parsedContent,
        url: `/blog/${slug}`
      };
    })
);

const items = posts
  .filter((post) => post.pubDate)
  .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

export async function GET() {
  const feed = await rss({
    title: 'rakshithsajjan.com',
    description: 'Notes, experiments, and writing from Rakshith Sajjan.',
    site: 'https://rakshithsajjan.com',
    items: items.map((post) => ({
      title: post.title,
      link: post.url,
      description: post.description,
      pubDate: post.pubDate,
      content: post.content
    }))
  });

  return new Response(feed.body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8'
    }
  });
}
