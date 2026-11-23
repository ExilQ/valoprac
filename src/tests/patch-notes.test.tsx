import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PatchNotes} from '../ui/PatchNotes';
import {entries,filterPatchEntries} from '../ui/patchNotesData';

describe('Readable, searchable patch history',()=>{
 it('retains production and prototype records while searching versions, titles and changes',()=>{
  const production=filterPatchEntries('production'),prototype=filterPatchEntries('prototype');
  expect(production.length+prototype.length).toBe(entries.length);
  expect(production.every(entry=>!entry.scope.startsWith('별도'))).toBe(true);
  expect(prototype.every(entry=>entry.scope.startsWith('별도 시제품 기록'))).toBe(true);
  expect(filterPatchEntries('all',` ${entries[0].version} `)).toContain(entries[0]);
  expect(filterPatchEntries('all','12.01').some(entry=>entry.version==='12.01')).toBe(true);
  const word='발소리';expect(filterPatchEntries('all',word).length).toBeGreaterThan(1);
  expect(filterPatchEntries('production',word).every(entry=>production.includes(entry))).toBe(true);
  expect(filterPatchEntries('all','no-such-update-123456789')).toEqual([]);
 });
 it('provides a labeled native dialog, search, filter states and initially expanded latest release without losing history',()=>{
  const html=renderToStaticMarkup(<PatchNotes/>);
  expect(html).toContain('aria-haspopup="dialog"');expect(html).toContain('aria-label="패치노트 닫기"');
  expect(html).toContain('패치노트 검색');expect(html).toContain('type="search"');expect(html).toContain('aria-pressed="true"');
  expect(html.match(/<details[^>]* open=""/g)).toHaveLength(1);
  expect(html).toContain('최신 업데이트');expect(html).toContain('별도 시제품 기록');expect(html).toContain('2.2.0');
  for(const entry of entries){expect(html.toLowerCase()).toContain(`datetime="${entry.date}"`);expect(html).toContain(entry.version);}
  const titleId=html.match(/aria-labelledby="([^"]+)"/)![1];expect(html).toContain(`<h2 id="${titleId}">패치노트</h2>`);
 });
});
