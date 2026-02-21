import rss from '@astrojs/rss';
import { marked } from 'marked';

export const GET = async (context: any) => {
  const postModules = import.meta.glob('../content/blog/*.md', { eager: true });
  const posts = await Promise.all(
    Object.entries(postModules).map(async ([file, module]: [string, any]) => {
      const slug = file.split('/').pop()?.replace(/\.md$/, '') ?? '';
      return {
        title: module.frontmatter.title,
        description: module.frontmatter.description,
        pubDate: module.frontmatter.pubDate,
        content: await marked.parse(module.rawContent()),
        url: `/blog/${slug}`
      };
    })
  );

  const items = posts
    .filter((post) => post.pubDate)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  const rssData = await rss({
    title: 'rakshithsajjan.com',
    description: 'Notes, experiments, and writing from Rakshith Sajjan.',
    site: context.site || 'https://rakshithsajjan.com',
    items: items.map((post) => ({
      title: post.title,
      link: post.url,
      description: post.description,
      pubDate: post.pubDate,
      content: post.content
    }))
  });

  return new Response(rssData.body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8'
    }
  });
};
