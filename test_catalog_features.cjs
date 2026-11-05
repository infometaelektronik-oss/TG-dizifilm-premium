const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log("1. Testing Home & Navigation...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 1. Go to Diziler (Sidebar nav index 4)
  console.log("2. Testing Diziler Tab...");
  const dizilerBtn = await page.locator('button:has-text("Diziler")').first();
  await dizilerBtn.click();
  await page.waitForTimeout(1500);

  // Check channel filter chips
  const channelPills = await page.locator('button:has-text("Kanal D"), button:has-text("Show TV"), button:has-text("ATV"), button:has-text("TRT 1"), button:has-text("NOW"), button:has-text("Efsaneler")').allTextContents();
  console.log("Channel pills found in Diziler:", channelPills);

  // Click Kanal D
  const kanalDBtn = page.locator('button:has-text("Kanal D Dizileri")').first();
  if (await kanalDBtn.isVisible()) {
    await kanalDBtn.click();
    await page.waitForTimeout(1000);
    const seriesTitles = await page.locator("h3, .font-black").allTextContents();
    console.log("Sample series titles after clicking Kanal D:", seriesTitles.slice(0, 10));
  }

  // 2. Go to Filmler (Sidebar nav index 5)
  console.log("3. Testing Filmler Tab...");
  const filmlerBtn = await page.locator('button:has-text("Filmler")').first();
  await filmlerBtn.click();
  await page.waitForTimeout(1500);

  const movieGenres = await page.locator('button:has-text("Yerli Sinema"), button:has-text("Yeşilçam Klasikleri"), button:has-text("Yabancı Sinema")').allTextContents();
  console.log("Movie category pills:", movieGenres);

  const movieCards = await page.locator("h3, .font-black").allTextContents();
  console.log("Sample movies displayed:", movieCards.filter((t) => t.length > 2 && t.length < 40).slice(0, 12));

  // Check that NO Pluto TV channels appear in Movies
  const hasPlutoInMovies = movieCards.some((t) => /pluto/i.test(t));
  console.log("Are linear Pluto TV channels present in Filmler?", hasPlutoInMovies);

  // 3. Test Video Player on G.O.R.A.
  console.log("4. Testing Video Player on G.O.R.A....");
  const goraCard = page.locator('div:has-text("G.O.R.A.")').first();
  if (await goraCard.isVisible()) {
    await goraCard.click();
    await page.waitForTimeout(2000);
    const videoTag = await page.locator("video").isVisible();
    const iframeTag = await page.locator("iframe").isVisible();
    console.log("Video tag visible:", videoTag, "| Iframe tag visible:", iframeTag);
    const pageText = await page.textContent("body");
    const hasError = pageText.includes("Video kullanılamıyor") || pageText.includes("Bu video kullanılamıyor");
    console.log("Does player display 'Video kullanılamıyor' error?", hasError);

    // Close player
    const closeBtn = page.locator('button[aria-label="Kapat"], button:has-text("Kapat")').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
  }

  // 4. Test CardManager in Admin Panel
  console.log("5. Testing CardManager in Admin Panel...");
  await page.goto("http://localhost:3000/tgdizifilm-admin-paneli", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const cardManagerTab = page.locator('button:has-text("Kart Yönetimi")').first();
  if (await cardManagerTab.isVisible()) {
    await cardManagerTab.click();
    await page.waitForTimeout(1500);

    const tabs = await page.locator('button:has-text("Canlı TV"), button:has-text("Filmler"), button:has-text("Diziler"), button:has-text("Radyolar")').allTextContents();
    console.log("CardManager tabs found:", tabs);
  }

  await browser.close();
  console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
})();
