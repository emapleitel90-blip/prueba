import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveOrder,removeOrder,validateOrders,orderPortions} from '../src/orders.js';
import {saveFamily,removeFamily,validateFamily} from '../src/family.js';
import {report} from '../src/analytics.js';
const fixture=()=>({stock:[{id:'s',name:'Harina',unit:'kg',qty:5,cost:1000,min:1}],recipes:[{id:'r',name:'Menú',yield:10,price:5000,items:[{id:'s',qty:1,unit:'kg'}]}],days:[{recipe:'r',name:'Menú preparado',date:'2026-10-29',made:10,sold:5,cost:100,price:5000}],expenses:[]});
const input=overrides=>({id:'o',recipe:'r',customer:' Ana ',portions:3,date:'2026-10-29',fulfillment:'delivery',address:' Calle 123, piso 2 ',phone:' 351-1234567 ',time:'12:30',notes:' Tocar timbre ',status:'pending',day:'day:0',...overrides});
test('pedido identifica porciones existentes, dirección y cliente sin duplicar stock, ventas ni cobros',()=>{
 const state=fixture(),before=structuredClone(state),next=saveOrder(state,input());
 assert.deepEqual(state,before);assert.deepEqual(next.stock,state.stock);assert.deepEqual(next.expenses,state.expenses);
 assert.deepEqual({...next.days[0],id:undefined},{...state.days[0],id:undefined});
 const order=next.orders[0];assert.equal(order.customer,'Ana');assert.equal(order.address,'Calle 123, piso 2');assert.equal(order.phone,'351-1234567');assert.equal(order.notes,'Tocar timbre');assert.equal(order.name,'Menú preparado');assert.equal(order.day,next.days[0].id);assert.equal(orderPortions(next,next.days[0]),3);
 assert.deepEqual(report(next,'2026-10','2026-10-29'),report({...next,orders:[]},'2026-10','2026-10-29'));assert.doesNotThrow(()=>validateOrders(next));
});
test('retiro no guarda direcciones viejas y pedidos futuros se anotan antes de preparar',()=>{
 const state=fixture();state.days=[];
 const next=saveOrder(state,input({day:'',date:'2026-11-01',fulfillment:'pickup',portions:20}));
 assert.equal(next.orders[0].address,'');assert.equal(next.orders[0].day,undefined);assert.equal(next.orders[0].name,'Menú');assert.equal(next.orders[0].portions,20);assert.deepEqual(next.stock,state.stock);assert.doesNotThrow(()=>validateOrders(next));
 next.days=fixture().days;
 assert.throws(()=>saveOrder(next,{...next.orders[0],day:'day:0'}),/superan/);
 const assigned=saveOrder(next,{...next.orders[0],day:'day:0',portions:4});assert.ok(assigned.orders[0].day);assert.equal(assigned.days[0].sold,5);
});
test('edición, estados, cancelación y eliminación ajustan asignación, conservando fecha de carga',()=>{
 let next=saveOrder(fixture(),input()),created=next.orders[0].createdAt;
 next=saveOrder(next,{...next.orders[0],portions:8,status:'ready',fulfillment:'pickup'});assert.equal(next.orders.length,1);assert.equal(next.orders[0].createdAt,created);assert.equal(next.orders[0].address,'');assert.equal(orderPortions(next,next.days[0]),8);
 next=saveOrder(next,{...next.orders[0],status:'delivered'});assert.equal(orderPortions(next,next.days[0]),8);assert.equal(next.days[0].sold,5);
 next=saveOrder(next,{...next.orders[0],status:'cancelled'});assert.equal(orderPortions(next,next.days[0]),0);assert.equal(next.orders[0].portions,8);
 next=saveOrder(next,input({id:'other',day:next.days[0].id,portions:10}));assert.equal(orderPortions(next,next.days[0]),10);
 assert.throws(()=>saveOrder(next,{...next.orders[0],status:'pending'}),/superan/);
 const removed=removeOrder(next,'other');assert.equal(removed.orders.length,1);assert.equal(orderPortions(removed,removed.days[0]),0);assert.equal(removed.days[0].sold,5);assert.deepEqual(removed.stock,fixture().stock);
});
test('pedidos respetan porciones de casa y familia respeta pedidos sin duplicar las ventas',()=>{
 let state=fixture();state.days[0].sold=2;
 const family={id:'home',kind:'prepared',day:'day:0',date:'2026-10-29',detail:'Cena',portions:2};
 state=saveFamily(state,family,'2026-10-29');
 assert.throws(()=>saveOrder(state,input({day:state.days[0].id,portions:9})),/superan/);
 state=saveOrder(state,input({day:state.days[0].id,portions:7}));assert.doesNotThrow(()=>validateFamily(state));
 assert.throws(()=>saveFamily(state,{...family,day:state.days[0].id,portions:4},'2026-10-29'),/Quedan 3/);
 state=saveFamily(state,{...family,day:state.days[0].id,portions:3},'2026-10-29');assert.doesNotThrow(()=>validateOrders(state));assert.doesNotThrow(()=>validateFamily(state));
 assert.equal(removeFamily(state,'home').days[0].sold,2);
});
test('identificadores estables sobreviven reordenar jornadas y cambiar nombres de recetas',()=>{
 let state=saveOrder(fixture(),input());state.days.unshift({...state.days[0],id:'other',name:'Otra jornada'});state.recipes[0].name='Menú renombrado';
 state=saveOrder(state,{...state.orders[0],customer:'Ana editada'});assert.equal(state.orders[0].day,state.days[1].id);assert.equal(state.orders[0].name,'Menú preparado');assert.doesNotThrow(()=>validateOrders(state));
});
test('rechaza pedidos inválidos y copias corruptas sin aplicar cambios parciales',()=>{
 const state=fixture(),before=structuredClone(state);
 for(const changes of [{customer:''},{customer:'a'.repeat(121)},{portions:0},{portions:1.5},{portions:Infinity},{date:'2026-02-30'},{date:'2026-10-28'},{recipe:'missing'},{day:'missing'},{fulfillment:'other'},{address:''},{status:'__proto__'},{time:'25:30'},{notes:'x'.repeat(1001)}]){assert.throws(()=>saveOrder(state,input(changes)));assert.deepEqual(state,before)}
 assert.doesNotThrow(()=>validateOrders(state));
 const valid=saveOrder(state,input());
 for(const mutate of [s=>s.orders.push({...s.orders[0]}),s=>s.orders[0].createdAt='bad',s=>s.orders[0].day='missing',s=>s.orders[0].portions=11,s=>s.orders[0].fulfillment='pickup',s=>s.orders={}]){const bad=structuredClone(valid);mutate(bad);assert.throws(()=>validateOrders(bad))}
});
