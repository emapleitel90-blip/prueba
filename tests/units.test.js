import {test} from 'node:test';
import assert from 'node:assert/strict';
import {convertQuantity,recipeQuantity,changeStockUnit,formatQuantity,inputQuantity} from '../src/units.js';
import {purchaseChanges,packageQuantity} from '../src/purchasing.js';
import {saveFamily,removeFamily,validateFamily} from '../src/family.js';
import {recipeCosts} from '../src/costing.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('gramos y kilos calculan el mismo costo físico en ambas direcciones',()=>{
 for(const grams of [100,200,300,630]){
  close(convertQuantity(grams,'g','kg'),grams/1000);
  close(recipeQuantity({qty:grams,unit:'g'},{unit:'kg'})*2500,grams*2.5);
  close(recipeQuantity({qty:grams/1000,unit:'kg'},{unit:'g'})*2.5,grams*2.5);
 }
 close(convertQuantity(300,'ml','litro')*2000,600);
 assert.equal(convertQuantity(2,'unidad','unidad'),2);
 assert.throws(()=>convertQuantity(100,'g','ml'));
 assert.throws(()=>convertQuantity(Infinity,'g','kg'));
});
test('una conversión de stock conserva el valor y la unidad de todo movimiento anterior',()=>{
 const state={stock:[{id:'f',unit:'kg',qty:2,cost:2500,min:.5}],recipes:[{items:[{id:'f',qty:.3}]}],expenses:[{ingredient:'f',qty:1,total:2500}],days:[{cost:750,consumed:[{id:'f',qty:.3}]}]};
 const before=structuredClone(state),converted=changeStockUnit(state,'f','g');
 assert.deepEqual(state,before);
 assert.equal(converted.stock[0].qty,2000);assert.equal(converted.stock[0].cost,2.5);assert.equal(converted.stock[0].min,500);
 assert.equal(converted.stock[0].qty*converted.stock[0].cost,state.stock[0].qty*state.stock[0].cost);
 assert.deepEqual(converted.recipes[0].items[0],{id:'f',qty:.3,unit:'kg'});
 assert.equal(converted.expenses[0].unit,'kg');assert.equal(converted.days[0].consumed[0].unit,'kg');assert.equal(converted.days[0].cost,750);
 close(recipeQuantity(converted.recipes[0].items[0],converted.stock[0]),300);
 assert.equal(changeStockUnit(converted,'f','kg').stock[0].cost,2500);
 assert.throws(()=>changeStockUnit(state,'f','litro'));
});
test('tres decimales muestran 0,360 kg sin cambiar su valor ni ocultar gramos',()=>{
 assert.equal(formatQuantity(.36,'kg'),'0,360');assert.equal(inputQuantity(.36,'kg'),'0,360');
 assert.equal(formatQuantity(360,'g'),'360');
 assert.equal(inputQuantity(3.921428571,'kg'),'3,921428571');
});

test('cantidades calculadas grandes o pequeñas se pueden volver a ingresar sin notación científica',()=>{
 for(const [quantity,unit] of [[1e21,'kg'],[1e-9,'g'],[.3333333333333333,'kg']]){
  const input=inputQuantity(quantity,unit);
  assert.ok(!/[eE]/.test(input));assert.equal(Number(input.replace(',','.')),quantity);
 }
});

test('corregir botellas a litros convierte recetas, compras y consumos sin cambiar importes históricos',()=>{
 let state={stock:[{id:'oil',name:'Aceite',unit:'unidad',qty:15,cost:900,min:2},{id:'salt',unit:'kg',qty:1,cost:100,min:0}],recipes:[{id:'r',name:'Menú',yield:2,price:2000,overheadPercent:10,items:[{id:'oil',qty:2}]}],expenses:[{id:'p',kind:'stock',ingredient:'oil',qty:5,total:4500,date:'2026-10-23',packages:{count:5,size:1,unit:'unidad'}}],days:[{id:'d',recipe:'r',name:'Menú',date:'2026-10-23',made:2,sold:0,cost:900,price:2000,overheadPercent:10,overheadCost:90,consumed:[{id:'oil',qty:2}]}]};
 const raw={id:'f',kind:'ingredients',date:'2026-10-23',detail:'Cena',portions:4,items:[{id:'oil',qty:1,unit:'unidad'}]};
 state=saveFamily(state,raw,'2026-10-23');
 state=saveFamily(state,{...raw,id:'fr',kind:'recipe',recipe:'r',portions:1},'2026-10-23');
 state=saveFamily(state,{...raw,id:'fp',kind:'prepared',day:'d',portions:1},'2026-10-23');
 const before=structuredClone(state),converted=changeStockUnit(state,'oil','litro',{quantity:900,unit:'ml'});
 assert.deepEqual(state,before);assert.deepEqual(converted.stock[1],state.stock[1]);
 close(converted.stock[0].qty,11.7);close(converted.stock[0].min,1.8);close(converted.stock[0].cost,1000);
 assert.deepEqual(converted.recipes[0].items,[{id:'oil',qty:1.8,unit:'litro'}]);
 close(recipeCosts(converted.recipes[0],converted.stock).perPortion,990);
 assert.equal(converted.expenses[0].qty,4.5);assert.equal(converted.expenses[0].total,4500);assert.equal(converted.expenses[0].date,before.expenses[0].date);
 assert.deepEqual(converted.expenses[0].packages,{count:5,size:.9,unit:'litro'});
 assert.equal(packageQuantity(5,.9,'litro','litro'),converted.expenses[0].qty);
 assert.deepEqual(converted.days[0],{...before.days[0],consumed:[{id:'oil',qty:1.8,unit:'litro'}]});
 for(const entry of converted.family){assert.equal(entry.total,before.family.find(x=>x.id===entry.id).total);for(const item of entry.consumed){assert.equal(item.unit,'litro');close(item.cost,1000)}}
 assert.equal(converted.family[1].recipeItems[0].qty,1.8);assert.doesNotThrow(()=>validateFamily(converted));
 assert.equal(converted.stock[0].unitCorrections.length,1);assert.equal(converted.stock[0].unitCorrections[0].quantity,.9);
 const edited=saveFamily(converted,{...raw,items:[{id:'oil',qty:450,unit:'ml'}]},'2026-10-23');close(edited.stock[0].qty,12.15);close(edited.family[0].total,450);assert.doesNotThrow(()=>validateFamily(edited));
 close(removeFamily(converted,'f').stock[0].qty,12.6);
 const purchase={...converted.expenses[0],qty:5.4,total:5400};
 const [change]=purchaseChanges(converted.stock,purchase,converted.expenses[0]);close(change.qty,12.6);close(change.cost,1000);
 close(purchaseChanges(converted.stock,null,converted.expenses[0])[0].qty,7.2);
 // Cambios posteriores de ml/L y nuevas equivalencias siguen siendo reversibles.
 const ml=changeStockUnit(converted,'oil','ml');assert.doesNotThrow(()=>validateFamily(ml));
 const bottles=changeStockUnit(ml,'oil','unidad',{quantity:1/900,unit:'unidad'});
 close(bottles.stock[0].qty,state.stock[0].qty);close(bottles.stock[0].cost,state.stock[0].cost);assert.doesNotThrow(()=>validateFamily(bottles));
});

test('una equivalencia convierte cantidades antiguas en g/kg y rechaza datos inválidos sin mutar',()=>{
 const state={stock:[{id:'a',unit:'kg',qty:2,cost:2500,min:.5}],recipes:[{items:[{id:'a',qty:300,unit:'g'},{id:'a',qty:.2}]}],expenses:[{ingredient:'a',qty:500,unit:'g',total:1250,packages:{count:2,size:250,unit:'g'}}],days:[]};
 const next=changeStockUnit(state,'a','litro',{quantity:2,unit:'litro'});
 close(next.recipes[0].items[0].qty,.6);close(next.recipes[0].items[1].qty,.4);assert.equal(next.expenses[0].qty,1);assert.equal(next.expenses[0].packages.size,.5);
 const before=structuredClone(state);
 for(const equivalence of [undefined,{quantity:0,unit:'litro'},{quantity:-1,unit:'litro'},{quantity:Infinity,unit:'litro'},{quantity:1,unit:'kg'},{quantity:1e308,unit:'litro'},{quantity:1e-320,unit:'litro'}]){assert.throws(()=>changeStockUnit(state,'a','litro',equivalence));assert.deepEqual(state,before)}
 const overflow=structuredClone(state);overflow.recipes[0].items[0].qty=1e308;
 assert.throws(()=>changeStockUnit(overflow,'a','litro',{quantity:1000000,unit:'litro'}));
});
