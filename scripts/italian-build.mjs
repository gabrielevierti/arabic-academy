import {rmSync} from 'node:fs';
// Archived English sources remain available to maintainers, never deployed.
for(const path of ['dist/course/en','dist/study/en'])rmSync(path,{recursive:true,force:true});
