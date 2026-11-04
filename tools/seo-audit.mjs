#!/usr/bin/env node
// Static SEO and local-link checks for the DIGRIX GitHub Pages repository.
// Zero dependencies; run: node tools/seo-audit.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const domain = 'https://digrix.tech';
const commercial = ['index.html','chatbots.html','websites.html','online-stores.html','crm-integration.html'];
const legal = ['privacy.html','pdn.html','cookies.html'];
const pages = [...commercial,...legal];
const errors = [];
const notices = [];
const titles = new Map();
const descriptions = new Map();

function check(ok, msg) { if (!ok) errors.push(msg); }
function read(filename) {
  const file = path.resolve(root, filename);
  check(file.startsWith(root + path.sep) || file === root, 'Unsafe path: '+filename);
  if (!fs.existsSync(file)) { errors.push('Missing: '+filename); return ''; }
  return fs.readFileSync(file,'utf8');
}
function attr(markup, name) {
  const m=markup.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')','i'));
  return m ? (m[1] ?? m[2]) : '';
}
function meta(html, name, kind='name') {
  const tags=html.match(/<meta\b[^>]*>/gi) || [];
  return tags.filter(tag => attr(tag,kind).toLowerCase()===name.toLowerCase()).map(tag=>attr(tag,'content'));
}
function localResource(url,page) {
  if (!url || url.startsWith('#') || /^(mailto:|tel:|javascript:|data:)/i.test(url)) return null;
  let absolute;
  try { absolute=new URL(url,domain+'/'+(page==='index.html'?'':page)); } catch { return null; }
  if (absolute.origin !== domain) return null;
  const pathname=decodeURIComponent(absolute.pathname);
  if (pathname.endsWith('/')) return pathname.slice(1)+'index.html';
  return pathname.slice(1);
}
for(const page of pages) {
  const html=read(page); if(!html) continue;
  const title=html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim()||'';
  check(Boolean(title),page+': missing title');
  if(titles.has(title)) errors.push('Duplicate title on '+page+' and '+titles.get(title));
  else titles.set(title,page);
  const descr=meta(html,'description');
  check(descr.length===1 && descr[0].trim().length>=60, page+': missing or short description');
  if(descr[0]) {
    if(descriptions.has(descr[0])) errors.push('Duplicate description on '+page+' and '+descriptions.get(descr[0]));
    descriptions.set(descr[0],page);
  }
  const canonical=(html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi)||[]).map(x=>attr(x,'href'));
  const expected=domain+'/'+(page==='index.html'?'':page);
  check(canonical.length===1&&canonical[0]===expected,page+': canonical wrong (expected '+expected+')');
  check((html.match(/<h1(?:\s|>)/gi)||[]).length===1,page+': expected exactly one H1');
  check(/<meta\s+name=["']viewport["']/i.test(html),page+': missing mobile viewport');
  check(!meta(html,'robots').some(v=>v.toLowerCase().includes('noindex')),page+': noindex prevents search visibility');
  const linkRe=/<(?:a|link|script|img)\b[^>]*>/gi;
  for(const tag of html.match(linkRe)||[]) {
    for(const key of tag.toLowerCase().startsWith('<a')?['href']:tag.toLowerCase().startsWith('<script')?['src']:tag.toLowerCase().startsWith('<img')?['src']:['href']) {
      const raw=attr(tag,key);
      const filepath=localResource(raw,page);
      if(filepath && !fs.existsSync(path.resolve(root,filepath))) errors.push(page+': missing referenced file '+filepath);
    }
  }
  if(commercial.includes(page)) {
    check(html.includes('tel:+79600810619')&&html.includes('mailto:ilhamzakir@mail.ru'),page+': missing direct contacts');
    check(!html.includes('<form'),page+': unwanted lead form');
  }
}
const sitemap=read('sitemap.xml');
const listed=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
check(new Set(listed).size===listed.length,'Sitemap duplicate URLs');
for(const page of pages) {
 const desired=domain+'/'+(page==='index.html'?'':page);
 check(listed.includes(desired),'Sitemap omits '+desired);
}
for(const url of listed) {
 const filename=localResource(url,'index.html');
 check(filename && fs.existsSync(path.resolve(root,filename)),'Sitemap missing file '+url);
}
check(read('robots.txt').includes('Sitemap: '+domain+'/sitemap.xml'),'robots.txt should reference sitemap.xml');
check(read('CNAME').trim()==='digrix.tech','CNAME does not match canonical host');
const home=read('index.html');
for(const page of ['chatbots.html','websites.html','online-stores.html','crm-integration.html']) {
  check(home.includes('href="/'+page+'"'),'Main page missing internal link to '+page);
}
const cssFiles=['style.css','digrix-visuals.css','service-pages.css'];
for(const name of cssFiles) { const css=read(name); if(css.length>100_000)notices.push(name+' is over 100KB (uncompressed)'); }
if(home.includes('const particlesCount = 450')) notices.push('Hero canvas uses 450 animated particles: measure real mobile performance using PageSpeed Insights.');
for(const notice of notices) console.log('NOTICE:',notice);
if(errors.length) {
  console.error('SEO audit failed:');
  for(const error of errors)console.error(' ✗',error);
  process.exitCode=1;
} else {
  console.log('SEO audit passed: '+pages.length+' pages, '+listed.length+' sitemap URLs, internal resources and canonical metadata verified.');
}
