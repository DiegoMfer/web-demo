// The Generate tab: synthetic data from a SHACL, ShEx or PGSchema schema,
// validated with it right away, and opened in the tabs of the validators.

import { test, expect, open, editor } from "./fixtures.js";

const verdict = (page) => page.locator("#gen-result .verdict");

async function generate(page, { example = "references", language = "turtle", scenario = "valid" } = {}) {
  await page.locator("#gen-example").selectOption(example);
  await page.locator("#gen-language").selectOption(language);
  await page.locator("#gen-scenario").selectOption(scenario);
  await expect(editor(page, "gen-schema")).not.toHaveText("");
  await page.locator("#gen-validate").click();
  await expect(page.locator("#gen-result")).not.toHaveAttribute("data-kind", "running");
}

test("loads an example and its configuration", async ({ page }) => {
  await open(page, "#generate/gen");
  await expect(page.locator("#gen-example")).toHaveValue("references");
  await expect(editor(page, "gen-schema")).toContainText("sh:NodeShape");
  await expect(editor(page, "gen-config")).toContainText("version = 2");
  await page.locator("#gen-language").selectOption("pgschema");
  await expect(editor(page, "gen-schema")).toContainText("CREATE NODE TYPE");
});

for (const [language, validator] of [["turtle", "SHACL"], ["shexc", "ShEx"], ["pgschema", "PGSchema"]]) {
  test(`valid data from ${validator} conforms to it`, async ({ page }) => {
    await open(page, "#generate/gen");
    await generate(page, { language });
    await expect(page.locator("#gen-result")).toHaveAttribute("data-kind", "ok");
    await expect(verdict(page)).toContainText(`valid, every`);
  });

  test(`data with errors from ${validator} fails exactly where the report says`, async ({ page }) => {
    await open(page, "#generate/gen");
    await generate(page, { language, scenario: "errors" });
    await expect(editor(page, "gen-config")).toContainText("[violations]");
    await expect(page.locator("#gen-result")).toHaveAttribute("data-kind", "ok");
    await expect(verdict(page)).toContainText(`${validator} rejects exactly the`);
  });
}

test("shows the property graph, the report and the validation", async ({ page }) => {
  await open(page, "#generate/gen");
  await generate(page, { scenario: "errors" });
  await page.locator("#gen-result-format").selectOption("yarspg");
  await expect(page.locator('.cm-viewer[data-viewer-for="gen-output"]')).toHaveAttribute("data-format", "yarspg");
  await page.locator("#gen-result-format").selectOption("report");
  await expect(page.locator("#gen-result .table-output table")).toBeVisible();
  await expect(page.locator("#gen-result .table-output")).toContainText("direct");
  await page.locator("#gen-result-format").selectOption("validation");
  await expect(page.locator("#gen-result .table-output")).toContainText("fails");
});

for (const [target, validator] of [["shacl", "SHACL"], ["shex", "ShEx"], ["pgschema", "PGSchema"]]) {
  test(`opens the data in ${validator}, where it validates`, async ({ page }) => {
    await open(page, "#generate/gen");
    await generate(page, { language: "shexc" });
    await page.locator(`#gen-to-${target}`).click();
    await expect(page.locator(`#panel-${target}`)).toBeVisible();
    await page.locator(`#${target}-validate`).click();
    await expect(page.locator(`#${target}-result`)).toHaveAttribute("data-kind", "ok");
  });
}

test("a custom schema without a property graph can't be opened in PGSchema", async ({ page }) => {
  await open(page, "#generate/gen");
  await page.locator("#gen-example").selectOption("custom");
  await generate(page, { example: "custom", language: "shexc" });
  await expect(page.locator("#gen-result")).toHaveAttribute("data-kind", "ok");
  await expect(page.locator("#gen-to-shex")).toBeEnabled();
  await expect(page.locator("#gen-to-pgschema")).toBeDisabled();
});

test("a permalink keeps the example and the kind of data", async ({ page }) => {
  await open(page, "#generate/gen");
  // Written after each run, as in the other tabs
  await generate(page, { example: "keys", scenario: "errors" });
  const url = page.url();
  expect(url).toContain("gen-example=keys");
  await page.goto("about:blank");
  await page.goto(url);
  await expect(page.locator("#status")).toHaveClass(/ready/, { timeout: 30_000 });
  await expect(page.locator("#gen-example")).toHaveValue("keys");
  await expect(editor(page, "gen-config")).toContainText("[violations]");
  await expect(editor(page, "gen-schema")).toContainText("sh:NodeShape");
});
