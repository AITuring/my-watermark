import sharp from 'sharp';
import {mkdir, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const source = process.argv[2];
if (!source) throw Error('Usage: node scripts/prepare-watermark-review.mjs /path/to/materials');
const output = path.resolve('.watermark-review.local');
await mkdir(path.join(output,'inputs'),{recursive:true});
const names = (await readdir(source)).filter(name=>/\.(jpe?g|png|webp)$/i.test(name)).sort();
const materials=[];
const tiles=[];
for (const [index,name] of names.entries()) {
    const filename=String(index+1).padStart(2,'0')+'.jpg';
    const metadata=await sharp(path.join(source,name),{limitInputPixels:false}).metadata();
    const info=await sharp(path.join(source,name),{limitInputPixels:false})
        .rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true})
        .jpeg({quality:94}).toFile(path.join(output,'inputs',filename));
    const preview=await sharp(path.join(output,'inputs',filename)).resize({width:260,height:214,fit:'contain',background:'#ebe7df'}).toBuffer();
    const label=Buffer.from(`<svg width="260" height="28"><rect width="260" height="28" fill="#ebe7df"/><text x="10" y="20" font-size="14" fill="#36332e">${index+1} · ${metadata.width} × ${metadata.height}</text></svg>`);
    const tile=await sharp({create:{width:260,height:242,channels:3,background:'#ebe7df'}}).composite([{input:preview,top:0,left:0},{input:label,top:214,left:0}]).png().toBuffer();
    tiles.push({input:tile,left:(index%4)*260,top:Math.floor(index/4)*242});
    materials.push({id:index+1,name,sourceWidth:metadata.width,sourceHeight:metadata.height,
        width:info.width,height:info.height,url:`/.watermark-review.local/inputs/${filename}`});
}
await writeFile(path.join(output,'materials.json'),JSON.stringify(materials,null,2));
await sharp({create:{width:1040,height:Math.ceil(names.length/4)*242,channels:3,background:'#ebe7df'}}).composite(tiles).jpeg({quality:90}).toFile(path.join(output,'source-contact.jpg'));
console.log(JSON.stringify({count:materials.length,output,fullFrames:true,previewLongEdge:2000}));
