#!/usr/bin/env node
// HTTP smoke test for the published DIGRIX site. Uses the actual network, not git files.
// STRICT_LIVE=true: fail on unreachable/stale URLs (main deployment).
const base='https://digrix.tech';
const strict=process.env.STRICT_LIVE==='true';
const targets=[
  ['/', 'DIGRIX — разработка сайтов'],
  ['/chatbots.html', 'Разработка Telegram-ботов'],
  ['/websites.html', 'Разработка сайтов под ключ'],
  ['/online-stores.html', 'Разработка интернет-магазинов'],
  ['/crm-integration.html', 'Интеграция CRM'],
  ['/sitemap.xml', 'https://digrix.tech/crm-integration.html'],
  ['/robots.txt', 'Sitemap: https://digrix.tech/sitemap.xml']
];
const timeoutMs=12000;
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function inspect(path,expected) {
  const url=base+path;
  try {
    const response=await fetch(url,{
      redirect:'follow',
      signal:AbortSignal.timeout(timeoutMs),
      headers:{'User-Agent':'DIGRIX-SEO-Monitor/1.0 (GitHub Actions; deployment smoke test)', 'Accept':'text/html,application/xml,text/plain;q=0.9'}
    });
    const html=await response.text();
    const contentType=response.headers.get('content-type')||'';
    const ok=response.status===200 && html.includes(expected) && response.url.startsWith(base+'/');
    console.log((ok?'PASS ':'FAIL ')+path+' status='+response.status+' bytes='+Buffer.byteLength(html)+' type='+contentType+' final='+response.url+' content='+Boolean(html.includes(expected)));
    return ok;
  }catch(error){
    console.log('FAIL '+path+' error='+error.name+': '+error.message);
    return false;
  }
}
const attempts=strict?6:1;
let passed=false;
for(let i=1;i<=attempts;i++) {
  console.log('Live check attempt '+i+'/'+attempts+' [strict='+strict+']');
  const result=await Promise.all(targets.map(([url,t])=>inspect(url,t)));
  passed=result.every(Boolean);
  if(passed)break;
  if(i<attempts)await delay(18000);
}
if(passed){console.log('Published site: 7/7 URLs verified live.');}
else if(strict){console.error('Published site is missing a page or still serves an old version. Check Settings → Pages / Actions / DNS.');process.exitCode=1;}
else{console.warn('INFO: Public deployment is not fully verified yet; this non-strict baseline does not block the branch.');}
