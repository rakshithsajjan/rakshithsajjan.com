import rss from '@astrojs/rss';
import { marked } from 'marked';

export async function GET(context: any) {
  const postModules = import.meta.glob('../content/blog/*.md', { eager: true });
  const posts = await Promise.all(
    Object.entries(postModules).map(async ([file, module]) => {
      const slug = file.split('/').pop()?.replace(/\.md$/, '') || '';
      const m = module as any;
      const frontmatter = m.frontmatter;
      const rawContent = typeof m.rawContent === 'function' ? m.rawContent() : '';
      return {
        title: frontmatter.title,
        description: frontmatter.description,
        pubDate: frontmatter.pubDate,
        content: await marked.parse(rawContent),
        link: `/blog/${slug}/`,
      };
    })
  );

  const items = posts
    .filter((post) => post.pubDate)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  return rss({
    title: 'rakshithsajjan.com',
    description: 'Notes, experiments, and writing from Rakshith Sajjan.',
    site: context.site,
    items: items,
  });
}
