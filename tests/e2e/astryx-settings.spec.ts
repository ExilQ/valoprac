import {test, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdirSync} from 'node:fs';

test('Astryx general settings: controls, persistence, keyboard, and CSS isolation', async ({page}) => {
  await page.goto('/settings.html');
  const pilot = page.getByTestId('astryx-settings-pilot');
  await expect(pilot).toBeVisible();
  await expect(pilot.getByRole('switch')).toHaveCount(5);

  const toggle = pilot.getByRole('switch', {name: '하단 조작 도움말 표시'});
  const wasChecked = await toggle.isChecked();
  await toggle.click();
  await expect(toggle).toHaveJSProperty('checked', !wasChecked);
  await page.reload();
  await expect(page.getByRole('switch', {name: '하단 조작 도움말 표시'})).toHaveJSProperty('checked', !wasChecked);

  const slider = page.getByRole('slider', {name: '훈련 정보 크기'});
  await expect(slider).toBeVisible();
  const before = Number(await slider.getAttribute('aria-valuenow'));
  await slider.focus();
  await slider.press(before < 1.25 ? 'ArrowRight' : 'ArrowLeft');
  await expect.poll(async () => Number(await slider.getAttribute('aria-valuenow'))).not.toBe(before);

  const sidebar = page.locator('.sidebar');
  const sidebarBackground = await sidebar.evaluate(element => getComputedStyle(element).backgroundColor);
  await page.getByRole('tab', {name: '조작'}).click();
  await expect(pilot).toHaveCount(0);
  await expect.poll(async () => sidebar.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(sidebarBackground);
  await page.getByRole('tab', {name: '일반'}).click();
  await expect(page.getByTestId('astryx-settings-pilot')).toBeVisible();

  mkdirSync('artifacts', {recursive: true});
  await page.screenshot({path: 'artifacts/astryx-settings-desktop.png', fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  await expect(page.getByTestId('astryx-settings-pilot')).toBeVisible();
  const overflow = await page.getByTestId('astryx-settings-pilot').evaluate(element => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await page.screenshot({path: 'artifacts/astryx-settings-mobile.png', fullPage: true});
});

test('Astryx general settings: WCAG automated violations', async ({page}) => {
  await page.goto('/settings.html');
  await expect(page.getByTestId('astryx-settings-pilot')).toBeVisible();
  const audit = await new AxeBuilder({page})
    .include('[data-testid="astryx-settings-pilot"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations.map(v => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map(n => ({target: n.target, summary: n.failureSummary})),
  }))).toEqual([]);
});
