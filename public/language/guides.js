import { createLanguage, hasKorean, mountLanguageSelect, preferredLanguage } from './preference.js';

const original = [];
const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT, {
  acceptNode(node) {
    return node.parentElement?.closest('script, style') || !hasKorean.test(node.data) ?
      NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
  }
});
for (let node = walker.nextNode(); node; node = walker.nextNode()) {
  original.push([node.data, value => { node.data = value; }]);
}
for (const attribute of ['aria-label', 'title', 'alt', 'placeholder', 'content']) {
  for (const element of document.querySelectorAll('[' + attribute + ']')) {
    const value = element.getAttribute(attribute);
    if (hasKorean.test(value)) original.push([value, text => element.setAttribute(attribute, text)]);
  }
}
const container = document.createElement('div');
container.className = 'guide-language';
(document.querySelector('body > header') ?? document.body).prepend(container);
const locale = createLanguage({
  catalog: '/language/guides.en.json',
  onChange() {
    sync();
    for (const [key, write] of original) write(locale.text(key));
  }
});
const sync = mountLanguageSelect(container, locale);
if (preferredLanguage() === 'en') locale.select('en', false).catch(() => {});
