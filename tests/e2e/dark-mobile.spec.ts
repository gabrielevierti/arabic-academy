import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
for(const route of ['course','alphabet','practice','review','progress','library','settings','lesson/A0-L0-01','lesson/C1-C1-04'])test('dark mobile '+route,async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});
 await page.setViewportSize({width:375,height:812});
 await page.goto('/#/'+route);
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 if(route==='alphabet')await expect(page.locator('.alphabet-grid')).toBeVisible();
 if(route==='library')await expect(page.locator('.volume-shelf')).toBeVisible();
 if(route.startsWith('lesson')){await expect(page.locator('.native-course')).toBeVisible();await page.getByRole('button',{name:/02 Allenati/}).click();}
 await page.waitForTimeout(300);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const report=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 fs.mkdirSync('reports/dark-mobile',{recursive:true});
 fs.writeFileSync('reports/dark-mobile/'+route.replaceAll('/','-')+'.json',JSON.stringify(report,null,2));
 await page.screenshot({path:'reports/dark-mobile/'+route.replaceAll('/','-')+'.png',fullPage:true});
 expect(report.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
});
