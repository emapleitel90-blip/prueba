import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recipeCosts} from '../src/costing.js';
const stock=[{id:'f',unit:'kg',cost:2500,qty:10}];
const recipe=(percent=10)=>({yield:1,overheadPercent:percent,items:[{id:'f',qty:300,unit:'g'}]});
test('300 g a $2500/kg más 10% cuestan $825, con el adicional desglosado',()=>{
 const c=recipeCosts(recipe(),stock);assert.equal(c.ingredients,750);assert.equal(c.extra,75);assert.equal(c.total,825);assert.equal(c.perPortion,825);assert.equal(stock[0].qty,10);
 const batch=recipeCosts({...recipe(),yield:5},stock);assert.equal(batch.ingredientPerPortion,150);assert.equal(batch.extraPerPortion,15);assert.equal(batch.perPortion,165);
});
test('recetas anteriores equivalen a 0%, y se aceptan porcentajes decimales o superiores a 100',()=>{
 const legacy=recipe();delete legacy.overheadPercent;assert.equal(recipeCosts(legacy,stock).perPortion,750);assert.equal(recipeCosts(recipe(0),stock).perPortion,750);
 assert.equal(recipeCosts(recipe(12.5),stock).extra,93.75);assert.equal(recipeCosts(recipe(200),stock).perPortion,2250);
});
test('rechaza porcentajes inválidos, rendimientos imposibles y cálculos fuera del rango numérico',()=>{
 for(const p of [-1,NaN,Infinity,'10',1e308])assert.throws(()=>recipeCosts(recipe(p),stock));
 assert.throws(()=>recipeCosts({...recipe(),yield:0},stock));assert.throws(()=>recipeCosts({...recipe(),items:[]},stock));
 assert.throws(()=>recipeCosts(recipe(),[{...stock[0],cost:Infinity}]));
});
