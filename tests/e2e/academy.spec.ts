import fs from "node:fs";
import { test, expect } from "@playwright/test";
test("course exercise error, retry and language-independent deep link", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("arabic-academy:language:./", "en"));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/lesson/A0-L0-01");
  await expect(
    page.getByRole("heading", {
      name: "Il sistema di scrittura e la famiglia del «dente»",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /02 Allenati/ }).click();
  await page.locator(".choice-options button").first().click();
  await expect(page.locator(".feedback")).toBeVisible();
  await page.getByRole("button", { name: "Riprova", exact: true }).click();
  await page.locator(".choice-options button").nth(1).click();
  await expect(page.locator(".feedback")).toHaveClass(/success/);
  await expect(page.getByRole("button", { name: "EN English" })).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
  await expect(page).toHaveURL(/lesson\/A0-L0-01/);
  await page.reload();
  await expect(page.locator(".native-course")).toBeVisible();
  expect(errors).toEqual([]);
});
test("v1 backup preview, atomic merge, v2 export and preserved unknown record", async ({
  page,
}) => {
  await page.goto("/#/settings");
  await page.locator("input[type=file]").setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "arabic-academy",
        version: 1,
        data: {
          goal: 20,
          "note:test": "preserved",
          "legacy:compatible": { x: 1 },
        },
      }),
    ),
  });
  await expect(
    page.getByRole("heading", { name: "Anteprima importazione" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Conferma importazione" }).click();
  await expect(
    page.getByText("Importazione completata e salvata."),
  ).toBeVisible();
  await expect(
    page.getByLabel("Minuti al giorno", { exact: true }),
  ).toHaveValue("20");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta backup JSON" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(c);
  const backup = JSON.parse(Buffer.concat(chunks).toString());
  expect(backup.version).toBe(2);
  expect(backup.data["legacy:compatible"]).toEqual({ x: 1 });
  await page.reload();
  await expect(
    page.getByLabel("Minuti al giorno", { exact: true }),
  ).toHaveValue("20");
});
for (const width of [320, 375, 390, 768, 1024, 1440])
  test(`responsive navigation and alphabet at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/");
    await expect(
      page.getByRole("heading", { name: "Il tuo corso di arabo." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width === 1440) {
      fs.mkdirSync("reports/screenshots", { recursive: true });
      await page.screenshot({
        path: "reports/screenshots/dashboard-desktop.png",
      });
    }
    await page.goto("/#/alphabet");
    await expect(
      page.getByRole("heading", { name: "28 lettere. Un nuovo mondo." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width === 390) {
      fs.mkdirSync("reports/screenshots", { recursive: true });
      await page.screenshot({
        path: "reports/screenshots/alphabet-mobile.png",
      });
    }
    if (width < 761) {
      await page
        .locator(".mobile-nav")
        .getByRole("button", { name: /Altro/ })
        .click();
      await expect(
        page
          .locator("#mobile-overflow")
          .getByRole("button", { name: "Impostazioni" }),
      ).toBeVisible();
    }
  });
test("keyboard modal dismissal restores focus", async ({ page }) => {
  await page.goto("/#/review");
  await page
    .getByRole("button", { name: "Nuova flashcard", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nuova flashcard", exact: true }),
  ).toBeFocused();
});
test("unavailable content has retry navigation", async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  await page.route("**/course/A0-L0-01.json", (r) => r.abort());
  await page.goto(
    (process.env.TEST_BASE_URL || "http://127.0.0.1:4174") +
      "/#/lesson/A0-L0-01",
  );
  await expect(
    page.getByRole("heading", { name: "Impossibile caricare la lezione" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Torna al percorso", exact: true }),
  ).toBeVisible();
  await context.close();
});
test("restricted storage does not pretend to save progress", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      value: {
        open() {
          throw new DOMException("Storage blocked", "SecurityError");
        },
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Storage blocked");
  await expect(
    page.getByRole("alert"),
  ).toBeVisible();
});
test("mistake review persists correction and schedules tomorrow", async ({
  page,
}) => {
  await page.goto("/#/lesson/A0-L0-01");
  await page.getByRole("button", { name: /02 Allenati/ }).click();
  await page.locator(".choice-options button").first().click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Ripasso errori", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: /Ripassa.*error|Riprendi.*error|Ripassa ora/i,
    })
    .click();
  await page.locator(".choice-options button").nth(1).click();
  await page.getByRole("button", { name: "Continua →", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Un altro passo avanti." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Torna al corso" }).click();
  await page.goto("/#/settings");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta backup JSON" }).click();
  const stream = await (await dl).createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(c);
  const data = JSON.parse(Buffer.concat(chunks).toString()).data;
  const key = "answer:native:A0-L0-01:starter:1";
  expect(data[key].rating).toBe("good");
  expect(data[key].attempts).toBe(2);
  expect(data[key].history).toHaveLength(2);
  expect(data["review:" + key].interval).toBe(1);
});

test("offline shell and cached lesson survive reload", async ({
  page,
  context,
}) => {
  await page.goto("/#/lesson/A0-L0-01");
  await expect(page.locator(".native-course")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await page.reload();
  await expect(page.locator(".native-course")).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".native-course")).toBeVisible();
  await expect(page.getByText(/Sei offline/)).toBeVisible();
});
test("first-load JavaScript budget and selected language only", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Il tuo corso di arabo." }),
  ).toBeVisible();
  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((e) => ({
      name: e.name,
      size: (e as PerformanceResourceTiming).decodedBodySize,
    })),
  );
  expect(resources.some((r) => r.name.includes("course.en-"))).toBe(false);
  const js = resources.filter(
    (r) => r.name.includes("/assets/") && r.name.endsWith(".js"),
  );
  expect(js.reduce((n, r) => n + r.size, 0)).toBeLessThan(800000);
});
test("quota failures remain visible and pending data is exportable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (this.name === "records")
        throw new DOMException("Storage full", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await page.goto("/#/settings");
  await page.getByLabel("Minuti al giorno", { exact: true }).selectOption("30");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Esporta backup JSON" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Riprova il salvataggio" }),
  ).toBeVisible();
});
test("committed settings propagate across tabs", async ({ page, context }) => {
  await page.goto("/#/settings");
  const other = await context.newPage();
  await other.goto("/#/settings");
  await expect(
    other.getByLabel("Minuti al giorno", { exact: true }),
  ).toHaveValue("15");
  await page.getByLabel("Minuti al giorno", { exact: true }).selectOption("45");
  await expect(
    other.getByLabel("Minuti al giorno", { exact: true }),
  ).toHaveValue("45");
});
test("daily goal controls session and a short block extends without resetting timer", async ({
  page,
}) => {
  await page.goto("/#/settings");
  await page.getByLabel("Minuti al giorno", { exact: true }).selectOption("20");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Corso", exact: true })
    .click();
  await page.getByRole("button", { name: /Studia 20 minuti/ }).click();
  await expect(page.locator(".session-clock")).toContainText("/ 20:00");
  await page
    .getByRole("button", { name: "Ho letto, passiamo alla pratica →" })
    .click();
  for (const option of [1, 1, 2]) {
    await page.locator(".choice-options button").nth(option).click();
    await page.getByRole("button", { name: "Continua →", exact: true }).click();
  }
  await expect(page.locator(".session-reading")).toBeVisible();
  await expect(page.locator(".session-clock")).toContainText("/ 20:00");
  await expect(
    page.getByRole("heading", { name: "Un altro passo avanti." }),
  ).not.toBeVisible();
});
test("local recorder handles stop, delete and navigation without double-stop errors (mock media)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
      },
    });
    class Recorder {
      state = "inactive";
      mimeType = "audio/webm";
      onstop: (() => void) | null = null;
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        if (this.state !== "recording") throw Error("Double stop");
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["test"], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { value: Recorder });
  });
  await page.goto("/#/lesson/A0-L0-01");
  await page
    .getByText("Pratica orale · confronto personale", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Attiva microfono e registra" })
    .click();
  await expect(
    page.getByRole("button", { name: "Ferma registrazione" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ferma registrazione" }).click();
  await expect(page.locator("audio")).toBeVisible();
  await page.getByRole("button", { name: "Elimina registrazione" }).click();
  await expect(page.locator("audio")).not.toBeVisible();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Corso", exact: true })
    .click();
  expect(errors).toEqual([]);
});

test("Italian course hub connects resume, exercises and corrections", async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('progressbar', {name:'Lezioni principali completate'})).toHaveAttribute('value','0');
  await page.getByRole('button',{name:'Riprendi il corso →',exact:true}).click();
  await expect(page.locator('.native-course')).toBeVisible();
  await page.locator('.sidebar').getByRole('button',{name:'Corso',exact:true}).click();
  await page.locator('.course-actions').getByRole('button',{name:/METTI IN PRATICA/}).click();
  await expect(page).toHaveURL(/practice/);
  await page.locator('.sidebar').getByRole('button',{name:'Ripasso errori'}).click();
  await expect(page).toHaveURL(/review/);
  expect(fs.existsSync('dist/course/en')).toBe(false);
  expect(fs.existsSync('dist/study/en')).toBe(false);
  expect(fs.readdirSync('dist/assets').some(n=>n.startsWith('course.en-'))).toBe(false);
});

test('volume library and sidebar study shortcuts', async ({page})=>{
 await page.goto('/#/library');
 await expect(page.locator('.volume-shelf .book-card')).toHaveCount(5);
 await page.locator('.volume-shelf .book-card').first().click();
 await expect(page.getByRole('region',{name:'Indice del volume A0'})).toBeVisible();
 await page.locator('.volume-index .volume-entry').first().click();
 await expect(page.locator('.native-course')).toBeVisible();
 await page.locator('.sidebar').getByRole('button',{name:'Flashcard',exact:true}).click();
 await expect(page).toHaveURL(/flashcards/);
 await expect(page.getByRole('heading',{name:'Le tue flashcard.',exact:true})).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:'Le tue flashcard.',exact:true})).toBeVisible();
 await page.goto('/#/library');
 await expect(page.locator('.volume-shelf')).toBeVisible();
 await page.screenshot({path:'reports/screenshots/library-desktop.png',fullPage:true});
 await page.setViewportSize({width:320,height:740});
 await expect(page.locator('.volume-shelf .book-card')).toHaveCount(5);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:/Altro/}).click();
 await page.locator('#mobile-overflow').getByRole('button',{name:'Flashcard',exact:true}).click();
 await expect(page).toHaveURL(/flashcards/);
});

test('slow section loading keeps navigation visible',async({page})=>{
 let release!:()=>void;
 const gate=new Promise<void>(resolve=>release=resolve);
 await page.route('**/assets/book-library-*.js',async route=>{await gate;await route.continue()});
 await page.goto('/');
 await page.locator('.sidebar').getByRole('button',{name:'Biblioteca',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Prepariamo questa sezione…'})).toBeVisible();
 await expect(page.locator('.sidebar')).toBeVisible();
 await expect(page.locator('.topbar')).toHaveCount(0);
 release();
 await expect(page.locator('.volume-shelf')).toBeVisible();
});

test('appearance settings persist and obsolete navigation is removed',async({page})=>{
 await page.goto('/#/settings');
 await page.getByLabel('Tema del sito').selectOption('dark');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByLabel('Dimensione del testo delle lezioni').selectOption('20');
 await page.waitForTimeout(1000);
 await page.reload();
 await expect(page.getByLabel('Tema del sito')).toHaveValue('dark');
 await expect(page.getByLabel('Dimensione del testo delle lezioni')).toHaveValue('20');
 await expect(page.locator('.topbar,.course-navigation')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Microlezioni',exact:true})).toHaveCount(0);
 await expect(page.locator('footer')).toContainText('Gabriele Vierti');
 await page.screenshot({path:'reports/screenshots/settings-dark.png',fullPage:true});
 await page.getByLabel('Tema del sito').selectOption('light');
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
