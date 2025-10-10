import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
export async function createPuppeteerPage(url: string) {
  const page = await browser.newPage();
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
