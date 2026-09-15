const SUPABASE_URL = 'https://soqvhvqtpgeoxwmkvbih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcXZodnF0cGdlb3h3bWt2YmloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwOTYwODQsImV4cCI6MjA5NTY3MjA4NH0.7o0KP2SEV4Pr2Y_tEcQ3rEFyo_PBwI8rbq9CMh2AveA';
const BASE_URL = 'https://chemato.vercel.app';

export default async function handler(req, res) {
    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?status=eq.published&select=slug,updated_at,published_at`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
        });
        const posts = await r.json();
        const today = new Date().toISOString().split('T')[0];

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        xml += `  <url><loc>${BASE_URL}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>\n`;
        xml += `  <url><loc>${BASE_URL}/blog.html</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>\n`;
        xml += `  <url><loc>${BASE_URL}/all-products.html</loc><lastmod>${today}</lastmod><priority>0.9</priority></url>\n`;
        xml += `  <url><loc>${BASE_URL}/all-requests.html</loc><lastmod>${today}</lastmod><priority>0.9</priority></url>\n`;
        xml += `  <url><loc>${BASE_URL}/chemato-suppliers.html</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>\n`;

        (posts || []).forEach(p => {
            const mod = (p.updated_at || p.published_at || today).split('T')[0];
            xml += `  <url><loc>${BASE_URL}/blog/${encodeURIComponent(p.slug)}</loc><lastmod>${mod}</lastmod><priority>0.7</priority></url>\n`;
        });

        xml += '</urlset>';

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).send(xml);
    } catch (e) {
        return res.status(500).send('Error');
    }
}
