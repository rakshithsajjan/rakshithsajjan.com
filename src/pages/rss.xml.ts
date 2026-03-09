import rss from '@astrojs/rss';

export const GET = async () => {
  const postModules = import.meta.glob('../content/blog/*.md', { eager: true });

  const posts = Object.entries(postModules).map(([file, module]: [string, any]) => {
    const slug = file.split('/').pop()?.replace(/\.md$/, '') ?? '';
    return {
      title: module.frontmatter.title,
      description: module.frontmatter.description,
      pubDate: module.frontmatter.pubDate,
      link: `/blog/${slug}`,
      content: module.compiledContent ? module.compiledContent() : ''
    };
  });

  const items = posts
    .filter((post) => post.pubDate)
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  const feed = await rss({
    title: 'rakshithsajjan.com',
    description: 'Notes, experiments, and writing from Rakshith Sajjan.',
    site: 'https://rakshithsajjan.com',
    items: items.map((post) => ({
      title: post.title,
      link: post.link,
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
