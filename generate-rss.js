const fs = require('fs');

const config = JSON.parse(fs.readFileSync('./blog-config.json', 'utf8'));
const cache = JSON.parse(fs.readFileSync('./posts/cache.json', 'utf8'));

const blogUrl = config.blog_url.endsWith('/') ? config.blog_url.slice(0, -1) : config.blog_url;

let rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${config.blog_title}</title>
  <link>${blogUrl}</link>
  <description>${config.blog_description}</description>
  <atom:link href="${blogUrl}/rss.xml" rel="self" type="application/rss+xml" />
`;

// Sort posts by date descending
const posts = Object.values(cache).sort((a, b) => {
  return new Date(b.post_created_at) - new Date(a.post_created_at);
});

for (const post of posts) {
    const postDate = new Date(post.post_created_at).toUTCString();
    
    rss += `  <item>
    <title>${post.post_title}</title>
    <link>${post.post_url}</link>
    <guid>${post.post_url}</guid>
    <description><![CDATA[${post.post_description}]]></description>
    <pubDate>${postDate}</pubDate>
  </item>\n`;
}

rss += `</channel>\n</rss>`;

fs.writeFileSync('./rss.xml', rss);
console.log('rss.xml generated');
