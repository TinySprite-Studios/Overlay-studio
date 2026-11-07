/* Scene controls retain their original inputs and values when categories change. */
(() => {
  const categories={
    general:['General','General Settings','Core scene options, text and colour.'],
    socials:['Socials','Social Accounts','Choose the handles and links shown in this scene.'],
    icons:['Platform Icons','Platform Icons','Choose which platform icons appear on your scene.'],
    labels:['Labels','Social Labels','Show or hide the labels beside your social icons.'],
    advanced:['Advanced','Advanced Settings','Layout, background, timing and audio.']
  };
  const paths={
    general:'<path d="m9 3 1-2h4l1 2 2 1 2-.2 2 3-1 2v3l1 2-2 3-2-.2-2 1-1 2h-4l-1-2-2-1-2 .2-2-3 1-2V9L3 7l2-3 2 .2Z"/><circle cx="12" cy="10.5" r="3"/>',
    socials:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m9 10 6-4M9 14l6 4"/>',
    icons:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    labels:'<path d="m2 19 6-14 6 14M4 14h8m9-3v8m0-6c-6-5-9 9 0 4"/>',
    advanced:'<path d="M3 5h18M3 12h18M3 19h18M8 2v6m8 1v6M7 16v6"/>',
    flame:'<path d="M13 2c2 7-5 7-3 12-3-1-3-4-3-4-5 5-2 12 5 12S23 12 17 7c0 4-2 5-2 5s2-5-2-10Z"/>',
    facebook:'<path fill="currentColor" stroke="none" d="M14 22v-9h3l.5-4H14V7c0-1 .4-2 2-2h2V1h-3c-4 0-5 2-5 6v2H7v4h3v9Z"/>',
    youtube:'<rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" stroke="none"/><path d="m10 9 6 3-6 3Z" fill="#17191d" stroke="none"/>',
    twitter:'<path fill="currentColor" stroke="none" d="M23 4a9 9 0 0 1-3 1 5 5 0 0 0-8 5A14 14 0 0 1 2 5s-3 5 2 8l-2-1c0 3 2 4 4 5l-2 0c1 2 3 3 5 3-3 2-6 2-8 1 15 7 21-6 20-13Z"/>',
    copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    picker:'<path d="m15 3 6 6m-4-4L5 17l-2 4 4-2L19 7"/>'
  };
  const icon=name=>{
    const element=document.createElement('span');element.className='scene-control-icon';element.setAttribute('aria-hidden','true');
    element.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||paths.general)+'</svg>';
    return element;
  };
  let selected='general',sceneKey,controls=[];
  function groupFor(field) {
    if(Object.hasOwn(categories,field.group))return field.group;
    const text=(field.key+' '+(field.label||'')).toLowerCase();
    if(field.type==='boolean'&&/icon/.test(text))return 'icons';
    if(field.type==='boolean'&&/label/.test(text))return 'labels';
    if(/handle|social|facebook|youtube|twitter|twitch|instagram|tiktok|discord/.test(text))return 'socials';
    return 'general';
  }
  function decorate(label,input,field) {
    if(!label.dataset.decorated) {
      label.dataset.decorated='true';
      const title=document.createElement('span');title.className='scene-field-title';
      for(const node of [...label.childNodes])if(node.nodeType===Node.TEXT_NODE)title.append(node);
      label.prepend(title);
      input.setAttribute('aria-label',title.textContent.trim());
      if(input.type==='checkbox') {
        label.classList.add('scene-toggle');input.setAttribute('role','switch');
        const text=(field.key+' '+(field.label||title.textContent)).toLowerCase();
        const name=/label/.test(text)?'labels':['facebook','youtube','twitter'].find(name=>text.includes(name)) || (/ember|animat/.test(text)?'flame':'socials');
        label.prepend(icon(name));
      }
      if(input.type==='color') {
        const control=document.createElement('span');control.className='scene-colour-control';
        const hex=document.createElement('output');
        const choose=document.createElement('button');choose.type='button';choose.title='Choose '+title.textContent.toLowerCase();choose.setAttribute('aria-label',choose.title);choose.append(icon('picker'));
        choose.onclick=()=>input.click();input.after(control);control.append(input,hex,choose);
        input.addEventListener('input',()=>{hex.value=input.value.toUpperCase();});
      }
    }
    if(input.type==='color')label.querySelector('output').value=input.value.toUpperCase();
  }
  function show(category) {
    selected=category;
    const visible=group=>group===category || (category==='general'&&['icons','labels'].includes(group));
    for(const control of controls)control.element.hidden=!control.available||!visible(control.group);
    for(const button of $('scene-settings-nav').children){const active=button.dataset.category===category;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
    $('scene-settings-title').textContent=categories[category][1];
    $('scene-settings-description').textContent=categories[category][2];
    $('scene-settings-content').scrollTop=0;
  }
  function update(scene) {
    const key=state.root+'|'+scene.id;
    if(key!==sceneKey){selected='general';sceneKey=key;}
    controls=[];
    const custom=scene.config.type==='custom', native=$('scene-form').querySelector('.form-grid');
    const audio=['audio','audioVolume','audioDelay'];
    for(const element of native.children) {
      const input=element.querySelector('input,select,textarea'),name=input?.name;
      const group=['channel','social'].includes(name)?'socials':['title','subtitle','accent','base','animate'].includes(name)?'general':'advanced';
      const available=!custom&&(scene.external?['accent',...audio].includes(name):scene.portrait?['name',...audio].includes(name):true);
      // Audio actions and their guidance travel with the audio controls.
      const allowed=available||(!custom&&element.classList.contains('audio-setting')&&!input)||(!custom&&element.classList.contains('audio-help'));
      if(input){input.disabled=!allowed;decorate(element,input,{key:name});}
      controls.push({element,group,available:allowed});
    }
    for(const label of $('scene-custom-settings').children) {
      const input=label.querySelector('[data-setting]');
      const field=scene.config.fields.find(field=>field.key===input.dataset.setting);
      const group=groupFor(field);
      decorate(label,input,field);label.classList.toggle('scene-toggle-wide',input.type==='checkbox'&&group==='general');
      controls.push({element:label,group,available:true});
    }
    // Place paired platform switches together, with text/colour options first.
    const customFields=$('scene-custom-settings');
    const order=label=>label.classList.contains('scene-toggle')?1:0;
    [...customFields.children].sort((a,b)=>order(a)-order(b)).forEach(label=>customFields.append(label));
    for(const help of $('scene-settings-content').querySelectorAll(':scope > .field-help'))controls.push({element:help,group:'advanced',available:help.id==='portrait-help'?!!scene.portrait:!custom&&!scene.external});
    for(const button of $('scene-settings-nav').children) {
      const category=button.dataset.category;
      button.disabled=category!=='general'&&!controls.some(control=>control.available&&control.group===category);
    }
    if($('scene-settings-nav').querySelector('[data-category="'+selected+'"]').disabled)selected='general';
    show(selected);
  }
  for(const [key,[name]] of Object.entries(categories)) {
    const button=document.createElement('button');button.type='button';button.dataset.category=key;button.setAttribute('aria-controls','scene-settings-content');
    button.append(icon(key),document.createTextNode(name));button.onclick=()=>show(key);$('scene-settings-nav').append(button);
  }
  for(const [id,name] of [['scene-vertical','copy'],['scene-duplicate','copy'],['scene-delete','trash']])$(id).prepend(icon(name));
  window.sceneSettings={update,revealInvalid(){
    const invalid=$('scene-form').querySelector(':invalid');
    if(invalid){const control=controls.find(control=>control.element.contains(invalid));if(control)show(control.group);}
  }};
})();
