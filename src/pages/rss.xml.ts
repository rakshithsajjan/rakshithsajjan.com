import rss from '@astrojs/rss';

interface MarkdownInstance {
  url?: string;
  frontmatter: {
    title: string;
    description: string;
    pubDate: string;
  };
}

export const GET = async () => {
  const postImportResult = import.meta.glob<MarkdownInstance>('../content/blog/*.md', { eager: true });
  const posts = Object.values(postImportResult);

  const items = posts
    .filter((post) => post.frontmatter.pubDate)
    .sort((a, b) => new Date(b.frontmatter.pubDate).getTime() - new Date(a.frontmatter.pubDate).getTime());

  const feed = await rss({
    title: 'rakshithsajjan.com',
    description: 'Notes, experiments, and writing from Rakshith Sajjan.',
    site: 'https://rakshithsajjan.com',
    items: items.map((post) => ({
      title: post.frontmatter.title,
      link: post.url || '',
      description: post.frontmatter.description,
      pubDate: new Date(post.frontmatter.pubDate),
    }))
  });

  return new Response(feed.body, {
    headers: {
      'content-type': 'application/xml'
    }
  });
};
