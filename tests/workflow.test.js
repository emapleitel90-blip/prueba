import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {report,advice} from '../src/analytics.js';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace("import './style.css';",'').replace("import {report,advice} from './analytics.js';",'').replace("import {cloud,readShared,writeShared} from './shared.js';",'');
function app({shared=false,write,payload}={}){
 const dom=new JSDOM('<div id="app"></div>',{url:'https://filo.test',runScripts:'outside-only'}),w=dom.window;
 w.report=report;w.advice=advice;w.structuredClone=structuredClone;w.HTMLElement.prototype.scrollIntoView=()=>{};const alerts=[];w.alert=m=>alerts.push(m);w.confirm=()=>true;
 let remote={payload:payload||{demo:false,stock:[{id:'beef',name:'Carne',unit:'kg',qty:2,cost:9000,min:0}],recipes:[],days:[],expenses:[]},version:3};
 w.mockCloud=shared?{auth:{getSession:async()=>({data:{session:{user:{email:'familia@example.com'}}}}),onAuthStateChange:()=>{}}}:null;
 w.mockRead=async()=>structuredClone(remote);w.mockWrite=write|| (async(payload,v)=>{assert.equal(v,remote.version);remote={payload:structuredClone(payload),version:v+1};return remote.version});
 w.eval(`const report=window.report,advice=window.advice;const cloud=window.mockCloud,readShared=window.mockRead,writeShared=window.mockWrite;\n${source}\nwindow.currentForTest=state;`);
 const doc=w.document;
 const nav=name=>[...doc.querySelectorAll('[data-tab]')].find(b=>b.dataset.tab===name).click();
 const set=(form,name,value)=>{const el=doc.querySelector(form).elements[name];el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}))};
 const submit=form=>doc.querySelector(form).dispatchEvent(new w.Event('submit',{cancelable:true}));
 const state=()=>JSON.parse(w.localStorage.getItem('filo-v1'));
 return {w,doc,nav,set,submit,state,alerts,remote:()=>remote};
}
const tick=()=>new Promise(r=>setTimeout(r,20));
test('compra crea ingrediente, admite coma, calcula costo y edición aplica solo diferencia',()=>{
 const a=app();a.nav('Compras');a.set('#purchase','ingredient','__new');a.set('#purchase','newName','Carne suelta');a.set('#purchase','qty','0,9');a.set('#purchase','total','8100');a.submit('#purchase');
 let s=a.state();const item=s.stock.find(i=>i.name==='Carne suelta');assert.equal(item.qty,.9);assert.equal(item.cost,9000);assert.equal(s.expenses[0].ingredient,item.id);
 a.doc.querySelector('[data-purchase]').click();a.set('#purchase','qty','1,2');a.set('#purchase','total','10800');a.submit('#purchase');s=a.state();assert.equal(s.expenses.length,1);assert.equal(s.stock.at(-1).qty,1.2);
 a.doc.querySelector('[data-delete-purchase]').click();assert.equal(a.state().stock.at(-1).qty,0);assert.equal(a.state().expenses.length,0);
});
test('otros gastos ocultan ingredientes y cantidad, categoría libre y fecha editable',()=>{
 const a=app();a.nav('Compras');a.set('#purchase','kind','other');assert.equal(a.doc.querySelector('[name=qty]').disabled,true);assert.equal(a.doc.querySelector('[name=ingredient]').disabled,true);a.set('#purchase','category','Flete del proveedor');a.set('#purchase','date','2026-10-12');a.set('#purchase','total','1500,50');a.submit('#purchase');assert.equal(a.state().expenses[0].total,1500.5);assert.equal(a.state().expenses[0].date,'2026-10-12');assert.equal(a.state().stock[0].qty,8);
});
test('rechaza cifras ambiguas y negativos, productos duplicados e enteros fraccionarios',()=>{
 const a=app();a.nav('Stock');a.set('#stock','name','Nuevo');a.set('#stock','qty','1.200,50');a.submit('#stock');assert.equal(a.alerts.length,1);a.set('#stock','qty','-2');a.submit('#stock');assert.equal(a.alerts.length,2);a.set('#stock','qty','0,9');a.set('#stock','name','Carne picada');a.submit('#stock');assert.equal(a.alerts.length,3);a.nav('Hoy');a.set('#day','made','2,5');a.submit('#day');assert.equal(a.alerts.length,4);
});
test('recetas aceptan decimales y producción usa sus costos',()=>{
 const a=app();a.nav('Recetas');a.set('#recipe','name','Porción');a.set('#recipe','yield','1');a.set('#recipe','price','2500,50');a.set('#recipe','amount','0,9');a.submit('#recipe');assert.equal(a.state().recipes.at(-1).items[0].qty,.9);
 a.nav('Hoy');a.set('#day','recipe',a.state().recipes.at(-1).id);a.set('#day','made','1');a.set('#day','sold','1');a.submit('#day');assert.equal(a.state().stock[0].qty,7.1);assert.equal(a.state().days[0].price,2500.5);
});
test('no elimina una compra ya consumida si produciría stock negativo',()=>{
 const a=app();a.nav('Compras');a.set('#purchase','ingredient','carne');a.set('#purchase','qty','2');a.set('#purchase','total','18000');a.submit('#purchase');a.nav('Hoy');a.set('#day','made','90');a.set('#day','sold','0');a.submit('#day'); // otros ingredientes insuficientes: no se guarda
 assert.ok(a.alerts.length);a.nav('Stock');a.doc.querySelector('[data-edit=carne]').click();a.set('#stock','qty','1');a.submit('#stock');a.nav('Compras');a.doc.querySelector('[data-delete-purchase]').click();assert.ok(a.alerts.at(-1).includes('negativo'));assert.equal(a.state().expenses.length,1);assert.equal(a.state().stock[0].qty,1);
});
test('modo compartido carga base remota y guarda usando su versión',async()=>{
 const a=app({shared:true});await tick();a.nav('Stock');a.doc.querySelector('[data-edit=beef]').click();a.set('#stock','qty','0,9');a.submit('#stock');await tick();assert.equal(a.remote().version,4);assert.equal(a.remote().payload.stock[0].qty,.9);assert.equal(a.state().stock[0].qty,.9);
});
test('conflicto conserva borrador, bloquea nuevas ediciones y permite recuperar datos remotos',async()=>{
 const a=app({shared:true,write:async()=>{throw Error('Otra persona guardó cambios')}});await tick();a.nav('Stock');a.doc.querySelector('[data-edit=beef]').click();a.set('#stock','qty','1');a.submit('#stock');await tick();assert.ok(a.doc.body.textContent.includes('Otra persona guardó'));assert.equal(JSON.parse(a.w.localStorage.getItem('filo-unsent')).stock[0].qty,1);assert.equal(a.doc.querySelector('#stock button').disabled,true);a.doc.querySelector('#refresh-cloud').click();await tick();assert.equal(a.state().stock[0].qty,2);assert.equal(a.doc.querySelector('#stock button').disabled,false);
});
test('backup inválido no reemplaza datos; backup válido es aceptado',()=>{
 const a=app();assert.doesNotThrow(()=>a.w.validateBackup(a.w.currentForTest));assert.throws(()=>a.w.eval('validateBackup({stock:[],recipes:[],days:[],expenses:[{kind:"other",detail:"x",date:"bad",total:-2,qty:0}]})'));
});

test('resumen mensual permite elegir mes, muestra datos vacíos y jornadas con fecha anterior',()=>{
 const a=app();a.nav('Hoy');a.set('#day','date','2025-01-12');a.set('#day','made','1');a.set('#day','sold','1');a.submit('#day');assert.equal(a.state().days[0].date,'2025-01-12');a.nav('Resumen');const picker=a.doc.querySelector('#report-month');picker.value='2025-01';picker.dispatchEvent(new a.w.Event('change'));assert.ok(a.doc.body.textContent.includes('Canelones de carne'));assert.ok(a.doc.body.textContent.includes('2025-01-12'));assert.ok(a.doc.body.textContent.includes('Contribución total'));assert.ok(!a.doc.body.textContent.includes('NaN'));
});

test('actualizar ventas conserva producción, stock y precios históricos sin duplicar jornadas',async()=>{
 const a=app();a.set('#day','made','20');a.set('#day','sold','5');a.submit('#day');
 const before=a.state();
 a.doc.querySelector('[data-edit-sales="0"]').click();
 a.set('[data-sales-form]','sold','8');a.submit('[data-sales-form]');await tick();
 const after=a.state();
 assert.equal(after.days.length,1);assert.equal(after.days[0].sold,8);
 assert.deepEqual(after.stock,before.stock);
 assert.deepEqual({...after.days[0],sold:before.days[0].sold},before.days[0]);
 const r=report(after,after.days[0].date.slice(0,7),after.days[0].date);
 assert.equal(r.sales,8*before.days[0].price);assert.equal(r.left,12);
 assert.equal(r.production,20*before.days[0].cost);
 assert.ok(a.doc.body.textContent.includes('Ventas actualizadas. El stock no cambió.'));
});

test('las ventas rechazan excesos y valores inválidos, permiten corregir a cero y cancelar',async()=>{
 const a=app();a.set('#day','made','10');a.set('#day','sold','5');a.submit('#day');
 a.doc.querySelector('[data-edit-sales="0"]').click();
 for(const value of ['11','-1','2,5','']){
  a.set('[data-sales-form]','sold',value);a.submit('[data-sales-form]');
  assert.equal(a.state().days[0].sold,5);
 }
 assert.equal(a.alerts.length,4);
 a.set('[data-sales-form]','sold','0');a.submit('[data-sales-form]');await tick();
 assert.equal(a.state().days[0].sold,0);
 a.doc.querySelector('[data-edit-sales="0"]').click();a.set('[data-sales-form]','sold','7');
 a.doc.querySelector('[data-cancel-sales]').click();
 assert.equal(a.state().days[0].sold,0);assert.equal(a.doc.querySelector('[data-sales-form]'),null);
});

test('el resumen actualiza la jornada histórica correcta aunque cambie el orden y no haya identificadores',async()=>{
 const a=app();
 for(const date of ['2025-01-12','2025-01-13']){a.set('#day','date',date);a.set('#day','made','5');a.set('#day','sold','1');a.submit('#day')}
 const stock=a.state().stock;
 a.nav('Resumen');const picker=a.doc.querySelector('#report-month');picker.value='2025-01';picker.dispatchEvent(new a.w.Event('change'));
 assert.equal(a.doc.querySelector('[data-edit-sales]').dataset.editSales,'1');
 a.doc.querySelector('[data-edit-sales="1"]').click();a.set('[data-sales-form]','sold','4');a.submit('[data-sales-form]');await tick();
 assert.deepEqual(a.state().days.map(d=>d.sold),[1,4]);
 assert.deepEqual(a.state().stock,stock);assert.equal(a.state().days.length,2);
});

const salesPayload=()=>({demo:false,stock:[{id:'beef',name:'Carne',unit:'kg',qty:2,cost:9000,min:0}],recipes:[{id:'meal',name:'Menú',yield:10,price:6500,items:[{id:'beef',qty:1}]}],days:[{date:new Date().toLocaleDateString('en-CA'),recipe:'meal',name:'Menú',made:10,sold:3,cost:900,price:6500}],expenses:[]});

test('las ventas compartidas guardan con la versión cargada y conservan el stock',async()=>{
 const payload=salesPayload(),a=app({shared:true,payload});await tick();
 a.doc.querySelector('[data-edit-sales="0"]').click();a.set('[data-sales-form]','sold','6');a.submit('[data-sales-form]');await tick();
 assert.equal(a.remote().version,4);assert.equal(a.remote().payload.days[0].sold,6);
 assert.deepEqual(a.remote().payload.stock,payload.stock);
 assert.equal(a.remote().payload.days[0].cost,900);assert.equal(a.remote().payload.days[0].price,6500);
});

test('un conflicto de ventas conserva el borrador y bloquea otra edición hasta actualizar',async()=>{
 const a=app({shared:true,payload:salesPayload(),write:async()=>{throw Error('Otra persona guardó cambios')}});await tick();
 a.doc.querySelector('[data-edit-sales="0"]').click();a.set('[data-sales-form]','sold','6');a.submit('[data-sales-form]');await tick();
 assert.equal(JSON.parse(a.w.localStorage.getItem('filo-unsent')).days[0].sold,6);
 assert.equal(a.doc.querySelector('[data-edit-sales="0"]').disabled,true);
 assert.ok(!a.doc.body.textContent.includes('Ventas actualizadas.'));
 a.doc.querySelector('#refresh-cloud').click();await tick();
 assert.equal(a.state().days[0].sold,3);assert.equal(a.doc.querySelector('[data-edit-sales="0"]').disabled,false);
});
