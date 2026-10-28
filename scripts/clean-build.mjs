import {rmSync} from 'node:fs';
// Only disposable build output; never touch source or browser data.
rmSync(new URL('../dist/',import.meta.url),{recursive:true,force:true});
