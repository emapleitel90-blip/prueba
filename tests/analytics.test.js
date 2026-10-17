import {test} from 'node:test';
import assert from 'node:assert/strict';
import {report,advice,previousMonth} from '../src/analytics.js';
const day=(date,overrides={})=>({date,recipe:'a',name:'Milanesa',made:20,sold:18,price:6000,cost:2000,...overrides});
const expense=(date,kind,total,category)=>({date,kind,total,category});
test('separa resultado de caja y costo de compras sin doble descuento',()=>{
 const r=report({days:[day('2026-09-10'),day('2026-10-10'),day('2026-11-10')],expenses:[expense('2026-10-10','stock',100000,'Carnes'),expense('2026-10-11','other',5000,'Gas'),expense('2026-09-10','other',3000)]},'2026-10','2026-10-17');
 assert.equal(r.sales,108000);assert.equal(r.production,40000);assert.equal(r.other,5000);assert.equal(r.profit,63000);assert.equal(r.outflow,105000);assert.equal(r.cash,3000);assert.equal(r.sold,18);assert.equal(r.left,2);assert.equal(r.menus[0].contribution,68000);assert.equal(r.sellThrough,.9);
});
test('compara mes actual hasta igual día, no contra el mes anterior entero',()=>{
 const r=report({days:[day('2026-09-10'),day('2026-09-20'),day('2026-10-10'),day('2026-10-18')],expenses:[expense('2026-09-20','other',5000)]},'2026-10','2026-10-17');assert.equal(r.previous.sold,18);assert.equal(r.sold,18);assert.equal(r.previous.other,0);assert.match(r.comparisonLabel,/1 al 17/);
});
test('meses cerrados comparan completos y el calendario maneja enero y febrero bisiesto',()=>{
 assert.equal(previousMonth('2026-01'),'2025-12');const r=report({days:[day('2024-02-29'),day('2024-03-30'),day('2024-03-31')],expenses:[]},'2024-03','2024-03-31');assert.equal(r.previous.sold,18);assert.equal(r.sold,36);assert.equal(r.trend.length,6);assert.equal(r.trend[0].month,'2023-10');
});
test('sin ventas no hay divisiones por cero y sobrantes conservan costo',()=>{
 const r=report({days:[day('2026-10-10',{sold:0})],expenses:[]},'2026-10','2026-10-17');assert.equal(r.margin,null);assert.equal(r.menus[0].perSold,null);assert.equal(r.profit,-40000);assert.equal(r.left,20);assert.ok(advice(r).some(a=>a.title==='Todavía hay pocos datos'));assert.ok(advice(r).some(a=>a.title.includes('Revisar')));
});
test('distingue ausencia de registros, crecimiento por día y muestras insuficientes',()=>{
 assert.equal(advice(report({days:[],expenses:[]},'2026-10','2026-10-17'))[0].title,'Empezá con un registro diario');
 const days=[1,2,3].flatMap(d=>[day(`2026-10-0${d}`),day(`2026-09-0${d}`,{sold:10})]);const r=report({days,expenses:[]},'2026-10','2026-10-17');assert.ok(advice(r).some(a=>a.title==='Más ventas por día registrado'));assert.ok(!advice(r).some(a=>a.title.startsWith('Probar una preventa')));
});
test('compara menús por contribución por vendida con muestra mínima y gastos por categoría',()=>{
 const days=[day('2026-10-01'),day('2026-10-02'),day('2026-10-03',{recipe:'b',name:'Canelones',cost:1000}),day('2026-10-04',{recipe:'b',name:'Canelones',cost:1000})];const r=report({days,expenses:[expense('2026-10-10','stock',100,'Verduras'),expense('2026-10-11','stock',250,'Verduras')]},'2026-10','2026-10-17');assert.equal(r.menus[0].name,'Canelones');assert.ok(advice(r).some(a=>a.title==='Probar una preventa de Canelones'));assert.equal(r.categories[0][1],350);
});
