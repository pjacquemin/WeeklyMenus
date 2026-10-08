const samples = [
  ['Risotto aux champignons','Végétarien',35,['160 g de riz arborio','250 g de champignons','1 oignon','600 ml de bouillon','40 g de parmesan']],
  ['Poulet citron & herbes','Viande',40,['2 filets de poulet','1 citron','400 g de pommes de terre','2 branches de thym','2 c. à soupe d’huile d’olive']],
  ['Curry de pois chiches','Végétarien',25,['250 g de pois chiches cuits','200 ml de lait de coco','150 g de riz','1 c. à soupe de curry','150 g d’épinards']],
  ['Saumon & légumes rôtis','Poisson',30,['2 pavés de saumon','2 carottes','1 courgette','1 citron','2 c. à soupe d’huile d’olive']],
  ['Pâtes au pesto maison','Végétarien',20,['200 g de pâtes','1 bouquet de basilic','30 g de pignons','40 g de parmesan','3 c. à soupe d’huile d’olive']],
  ['Tarte aux légumes','Végétarien',45,['1 pâte brisée','2 courgettes','2 tomates','2 œufs','150 ml de crème']],
  ['Boulettes & sauce tomate','Viande',35,['300 g de viande hachée','400 g de tomates concassées','1 oignon','1 œuf','150 g de pâtes']],
  ['Dahl de lentilles corail','Végétarien',30,['180 g de lentilles corail','200 ml de lait de coco','1 oignon','1 c. à café de cumin','150 g de riz']],
  ['Omelette aux fines herbes','Végétarien',15,['4 œufs','1 bouquet de ciboulette','100 g de salade','20 g de beurre']]
].map(([name,category,time,ingredients],i)=>({id:`sample-${i}`,name,category,time,ingredients,servings:2,instructions:''}));
const $ = id => document.getElementById(id);
let recipes=[], plans={}, revision=0, confirmed=null, saving=false;
const aisles=['vins/alcools','tapas','fruits','légumes','viande','boulangerie','charcuterie','fromagerie','oeufs','produits laitiers','café / thé / sucrerie','chocolaterie','collations/biscuits','petit déjeuner','épicerie / huiles / vinaigre','sauces','produits pour la pâtisserie','Conserves / bocaux','Riz / couscous / lentilles','Spaghetti / pâtes','épicerie italienne','essuie-tout / papier toilette / papier cuisine / sacs','laiterie','soda','eaux','bières','légumes surgelés','poissons surgelés','pizzas surgelées','croquettes / frites','chips / biscuits apéro / olives','glaces','Fruits secs',"produits d'entretien",'hygiène','À classer'].map(name=>name.charAt(0).toLocaleUpperCase('fr')+name.slice(1));
const aisleLabelText=name=>name.charAt(0).toLocaleUpperCase('fr')+name.slice(1);
function aisleOptionsHtml(current='À classer'){
  current=aisleLabelText(current);
  const options=aisles.includes(current)?aisles:[...aisles,current];
  return options.map(name=>`<option value="${escapeHtml(name)}"${name===current?' selected':''}>${escapeHtml(name)}</option>`).join('');
}
const ingredientKey=name=>name.trim().replace(/^(?:de\s+|d[’'])/i,'').toLocaleLowerCase('fr').replace(/\s+/g,' ');
const ingredientText=item=>typeof item==='string'?item:[item.quantity,item.name].filter(Boolean).join(' ');
const monday=new Date();monday.setHours(12,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
let week=new Date(monday), pickedDay=null, toastTimer;
const dateKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const getPlan=()=>Array.isArray(plans[dateKey(week)])?plans[dateKey(week)]:[];
function notify(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3500);}
async function save(){
  saving=true;setBusy(true);$('storage-label').textContent='Enregistrement…';
  try{const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipes,plans,revision})});const result=await response.json();if(!response.ok)throw new Error(result.error);revision=result.revision;confirmed=structuredClone({recipes,plans});$('storage-label').textContent='Enregistré dans la base SQLite';return true;}
  catch(error){if(confirmed){recipes=structuredClone(confirmed.recipes);plans=structuredClone(confirmed.plans);}renderWeek();renderRecipes();$('storage-label').textContent='Échec de l’enregistrement';notify(error.message||'Enregistrement impossible. Réessayez.');return false;}
  finally{saving=false;setBusy(false);}
}
function setBusy(busy){document.querySelectorAll('main button, nav button, #picker button, #recipe-form input, #recipe-form textarea, #recipe-form select, #ingredient-manager input, #ingredient-manager select').forEach(element=>element.disabled=busy);if(!busy)$('generate').disabled=recipes.length===0;}
async function load(){
  setBusy(true);$('storage-label').textContent='Chargement de la base…';
  try{const response=await fetch('/api/state');if(!response.ok)throw new Error('Base indisponible');const state=await response.json();revision=state.revision;
    if(state.initialized){recipes=state.recipes;plans=state.plans;confirmed=structuredClone({recipes,plans});}
    else{let legacy=null;try{legacy=JSON.parse(localStorage.getItem('weeklymenus-v1'));}catch{throw new Error('Les données locales ne peuvent pas être lues. Elles restent conservées.');}recipes=legacy?.recipes??samples;plans=legacy?.plans??{};if(!await save())return;}
    $('storage-label').textContent='Enregistré dans la base SQLite';renderWeek();renderRecipes();setBusy(false);
  }catch(error){$('storage-label').textContent='Base indisponible — rechargez la page';notify(error.message);}
}
function show(view){for(const name of ['week','recipes','ingredients','editor'])$(`${name}-view`).hidden=name!==view;document.querySelectorAll('nav button').forEach(button=>button.classList.toggle('active',button.dataset.view===(view==='editor'?'recipes':view)));if(view==='recipes')renderRecipes();if(view==='ingredients')renderIngredients();window.scrollTo({top:0});}
function renderWeek(){const end=new Date(week);end.setDate(end.getDate()+6);const format={day:'numeric',month:'long'};$('week-label').textContent=`${week.toLocaleDateString('fr-FR',format)} – ${end.toLocaleDateString('fr-FR',{...format,year:'numeric'})}`;const plan=getPlan();let count=0;$('days').innerHTML=Array.from({length:7},(_,index)=>{const date=new Date(week);date.setDate(date.getDate()+index);const recipe=recipes.find(r=>r.id===plan[index]);if(recipe)count++;return `<div class="day ${dateKey(date)===dateKey(new Date())?'today':''}"><div class="day-name">${date.toLocaleDateString('fr-FR',{weekday:'long'})}<span class="day-date">${date.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</span></div><div>${recipe?`<button class="meal-title" data-edit="${escapeHtml(recipe.id)}">${escapeHtml(recipe.name)}</button><div class="meal-meta"><span class="category-dot ${escapeHtml(recipe.category)}"></span>${escapeHtml(recipe.category)} <span>· ${escapeHtml(recipe.servings)} portions</span></div>`:`<button class="meal-title" data-pick="${index}">Choisir un repas</button><div class="meal-meta">Une place pour vos envies</div>`}</div><span class="time">${recipe?`${escapeHtml(recipe.time)} min`:'—'}</span><button class="change" data-pick="${index}" aria-label="Choisir le repas du ${date.toLocaleDateString('fr-FR',{weekday:'long'})}">↻</button></div>`;}).join('');$('week-summary').textContent=`${count} / 7 repas prévus`;$('recipe-count').textContent=String(recipes.length).padStart(2,'0');$('ingredient-count').textContent=String(ingredientCatalog().length).padStart(2,'0');$('generate').disabled=recipes.length===0;}
function renderRecipes(){const query=$('search').value.toLocaleLowerCase('fr');const category=$('category-filter').value;const filtered=recipes.filter(r=>(!category||r.category===category)&&`${r.name} ${r.ingredients.map(ingredientText).join(' ')}`.toLocaleLowerCase('fr').includes(query));$('recipes').innerHTML=filtered.length?filtered.map(r=>`<article class="recipe-item"><h2>${escapeHtml(r.name)}</h2><div class="meal-meta"><span class="category-dot ${escapeHtml(r.category)}"></span>${escapeHtml(r.category)} <span>· ${escapeHtml(r.time)} min · ${escapeHtml(r.servings)} portions</span></div><p>${r.ingredients.slice(0,3).map(item=>escapeHtml(ingredientText(item))).join(' · ')}${r.ingredients.length>3?'…':''}</p><button class="text-button" data-edit="${escapeHtml(r.id)}">Voir et modifier la recette →</button></article>`).join(''):`<div class="empty">${recipes.length?'Aucune recette ne correspond. Essayez un autre nom ou ingrédient.':'Votre carnet est vide. Ajoutez une première recette pour composer votre semaine.'}</div>`;}
function edit(id){const recipe=recipes.find(r=>r.id===id);const form=$('recipe-form');form.reset();for(const key of ['id','name','category','time','servings','instructions']){if(recipe)form.elements[key].value=recipe[key]??'';}form.elements.id.value=recipe?.id||'';$('ingredient-list').replaceChildren();(recipe?.ingredients.length?recipe.ingredients:['']).forEach(addIngredient);$('editor-title').textContent=recipe?'Une recette à garder.':'Une nouvelle recette.';$('delete').hidden=!recipe;show('editor');form.elements.name.focus();}
function openPicker(index){pickedDay=index;$('picker-list').innerHTML=recipes.length?recipes.map(r=>`<button data-choose="${escapeHtml(r.id)}"><span>${escapeHtml(r.name)}</span><small>${escapeHtml(r.time)} min</small></button>`).join(''):'<p>Ajoutez une recette à votre collection pour choisir un repas.</p>';$('picker').showModal();}
document.querySelectorAll('nav button').forEach(button=>button.onclick=()=>show(button.dataset.view));
$('generate').onclick=async()=>{const pool=[...recipes];for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const lastUsed=new Map();
  for(const [start,meals] of Object.entries(plans)){
    if(start>=dateKey(week))continue;
    meals.forEach((id,index)=>{
      if(!id)return;
      const day=new Date(`${start}T12:00:00`);day.setDate(day.getDate()+index);
      const used=dateKey(day);
      if(!lastUsed.has(id)||used>lastUsed.get(id))lastUsed.set(id,used);
    });
  }
  pool.sort((a,b)=>(lastUsed.get(a.id)||'').localeCompare(lastUsed.get(b.id)||''));
  plans[dateKey(week)]=Array.from({length:7},(_,i)=>pool[i%pool.length].id);if(!await save())return;renderWeek();const planning=document.querySelector('.planning');planning.classList.remove('changed');void planning.offsetWidth;planning.classList.add('changed');notify(recipes.length<7?'Semaine générée. Certaines recettes reviennent : votre collection contient moins de sept recettes.':'Votre semaine est prête. À table !');};
$('previous').onclick=()=>{week.setDate(week.getDate()-7);renderWeek();};$('next').onclick=()=>{week.setDate(week.getDate()+7);renderWeek();};
$('browse').onclick=()=>show('recipes');$('add').onclick=$('add-from-week').onclick=()=>edit();$('back').onclick=$('cancel').onclick=()=>show('recipes');$('search').oninput=renderRecipes;$('category-filter').onchange=renderRecipes;
document.addEventListener('click',async event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.edit)edit(button.dataset.edit);if(button.dataset.pick!==undefined)openPicker(Number(button.dataset.pick));if(button.dataset.choose){const plan=[...getPlan()];plan[pickedDay]=button.dataset.choose;plans[dateKey(week)]=plan;if(!await save())return;renderWeek();$('picker').close();notify('Le repas a été remplacé.');}});
$('close-picker').onclick=()=>$('picker').close();$('picker').addEventListener('click',event=>{if(event.target===$('picker')){const rect=$('picker').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('picker').close();}});
$('recipe-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;const ingredients=Array.from($('ingredient-list').children,row=>({quantity:row.querySelector('[data-quantity]').value.trim(),name:row.querySelector('[data-ingredient]').value.trim(),category:row.querySelector('[data-aisle]').value.trim()||'À classer'})).filter(Boolean);const name=form.elements.name.value.trim();if(!name||!ingredients.length){notify('Ajoutez un nom et au moins un ingrédient.');return;}const categories=new Map(ingredients.map(item=>[ingredientKey(item.name),item.category]));for(const existing of recipes)for(const item of existing.ingredients)if(typeof item==='object'&&categories.has(ingredientKey(item.name)))item.category=categories.get(ingredientKey(item.name));const recipe={id:form.elements.id.value||crypto.randomUUID(),name,category:form.elements.category.value,time:Number(form.elements.time.value),servings:Number(form.elements.servings.value),ingredients,instructions:form.elements.instructions.value.trim()};const index=recipes.findIndex(r=>r.id===recipe.id);if(index<0)recipes.push(recipe);else recipes[index]=recipe;if(!await save())return;renderWeek();show('recipes');notify('La recette a été enregistrée.');};
$('delete').onclick=async()=>{const id=$('recipe-form').elements.id.value;const recipe=recipes.find(r=>r.id===id);if(!confirm(`Supprimer « ${recipe.name} » ? Les repas correspondants seront retirés des plannings.`))return;recipes=recipes.filter(r=>r.id!==id);for(const key of Object.keys(plans))if(Array.isArray(plans[key]))plans[key]=plans[key].map(value=>value===id?null:value);if(!await save())return;renderWeek();show('recipes');notify('La recette a été supprimée.');};
renderWeek();load();

function addIngredient(value=''){
  const row=document.createElement('li');row.className='ingredient-row';
  // Les anciennes recettes gardent leur texte si la quantité n'est pas reconnue.
  const parts=typeof value==='string'?value.match(/^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?(?:\s+(?:kg|g|mg|ml|cl|l|c\. à soupe|c\. à café|branches?|bouquets?|filets?|pavés?))?)\s+(.+)$/i):null;
  const quantity=document.createElement('input');quantity.type='text';quantity.value=typeof value==='object'?value.quantity:parts?parts[1]:'';quantity.placeholder='Ex. : 160 g';quantity.dataset.quantity='';quantity.maxLength=60;
  const input=document.createElement('input');input.type='text';input.value=typeof value==='object'?value.name:parts?parts[2]:value;input.placeholder='Ex. : riz arborio';input.dataset.ingredient='';input.setAttribute('autocomplete','off');input.maxLength=200;input.required=true;
  const quantityLabel=document.createElement('label');quantityLabel.textContent='Quantité';quantityLabel.append(quantity);
  const ingredientLabel=document.createElement('label');ingredientLabel.textContent='Ingrédient';ingredientLabel.append(input);
  const remove=document.createElement('button');remove.type='button';remove.className='text-button';remove.textContent='Retirer';remove.setAttribute('aria-label','Retirer cet ingrédient');
  remove.onclick=()=>{const next=row.nextElementSibling||row.previousElementSibling;row.remove();if(next)next.querySelector('[data-ingredient]').focus();else $('add-ingredient').focus();};
  const aisle=document.createElement('select');aisle.dataset.aisle='';
  const known=recipes.flatMap(recipe=>recipe.ingredients).find(item=>typeof item==='object'&&ingredientKey(item.name)===ingredientKey(input.value)&&item.category&&item.category!=='À classer');
  aisle.innerHTML=aisleOptionsHtml(typeof value==='object'?value.category||known?.category||'À classer':known?.category||'À classer');
  input.addEventListener('change',()=>{const match=recipes.flatMap(recipe=>recipe.ingredients).find(item=>typeof item==='object'&&ingredientKey(item.name)===ingredientKey(input.value)&&item.category&&item.category!=='À classer');if(match)aisle.innerHTML=aisleOptionsHtml(match.category);});
  const aisleLabel=document.createElement('label');aisleLabel.textContent='Rayon';aisleLabel.append(aisle);
  attachIngredientAutocomplete(input,ingredientLabel);
  row.append(quantityLabel,ingredientLabel,aisleLabel,remove);$('ingredient-list').append(row);return input;
}
$('add-ingredient').onclick=()=>addIngredient().focus();

$('export-shopping').onclick=()=>{
  const meals=getPlan().map(id=>recipes.find(recipe=>recipe.id===id)).filter(Boolean);
  if(!meals.length){notify('Ajoutez un repas à cette semaine pour exporter sa liste de courses.');return;}
  const groups=new Map();
  for(const recipe of meals){
    for(const ingredient of recipe.ingredients){
      const name=(typeof ingredient==='string'?ingredient:ingredient.name).trim().replace(/^(?:de\s+|d[’'])/i,'');
      const savedCategory=typeof ingredient==='string'?'À classer':ingredient.category||'À classer';
      const category=aisles.find(aisle=>aisle.toLocaleLowerCase('fr').replace(/’/g,"'")===savedCategory.toLocaleLowerCase('fr').replace(/’/g,"'"))||savedCategory;
      const key=JSON.stringify([category,ingredientKey(name)]);
      if(!groups.has(key))groups.set(key,{name,category,totals:new Map(),other:[]});
      const group=groups.get(key);
      const quantity=typeof ingredient==='string'?'':ingredient.quantity.trim();
      const match=quantity.match(/^(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?\s*(.*)$/);
      if(!match||match[2]&&Number(match[2])===0){group.other.push(quantity||'quantité à préciser');continue;}
      let amount=Number(match[1].replace(',','.'))/(match[2]?Number(match[2]):1);
      let unit=match[3].toLocaleLowerCase('fr').replace(/\s+/g,' ');
      const conversions={kg:['g',1000],mg:['g',0.001],l:['ml',1000],cl:['ml',10]};
      if(conversions[unit]){amount*=conversions[unit][1];unit=conversions[unit][0];}
      if(!Number.isFinite(amount)){group.other.push(quantity);continue;}
      group.totals.set(unit,(group.totals.get(unit)||0)+amount);
    }
  }
  const aisleRank=category=>category==='À classer'?10000:aisles.includes(category)?aisles.indexOf(category):100;
  const sorted=Array.from(groups.values()).sort((a,b)=>aisleRank(a.category)-aisleRank(b.category)||a.category.localeCompare(b.category,'fr')||a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));
  const lines=[];let currentCategory=null;
  for(const group of sorted){
    if(group.category!==currentCategory){if(lines.length)lines.push('');lines.push(group.category.toLocaleUpperCase('fr'));currentCategory=group.category;}
    const quantities=Array.from(group.totals,([unit,amount])=>`${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3}).format(amount)}${unit?' '+unit:''}`);
    quantities.push(...group.other);
    lines.push(`[ ] ${group.name} — ${quantities.join(' + ')}`);
  }
  const text=lines.join('\n');
  const url=URL.createObjectURL(new Blob(['\uFEFF',text],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`courses-${dateKey(week)}.txt`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify('La liste de courses a été exportée.');
};

function ingredientCatalog(){
  const catalog=new Map();
  for(const recipe of recipes){
    const seen=new Set();
    for(const item of recipe.ingredients){
      const name=typeof item==='string'?item:item.name;
      const key=ingredientKey(name);
      if(!catalog.has(key))catalog.set(key,{key,name,category:aisleLabelText(typeof item==='string'?'À classer':item.category||'À classer'),uses:0});
      if(!seen.has(key)){catalog.get(key).uses++;seen.add(key);}
    }
  }
  return Array.from(catalog.values()).sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));
}
function renderIngredients(){
  const catalog=ingredientCatalog();$('ingredient-count').textContent=String(catalog.length).padStart(2,'0');
  const chosen=$('ingredient-filter').value;
  const categories=Array.from(new Set([...aisles,...catalog.map(item=>item.category)]));
  $('ingredient-filter').innerHTML='<option value="">Tous les rayons</option>'+categories.map(category=>`<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  $('ingredient-filter').value=chosen;
  const query=$('ingredient-search').value.toLocaleLowerCase('fr');
  const filtered=catalog.filter(item=>item.name.toLocaleLowerCase('fr').includes(query)&&(!chosen||item.category===chosen));
  $('ingredient-manager').innerHTML=filtered.length?filtered.map(item=>`<form class="managed-ingredient" data-key="${escapeHtml(item.key)}"><label>Ingrédient<input name="ingredientName" value="${escapeHtml(item.name)}" required maxlength="200"></label><label>Rayon<select name="aisle" required>${aisleOptionsHtml(item.category)}</select></label><span class="ingredient-usage">${item.uses} recette${item.uses>1?'s':''}</span><button class="secondary" type="submit">Enregistrer</button><button class="danger" type="button" data-delete-ingredient>Supprimer</button></form>`).join(''):'<p class="empty">'+(catalog.length?'Aucun ingrédient ne correspond à votre recherche.':'Ajoutez des ingrédients dans vos recettes pour les retrouver ici.')+'</p>';
}
$('ingredient-search').oninput=renderIngredients;
$('ingredient-filter').onchange=renderIngredients;
$('ingredient-manager').addEventListener('submit',async event=>{
  event.preventDefault();if(saving)return;
  const form=event.target;const name=form.elements.ingredientName.value.trim();const category=form.elements.aisle.value.trim();
  if(!name||!category){notify('Indiquez un nom et un rayon.');return;}
  const key=form.dataset.key;
  const newKey=ingredientKey(name);
  if(newKey!==key&&ingredientCatalog().some(item=>item.key===newKey)){notify('Ce nom existe déjà. Choisissez un nom distinct pour éviter une fusion involontaire.');return;}
  for(const recipe of recipes){
    recipe.ingredients=recipe.ingredients.map(item=>ingredientKey(typeof item==='string'?item:item.name)===key?{...(typeof item==='string'?{quantity:''}:item),name,category}:item);
  }
  if(!await save())return;
  renderIngredients();renderRecipes();notify('L’ingrédient a été mis à jour dans les recettes.');
});

$('ingredient-manager').addEventListener('click',async event=>{
  const button=event.target.closest('[data-delete-ingredient]');if(!button||saving)return;
  const key=button.closest('form').dataset.key;
  const item=ingredientCatalog().find(item=>item.key===key);if(!item)return;
  if(!confirm(`Supprimer « ${item.name} » de ${item.uses} recette${item.uses>1?'s':''} ? Les recettes seront conservées, mais cet ingrédient sera retiré de leur liste et des prochaines listes de courses.`))return;
  for(const recipe of recipes)recipe.ingredients=recipe.ingredients.filter(ingredient=>ingredientKey(typeof ingredient==='string'?ingredient:ingredient.name)!==key);
  if(!await save())return;
  renderWeek();renderIngredients();renderRecipes();notify('L’ingrédient a été supprimé des recettes.');
});

function attachIngredientAutocomplete(input,label){
  const wrapper=document.createElement('div');wrapper.className='ingredient-autocomplete';
  const list=document.createElement('div');list.className='ingredient-suggestions';list.hidden=true;list.id=`suggestions-${crypto.randomUUID()}`;list.setAttribute('role','listbox');
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');
  input.replaceWith(wrapper);wrapper.append(input,list);
  let active=-1;
  function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
  function choose(name){input.value=name;input.dispatchEvent(new Event('change'));close();input.focus();}
  function update(){
    const query=ingredientKey(input.value);
    const matches=query?ingredientCatalog().filter(item=>ingredientKey(item.name).includes(query)).slice(0,8):[];
    active=-1;input.removeAttribute('aria-activedescendant');list.replaceChildren();
    for(const [index,item] of matches.entries()){
      const option=document.createElement('button');option.type='button';option.tabIndex=-1;option.id=`${list.id}-${index}`;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.textContent=item.name;
      option.addEventListener('mousedown',event=>event.preventDefault());option.onclick=()=>choose(item.name);list.append(option);
    }
    list.hidden=!matches.length;input.setAttribute('aria-expanded',String(matches.length>0));
  }
  input.addEventListener('input',update);input.addEventListener('focus',update);input.addEventListener('blur',close);
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){close();return;}
    if(list.hidden)return;
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();const count=list.children.length;active=(active+(event.key==='ArrowDown'?1:active<0?0:-1)+count)%count;
      Array.from(list.children).forEach((option,index)=>option.setAttribute('aria-selected',String(index===active)));
      input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView({block:'nearest'});
    }else if(event.key==='Enter'&&active>=0){event.preventDefault();choose(list.children[active].textContent);}
  });
}
