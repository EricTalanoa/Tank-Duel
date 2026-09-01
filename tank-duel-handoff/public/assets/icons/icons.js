/* Tank Duel — ammunition icon set
   24x24 grid · stroke-only · currentColor · 1.75 stroke · round caps/joins
   Shared motifs: a ground line at y≈19.5 for every shell whose defining trait is
   terrain interaction; a shell silhouette for pure ballistic shells. */

const ICONS = {

  he: `<path d="M12 2.5c2.1 2.4 3.1 4.9 3.1 7.4v6.4H8.9V9.9c0-2.5 1-5 3.1-7.4z"/>
       <path d="M8.9 16.3 6.2 20.5M15.1 16.3l2.7 4.2"/>
       <path d="M9.4 20.5h5.2"/>`,

  mortar: `<path d="M12 3.4c2.6 2.4 3.9 4.7 3.9 7.1v5.8H8.1v-5.8c0-2.4 1.3-4.7 3.9-7.1z"/>
           <path d="M8.1 16.3 5.2 20.5M15.9 16.3l2.9 4.2"/>
           <path d="M9.6 9.6 12 12l2.4-2.4"/>
           <path d="M9.6 13 12 15.4l2.4-2.4"/>`,

  cluster: `<circle cx="12" cy="4.6" r="1.7"/>
            <path d="M10.7 6.1 6.6 15.6M11.5 6.4 9.6 16.4M12 6.4v10.2M12.5 6.4l1.9 10M13.3 6.1l4.1 9.5"/>
            <path d="M2.5 19.8h19"/>`,

  buster: `<path d="M12 2.2v5.6"/>
           <path d="M8.8 6.6 12 10l3.2-3.4"/>
           <path d="M2.5 11.4h6.4M15.1 11.4h6.4"/>
           <path d="M12 12.8v2.6M12 17.4v3"/>`,

  roller: `<path d="M2.5 7.4 21.5 18.6"/>
           <circle cx="15.2" cy="13.3" r="2.7"/>
           <path d="M7.4 9.4 9.8 10.8M10.2 7.6 12.3 8.8"/>`,

  sand: `<rect x="3.4" y="13.7" width="8.1" height="4.7" rx="2.35"/>
         <rect x="12.5" y="13.7" width="8.1" height="4.7" rx="2.35"/>
         <rect x="7.9" y="8.5" width="8.1" height="4.7" rx="2.35"/>
         <path d="M2.5 20.4h19"/>`,

  skipper: `<path d="M2.5 19.5h19"/>
            <path d="M3 19.5C4.3 9.2 7.6 9.2 8.9 19.5"/>
            <path d="M8.9 19.5C10 12.6 12.7 12.6 13.8 19.5"/>
            <path d="M13.8 19.5C14.7 15.2 16.8 15.2 17.7 19.5"/>`,

  airburst: `<path d="M7.4 6.4 12 2.2l4.6 4.2"/>
             <path d="M6 9.4v6.2M12 8.4v7.2M18 9.4v6.2"/>
             <path d="M4.4 14 6 15.8 7.6 14M10.4 14 12 15.8 13.6 14M16.4 14 18 15.8 19.6 14"/>
             <path d="M2.5 19.5h19"/>`,

  drill: `<path d="M12 2.2v4.6"/>
          <path d="M9.8 5 12 7.2 14.2 5"/>
          <path d="M2.5 9.6h7M14.5 9.6h7"/>
          <path d="M9.6 9.6v7.8l2.4 4.2 2.4-4.2V9.6"/>
          <path d="M9.6 12.7h4.8M9.6 15.4h4.8"/>`,

  mirv: `<circle cx="12" cy="3" r="1.4"/>
         <path d="M12 4.5 7.4 8.8M12 4.5v4.3M12 4.5l4.6 4.3"/>
         <path d="M7.4 8.8 5 15.4M7.4 8.8v6.6M7.4 8.8 9.8 15.4"/>
         <path d="M12 8.8 9.8 15.4M12 8.8v6.6M12 8.8l2.2 6.6"/>
         <path d="M16.6 8.8 14.2 15.4M16.6 8.8v6.6M16.6 8.8 19 15.4"/>
         <path d="M2.5 19.5h19"/>`,

  napalm: `<path d="M12 2.8c3.1 3.5 4.6 6.1 4.6 8.4a4.6 4.6 0 0 1-9.2 0c0-1.7.7-3.2 2.1-4.7.4 1.4 1 2.3 2 2.8-.3-2.2.5-4.4 2.5-6.5z"/>
           <path d="M5.6 19.6c0-1.6.9-2.8 2.2-3.4M18.4 19.6c0-1.6-.9-2.8-2.2-3.4"/>
           <path d="M2.5 19.6h19"/>`,

  anvil: `<path d="M4.4 11.2h13.1c1.9 0 3.2 1.2 4 3-2.6-.6-4.2.1-5.6 1.4H8.6c-2.6 0-4.2-1.7-4.2-4.4z"/>
          <path d="M10.2 15.6v2.4M13.8 15.6v2.4"/>
          <path d="M7.6 18h8.8"/>
          <path d="M8.4 6.2v-3M12 5v-2.6M15.6 6.2v-3"/>`,

  repair: `<rect x="2.8" y="7.4" width="18.4" height="12.2" rx="2.2"/>
           <path d="M8.8 7.4V6a1.6 1.6 0 0 1 1.6-1.6h3.2A1.6 1.6 0 0 1 15.2 6v1.4"/>
           <path d="M12 10.4v6.2M8.9 13.5h6.2"/>`
};

const ICON_META = {
  he:'Shell silhouette with fins — the baseline everything else is read against',
  mortar:'Same silhouette, heavier body, two descending chevrons for mass 1.55',
  cluster:'Apex node fanning into five diverging submunitions',
  buster:'Nose entering a broken ground line, shaft continuing below',
  roller:'A ball on a slope with motion marks up-hill behind it',
  sand:'Three stacked bags on the ground line — the only additive shell',
  skipper:'Three diminishing hops along the ground line',
  airburst:'Burst chevron above, three bomblets falling vertically',
  drill:'Drill bit with flutes and a pointed tip below a broken ground line',
  mirv:'A two-stage fork: one node to three, three to nine',
  napalm:'Flame with side flares sitting on the ground line',
  anvil:'An anvil on its base with speed marks above — the only shell that falls vertically',
  repair:'Field case with a cross — the only non-ordnance item'
};

function iconSVG(id, size){
  const s = size || 24;
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor"
  stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
  xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${ICONS[id]}</svg>`;
}

if (typeof module !== 'undefined') module.exports = { ICONS, ICON_META, iconSVG };
