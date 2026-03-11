import rss from '@astrojs/rss';

interface MarkdownInstance {
  frontmatter: {
    title: string;
    description: string;
    pubDate: string;
  };
  compiledContent?: () => string;
}

export const GET = async (context: any) => {
  // Use import.meta.glob to avoid Node.js fs/path, which can cause issues in
  // environments like Cloudflare Workers Builds that attempt to bundle API routes.
  // Astro's Vite-based globbing is faster and more reliable for static builds.
  const postModules = import.meta.glob<MarkdownInstance>('../content/blog/*.md', { eager: true });

  const items = Object.entries(postModules).map(([file, module]) => {
    const slug = file.split('/').pop()?.replace(/\.md$/, '') ?? '';
    return {
      title: module.frontmatter.title,
      description: module.frontmatter.description,
      pubDate: new Date(module.frontmatter.pubDate),
      link: `/blog/${slug}/`,
      // compiledContent() provides the pre-rendered HTML for the markdown file
      content: typeof module.compiledContent === 'function' ? module.compiledContent() : '',
    };
  })
  .filter((item) => !isNaN(item.pubDate.getTime()))
  .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  const feed = await rss({
    title: 'rakshithsajjan.com',
    description: 'Notes, experiments, and writing from Rakshith Sajjan.',
    site: context.site || 'https://rakshithsajjan.com',
    items: items,
  });

  return new Response(feed.body, {
    headers: {
      'content-type': 'application/xml'
    }
  });
};
