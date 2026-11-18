// Stage the verified authored pack. UI bindings and flight scripts remain canonical source.
import fs from 'node:fs';
for(const kind of ['behavior','resource'])fs.cpSync('cessna172s/'+kind+'_packs','.runtime/g5-transform-prototype/'+kind+'_packs',{recursive:true});
console.log('Staged verified G5 pack.');
