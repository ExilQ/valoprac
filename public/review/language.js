import { createLanguage, hasKorean, mountLanguageSelect, preferredLanguage } from '../language/preference.js';

const catalog = '/language/review.en.json';
const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// Translate literal templates before interpolating any record data or form values.
export function translateTemplate(fragment, text) {
  if (!hasKorean.test(fragment)) return fragment;
  if (!/<\/?[a-z]|">/.test(fragment)) return text(fragment);
  return fragment.split(/(<[^>]*>)/).map(part => {
    if (part.startsWith('<') && part.endsWith('>')) {
      return part.replace(/\b(aria-label|placeholder|title)="([^"]*)"/g,
        (_, name, value) => name + '="' + escapeAttribute(text(value)) + '"');
    }
    // The text of a composed accessible label can end in the opening tag's quote.
    const tail = part.indexOf('">');
    if (tail !== -1) return escapeAttribute(text(part.slice(0, tail))) + '">' + text(part.slice(tail + 2));
    return text(part);
  }).join('');
}

export function createReviewLanguage(onChange) {
  const originals = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (hasKorean.test(node.data)) originals.push([node, node.data]);
  }
  const attrs = [...document.querySelectorAll('[aria-label]')]
    .filter(node => hasKorean.test(node.getAttribute('aria-label')))
    .map(node => [node, node.getAttribute('aria-label')]);
  const title = document.title;
  const description = document.querySelector('meta[name="description"]');
  const originalDescription = description?.content;
  const locale = createLanguage({
    catalog,
    onChange() {
      for (const [node, value] of originals) node.data = locale.text(value);
      for (const [node, value] of attrs) node.setAttribute('aria-label', locale.text(value));
      document.title = locale.text(title);
      if (description) description.content = locale.text(originalDescription);
      sync();
      onChange();
    }
  });
  const sync = mountLanguageSelect(document.querySelector('.top-actions'), locale);
  return {
    text: locale.text,
    get active() { return locale.language; },
    template: value => translateTemplate(value, locale.text),
    initial: async () => {
      if (preferredLanguage() === 'en') await locale.select('en', false).catch(() => {});
    }
  };
}
