const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());

app.post('/scrape', async (req, res) => {
  const { url } = req.body;

  // ✅ Validate input
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return res.status(400).json({ error: 'Missing or invalid "url" field.' });
  }

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // ✅ Go to the page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 0,
    });

    // ✅ Scroll to bottom to load lazy-loaded content
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 300;
        const interval = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (window.scrollY + window.innerHeight >= document.body.scrollHeight) {
            clearInterval(interval);
            resolve();
          }
        }, 300);
      });
    });

    // ✅ Give extra time for JS content to settle (replaces waitForTimeout)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ✅ Try multiple selectors for flexibility across sites
    const selectors = [
      '.vue-exhibitor-listing .card__title', // Informaconnect
      '.exhibitor-name',
      '.sponsor-name',
      '.company-name',
      'li',
      'td',
      'h3',
      'span',
      'div'
    ];

    const names = await page.evaluate((selectors) => {
      const collected = new Set();

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = (el.alt || el.innerText || el.textContent || '').trim();
          if (
            text.length >= 3 &&
            text.length <= 100 &&
            !/cookie|accept|terms|policy|email|phone|button|apply/i.test(text)
          ) {
            collected.add(text);
          }
        });
      });

      return Array.from(collected);
    }, selectors);

    res.status(200).json({ names });

  } catch (err) {
    console.error('❌ Scraping failed:', err.message);
    res.status(500).json({ error: 'Scraping failed', message: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// ✅ Port from env or fallback
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Puppeteer API running on port ${PORT}`));
