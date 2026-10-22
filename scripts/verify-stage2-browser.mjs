// Isolated production-assets UI check using Chrome's generated microphone.
// API responses are fixtures; use verify-stage2-storage.mjs for the real backend.
// Requires a completed npm run build and local Chrome. Does not sign in or deploy.
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { spawn } from "node:child_process";

const chrome = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const output = resolve(".next/stage2-browser");
await mkdir(output, { recursive: true });
const rate = 48000;
const wav = Buffer.alloc(44 + rate * 16 * 2);
wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(wav.length - 44, 40);
for (let i = 0; i < rate * 16; i++) {
  const t = i / rate, beat = t % 0.5;
  const value = 0.07 * (Math.sin(2 * Math.PI * 261.6256 * t) + Math.sin(2 * Math.PI * 329.6276 * t) + Math.sin(2 * Math.PI * 391.9954 * t)) + (beat < 0.03 ? 0.25 * Math.exp(-beat * 100) * Math.sin(2 * Math.PI * 1500 * t) : 0);
  wav.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
}
await writeFile(resolve(output, "fixture.wav"), wav);
const probe = `<script>
window.fixtureCalls=[];window.cancelledNavigation=0;
window.confirm=()=>{window.cancelledNavigation++;return false;};
const actualFetch=window.fetch;
window.fetch=async (url,options)=>{
if(url==='/api/takes'){
 const body=JSON.parse(options.body);fixtureCalls.push(body);
 if(fixtureCalls.length===1){await new Promise(r=>setTimeout(r,500));return new Response(JSON.stringify({error:'Fixture network interruption. Retry saving.'}),{status:503});}
 return new Response(JSON.stringify({saved:true,id:body.take.id,title:'Saved fixture take',playbackUrl:'/fixture.wav'}),{status:200});
}return actualFetch(url,options);};
addEventListener('load',async()=>{
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
const wait=async(fn,label)=>{for(let i=0;i<200;i++){if(fn())return;await sleep(200);}throw Error('Timeout '+label+': '+document.body.innerText.slice(-1200));};
const setValue=(element,value)=>{Object.getOwnPropertyDescriptor(element instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLSelectElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));};
const field=label=>document.querySelector('[aria-label="'+label+'"]');
try{
 await sleep(1800);button('Record vocal').click();await wait(()=>button('Stop recording'),'record');await sleep(12000);button('Stop recording').click();await wait(()=>document.body.innerText.includes('Analysis ready'),'analysis');
 if(field('Take musical key').options.length!==25)throw Error('Missing keys');
 const detected={bpm:field('Take tempo BPM').value,key:field('Take musical key').value};
 document.querySelector('a[href="/library"]').click();await sleep(100);
 if(!window.cancelledNavigation||!field('Take tempo BPM'))throw Error('Unsaved navigation warning failed');
 setValue(field('Take tempo BPM'),'97');setValue(field('Take musical key'),'E minor');setValue(field('Take energy'),'low');await sleep(150);
 button('Keep & save take').click();await sleep(150);if(!button('Retake').disabled)throw Error('Retake allowed during saving');await wait(()=>button('Retry saving take'),'retry state');button('Retry saving take').click();await wait(()=>document.body.innerText.includes('Take saved ✓'),'saved');
 if(fixtureCalls.length!==2||fixtureCalls[0].take.id!==fixtureCalls[1].take.id)throw Error('Save retry ID mismatch');
 const saved=fixtureCalls[1].take.settings;
 if(saved.bpm!==97||saved.musicalKey!=='E minor'||saved.energy!=='low'||Object.values(saved.sources).some(x=>x!=='user'))throw Error('Editable settings mismatch');
 const savedPlayback=!!document.querySelector('audio');
 button('Retake').click();
 [...document.querySelectorAll('label')].find(l=>l.textContent.includes('Metronome click')).querySelector('input').click();
 [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Count-in & Record')).click();await wait(()=>button('Stop recording'),'count-in');await sleep(3000);button('Stop recording').click();await wait(()=>document.body.innerText.includes('Analysis ready'),'known tempo analysis');
 if(field('Take tempo BPM').value!=='90'||!document.body.innerText.includes('Known · metronome'))throw Error('Known tempo was replaced');
 await fetch('/result',{method:'POST',body:JSON.stringify({passed:true,detected,editableSettings:saved,retryStableId:true,unsavedWarning:true,knownBpm:90,savedPlayback,uiFixture:true})});
}catch(e){await fetch('/result',{method:'POST',body:JSON.stringify({passed:false,error:String(e)})});}
});</script>`;
const html = (await readFile(".next/server/app/muziqobbiz.html", "utf8")).replace("<head>", "<head>" + probe);
let finish;
const completion = new Promise((r) => { finish = r; });
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (path === "/result") { let data = ""; for await (const part of req) data += part; res.end("ok"); finish(JSON.parse(data)); return; }
    if (path === "/muziqobbiz") { res.setHeader("Content-Type", "text/html"); res.end(html); return; }
    if (path === "/fixture.wav") { res.setHeader("Content-Type", "audio/wav"); res.end(wav); return; }
    const base = path.startsWith("/_next/static/") ? resolve(".next/static") : resolve("public");
    const relative = path.startsWith("/_next/static/") ? path.slice(14) : path.slice(1);
    const file = resolve(base, relative);
    if (!file.startsWith(base + sep)) throw new Error("Invalid asset path");
    res.setHeader("Content-Type", file.endsWith(".css") ? "text/css" : "text/javascript");
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => server.listen(4320, "127.0.0.1", r));
const browser = spawn(chrome, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=4321", "--user-data-dir=" + resolve(output, "profile"), "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-audio-capture=" + resolve(output, "fixture.wav"), "--autoplay-policy=no-user-gesture-required", "--window-size=430,1000", "http://127.0.0.1:4320/muziqobbiz"], { windowsHide: true, stdio: "ignore" });
browser.on("error", (error) => finish({ passed: false, error: String(error) }));
const timeout = setTimeout(() => finish({ passed: false, error: "Browser timed out" }), 100000);
try { console.log(JSON.stringify(await completion)); }
finally {
  clearTimeout(timeout);
  try {
    const info = await (await fetch("http://127.0.0.1:4321/json/version")).json();
    const socket = new WebSocket(info.webSocketDebuggerUrl);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id: 1, method: "Browser.close" })));
    await new Promise((r) => socket.addEventListener("close", r, { once: true }));
  } catch { browser.kill(); }
  server.close();
}
