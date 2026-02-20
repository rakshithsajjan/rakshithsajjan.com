import rss from '@astrojs/rss';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

const contentDir = path.resolve('src/content/blog');
const files = await fs.readdir(contentDir);
const posts = await Promise.all(
  files
    .filter((file) => file.endsWith('.md'))
    .map(async (file) => {
      const slug = file.replace(/\.md$/, '');
      const raw = await fs.readFile(path.join(contentDir, file), 'utf-8');
      const { data, content } = matter(raw);
      const htmlContent = await marked.parse(content);
      return {
        title: data.title as string,
        description: data.description as string,
        pubDate: data.pubDate as Date,
        content: htmlContent as string,
        url: `/blog/${slug}`
      };
    })
);

const items = posts
  .filter((post) => post.pubDate)
  .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

export async function GET(context: any) {
  const rssResponse = (await rss({
    title: 'rakshithsajjan.com',
    description: 'Notes, experiments, and writing from Rakshith Sajjan.',
    site: context.site,
    items: items.map((post) => ({
      title: post.title,
      link: post.url,
      description: post.description,
      pubDate: post.pubDate,
      content: post.content
    }))
  })) as any;

  if (rssResponse instanceof Response) {
    return rssResponse;
  }

  return new Response(rssResponse.body, {
    headers: {
      'Content-Type': 'application/xml',
    }
  });
}
