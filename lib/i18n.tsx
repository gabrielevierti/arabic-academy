/** Italian-only product. The union remains for archived content tooling;
 * previous English preferences never affect the active application. */
export type Language = 'it' | 'en';
export function useLanguage():Language{return 'it'}
export function tr(text:string):string{return text}
document.documentElement.lang='it';
document.title='Arabo da Zero · Arabo per la vita e il lavoro';
