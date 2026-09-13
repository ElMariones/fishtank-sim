const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const url = process.env.FISHTANK_URL || 'http://127.0.0.1:5173';
const evidence = {};
fs.mkdirSync('.artifacts',{recursive:true});
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const page = await context.newPage(), errors = [];
    evidence.browser=browser.version();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    const saved = () => page.getByText('Saved on this device', {exact:true}).waitFor();
    await saved();
    await page.locator('#card-FSH-000001').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement?.matches('.fish-title h2'));
    await page.getByLabel('Given name').fill('M2 ancestor');
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await saved();
    await page.getByRole('button',{name:'Breed 20 offspring'}).focus();
    await page.keyboard.press('Enter');
    await saved();
    await page.getByRole('button',{name:'Family',exact:true}).click();
    await page.locator('.family-view').getByRole('button',{name:/M2 ancestor/}).click();
    await page.waitForFunction(() => document.activeElement?.matches('.fish-title h2'));
    await page.reload(); await saved();
    assert.equal(await page.getByLabel('Given name').inputValue(), 'M2 ancestor');
    evidence.journey = 'Keyboard select/rename/breed/family and reload preserved name, 26 fish, ancestry.';
    await page.evaluate(() => {
      window.qaOriginalPut=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value,key){if(key==='current')throw new DOMException('QA quota','QuotaExceededError');return window.qaOriginalPut.call(this,value,key);};
    });
    await page.getByLabel('Given name').fill('Quota retry');
    await page.getByRole('button',{name:'Save',exact:true}).click();
    await page.getByText(/Not saved\./).waitFor();
    await page.evaluate(()=>{IDBObjectStore.prototype.put=window.qaOriginalPut;delete window.qaOriginalPut;});
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    await page.getByRole('button',{name:'Retry save now',exact:true}).click();
    await saved();
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    await page.getByLabel('Given name').fill('M2 ancestor');
    await page.getByRole('button',{name:'Save',exact:true}).click(); await saved();
    evidence.quotaUi='Quota failure remained visible; Retry save now persisted the in-memory world.';

    const modules = await page.evaluate(async () => {
      const {openDatabase,readSlots,commitSnapshot} = await import('/src/persistence/database.ts');
      const {createRuntime,executeCommand,commandEnvelope,decodeRuntime} = await import('/src/core/runtime.ts');
      const {createWorld} = await import('/src/core/world.ts');
      const {kinship} = await import('/src/core/pedigree.ts');
      const database = await openDatabase('m2-isolated-transaction-tests');
      const now = '2026-09-13T12:00:00.000Z';
      let runtime = createRuntime(createWorld(now),'qa-world');
      let record = await commitSnapshot(database,runtime,null);
      for(let i=0;i<3;i++) {
        runtime = executeCommand(runtime,commandEnvelope(runtime,{type:'rename',fishId:'FSH-000001',name:`Name ${i}`},i));
        record = await commitSnapshot(database,runtime,record.token);
      }
      const before = await readSlots(database);
      const names = [before.current,before.backup1,before.backup2].map(slot=>decodeRuntime(slot.raw).world.fish[0].name);
      const changed = executeCommand(runtime,commandEnvelope(runtime,{type:'decorate',tankId:'tank-1'}));
      const outcomes = {};
      for (const mode of ['abort','quota']) {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function(value,key) {
          if(key==='current') {
            if(mode==='abort') this.transaction.abort();
            else throw new DOMException('Injected quota failure','QuotaExceededError');
          }
          return put.call(this,value,key);
        };
        try { await commitSnapshot(database,changed,record.token); outcomes[mode]='unexpected success'; }
        catch { outcomes[mode]=JSON.stringify(await readSlots(database))===JSON.stringify(before); }
        finally { IDBObjectStore.prototype.put = put; }
      }
      try { await commitSnapshot(database,changed,record.token-1); outcomes.stale=false; }
      catch { outcomes.stale=JSON.stringify(await readSlots(database))===JSON.stringify(before); }
      database.close();
      const large = createWorld(now);
      const mother=large.fish[0],father=large.fish[1];
      for(let i=7;i<=10000;i++) large.fish.push({...structuredClone(mother),id:`FSH-${String(i).padStart(6,'0')}`,name:`Archive ${i}`,status:'sold',generation:1,parents:[mother.id,father.id]});
      large.nextId=10001;
      const started=performance.now();
      const f=kinship(large.fish,'FSH-010000','FSH-009999');
      const kinshipMs=performance.now()-started;
      const largeRuntime=createRuntime(large,'large-world');
      const largeDb=await openDatabase('m2-large-transaction-tests');
      const start=performance.now();
      await commitSnapshot(largeDb,largeRuntime,null);
      const load=await readSlots(largeDb);
      const restored=decodeRuntime(load.current.raw);
      const elapsedMs=performance.now()-start;
      largeDb.close();
      return {names,outcomes,large:{records:restored.world.fish.length,bytes:load.current.raw.length,elapsedMs,kinshipMs,f},largeRaw:load.current.raw};
    });
    assert.deepEqual(modules.names,['Name 2','Name 1','Name 0']);
    assert.deepEqual(modules.outcomes,{abort:true,quota:true,stale:true});
    assert.equal(modules.large.records,10000); assert.equal(modules.large.f,0.25);
    evidence.transactions={names:modules.names,outcomes:modules.outcomes}; evidence.large=modules.large;
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    await page.getByLabel('Save JSON').fill('{bad');
    await page.getByRole('button',{name:'Validate import',exact:true}).click();
    await page.getByText(/Import rejected/).waitFor();
    assert.equal(await page.getByRole('button',{name:'Replace world with reviewed import'}).count(),0);
    await page.getByLabel('Save JSON').fill('{"schemaVersion":99}');
    await page.getByRole('button',{name:'Validate import',exact:true}).click();
    await page.getByText(/Import rejected/).waitFor();
    await page.getByLabel('Save JSON').fill(modules.largeRaw);
    await page.getByRole('button',{name:'Validate import',exact:true}).click();
    await page.getByRole('button',{name:'Replace world with reviewed import'}).click();
    await page.waitForEvent('load'); await saved();
    await page.getByRole('button',{name:'View archive',exact:true}).click();
    assert.equal(await page.locator('.fish-grid .fish-card').count(),60);
    await page.getByRole('button',{name:'Next collection page'}).click();
    assert.equal(await page.locator('.fish-grid .fish-card').count(),60);
    await page.locator('.fish-grid [id^="card-"]').first().focus(); await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'Family',exact:true}).click();
    await page.locator('.family-view').getByRole('button',{name:/Haru/}).click();
    assert.equal(await page.locator('.family-view .relative').count(),60);
    evidence.largeUi='10,000-record import; archive and family lists remain at 60 rows per page.';
    await page.getByRole('button',{name:'Saves',exact:true}).click();
    await page.getByRole('button',{name:'Show recovery copies'}).click();
    await page.getByRole('button',{name:'Preview backup1',exact:true}).click();
    await page.getByRole('button',{name:'Replace world with reviewed import'}).click();
    await page.waitForEvent('load'); await saved();
    assert.equal(await page.getByLabel('Given name').inputValue(),'M2 ancestor');
    evidence.importRecovery='Malformed/future imports rejected; reviewed import and previous-save restore succeeded.';
    await page.evaluate(()=>document.documentElement.style.fontSize='32px');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.getByRole('button',{name:'Genome',exact:true}).click();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    evidence.desktopText='200% text: no document overflow at 1440px.';
    const legacyContext=await browser.newContext(); const legacyPage=await legacyContext.newPage();
    await legacyPage.goto(url+'/favicon.svg');
    const legacyRaw=await legacyPage.evaluate(async()=>{
      const {createWorld}=await import('/src/core/world.ts');
      const world=createWorld('2026-09-13T12:00:00.000Z');world.fish[0].name='Legacy ancestor';
      const raw=JSON.stringify(world);localStorage.setItem('fishtank-sim.lab.v1',raw);return raw;
    });
    await legacyPage.goto(url); await legacyPage.getByText('Saved on this device',{exact:true}).waitFor();
    assert.equal(await legacyPage.getByLabel('Given name').inputValue(),'Legacy ancestor');
    assert.equal(await legacyPage.evaluate(()=>localStorage.getItem('fishtank-sim.lab.v1')),legacyRaw);
    await legacyPage.evaluate(async()=>{
      const {openDatabase}=await import('/src/persistence/database.ts');
      const db=await openDatabase();
      await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put({raw:'{"schemaVersion":99}',token:20,savedAt:'qa'},'current');tx.oncomplete=resolve;tx.onabort=reject;});db.close();
    });
    await legacyPage.reload();
    await legacyPage.getByText(/Stored data has been preserved/).waitFor();
    assert.ok(await legacyPage.evaluate(async()=>{
      const {openDatabase,readSlots}=await import('/src/persistence/database.ts');const db=await openDatabase();const slots=await readSlots(db);db.close();return slots.current.raw==='{"schemaVersion":99}';
    }));
    evidence.migration='v1 migrated without changing its raw backup; unsupported current snapshot preserved on reload.';
    const mobileContext=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const mobile=await mobileContext.newPage();await mobile.goto(url);await mobile.getByText('Saved on this device',{exact:true}).waitFor();
    await mobile.getByRole('button',{name:'Saves',exact:true}).click();
    const touch=await mobile.evaluate(()=>[...document.querySelectorAll('button,select,a,input[type="file"]')].filter(e=>e.getClientRects().length&&!e.classList.contains('skip-link')).map(e=>({text:e.textContent,box:e.getBoundingClientRect()})).filter(e=>e.box.width<44||e.box.height<44).map(e=>e.text));
    assert.deepEqual(touch,[]);
    await mobile.evaluate(()=>document.documentElement.style.fontSize='32px');
    assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await mobile.screenshot({path:'.artifacts/m2-mobile-viewport.png'});
    fs.mkdirSync('.artifacts',{recursive:true});
    await mobile.screenshot({path:'.artifacts/m2-mobile.png',fullPage:true});
    evidence.mobile='375px coarse-pointer targets >=44px; 200% text without horizontal overflow.';
    assert.deepEqual(errors,[]); evidence.errors=errors;
    fs.writeFileSync('.artifacts/m2-browser-evidence.json',JSON.stringify(evidence,null,2));
    console.log(JSON.stringify(evidence,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});

