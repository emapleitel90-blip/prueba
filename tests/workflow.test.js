import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {report,advice} from '../src/analytics.js';
import * as measurements from '../src/units.js';
import * as purchasing from '../src/purchasing.js';
import * as household from '../src/family.js';
import {recipeCosts} from '../src/costing.js';
import * as customerOrders from '../src/orders.js';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace("import './style.css';",'').replace("import {familyPortions,familyEntry,saveFamily,removeFamily,validateFamily} from './family.js';",'').replace("import {packageQuantity,purchaseChanges} from './purchasing.js';",'').replace(/^import \{units,.*from '\.\/units\.js';\n/m,'').replace("import {recipeCosts} from './costing.js';",'').replace("import {orderStatuses,orderPortions,saveOrder,removeOrder,validateOrders} from './orders.js';",'').replace("import {report,advice} from './analytics.js';",'').replace("import {cloud,readShared,writeShared} from './shared.js';",'');
function app({shared=false,write,read,payload,authenticated=true}={}){
 const dom=new JSDOM('<div id="app"></div>',{url:'https://filo.test',runScripts:'outside-only'}),w=dom.window;
 w.customerOrders=customerOrders;w.recipeCosts=recipeCosts;w.report=report;w.advice=advice;w.purchasing=purchasing;w.household=household;w.measurements=measurements;if(payload&&!shared)w.localStorage.setItem('filo-v1',JSON.stringify(payload));w.structuredClone=structuredClone;w.HTMLElement.prototype.scrollIntoView=()=>{};const alerts=[];w.alert=m=>alerts.push(m);w.confirm=()=>true;
 let remote={payload:payload||{demo:false,stock:[{id:'beef',name:'Carne',unit:'kg',qty:2,cost:9000,min:0}],recipes:[],days:[],expenses:[]},version:3};
 let authChange,currentSession=authenticated?{user:{email:'familia@example.com'}}:null,readCount=0;
 w.mockCloud=shared?{auth:{getSession:async()=>({data:{session:currentSession}}),onAuthStateChange:callback=>{authChange=callback}}}:null;
 w.mockRead=async()=>{readCount++;return read?read(structuredClone(remote),readCount):structuredClone(remote)};w.mockWrite=write|| (async(payload,v)=>{assert.equal(v,remote.version);remote={payload:structuredClone(payload),version:v+1};return remote.version});
 w.eval(`const {orderStatuses,orderPortions,saveOrder,removeOrder,validateOrders}=window.customerOrders;const {familyPortions,familyEntry,saveFamily,removeFamily,validateFamily}=window.household;const {packageQuantity,purchaseChanges}=window.purchasing;const {units,unitLabel,compatibleUnits,compatible,convertQuantity,formatQuantity,inputQuantity,recipeQuantity,stockUnitFactor,changeStockUnit}=window.measurements;const report=window.report,advice=window.advice;const cloud=window.mockCloud,readShared=window.mockRead,writeShared=window.mockWrite;\n${source}\nwindow.currentForTest=state;`);
 const doc=w.document;
 const nav=name=>[...doc.querySelectorAll('[data-tab]')].find(b=>b.dataset.tab===name).click();
 const set=(form,name,value)=>{const el=doc.querySelector(form).elements[name];el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}))};
 const submit=form=>doc.querySelector(form).dispatchEvent(new w.Event('submit',{cancelable:true}));
 const state=()=>JSON.parse(w.localStorage.getItem('filo-v1'));
 return {w,doc,nav,set,submit,state,alerts,remote:()=>remote,replaceRemote:next=>{remote=structuredClone(next)},readCalls:()=>readCount,emitAuth:(event,next=currentSession)=>{currentSession=next;authChange(event,next)}};
}
const tick=()=>new Promise(r=>setTimeout(r,20));
test('buscador de stock ignora tildes, combina palabras y conserva edición y datos',()=>{
 const payload={demo:false,stock:[{id:'o',name:'Orégano seco',unit:'g',qty:200,cost:10,min:5},{id:'p',name:'Pimienta negra',unit:'g',qty:100,cost:20,min:5},{id:'h',name:'Harina',unit:'kg',qty:5,cost:1000,min:1}],recipes:[],days:[],expenses:[]};
 const a=app({payload});a.nav('Stock');a.doc.querySelector('[data-edit=o]').click();a.set('#stock','cost','12');
 const search=value=>{const el=a.doc.querySelector('#stock-search');el.value=value;el.dispatchEvent(new a.w.Event('input',{bubbles:true}))};
 search('  SECO orega ');assert.equal(a.doc.querySelectorAll('[data-stock-name]:not([hidden])').length,1);assert.equal(a.doc.querySelector('[data-stock-name]:not([hidden])').dataset.stockName,'Orégano seco');assert.equal(a.doc.querySelector('#stock-search-count').textContent,'1 de 3 productos');assert.equal(a.doc.querySelector('#stock [name=cost]').value,'12');assert.deepEqual(a.state(),payload);
 search('inexistente');assert.equal(a.doc.querySelector('#stock-search-empty').hidden,false);a.doc.querySelector('#clear-stock-search').click();assert.equal(a.doc.querySelectorAll('[data-stock-name]:not([hidden])').length,3);assert.equal(a.doc.querySelector('#stock-search-empty').hidden,true);
 search('pimi');a.nav('Hoy');a.nav('Stock');assert.equal(a.doc.querySelector('#stock-search').value,'pimi');assert.equal(a.doc.querySelector('[data-stock-name]:not([hidden])').dataset.stockName,'Pimienta negra');
});
function fillOrder(a,changes={}){
 a.nav('Pedidos');for(const [key,value] of Object.entries({customer:'Ana',portions:'2',...changes}))a.set('#order',key,value);
}
test('Pedidos guarda cliente, porciones, entrega, horario y notas, y los muestra en Hoy',async()=>{
 const a=app(),before=structuredClone(a.w.currentForTest);fillOrder(a,{customer:'Ana <img src=x onerror=alert(1)>',fulfillment:'delivery',address:'Calle 123, 2° A',phone:'3511234567',time:'12:30',notes:'Sin cebolla'});
 assert.equal(a.doc.querySelector('#order-address').hidden,false);assert.equal(a.doc.querySelector('#order [name=address]').required,true);a.submit('#order');await tick();
 let saved=a.state();const created=saved.orders[0].createdAt;assert.equal(saved.orders.length,1);assert.equal(saved.orders[0].address,'Calle 123, 2° A');assert.equal(saved.orders[0].portions,2);assert.deepEqual(saved.stock,before.stock);assert.deepEqual(saved.days,before.days);assert.equal(a.doc.querySelector('.order-card img'),null);assert.doesNotThrow(()=>a.w.validateBackup(saved));
 a.nav('Hoy');assert.ok(a.doc.querySelector('.orders-today').textContent.includes('Calle 123'));assert.ok(a.doc.querySelector('.orders-today').textContent.includes('12:30'));a.doc.querySelector('[data-order-edit]').click();assert.equal(a.doc.querySelector('#order-title').textContent,'Editar pedido');assert.equal(a.doc.querySelector('#order [name=customer]').value,saved.orders[0].customer);
 a.set('#order','fulfillment','pickup');assert.equal(a.doc.querySelector('#order [name=address]').disabled,true);a.set('#order','portions','3');a.submit('#order');await tick();saved=a.state();assert.equal(saved.orders.length,1);assert.equal(saved.orders[0].address,'');assert.equal(saved.orders[0].portions,3);assert.equal(saved.orders[0].createdAt,created);assert.ok(a.doc.querySelector('.order-card').textContent.includes('Retira el cliente'));
});
test('pedidos futuros, filtros, estados y cancelación conservan el historial sin registrar ventas',async()=>{
 const a=app();fillOrder(a,{date:'2099-11-01'});a.submit('#order');await tick();const created=a.state().orders[0].createdAt;
 a.doc.querySelector('[data-order-status=ready]').click();await tick();assert.equal(a.state().orders[0].status,'ready');a.doc.querySelector('[data-order-status=delivered]').click();await tick();assert.equal(a.state().orders[0].status,'delivered');assert.equal(a.state().orders[0].createdAt,created);assert.equal(a.state().days.length,0);
 a.doc.querySelector('#orders-date').value='2099-11-02';a.doc.querySelector('#orders-date').dispatchEvent(new a.w.Event('change'));assert.equal(a.doc.querySelectorAll('.order-card').length,0);a.doc.querySelector('#orders-all-dates').click();assert.equal(a.doc.querySelectorAll('.order-card').length,1);
 a.doc.querySelector('[data-order-edit]').click();a.set('#order','status','cancelled');a.submit('#order');await tick();assert.equal(a.state().orders.length,1);assert.equal(a.state().orders[0].status,'cancelled');assert.ok(a.doc.body.textContent.includes('0 porciones sin contar cancelados'));
 a.doc.querySelector('#orders-status').value='pending';a.doc.querySelector('#orders-status').dispatchEvent(new a.w.Event('change'));assert.equal(a.doc.querySelectorAll('.order-card').length,0);a.doc.querySelector('#orders-status').value='all';a.doc.querySelector('#orders-status').dispatchEvent(new a.w.Event('change'));a.doc.querySelector('[data-order-delete]').click();await tick();assert.equal(a.state().orders.length,0);assert.equal(a.state().days.length,0);
});
test('asignar un pedido a producción protege porciones familiares y evita eliminar la jornada vinculada',async()=>{
 const a=app();a.set('#day','made','10');a.set('#day','sold','3');a.submit('#day');const stock=a.state().stock;
 fillOrder(a,{portions:'8',day:'day:0'});a.submit('#order');await tick();let saved=a.state();assert.ok(saved.days[0].id);assert.equal(saved.orders[0].day,saved.days[0].id);assert.equal(saved.days[0].sold,3);assert.deepEqual(saved.stock,stock);
 a.nav('Hoy');a.doc.querySelector('[data-delete-day]').click();assert.ok(a.alerts.at(-1).includes('pedidos vinculados'));assert.equal(a.state().days.length,1);
 a.nav('Familia');a.set('#family','kind','prepared');a.set('#family','portions','4');a.submit('#family');await tick();assert.ok(a.alerts.at(-1).includes('Quedan 2'));a.set('#family','portions','2');a.submit('#family');await tick();assert.equal(a.state().family[0].portions,2);
 a.nav('Pedidos');a.doc.querySelector('[data-order-edit]').click();a.set('#order','portions','9');a.submit('#order');await tick();assert.ok(a.alerts.at(-1).includes('superan'));assert.equal(a.state().orders[0].portions,8);assert.doesNotThrow(()=>a.w.validateBackup(a.state()));
 a.set('#order','status','cancelled');a.submit('#order');await tick();a.nav('Familia');a.doc.querySelector('[data-family-edit]').click();a.set('#family','portions','4');a.submit('#family');await tick();assert.equal(a.state().family[0].portions,4);
});
test('pedido valida cliente, dirección y porciones, permite cancelar el formulario y conserva copias anteriores',async()=>{
 const a=app();fillOrder(a,{fulfillment:'delivery'});
 for(const [key,value] of [['customer',''],['customer','Ana'],['portions','2,5'],['portions','-1'],['portions','2']]){a.set('#order',key,value);a.submit('#order');await tick();assert.equal(a.state()?.orders,undefined)}
 assert.ok(a.alerts.some(message=>message.includes('dirección')));a.set('#order','address','Calle 123');a.doc.querySelector('#cancel-order').click();assert.equal(a.state()?.orders,undefined);assert.doesNotThrow(()=>a.w.validateBackup(a.w.currentForTest));
 fillOrder(a);a.submit('#order');await tick();const bad=a.state();bad.orders[0].day='missing';assert.throws(()=>a.w.validateBackup(bad));
});
test('pedidos compartidos guardan con versión y un conflicto conserva el borrador y bloquea nuevas escrituras',async()=>{
 const payload={demo:false,stock:[],recipes:[{id:'r',name:'Menú',yield:1,price:1000,items:[{id:'s',qty:1,unit:'unidad'}]}],days:[],expenses:[]};payload.stock=[{id:'s',name:'Envase',unit:'unidad',qty:10,cost:100,min:0}];
 const a=app({shared:true,payload});await tick();fillOrder(a,{customer:'Cliente compartido',fulfillment:'delivery',address:'Destino 123'});a.submit('#order');await tick();assert.equal(a.remote().version,4);assert.equal(a.remote().payload.orders[0].customer,'Cliente compartido');assert.doesNotThrow(()=>a.w.validateBackup(a.remote().payload));
 const b=app({shared:true,payload:a.remote().payload,write:async()=>{throw Error('Otra persona guardó cambios.')}});await tick();b.nav('Pedidos');b.doc.querySelector('[data-order-edit]').click();b.set('#order','portions','3');b.submit('#order');await tick();assert.equal(b.remote().payload.orders[0].portions,2);assert.equal(JSON.parse(b.w.localStorage.getItem('filo-unsent')).orders[0].portions,3);assert.equal(b.doc.querySelector('[data-order-edit]').disabled,true);assert.ok(!b.doc.body.textContent.includes('Pedido guardado con los datos'));
 const c=app({shared:true,authenticated:false});await tick();c.nav('Pedidos');assert.equal(c.doc.querySelector('#order'),null);assert.ok(c.doc.body.textContent.includes('Ingresá con un correo autorizado'));
});
test('un pedido sin jornada no bloquea corregir una producción distinta y conserva su cliente',async()=>{
 const a=app();fillOrder(a,{customer:'Cliente por preparar'});a.submit('#order');await tick();a.nav('Hoy');a.set('#day','made','5');a.set('#day','sold','0');a.submit('#day');const stock=a.state().stock;
 a.doc.querySelector('[data-delete-day]').click();await tick();assert.equal(a.state().days.length,0);assert.equal(a.state().orders[0].customer,'Cliente por preparar');assert.notDeepEqual(a.state().stock,stock);assert.doesNotThrow(()=>a.w.validateBackup(a.state()));
});
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
 const a=app();a.nav('Recetas');a.set('#recipe','name','Porción');a.set('#recipe','yield','1');a.set('#recipe','price','2500,50');a.set('#recipe','amount','0,9');a.set('#recipe','itemUnit','kg');a.submit('#recipe');assert.equal(a.state().recipes.at(-1).items[0].qty,.9);
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

const salesPayload=()=>({demo:false,stock:[{id:'beef',name:'Carne',unit:'kg',qty:2,cost:9000,min:0}],recipes:[{id:'meal',name:'Menú',yield:10,price:6500,items:[{id:'beef',qty:1}]}],days:[{date:new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Cordoba'}),recipe:'meal',name:'Menú',made:10,sold:3,cost:900,price:6500}],expenses:[]});

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

const flourPayload=()=>({demo:false,stock:[{id:'flour',name:'Harina',unit:'kg',qty:3,cost:2500,min:.5}],recipes:[],days:[],expenses:[]});
test('300 g en receta con precio por kilo cuestan $750 y consumen solo 0,3 kg',()=>{
 const a=app({payload:flourPayload()});a.nav('Recetas');
 assert.equal(a.doc.querySelector('[name=itemUnit]').value,'g');
 a.set('#recipe','name','Masa');a.set('#recipe','yield','1');a.set('#recipe','amount','300');
 a.doc.querySelector('[name=amount]').dispatchEvent(new a.w.Event('input',{bubbles:true}));
 assert.ok(a.doc.querySelector('#recipe-estimate').textContent.includes('750'));
 a.submit('#recipe');assert.deepEqual(a.state().recipes[0].items[0],{id:'flour',qty:300,unit:'g'});
 a.nav('Hoy');a.set('#day','made','1');a.set('#day','sold','1');a.submit('#day');
 assert.equal(a.state().stock[0].qty,2.7);assert.equal(a.state().days[0].cost,750);
 assert.equal(a.state().days[0].consumed[0].unit,'kg');assert.equal(a.state().days[0].consumed[0].qty,.3);
 a.doc.querySelector('[data-delete-day]').click();assert.equal(a.state().stock[0].qty,3);
});
test('compras en gramos convierten cantidad y precio, también al editar y eliminar',()=>{
 const a=app({payload:flourPayload()});a.nav('Compras');a.set('#purchase','ingredient','flour');a.set('#purchase','purchaseUnit','g');a.set('#purchase','qty','300');a.set('#purchase','total','750');a.submit('#purchase');
 assert.equal(a.state().stock[0].qty,3.3);assert.equal(a.state().stock[0].cost,2500);assert.equal(a.state().expenses[0].unit,'g');
 a.doc.querySelector('[data-purchase]').click();assert.equal(a.doc.querySelector('[name=purchaseUnit]').value,'g');
 a.set('#purchase','qty','200');a.set('#purchase','total','600');a.submit('#purchase');
 assert.ok(Math.abs(a.state().stock[0].qty-3.2)<1e-9);assert.equal(a.state().stock[0].cost,3000);
 a.doc.querySelector('[data-delete-purchase]').click();assert.ok(Math.abs(a.state().stock[0].qty-3)<1e-9);
});
test('cambiar stock de kg a g convierte mínimos y precio sin alterar recetas o compras antiguas',()=>{
 const payload=flourPayload();payload.recipes=[{id:'r',name:'Masa',yield:1,price:2000,items:[{id:'flour',qty:.3}]}];payload.expenses=[{id:'p',ingredient:'flour',kind:'stock',qty:1,total:2500,date:'2026-10-01',detail:''}];payload.days=[{recipe:'r',name:'Masa',date:new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Cordoba'}),made:1,sold:0,cost:750,price:2000,consumed:[{id:'flour',qty:.3}]}];
 const a=app({payload});a.nav('Stock');a.doc.querySelector('[data-edit=flour]').click();a.set('#stock','unit','g');
 assert.equal(a.doc.querySelector('#stock [name=qty]').value,'3000');assert.equal(a.doc.querySelector('#stock [name=costUnit]').value,'kg');
 a.submit('#stock');const s=a.state();assert.equal(s.stock[0].unit,'g');assert.equal(s.stock[0].qty,3000);assert.equal(s.stock[0].cost,2.5);assert.equal(s.stock[0].min,500);
 assert.equal(s.recipes[0].items[0].unit,'kg');assert.equal(s.expenses[0].unit,'kg');assert.equal(s.days[0].cost,750);
 a.nav('Hoy');a.doc.querySelector('[data-delete-day]').click();assert.equal(a.state().stock[0].qty,3300);
 a.nav('Compras');a.doc.querySelector('[data-delete-purchase]').click();assert.equal(a.state().stock[0].qty,2300);
});
test('un registro antiguo 630 kg se puede corregir explícitamente a 630 g sin tocar jornadas',()=>{
 const payload=flourPayload();payload.recipes=[{id:'r',name:'Pan de carne',yield:20,price:9000,items:[{id:'flour',qty:630}]}];
 const a=app({payload});a.nav('Recetas');a.doc.querySelector('[data-recipe]').click();
 assert.equal(a.doc.querySelector('[name=itemUnit]').value,'kg');a.set('#recipe','itemUnit','g');a.submit('#recipe');
 assert.equal(a.state().recipes[0].items[0].qty,630);assert.equal(a.state().recipes[0].items[0].unit,'g');assert.equal(a.state().stock[0].qty,3);
 a.nav('Hoy');a.set('#day','made','20');a.set('#day','sold','0');a.submit('#day');
 assert.equal(a.state().days[0].cost,78.75);assert.equal(a.state().stock[0].qty,2.37);
});
test('una receta combina gramos y kilos del mismo producto, sumando el consumo una sola vez',()=>{
 const payload=flourPayload();payload.recipes=[{id:'r',name:'Mezcla',yield:1,price:2000,items:[{id:'flour',qty:300,unit:'g'},{id:'flour',qty:.2,unit:'kg'}]}];
 const a=app({payload});a.set('#day','made','1');a.set('#day','sold','0');a.submit('#day');
 assert.equal(a.state().days[0].cost,1250);assert.equal(a.state().stock[0].qty,2.5);assert.equal(a.state().days[0].consumed.length,1);
});
test('copias nuevas validan dimensiones y las copias anteriores siguen siendo compatibles',()=>{
 const payload=flourPayload();payload.recipes=[{id:'r',name:'Masa',yield:1,price:2000,items:[{id:'flour',qty:300,unit:'g'}]}];
 const a=app({payload});assert.doesNotThrow(()=>a.w.validateBackup(payload));
 payload.recipes[0].items[0].unit='litro';assert.throws(()=>a.w.validateBackup(payload));
 delete payload.recipes[0].items[0].unit;assert.doesNotThrow(()=>a.w.validateBackup(payload));
});

test('precio por kg con stock en gramos normaliza el costo y exige equivalencia para otra dimensión',()=>{
 const payload=flourPayload();payload.stock[0]={...payload.stock[0],unit:'g',qty:3000,cost:2.5,min:500};
 const a=app({payload});a.nav('Stock');a.doc.querySelector('[data-edit=flour]').click();
 a.set('#stock','costUnit','kg');a.set('#stock','cost','2500');a.submit('#stock');
 assert.equal(a.state().stock[0].cost,2.5);assert.equal(a.state().stock[0].qty,3000);
 a.doc.querySelector('[data-edit=flour]').click();a.set('#stock','unit','litro');
 assert.equal(a.doc.querySelector('#stock [name=unit]').value,'litro');assert.equal(a.doc.querySelector('#stock-unit-correction').hidden,false);assert.equal(a.doc.querySelector('#save-stock').disabled,true);assert.equal(a.state().stock[0].unit,'g');
});
test('corregir unidad a litros muestra equivalencia, guarda una sola vez y permite seguir comprando',async()=>{
 const payload={demo:false,stock:[{id:'oil',name:'Aceite',unit:'unidad',qty:15,cost:900,min:2}],recipes:[{id:'r',name:'Menú',yield:2,price:2000,items:[{id:'oil',qty:2}]}],days:[{recipe:'r',name:'Menú',date:'2026-10-23',made:2,sold:0,cost:900,price:2000,consumed:[{id:'oil',qty:2}]}],expenses:[{id:'p',kind:'stock',ingredient:'oil',qty:5,total:4500,date:'2026-10-23',detail:'Oferta',packages:{count:5,size:1,unit:'unidad'}}]};
 const a=app({shared:true,payload});await tick();a.nav('Stock');a.doc.querySelector('[data-edit=oil]').click();a.set('#stock','unit','litro');
 assert.equal(a.doc.querySelector('#save-stock').disabled,true);assert.equal(a.doc.querySelector('#stock [name=cost]').disabled,true);
 a.doc.querySelector('#apply-stock-equivalence').click();assert.ok(a.alerts.at(-1).includes('equivale'));assert.equal(a.remote().version,3);
 a.set('#stock','equivalenceQty','900');a.set('#stock','equivalenceUnit','ml');assert.ok(a.doc.querySelector('#stock-equivalence-preview').textContent.includes('13,500 litro'));
 a.doc.querySelector('#apply-stock-equivalence').click();assert.equal(a.remote().version,3);assert.equal(a.remote().payload.stock[0].unit,'unidad');
 assert.equal(a.doc.querySelector('#stock-unit-correction').hidden,true);assert.equal(a.doc.querySelector('#save-stock').disabled,false);assert.equal(a.doc.querySelector('#stock [name=qty]').value,'13,500');assert.equal(a.doc.querySelector('#stock [name=cost]').value,'1000,000');
 a.submit('#stock');await tick();let saved=a.remote().payload;assert.equal(a.remote().version,4);assert.equal(saved.stock[0].qty,13.5);assert.equal(saved.stock[0].cost,1000);assert.equal(saved.stock[0].unit,'litro');assert.equal(saved.recipes[0].items[0].qty,1.8);assert.equal(saved.expenses[0].total,4500);assert.equal(saved.days[0].cost,900);assert.doesNotThrow(()=>a.w.validateBackup(saved));
 a.nav('Compras');a.doc.querySelector('[data-purchase=p]').click();a.set('#purchase','total','4000');a.submit('#purchase');await tick();assert.equal(a.remote().payload.stock[0].qty,13.5);assert.equal(a.remote().payload.expenses[0].qty,4.5);
 a.nav('Stock');a.doc.querySelector('[data-restock=oil]').click();a.set('#purchase','qty','1,8');a.set('#purchase','total','1800');a.submit('#purchase');await tick();saved=a.remote().payload;assert.equal(saved.stock[0].qty,15.3);assert.equal(saved.stock[0].cost,1000);assert.equal(saved.expenses.length,2);assert.equal(saved.stock[0].unitCorrections.length,1);
});
test('cancelar una equivalencia no cambia datos; permite corregir solo el nombre de la medida y ajustar precio',()=>{
 const payload={demo:false,stock:[{id:'oil',name:'Aceite',unit:'unidad',qty:3,cost:2500,min:1}],recipes:[],days:[],expenses:[]};
 const a=app({payload});a.nav('Stock');a.doc.querySelector('[data-edit=oil]').click();a.set('#stock','unit','litro');a.set('#stock','equivalenceQty','1');a.doc.querySelector('#apply-stock-equivalence').click();a.doc.querySelector('#cancel-stock').click();assert.deepEqual(a.state(),payload);
 a.doc.querySelector('[data-edit=oil]').click();a.set('#stock','unit','litro');a.set('#stock','equivalenceQty','1');a.doc.querySelector('#apply-stock-equivalence').click();a.set('#stock','qty','4,5');a.set('#stock','cost','2200');a.submit('#stock');assert.equal(a.state().stock[0].qty,4.5);assert.equal(a.state().stock[0].cost,2200);assert.equal(a.state().stock[0].unit,'litro');assert.equal(a.state().stock[0].unitCorrections[0].quantity,1);
 // Una edición posterior conserva el registro de equivalencia.
 a.doc.querySelector('[data-edit=oil]').click();a.set('#stock','cost','2100');a.submit('#stock');assert.equal(a.state().stock[0].unitCorrections.length,1);assert.doesNotThrow(()=>a.w.validateBackup(a.state()));
});
test('cambiar de medida varias veces en una edición no repite la conversión ni guarda cambios parciales',()=>{
 const payload={demo:false,stock:[{id:'oil',name:'Aceite',unit:'unidad',qty:10,cost:900,min:1}],recipes:[{id:'r',name:'Menú',yield:1,price:2000,items:[{id:'oil',qty:1}]}],days:[],expenses:[]};
 const a=app({payload});a.nav('Stock');a.doc.querySelector('[data-edit=oil]').click();a.set('#stock','unit','litro');a.set('#stock','equivalenceQty','0,9');a.doc.querySelector('#apply-stock-equivalence').click();a.set('#stock','unit','ml');assert.equal(a.doc.querySelector('#stock [name=qty]').value,'9000');a.set('#stock','unit','litro');assert.equal(a.doc.querySelector('#stock [name=qty]').value,'9,000');
 a.set('#stock','unit','unidad');a.set('#stock','equivalenceQty','10');a.doc.querySelector('#apply-stock-equivalence').click();a.submit('#stock');assert.equal(a.state().stock[0].qty,90);assert.equal(a.state().recipes[0].items[0].qty,9);assert.equal(a.state().stock[0].unitCorrections.length,2);assert.doesNotThrow(()=>a.w.validateBackup(a.state()));
 const broken=structuredClone(a.state());broken.stock[0].unitCorrections[0].quantity=0;assert.throws(()=>a.w.validateBackup(broken));
});
test('el conteo por paquetes conserva el contenido equivalente y un conflicto no pisa datos compartidos',async()=>{
 const payload={demo:false,stock:[{id:'oil',name:'Aceite',unit:'unidad',qty:15,cost:900,min:1}],recipes:[],days:[],expenses:[]};
 const a=app({shared:true,payload,write:async()=>{throw Error('Otra persona guardó cambios. Actualizá los datos.')}});await tick();a.nav('Stock');a.doc.querySelector('[data-edit=oil]').click();
 check(a,'#stock','packaged');a.set('#stock','packageCount','15');a.set('#stock','packageSize','1');a.set('#stock','unit','litro');a.set('#stock','equivalenceQty','900');a.set('#stock','equivalenceUnit','ml');a.doc.querySelector('#apply-stock-equivalence').click();
 assert.equal(a.doc.querySelector('#stock [name=qty]').value,'13,500');assert.equal(a.doc.querySelector('#stock [name=packageSize]').value,'0,900');assert.equal(a.doc.querySelector('#stock [name=packageUnit]').value,'litro');
 a.submit('#stock');await tick();assert.equal(a.remote().payload.stock[0].unit,'unidad');assert.equal(a.remote().version,3);const draft=JSON.parse(a.w.localStorage.getItem('filo-unsent'));assert.equal(draft.stock[0].unit,'litro');assert.equal(draft.stock[0].qty,13.5);assert.doesNotThrow(()=>a.w.validateBackup(draft));assert.equal(a.doc.querySelector('#stock [name=qty]').disabled,true);
});
test('litros y mililitros también convierten los precios y el consumo',()=>{
 const payload=flourPayload();payload.stock[0]={id:'flour',name:'Aceite',unit:'litro',qty:2,cost:5000,min:0};
 const a=app({payload});a.nav('Recetas');assert.equal(a.doc.querySelector('[name=itemUnit]').value,'ml');
 a.set('#recipe','name','Aceite para menú');a.set('#recipe','yield','1');a.set('#recipe','amount','100');a.submit('#recipe');
 a.nav('Hoy');a.set('#day','made','1');a.set('#day','sold','0');a.submit('#day');
 assert.equal(a.state().stock[0].qty,1.9);assert.equal(a.state().days[0].cost,500);
});

function check(a,form,name,checked=true){const el=a.doc.querySelector(form).elements[name];el.checked=checked;el.dispatchEvent(new a.w.Event('change',{bubbles:true}))}
test('conteo de 15 paquetes y reposición de 5 con oferta suman 20 sin duplicar el producto',()=>{
 const payload=flourPayload();payload.stock[0].qty=0;payload.stock[0].cost=980;
 payload.recipes=[{id:'r',name:'Masa',yield:1,price:2000,items:[{id:'flour',qty:300,unit:'g'}]}];
 payload.days=[{recipe:'r',name:'Masa',date:'2026-10-01',made:1,sold:1,cost:294,price:2000,consumed:[{id:'flour',qty:.3,unit:'kg'}]}];
 const a=app({payload});a.nav('Stock');a.doc.querySelector('[data-edit=flour]').click();
 check(a,'#stock','packaged');a.set('#stock','packageCount','15');a.set('#stock','packageSize','1');a.submit('#stock');
 assert.equal(a.state().stock[0].qty,15);assert.equal(a.state().expenses.length,0);
 a.doc.querySelector('[data-restock=flour]').click();assert.equal(a.doc.querySelector('#purchase [name=ingredient]').value,'flour');
 check(a,'#purchase','packaged');a.set('#purchase','packageCount','5');a.set('#purchase','packageSize','1');a.set('#purchase','priceMode','unit');a.set('#purchase','unitPrice','650');a.set('#purchase','date','2026-10-19');a.set('#purchase','detail','Oferta del mayorista');
 assert.equal(a.doc.querySelector('#purchase [name=total]').value,'3250');assert.ok(a.doc.querySelector('#purchase-estimate').textContent.includes('20,000 kg'));
 a.submit('#purchase');const s=a.state();assert.equal(s.stock.length,1);assert.equal(s.stock[0].qty,20);assert.equal(s.stock[0].cost,650);
 assert.equal(s.expenses[0].total,3250);assert.equal(s.expenses[0].date,'2026-10-19');assert.deepEqual(s.expenses[0].packages,{count:5,size:1,unit:'kg'});assert.ok(s.expenses[0].createdAt);
 assert.equal(s.days[0].cost,294);assert.ok(a.doc.querySelector('#purchase-history').textContent.includes('650,00'));
 a.nav('Hoy');a.set('#day','made','1');a.set('#day','sold','0');a.submit('#day');assert.equal(a.state().days[1].cost,195);
 assert.doesNotThrow(()=>a.w.validateBackup(a.state()));
});
test('paquetes de 500 g convierten a kg y la edición reemplaza solo la diferencia',()=>{
 const a=app({payload:flourPayload()});a.nav('Stock');a.doc.querySelector('[data-edit=flour]').click();
 check(a,'#stock','packaged');a.set('#stock','packageCount','15');a.set('#stock','packageSize','500');a.set('#stock','packageUnit','g');a.submit('#stock');assert.equal(a.state().stock[0].qty,7.5);
 a.doc.querySelector('[data-restock=flour]').click();check(a,'#purchase','packaged');a.set('#purchase','packageCount','5');a.set('#purchase','packageSize','500');a.set('#purchase','packageUnit','g');a.set('#purchase','priceMode','unit');a.set('#purchase','unitPrice','650,50');a.submit('#purchase');
 assert.equal(a.state().stock[0].qty,10);assert.equal(a.state().stock[0].cost,1301);assert.equal(a.state().expenses[0].total,3252.5);
 a.doc.querySelector('[data-purchase]').click();assert.equal(a.doc.querySelector('#purchase [name=packaged]').checked,true);assert.equal(a.doc.querySelector('#purchase [name=packageUnit]').value,'g');assert.equal(a.doc.querySelector('#purchase [name=packageSize]').value,'500');
 a.set('#purchase','packageCount','6');a.set('#purchase','total','3600');a.submit('#purchase');assert.equal(a.state().stock[0].qty,10.5);assert.equal(a.state().stock[0].cost,1200);assert.equal(a.state().expenses.length,1);
 a.doc.querySelector('[data-delete-purchase]').click();assert.equal(a.state().stock[0].qty,7.5);
});
test('precios por unidad, historial por producto y cantidades sin un tope fijo',()=>{
 const payload=flourPayload();payload.stock.push({id:'mayo',name:'Mayonesa',unit:'unidad',qty:100000,cost:1200,min:1});
 const a=app({payload});a.nav('Stock');a.doc.querySelector('[data-restock=mayo]').click();a.set('#purchase','qty','5000');a.set('#purchase','priceMode','unit');a.set('#purchase','unitPrice','1000');a.submit('#purchase');
 assert.equal(a.state().stock[1].qty,105000);assert.equal(a.state().stock[1].cost,1000);assert.equal(a.state().expenses[0].total,5000000);
 a.set('#purchase','ingredient','flour');a.set('#purchase','qty','1');a.set('#purchase','total','2500');a.submit('#purchase');
 a.nav('Stock');a.doc.querySelector('[data-view-purchases=mayo]').click();assert.equal(a.doc.querySelector('#purchase-filter').value,'mayo');
 assert.equal(a.doc.querySelector('[data-movement-product=mayo]').hidden,false);assert.equal(a.doc.querySelector('[data-movement-product=flour]').hidden,true);
 const filter=a.doc.querySelector('#purchase-filter');filter.value='';filter.dispatchEvent(new a.w.Event('change'));assert.equal(a.doc.querySelector('[data-movement-product=flour]').hidden,false);
});
test('reposición compartida guarda cantidad, precio y fecha usando la versión remota',async()=>{
 const payload=flourPayload(),a=app({shared:true,payload});await tick();a.nav('Stock');a.doc.querySelector('[data-restock=flour]').click();a.set('#purchase','qty','2');a.set('#purchase','priceMode','unit');a.set('#purchase','unitPrice','1800');a.set('#purchase','date','2026-10-18');a.submit('#purchase');await tick();
 assert.equal(a.remote().version,4);assert.equal(a.remote().payload.stock[0].qty,5);assert.equal(a.remote().payload.stock[0].cost,1800);assert.equal(a.remote().payload.expenses[0].date,'2026-10-18');
});
test('paquetes inválidos no se guardan y otro gasto no exige datos de paquetes',()=>{
 const a=app({payload:flourPayload()});a.nav('Compras');a.set('#purchase','ingredient','flour');check(a,'#purchase','packaged');a.set('#purchase','packageSize','0');a.set('#purchase','total','1000');a.submit('#purchase');assert.equal(a.alerts.length,1);assert.equal(a.state().expenses.length,0);
 a.set('#purchase','kind','other');a.set('#purchase','total','1000');a.submit('#purchase');assert.equal(a.state().expenses.length,1);assert.equal(a.state().stock[0].qty,3);assert.equal(a.state().expenses[0].packages,undefined);
});
test('un conflicto de reposición conserva el borrador y bloquea sumar otra compra',async()=>{
 const payload=flourPayload(),a=app({shared:true,payload,write:async()=>{throw Error('Otra persona guardó cambios')}});await tick();a.nav('Stock');a.doc.querySelector('[data-restock=flour]').click();a.set('#purchase','qty','5');a.set('#purchase','total','3250');a.submit('#purchase');await tick();
 assert.equal(a.remote().payload.stock[0].qty,3);assert.equal(JSON.parse(a.w.localStorage.getItem('filo-unsent')).stock[0].qty,8);
 assert.equal(a.doc.querySelector('#purchase button').disabled,true);a.nav('Stock');assert.equal(a.doc.querySelector('[data-restock=flour]').disabled,false);
 a.doc.querySelector('#refresh-cloud').click();await tick();assert.equal(a.state().stock[0].qty,3);
});

test('Familia registra 300 g para cuatro, permite corregir y anular sin tocar ventas o pagos',async()=>{
 const a=app({payload:flourPayload()});a.nav('Familia');assert.equal(a.doc.querySelector('#family [name=portions]').value,'4');
 a.set('#family','amount','300');a.set('#family','detail','Cena en casa');assert.ok(a.doc.querySelector('#family-estimate').textContent.includes('750,00'));
 a.submit('#family');await tick();assert.equal(a.state().stock[0].qty,2.7);assert.equal(a.state().family[0].total,750);assert.equal(a.state().days.length,0);assert.equal(a.state().expenses.length,0);
 a.doc.querySelector('[data-family-edit]').click();a.set('#family','amount','500');a.submit('#family');await tick();assert.equal(a.state().stock[0].qty,2.5);assert.equal(a.state().family.length,1);
 assert.doesNotThrow(()=>a.w.validateBackup(a.state()));a.doc.querySelector('[data-family-delete]').click();await tick();assert.equal(a.state().stock[0].qty,3);assert.equal(a.state().family.length,0);
});
test('Familia prepara receta para cuatro sin crear una jornada comercial',async()=>{
 const payload=flourPayload();payload.recipes=[{id:'r',name:'Masa',yield:10,price:2000,items:[{id:'flour',qty:1,unit:'kg'}]}];
 const a=app({payload});a.nav('Familia');a.set('#family','kind','recipe');a.submit('#family');await tick();
 assert.equal(a.state().stock[0].qty,2.6);assert.equal(a.state().family[0].total,1000);assert.equal(a.state().days.length,0);
 a.nav('Resumen');assert.ok(a.doc.body.textContent.includes('Consumo familiar del mes'));assert.ok(!a.doc.body.textContent.includes('NaN'));
});
test('viandas para casa protegen disponibilidad, ventas y eliminación de la jornada',async()=>{
 const a=app();a.set('#day','made','10');a.set('#day','sold','5');a.submit('#day');const original=a.state();
 a.nav('Familia');a.set('#family','kind','prepared');a.submit('#family');await tick();assert.deepEqual(a.state().stock,original.stock);assert.equal(a.state().family[0].portions,4);
 a.nav('Hoy');assert.ok(a.doc.body.textContent.includes('4 para casa'));assert.ok(a.doc.body.textContent.includes('1 disponibles'));
 a.doc.querySelector('[data-edit-sales]').click();a.set('[data-sales-form]','sold','7');a.submit('[data-sales-form]');await tick();assert.equal(a.state().days[0].sold,5);assert.ok(a.alerts.at(-1).includes('6 viandas'));
 a.doc.querySelector('[data-cancel-sales]').click();a.doc.querySelector('[data-delete-day]').click();assert.equal(a.state().days.length,1);assert.ok(a.alerts.at(-1).includes('Familia'));
 a.nav('Familia');a.doc.querySelector('[data-family-delete]').click();await tick();a.nav('Hoy');a.doc.querySelector('[data-delete-day]').click();await tick();assert.equal(a.state().days.length,0);assert.deepEqual(a.state().stock.map(i=>i.qty),[8,80,3,45]);
});
test('consumo familiar compartido usa versión remota y un conflicto conserva el borrador',async()=>{
 const payload=flourPayload(),a=app({shared:true,payload});await tick();a.nav('Familia');a.set('#family','amount','300');a.submit('#family');await tick();assert.equal(a.remote().version,4);assert.equal(a.remote().payload.stock[0].qty,2.7);assert.equal(a.remote().payload.family.length,1);
 const b=app({shared:true,payload,write:async()=>{throw Error('Otra persona guardó cambios')}});await tick();b.nav('Familia');b.set('#family','amount','500');b.submit('#family');await tick();
 assert.equal(b.remote().payload.stock[0].qty,3);assert.equal(JSON.parse(b.w.localStorage.getItem('filo-unsent')).family[0].total,1250);assert.equal(b.doc.querySelector('#family button').disabled,true);assert.equal(b.doc.querySelector('[data-family-edit]').disabled,true);
 b.doc.querySelector('#refresh-cloud').click();await tick();assert.equal(b.state().stock[0].qty,3);assert.equal(b.state().family,undefined);
});

test('Ajustar inventario recupera el bloqueo y abre el producto con los últimos valores compartidos',async()=>{
 const writes=[],a=app({shared:true,write:async(payload,v)=>{writes.push({payload:structuredClone(payload),version:v});if(v===3)throw Error('Otra persona guardó cambios');return v+1}});await tick();
 a.nav('Stock');a.doc.querySelector('[data-edit=beef]').click();a.set('#stock','qty','1');a.submit('#stock');await tick();
 assert.equal(a.doc.querySelector('#stock button').disabled,true);assert.equal(a.doc.querySelector('[data-edit=beef]').disabled,false);
 assert.ok(!a.doc.body.textContent.includes('Inventario y precio guardados.'));
 const latest=structuredClone(a.remote());latest.version=4;latest.payload.stock[0].qty=5;latest.payload.stock[0].cost=7000;a.replaceRemote(latest);
 a.doc.querySelector('[data-edit=beef]').click();await tick();
 assert.equal(a.doc.querySelector('#stock [name=qty]').value,'5,000');assert.equal(a.doc.querySelector('#stock [name=cost]').value,'7000');assert.equal(a.doc.querySelector('#stock button').disabled,false);
 assert.equal(JSON.parse(a.w.localStorage.getItem('filo-unsent')).stock[0].qty,1);
 a.set('#stock','qty','6');a.set('#stock','cost','7500');a.submit('#stock');await tick();
 assert.equal(writes[1].version,4);assert.equal(writes[1].payload.stock[0].qty,6);assert.equal(writes[1].payload.stock[0].cost,7500);assert.equal(a.state().stock[0].qty,6);assert.equal(a.w.localStorage.getItem('filo-unsent'),null);
});
test('Sumar compra recupera la sincronización y selecciona el mismo producto',async()=>{
 const a=app({shared:true,write:async()=>{throw Error('Otra persona guardó cambios')}});await tick();a.nav('Stock');a.doc.querySelector('[data-edit=beef]').click();a.set('#stock','cost','8000');a.submit('#stock');await tick();
 a.doc.querySelector('[data-restock=beef]').click();await tick();
 assert.equal(a.doc.querySelector('#purchase [name=ingredient]').value,'beef');assert.equal(a.doc.querySelector('#purchase button').disabled,false);assert.equal(a.remote().payload.stock[0].cost,9000);
});
test('un reintento sin conexión conserva el bloqueo y el borrador hasta leer una versión válida',async()=>{
 const a=app({shared:true,read:async(row,count)=>{if(count===2)throw Error('Sin conexión');return row},write:async()=>{throw Error('Otra persona guardó cambios')}});await tick();a.nav('Stock');a.doc.querySelector('[data-edit=beef]').click();a.set('#stock','qty','1');a.submit('#stock');await tick();
 a.doc.querySelector('[data-edit=beef]').click();await tick();assert.equal(a.doc.querySelector('#stock button').disabled,true);assert.ok(a.doc.body.textContent.includes('Sin conexión'));assert.ok(a.doc.querySelector('[data-recover-edit]'));assert.equal(a.remote().payload.stock[0].qty,2);
 a.doc.querySelector('[data-edit=beef]').click();await tick();assert.equal(a.doc.querySelector('#stock button').disabled,false);assert.equal(a.doc.querySelector('#stock [name=qty]').value,'2,000');assert.ok(a.w.localStorage.getItem('filo-unsent'));
});
test('el aviso de recuperación permite resolver una lectura inicial fallida',async()=>{
 const a=app({shared:true,read:async(row,count)=>{if(count===1)throw Error('Falló la conexión');return row}});await tick();a.nav('Stock');assert.equal(a.doc.querySelector('#stock button').disabled,true);
 a.doc.querySelector('[data-recover-edit]').click();await tick();assert.equal(a.doc.querySelector('#stock button').disabled,false);assert.ok(a.doc.querySelector('[data-edit=beef]'));assert.equal(a.readCalls(),2);
});
test('recuperar la sesión limpia el error antiguo y una lectura pendiente no restaura datos tras cerrar sesión',async()=>{
 const a=app({shared:true,read:async(row,count)=>{if(count===1)throw Error('Sesión pendiente de renovar');return row}});await tick();a.nav('Stock');assert.equal(a.doc.querySelector('#stock button').disabled,true);
 a.emitAuth('TOKEN_REFRESHED');await tick();assert.equal(a.doc.querySelector('#stock button').disabled,false);assert.equal(a.readCalls(),2);
 let resolveRead;const b=app({shared:true,read:row=>new Promise(resolve=>{resolveRead=()=>resolve(row)})});await tick();b.emitAuth('SIGNED_OUT',null);resolveRead();await tick();b.nav('Stock');assert.equal(b.doc.querySelector('[data-edit]'),null);assert.equal(b.doc.querySelector('#stock button').disabled,true);assert.ok(b.doc.querySelector('#login'));
});
test('sin sesión muestra el acceso y mantiene los formularios de inventario bloqueados',async()=>{
 const a=app({shared:true,authenticated:false});await tick();a.nav('Stock');assert.equal(a.readCalls(),0);assert.equal(a.doc.querySelector('#stock button').disabled,true);
 a.doc.querySelector('[data-recover-edit]').click();assert.equal(a.doc.activeElement,a.doc.querySelector('#login input'));assert.equal(a.readCalls(),0);
});

test('el 10% de gastos adicionales se guarda en la receta y en futuras producciones, conservando lo ya registrado',async()=>{
 const payload=flourPayload();payload.recipes=[{id:'r',name:'Masa',yield:1,price:2000,items:[{id:'flour',qty:300,unit:'g'}]}];payload.days=[{recipe:'r',name:'Masa',date:new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Cordoba'}),made:1,sold:1,cost:750,price:2000}];
 const a=app({payload});a.nav('Recetas');a.doc.querySelector('[data-recipe=r]').click();assert.equal(a.doc.querySelector('#recipe [name=overheadPercent]').value,'0');
 a.doc.querySelector('#recipe-overhead-10').click();assert.equal(a.doc.querySelector('#recipe [name=overheadPercent]').value,'10');assert.ok(a.doc.querySelector('#recipe-estimate').textContent.includes('825,00'));a.submit('#recipe');
 assert.equal(a.state().recipes[0].overheadPercent,10);assert.equal(a.state().recipes[0].price,2000);assert.deepEqual(a.state().stock,payload.stock);assert.deepEqual(a.state().days,payload.days);assert.equal(a.state().expenses.length,0);
 a.nav('Hoy');a.set('#day','made','1');a.set('#day','sold','1');a.submit('#day');const day=a.state().days[1];assert.equal(day.cost,750);assert.equal(day.overheadCost,75);assert.equal(day.overheadPercent,10);assert.equal(a.state().stock[0].qty,2.7);assert.ok(a.doc.body.textContent.includes('825,00'));
 a.nav('Recetas');a.doc.querySelector('[data-recipe=r]').click();a.set('#recipe','overheadPercent','20');a.submit('#recipe');assert.equal(a.state().days[1].overheadCost,75);assert.equal(a.state().days[1].overheadPercent,10);
 a.nav('Resumen');assert.ok(a.doc.body.textContent.includes('Presupuesto de recetas del mes'));assert.doesNotThrow(()=>a.w.validateBackup(a.state()));
});
test('porcentajes decimales son editables y no se guardan negativos, vacíos o desbordamientos',()=>{
 const a=app({payload:flourPayload()});a.nav('Recetas');a.set('#recipe','name','Masa');a.set('#recipe','yield','1');a.set('#recipe','amount','300');
 for(const value of ['-10','','1'+'0'.repeat(308)]){a.set('#recipe','overheadPercent',value);a.submit('#recipe');assert.equal(a.state().recipes.length,0)}
 a.set('#recipe','overheadPercent','12,5');a.submit('#recipe');assert.equal(a.state().recipes[0].overheadPercent,12.5);a.doc.querySelector('[data-recipe]').click();assert.equal(a.doc.querySelector('#recipe [name=overheadPercent]').value,'12,5');assert.ok(a.doc.querySelector('#recipe-estimate').textContent.includes('843,75'));
});
test('el porcentaje usa el guardado compartido y conserva el borrador ante un conflicto',async()=>{
 const payload=flourPayload();payload.recipes=[{id:'r',name:'Masa',yield:1,price:2000,items:[{id:'flour',qty:300,unit:'g'}]}];
 const a=app({shared:true,payload});await tick();a.nav('Recetas');a.doc.querySelector('[data-recipe=r]').click();a.doc.querySelector('#recipe-overhead-10').click();a.submit('#recipe');await tick();assert.equal(a.remote().version,4);assert.equal(a.remote().payload.recipes[0].overheadPercent,10);assert.deepEqual(a.remote().payload.stock,payload.stock);
 const b=app({shared:true,payload,write:async()=>{throw Error('Otra persona guardó cambios')}});await tick();b.nav('Recetas');b.doc.querySelector('[data-recipe=r]').click();b.doc.querySelector('#recipe-overhead-10').click();b.submit('#recipe');await tick();assert.equal(b.remote().payload.recipes[0].overheadPercent,undefined);assert.equal(JSON.parse(b.w.localStorage.getItem('filo-unsent')).recipes[0].overheadPercent,10);assert.equal(b.doc.querySelector('#recipe button').disabled,true);
});
test('las copias anteriores son válidas y las nuevas validan el porcentaje y el desglose histórico',()=>{
 const payload=flourPayload();payload.recipes=[{id:'r',name:'Masa',yield:1,price:2000,items:[{id:'flour',qty:300,unit:'g'}]}];const a=app({payload});assert.doesNotThrow(()=>a.w.validateBackup(payload));
 payload.recipes[0].overheadPercent=-10;assert.throws(()=>a.w.validateBackup(payload));payload.recipes[0].overheadPercent='10';assert.throws(()=>a.w.validateBackup(payload));payload.recipes[0].overheadPercent=10;assert.doesNotThrow(()=>a.w.validateBackup(payload));
 payload.days=[{recipe:'r',name:'Masa',date:'2026-10-23',made:1,sold:1,cost:750,price:2000,overheadPercent:10,overheadCost:75}];assert.doesNotThrow(()=>a.w.validateBackup(payload));payload.days[0].overheadCost=70;assert.throws(()=>a.w.validateBackup(payload));
});
