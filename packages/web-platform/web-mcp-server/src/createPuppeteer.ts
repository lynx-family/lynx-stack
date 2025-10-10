import puppeteer, { type Browser, type Page } from 'puppeteer';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browser) {
    return browser;
  }
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    return browser;
  } catch (error) {
    console.error('Failed to launch Puppeteer browser:', error);
    throw error; // Re-throw the error to be caught by the caller
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export async function createPuppeteerPage(url: string): Promise<Page> {
  const currentBrowser = await getBrowser();
  const page = await currentBrowser.newPage();
  try {
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000, // 30 seconds
    });
  } catch (error: Error | any) {
    await page.close();
    throw new Error(`Failed to navigate to ${url}: ${error.message}`);
  }
  // Wait for the lynx-view element to be present
  try {
    await page.waitForSelector(`lynx-view >>> [lynx-tag="page"]`, {
      timeout: 10000, // 10 seconds
    });
  } catch (error: Error | any) {
    await page.close();
    throw new Error(`Lynx page element not found at ${url}: ${error.message}`);
  }
  return page;
}
