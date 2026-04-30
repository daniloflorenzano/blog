const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('./blog-config.json', 'utf8'));
const cache = JSON.parse(fs.readFileSync('./posts/cache.json', 'utf8'));

const blogUrl = config.blog_url.endsWith('/') ? config.blog_url.slice(0, -1) : config.blog_url;

let rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
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
    
    // Extract content from generated index.html
    let content = '';
    const postHtmlPath = path.join('./posts', post.entryName, 'index.html');
    if (fs.existsSync(postHtmlPath)) {
        const html = fs.readFileSync(postHtmlPath, 'utf8');
        // Extract everything between <hr> and the closing </div> before Prism script
        const hrSplit = html.split('<hr>');
        if (hrSplit.length > 1) {
            const afterHr = hrSplit.slice(1).join('<hr>');
            const divRegex = /<\/div>\s*<!-- Prism Code Highlighting -->/;
            const divMatch = afterHr.match(divRegex);
            if (divMatch) {
                content = afterHr.substring(0, divMatch.index).trim();
            } else {
                // Fallback in case Prism comment is missing or changed
                const lastDivRegex = /<\/div>\s*<script src="https:\/\/unpkg\.com\/prismjs/;
                const lastDivMatch = afterHr.match(lastDivRegex);
                if (lastDivMatch) {
                    content = afterHr.substring(0, lastDivMatch.index).trim();
                }
            }
        }
    }
    
    // Fix relative links for images and links
    const postAbsoluteUrl = `${blogUrl}/posts/${post.entryName}/`;
    content = content.replace(/src="([^"]+)"/g, (match, p1) => {
        if (!p1.startsWith('http') && !p1.startsWith('//') && !p1.startsWith('data:')) {
            return `src="${postAbsoluteUrl}${p1}"`;
        }
        return match;
    });
    content = content.replace(/href="([^"]+)"/g, (match, p1) => {
        if (!p1.startsWith('http') && !p1.startsWith('//') && !p1.startsWith('#') && !p1.startsWith('mailto:')) {
            return `href="${postAbsoluteUrl}${p1}"`;
        }
        return match;
    });

    rss += `  <item>
    <title>${post.post_title}</title>
    <link>${post.post_url}</link>
    <guid>${post.post_url}</guid>
    <description><![CDATA[${post.post_description}]]></description>
    <content:encoded><![CDATA[${content}]]></content:encoded>
    <pubDate>${postDate}</pubDate>
  </item>\n`;
}

rss += `</channel>\n</rss>`;

fs.writeFileSync('./rss.xml', rss);
console.log('rss.xml generated with full content');
