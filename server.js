const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

app.post('/extract', async (req, res) => {
  const { url } = req.body;
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.evaluate(() => window.scrollBy(0, window.innerHeight));

    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a, img, iframe, video, source, link, script')).map(el => ({
        tag: el.tagName,
        href: el.href || el.src || '',
        text: el.innerText || el.alt || ''
      })).filter(l => l.href)
    );

    await browser.close();
    return res.json(links);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Puppeteer API running on port ${PORT}`);
});
