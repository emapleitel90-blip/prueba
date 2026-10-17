import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace("import './style.css';",'').replace("import {cloud,readShared,writeShared} from './shared.js';",'');
function app({shared=false,write}={}){
 const dom=new JSDOM('<div id="app"></div>',{url:'https://filo.test',runScripts:'outside-only'}),w=dom.window;
 w.structuredClone=structuredClone;w.HTMLElement.prototype.scrollIntoView=()=>{};const alerts=[];w.alert=m=>alerts.push(m);w.confirm=()=>true;
 let remote={payload:{demo:false,stock:[{id:'beef',name:'Carne',unit:'kg',qty:2,cost:9000,min:0}],recipes:[],days:[],expenses:[]},version:3};
 w.mockCloud=shared?{auth:{getSession:async()=>({data:{session:{user:{email:'familia@example.com'}}}}),onAuthStateChange:()=>{}}}:null;
 w.mockRead=async()=>structuredClone(remote);w.mockWrite=write|| (async(payload,v)=>{assert.equal(v,remote.version);remote={payload:structuredClone(payload),version:v+1};return remote.version});
 w.eval(`const cloud=window.mockCloud,readShared=window.mockRead,writeShared=window.mockWrite;\n${source}\nwindow.currentForTest=state;`);
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
