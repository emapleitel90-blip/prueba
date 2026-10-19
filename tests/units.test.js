import {test} from 'node:test';
import assert from 'node:assert/strict';
import {convertQuantity,recipeQuantity,changeStockUnit,formatQuantity,inputQuantity} from '../src/units.js';
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
