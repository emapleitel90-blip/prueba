import {test} from 'node:test';
import assert from 'node:assert/strict';
import {familyPortions,familyEntry,saveFamily,removeFamily,validateFamily} from '../src/family.js';
import {changeStockUnit} from '../src/units.js';
const now='2026-10-19';
const fixture=()=>({stock:[{id:'f',name:'Harina',unit:'kg',qty:3,cost:2500,min:0}],recipes:[{id:'r',name:'Masa',yield:10,price:5000,items:[{id:'f',qty:1,unit:'kg'}]}],days:[{recipe:'r',name:'Masa',date:now,made:10,sold:5,cost:250,price:5000}],expenses:[]});
const raw=(overrides={})=>({id:'c',kind:'ingredients',date:now,detail:'Cena',portions:4,items:[{id:'f',qty:300,unit:'g'}],...overrides});
test('consumo de cuatro personas descuenta el total una vez y no crea venta ni gasto',()=>{
 const state=fixture(),before=structuredClone(state),next=saveFamily(state,raw(),now);
 assert.deepEqual(state,before);assert.equal(next.stock[0].qty,2.7);assert.equal(next.family[0].total,750);assert.equal(next.family[0].portions,4);
 assert.deepEqual(next.days,state.days);assert.deepEqual(next.expenses,[]);assert.doesNotThrow(()=>validateFamily(next));
 assert.equal(removeFamily(next,'c').stock[0].qty,3);
});
test('preparar cuatro porciones escala la receta y preserva el consumo original al corregir',()=>{
 const state=fixture();let next=saveFamily(state,raw({kind:'recipe',recipe:'r'}),now);
 assert.equal(next.stock[0].qty,2.6);assert.equal(next.family[0].total,1000);
 next.recipes[0].items[0].qty=2;next.stock[0].cost=8000;
 next=saveFamily(next,raw({kind:'recipe',recipe:'r',portions:5}),now);
 assert.equal(next.stock[0].qty,2.5);assert.equal(next.family[0].total,1250);assert.equal(next.family[0].recipeItems[0].qty,1);
 assert.equal(removeFamily(next,'c').stock[0].qty,3);assert.doesNotThrow(()=>validateFamily(next));
});
test('viandas ya preparadas se asignan a casa sin descontar ingredientes dos veces',()=>{
 const state=fixture(),next=saveFamily(state,raw({kind:'prepared',day:'day:0'}),now);
 assert.deepEqual(next.stock,state.stock);assert.equal(next.family[0].total,1000);assert.deepEqual(next.family[0].consumed,[]);
 assert.ok(next.days[0].id);assert.equal(next.family[0].day,next.days[0].id);assert.equal(familyPortions(next,next.days[0]),4);
 assert.throws(()=>saveFamily(next,raw({id:'c2',kind:'prepared',day:next.days[0].id,portions:2}),now),/Quedan 1/);
 const edit=saveFamily(next,raw({kind:'prepared',day:next.days[0].id,portions:5}),now);assert.equal(familyPortions(edit,edit.days[0]),5);
 const undone=removeFamily(edit,'c');assert.equal(familyPortions(undone,undone.days[0]),0);assert.deepEqual(undone.stock,state.stock);
 assert.doesNotThrow(()=>validateFamily(edit));
});
test('corregir ingredientes aplica diferencias, conserva precios originales y admite cambios de unidad',()=>{
 const state=fixture();let next=saveFamily(state,raw(),now);next.stock[0].cost=9000;
 next=saveFamily(next,raw({items:[{id:'f',qty:500,unit:'g'}]}),now);
 assert.equal(next.stock[0].qty,2.5);assert.equal(next.family[0].total,1250);
 next=changeStockUnit(next,'f','g');assert.doesNotThrow(()=>validateFamily(next));
 next=saveFamily(next,raw({items:[{id:'f',qty:.4,unit:'kg'}]}),now);
 assert.equal(next.stock[0].qty,2600);assert.equal(next.family[0].total,1000);assert.equal(removeFamily(next,'c').stock[0].qty,3000);
});
test('ingredientes repetidos suman el consumo y un error no deja descuentos parciales',()=>{
 const state=fixture(),before=structuredClone(state);
 const next=saveFamily(state,raw({items:[{id:'f',qty:300,unit:'g'},{id:'f',qty:.2,unit:'kg'}]}),now);
 assert.equal(next.stock[0].qty,2.5);assert.equal(next.family[0].consumed.length,1);assert.equal(next.family[0].total,1250);
 assert.throws(()=>saveFamily(state,raw({items:[{id:'f',qty:4,unit:'kg'}]}),now),/No alcanza/);
 assert.deepEqual(state,before);
});
test('rechaza fechas futuras, porciones inválidas y consumo antes de producir',()=>{
 for(const input of [raw({date:'2026-10-20'}),raw({date:'2026-02-30'}),raw({portions:0}),raw({portions:2.5}),raw({items:[{id:'f',qty:2,unit:'ml'}]}),raw({kind:'prepared',day:'day:0',date:'2026-10-18'})])assert.throws(()=>saveFamily(fixture(),input,now));
});
test('copias anteriores siguen siendo válidas; el historial nuevo valida referencias, cantidades y costos',()=>{
 const state=fixture();assert.doesNotThrow(()=>validateFamily(state));
 const next=saveFamily(state,raw(),now);assert.doesNotThrow(()=>validateFamily(next));
 for(const mutate of [s=>s.family.push(structuredClone(s.family[0])),s=>s.family[0].total=5,s=>s.family[0].consumed[0].unit='litro',s=>s.family[0].consumed[0].cost=-1,s=>s.family[0].items=[]]){
  const bad=structuredClone(next);mutate(bad);assert.throws(()=>validateFamily(bad));
 }
 const prepared=saveFamily(state,raw({kind:'prepared',day:'day:0'}),now);prepared.days[0].sold=10;assert.throws(()=>validateFamily(prepared));
});
