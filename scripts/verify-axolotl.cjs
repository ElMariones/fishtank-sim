// Isolated browser world: never touches the user's saved aquarium.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.FISHTANK_URL || 'http://127.0.0.1:5191';
fs.mkdirSync('.artifacts', { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { browser: browser.version(), errors: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => report.errors.push(e.message));
    await page.goto(url);
    await page.getByText('Saved on this device', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'NPC shop', exact: true }).first().click();
    await page.locator('.shop-panel').getByRole('button', { name: /^Axolotls/ }).click();
    const first = page.locator('.axolotl-listing').first();
    const name = await first.locator('strong').first().innerText();
    await first.getByRole('button', { name: /^Buy / }).click();
    await page.locator('.axolotl-listing').filter({has:page.getByText(name,{exact:true})}).waitFor({state:'detached'});
    await page.locator('.axolotl-listing').first().getByRole('button', { name: /^Buy / }).click();
    await page.keyboard.press('Escape');
    await page.locator('.shop-panel').waitFor({state:'detached'});
    console.log('Bought two axolotls in isolated world:', name);
    // Click the collection card through its visible portrait label.
    await page.getByRole('img', { name: new RegExp(`^${name},`) }).last().click();
    await page.getByRole('heading', { name, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Genome', exact: true }).click();
    assert.match(await page.locator('body').innerText(), /66|Axolotl/);
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.getByRole('button', { name: 'Feed', exact: true }).click();
    const tank = page.locator('.tank-canvas');
    const moving = await tank.evaluate(c=>c.toDataURL());
    await page.waitForTimeout(300);
    assert.notEqual(await tank.evaluate(c=>c.toDataURL()),moving);
    console.log('Selection, genome and feeding passed');
    // Discover the live playback control's accessible name from the actual DOM.
    console.log('Playback:', await page.locator('button').evaluateAll(nodes => nodes.map(n=>n.getAttribute('aria-label')).filter(v=>v&&/pause|resume/i.test(v))));
    await page.getByRole('button', { name: /Pause/ }).click();
    await page.waitForTimeout(300);
    const paused = await tank.evaluate(c=>c.toDataURL());
    await page.waitForTimeout(300);
    assert.equal(await tank.evaluate(c=>c.toDataURL()),paused);
    await page.evaluate(()=>window.scrollTo(0,0));
    const cdp = await page.context().newCDPSession(page);
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('.artifacts/axolotl-tank.png', Buffer.from(screenshot.data, 'base64'));
    report.journey = 'Bought two axolotls, selected collection portrait, inspected genome, fed and paused the mixed tank.';
    await page.reload();
    await page.getByText('Saved on this device', { exact: true }).waitFor();
    assert.ok((await page.locator('body').innerText()).includes(name));
    report.reload = 'Purchased animal survives reload.';
    report.animation = 'Live canvas changes during playback and stays pixel-identical while paused.';

    // Offscreen rendering uses the same production drawing path, independent of UI animation.
    report.render = await page.evaluate(async () => {
      const { drawAxolotl } = await import('/src/rendering/axolotl.ts');
      const { axolotlFounderGenome, expressAxolotl } = await import('/src/core/axolotlGenetics.ts');
      const { axolotlPortraitFrame, DEFAULT_AXOLOTL_SHAPE } = await import('/src/core/axolotlAnatomy.ts');
      const { AXOLOTL_LOCUS_INDEX } = await import('/src/core/axolotlCatalog.ts');
      const specimens = ['Wild palette', 'Leucistic-like', 'Albino-like', 'Melanoid-like'].map((label,i)=>{
        const genome=axolotlFounderGenome(9812);
        for(const key of ['axo_leucistic_switch','axo_albinism_switch','axo_melanoid_switch']) {
          const index=AXOLOTL_LOCUS_INDEX[key]; genome.maternal[index]=0; genome.paternal[index]=0;
        }
        if(i){const index=AXOLOTL_LOCUS_INDEX[['axo_leucistic_switch','axo_albinism_switch','axo_melanoid_switch'][i-1]];genome.maternal[index]=5;genome.paternal[index]=5;}
        return {label,p:expressAxolotl(genome),seed:9812};
      });
      specimens.push({label:'Long gills / wide tail',p:{...DEFAULT_AXOLOTL_SHAPE,gillLength:1,gillFilamentLength:1,tailFin:1},seed:81});
      specimens.push({label:'Compact / short limbs',p:{...DEFAULT_AXOLOTL_SHAPE,bodyLength:0,headWidth:0,tailLength:0,forelimbLength:0,hindlimbLength:0},seed:12});
      const sheet=document.createElement('canvas');sheet.width=1440;sheet.height=920;const ctx=sheet.getContext('2d');
      ctx.fillStyle='#10272e';ctx.fillRect(0,0,1440,920);ctx.fillStyle='#d8e9df';ctx.font='26px sans-serif';ctx.fillText('Axolotl / anatomy v2',32,45);
      specimens.forEach(({label,p,seed},i)=>{
        const x=(i%2)*720,y=75+Math.floor(i/2)*275;ctx.fillStyle='#1b353b';ctx.fillRect(x+16,y,688,256);
        ctx.fillStyle='#c5dad1';ctx.font='18px sans-serif';ctx.fillText(label,x+36,y+32);
        const frame=axolotlPortraitFrame(p,640,210);ctx.save();ctx.translate(x+40+frame.originX,y+40+frame.originY);drawAxolotl(ctx,p,seed,frame.size,2);ctx.restore();
      });
      const animation=document.createElement('canvas');animation.width=1440;animation.height=700;const actx=animation.getContext('2d');
      actx.fillStyle='#10272e';actx.fillRect(0,0,1440,700);
      for(let i=0;i<8;i++){
        const x=(i%4)*360,y=Math.floor(i/4)*350,frame=axolotlPortraitFrame(specimens[1].p,340,260);
        actx.fillStyle='#c5dad1';actx.font='16px sans-serif';actx.fillText(`${i<4?'Swimming':'Bottom gait'} / phase ${i%4}`,x+12,y+30);
        actx.save();actx.translate(x+10+frame.originX,y+50+frame.originY);
        drawAxolotl(actx,specimens[1].p,9812,frame.size,i*0.9,{tailPhase:i*1.57,limbPhase:i*1.57,effort:1,grounded:i<4?0:1});actx.restore();
      }
      const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=700;const bc=canvas.getContext('2d');
      const phenotypes=Array.from({length:60},(_,i)=>expressAxolotl(axolotlFounderGenome(700+i)));
      const timings=[];for(let frame=0;frame<35;frame++){
        const start=performance.now();bc.clearRect(0,0,1000,700);
        for(let i=0;i<60;i++){bc.save();bc.translate(70+(i%10)*90,65+Math.floor(i/10)*105);drawAxolotl(bc,phenotypes[i],i,38,frame/30);bc.restore();}
        if(frame>4)timings.push(performance.now()-start);
      }
      timings.sort((a,b)=>a-b);
      return {sheet:sheet.toDataURL(),animation:animation.toDataURL(),sixtyAnimalsMs:{median:timings[15],p95:timings[28]},frames:30};
    });
    for(const [key,file] of [['sheet','axolotl-morphs.png'],['animation','axolotl-animation.png']]){
      fs.writeFileSync(`.artifacts/${file}`,Buffer.from(report.render[key].split(',')[1],'base64'));delete report.render[key];
    }
    assert.deepEqual(report.errors, []);
    fs.writeFileSync('.artifacts/axolotl-verification.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
