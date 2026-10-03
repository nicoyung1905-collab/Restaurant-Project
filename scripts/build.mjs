import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=name=>fs.readFile(path.join(root,name),'utf8');
const manifest=JSON.parse(await read('.openai/hosting.json'));
if(!manifest.project_id) console.warn('Local build: Site registration is not present yet.');
const files=['index.html','menu.html','kitchen.html','reports.html','style.css','operations.css','main.js','catalog-data.js','operations.js','kitchen.js','reports.js'];
const assets={};
for(const file of files){const ext=path.extname(file);assets['/'+file]={body:await read(file),type:({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[ext])+'; charset=utf-8'};}
const source=(await read('worker/index.js')).replace("import { MENU, TABLES } from '../data/catalog.js';",'').replace("import { database } from './db.js';",'');
const catalog=(await read('data/catalog.js')).replaceAll('export const','const');
const database=(await read('worker/db.js')).replace('export function','function');
const output=catalog+'\n'+database+'\nconst ASSETS='+JSON.stringify(assets)+';\n'+source;
await fs.mkdir(path.join(root,'dist/server'),{recursive:true});await fs.mkdir(path.join(root,'dist/.openai'),{recursive:true});
await fs.writeFile(path.join(root,'dist/server/index.js'),output);
await fs.writeFile(path.join(root,'dist/.openai/hosting.json'),JSON.stringify(manifest,null,2));
const sqlFiles=(await fs.readdir(path.join(root,'drizzle'))).filter(f=>f.endsWith('.sql'));
await fs.cp(path.join(root,'drizzle'),path.join(root,'dist/drizzle'),{recursive:true});
const worker=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
if(typeof worker.default?.fetch!=='function')throw new Error('Worker fetch export is missing');
for(const [url,asset] of Object.entries(assets)){
 if(!url.endsWith('.html'))continue;
 for(const match of asset.body.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const reference=match[1];if(/^(https?:|data:)/.test(reference))continue;
  if(!assets['/'+reference.replace(/^\//,'')])throw new Error('Broken asset link in '+url+': '+reference);
 }
}
console.log(`Built self-contained Worker: ${files.length} assets, ${sqlFiles.length} D1 migrations, ${Buffer.byteLength(output)} bytes.`);
