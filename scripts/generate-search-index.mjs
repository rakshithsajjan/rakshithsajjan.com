import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

const contentDir = path.resolve('src/content/blog');
const outputPath = path.resolve('public/search-index.json');

await fs.mkdir(contentDir, { recursive: true });
const files = await fs.readdir(contentDir);
const posts = [];

for (const file of files) {
  if (!file.endsWith('.md')) continue;
  const slug = file.replace(/\.md$/, '');
  const raw = await fs.readFile(path.join(contentDir, file), 'utf-8');
  const { data, content } = matter(raw);
  posts.push({
    slug,
    title: data.title,
    description: data.description,
    tags: data.tags ?? [],
    pubDate: data.pubDate,
    url: `/blog/${slug}`,
    preview: content.slice(0, 240).replace(/\s+/g, ' ').trim()
  });
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(posts.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)), null, 2));
console.log(`Search index written to ${outputPath}`);
