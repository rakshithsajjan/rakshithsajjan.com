import rss from '@astrojs/rss';
import { marked } from 'marked';

interface MarkdownInstance {
  url: string | undefined;
  frontmatter: Record<string, any>;
  default: any;
}

export const GET = async () => {
  const postModules = import.meta.glob<MarkdownInstance>('../content/blog/*.md', { eager: true });

  const posts = await Promise.all(
    Object.entries(postModules).map(async ([file, module]) => {
      const slug = file.split('/').pop()?.replace(/\.md$/, '') ?? '';
      const frontmatter = module.frontmatter ?? module.default?.frontmatter;
      const rawContent = module.default?.rawContent?.() || '';

      return {
        title: frontmatter.title,
        description: frontmatter.description,
        pubDate: frontmatter.pubDate,
        content: await marked.parse(rawContent),
        url: `/blog/${slug}`
      };
    })
  );

  const items = posts
    .filter((post) => post.pubDate)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

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
      'content-type': 'application/xml'
    }
  });
};
