import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {PatchNotes} from '../ui/PatchNotes';
import {entries,filterPatchEntries} from '../ui/patchNotesData';
import englishPatches from '../i18n/patches.en.json';

describe('Readable, searchable patch history',()=>{
 it('starts small patch numbering at .01 after each large patch and searches old versions and descriptions',()=>{
  const major=filterPatchEntries('major'),minor=filterPatchEntries('minor');
  expect(major.length+minor.length).toBe(entries.length);
  let majorNumber=0,minorNumber=0;
  for(const entry of [...entries].reverse()){
   if(major.includes(entry)){
    majorNumber++;
    minorNumber=0;
   }else{
    minorNumber++;
   }
   expect(majorNumber).toBeGreaterThan(0);
   expect(entry.version).toBe(`${majorNumber}.${String(minorNumber).padStart(2,'0')}`);
  }
  expect(filterPatchEntries('all',` ${entries[0].version} `)).toEqual([entries[0]]);
  expect(filterPatchEntries('all','1.00').map(entry=>entry.version)).toEqual(['1.00']);
  expect(filterPatchEntries('minor','00.01').map(entry=>entry.version)).toEqual(['1.01']);
  expect(filterPatchEntries('minor','06.01').map(entry=>entry.version)).toEqual(['6.01']);
  expect(filterPatchEntries('minor','12.01').map(entry=>entry.version)).toEqual(['12.01']);
  expect(filterPatchEntries('all','2.3.0').map(entry=>entry.version)).toEqual(['2.00']);
  const word='발소리';expect(filterPatchEntries('all',word).length).toBeGreaterThan(1);
  expect(filterPatchEntries('major',word).every(entry=>major.includes(entry))).toBe(true);
  expect(filterPatchEntries('minor','쌓아 둔 기록').map(entry=>entry.version)).toEqual(['12.14']);
  expect(filterPatchEntries('all','no-such-update-123456789')).toEqual([]);
 });
 it('provides searchable English text for every patch and preserves version aliases',()=>{
  expect(Object.keys(englishPatches)).toHaveLength(entries.length);
  const english=entries.map(entry=>{
   const copy=englishPatches[entry.version as keyof typeof englishPatches];
   expect(copy?.title).toBeTruthy();
   expect(copy?.description).toBeTruthy();
   expect(copy?.changes.length).toBe(entry.changes.length);
   expect(JSON.stringify(copy)).not.toMatch(/[가-힣]/);
   return {...entry,...copy};
  });
  expect(filterPatchEntries('all','review lab',english).map(entry=>entry.version)).toContain('12.14');
  expect(filterPatchEntries('minor','06.01',english).map(entry=>entry.version)).toEqual(['6.01']);
 });
 it('provides a labeled native dialog, search, filter states and initially expanded latest release without losing history',()=>{
  const html=renderToStaticMarkup(<PatchNotes/>);
  expect(html).toContain('aria-haspopup="dialog"');expect(html).toContain('aria-label="패치노트 닫기"');
  expect(html).toContain('패치노트 검색');expect(html).toContain('type="search"');expect(html).toContain('aria-pressed="true"');
  expect(html.match(/<details[^>]* open=""/g)).toHaveLength(1);
  expect(html).toContain('최신 업데이트');expect(html).toContain('큰 패치');expect(html).toContain('작은 패치');
  expect(html).not.toMatch(/운영 업데이트|시제품 기록|open\s*vaim/i);
  for(const entry of entries){expect(html.toLowerCase()).toContain(`datetime="${entry.date}"`);expect(html).toContain(entry.version);expect(html).toContain(entry.description);}
  const titleId=html.match(/aria-labelledby="([^"]+)"/)![1];expect(html).toContain(`<h2 id="${titleId}">패치노트</h2>`);
 });
});
