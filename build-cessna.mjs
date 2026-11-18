// Refresh release metadata without regenerating verified scripts, UI, or geometry.
import fs from 'node:fs';
const version=[2,8,5];
for(const kind of ['behavior','resource']) {
 const p='cessna172s/'+kind+'_packs/skyhawk/manifest.json',m=JSON.parse(fs.readFileSync(p));
 m.header.version=version;m.header.name='Cessna 172S V2.8.5 - G5 and Seat Attachment';
 for(const module of m.modules)module.version=version;
 for(const dependency of m.dependencies??[])if(dependency.uuid)dependency.version=version;
 fs.writeFileSync(p,JSON.stringify(m,null,2)+'\n');
}
console.log('Updated 2.8.5 release metadata. Authored assets preserved.');
