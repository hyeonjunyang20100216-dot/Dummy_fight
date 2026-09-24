import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

const $=id=>document.getElementById(id);
const ui={start:$('startBtn'),pause:$('pauseBtn'),reset:$('resetBtn'),again:$('againBtn'),speed:$('speedRange'),speedLabel:$('speedLabel'),redBar:$('redBleedBar'),blueBar:$('blueBleedBar'),redText:$('redBleedText'),blueText:$('blueBleedText'),redStatus:$('redStatus'),blueStatus:$('blueStatus'),limit:$('bleedLimit'),limitVal:$('bleedLimitValue'),limitTop:$('bleedLimitText'),detach:$('detachChance'),detachVal:$('detachChanceValue'),agg:$('aggression'),aggVal:$('aggressionValue'),state:$('matchState'),time:$('timeLabel'),overlay:$('winnerOverlay'),winner:$('winnerText'),log:$('combatLog'),clear:$('clearLogBtn'),live:document.querySelector('.live-pill')};
const LABEL={head:'머리',torso:'몸통',leftArm:'왼팔',rightArm:'오른팔',leftLeg:'왼다리',rightLeg:'오른다리'};
const LIMBS=['leftArm','rightArm','leftLeg','rightLeg'];
const TARGETS=['torso','leftArm','rightArm','leftLeg','rightLeg','head'];
const cfg=()=>({limit:+ui.limit.value,detach:+ui.detach.value/100,agg:+ui.agg.value/100});
const parts=()=>({head:{hp:70,max:70,attached:true},torso:{hp:150,max:150,attached:true},leftArm:{hp:70,max:70,attached:true},rightArm:{hp:70,max:70,attached:true},leftLeg:{hp:85,max:85,attached:true},rightLeg:{hp:85,max:85,attached:true}});

const viewport=$('viewport3d'),scene=new THREE.Scene();
scene.background=new THREE.Color(0x070c13);scene.fog=new THREE.FogExp2(0x070c13,.035);
const camera=new THREE.PerspectiveCamera(46,16/9,.1,80);camera.position.set(0,4.7,13.4);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;viewport.appendChild(renderer.domElement);
const clock=new THREE.Clock(),tmp=new THREE.Vector3(),tmp2=new THREE.Vector3();
const S={running:false,finished:false,time:0,speed:1,red:null,blue:null,debris:[],weapons:[],sparks:[]};

function mat(c,metal=.25,rough=.45){return new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});}
function mesh(g,m){const x=new THREE.Mesh(g,m);x.castShadow=true;x.receiveShadow=true;return x;}
function ellipsoid(x,y,z,m,seg=20){const e=mesh(new THREE.SphereGeometry(1,seg,Math.max(12,Math.floor(seg*.75))),m);e.scale.set(x,y,z);return e;}
function limb(radius,len,m,lower=.82){const g=new THREE.Group();const b=mesh(new THREE.CylinderGeometry(radius,Math.max(.055,radius*lower),len,16),m);g.add(b);const capR=radius*.72;const a=mesh(new THREE.SphereGeometry(capR,14,10),m);a.scale.y=.72;a.position.y=len/2;g.add(a);const c=a.clone();c.position.y=-len/2;g.add(c);return g;}
function joint(r=.12){const j=mesh(new THREE.SphereGeometry(r,16,12),mat(0x080d14,.55,.26));j.scale.y=.82;return j;}
function weapon(type){
  const g=new THREE.Group(),grip=new THREE.Object3D(),tip=new THREE.Object3D(),rear=new THREE.Object3D();g.add(grip,tip,rear);
  if(type==='spear'){
    const shaft=mesh(new THREE.CylinderGeometry(.042,.048,3.05,12),mat(0x795638,.12,.76));shaft.rotation.z=Math.PI/2;shaft.position.x=.42;g.add(shaft);
    const collar=mesh(new THREE.CylinderGeometry(.07,.07,.16,12),mat(0xaab4c2,.78,.2));collar.rotation.z=Math.PI/2;collar.position.x=1.98;g.add(collar);
    const blade=mesh(new THREE.ConeGeometry(.115,.48,14),mat(0xf3f7fb,.95,.12));blade.rotation.z=-Math.PI/2;blade.position.x=2.25;g.add(blade);
    const butt=mesh(new THREE.CylinderGeometry(.055,.07,.26,10),mat(0x9aa5b4,.72,.28));butt.rotation.z=Math.PI/2;butt.position.x=-1.18;g.add(butt);
    tip.position.x=2.48;rear.position.x=-1.32;
  }else{
    const handle=mesh(new THREE.CylinderGeometry(.06,.07,.38,12),mat(0x33241c,.08,.82));handle.rotation.z=Math.PI/2;handle.position.x=-.18;g.add(handle);
    const pommel=mesh(new THREE.SphereGeometry(.09,12,10),mat(0x8f9aa8,.75,.25));pommel.position.x=-.4;g.add(pommel);
    const guard=mesh(new THREE.BoxGeometry(.06,.28,.09),mat(0xbfc9d4,.82,.18));guard.position.x=.02;g.add(guard);
    const blade=mesh(new THREE.BoxGeometry(1.08,.075,.035),mat(0xf2f6fb,.96,.1));blade.position.x=.59;g.add(blade);
    const point=mesh(new THREE.ConeGeometry(.045,.24,8),mat(0xf2f6fb,.96,.1));point.rotation.z=-Math.PI/2;point.position.x=1.25;g.add(point);
    tip.position.x=1.37;rear.position.x=-.43;
  }
  g.userData.grip=grip;g.userData.tip=tip;g.userData.rear=rear;return g;
}
function environment(){
  scene.add(new THREE.HemisphereLight(0xcde0ff,0x141922,1.35));
  const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(6,12,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;scene.add(sun);
  const red=new THREE.PointLight(0xff2c43,22,28,2);red.position.set(-6.5,4.8,3.5);scene.add(red);const blue=new THREE.PointLight(0x2f73ff,22,28,2);blue.position.set(6.5,4.8,3.5);scene.add(blue);
  const floor=mesh(new THREE.CylinderGeometry(8.3,8.75,.52,64),mat(0x141b25,.22,.78));floor.position.y=-.28;floor.receiveShadow=true;scene.add(floor);
  const grid=new THREE.GridHelper(16,24,0x35445a,0x202936);grid.position.y=.015;grid.material.transparent=true;grid.material.opacity=.34;scene.add(grid);
  const ring=mesh(new THREE.TorusGeometry(8,.085,12,100),mat(0x59687d,.78,.22));ring.rotation.x=Math.PI/2;ring.position.y=.045;scene.add(ring);
}
function addArm(f,side){
  const sg=side==='left'?-1:1,p=new THREE.Group();p.position.set(.54*sg,.67,0);f.torsoPivot.add(p);f.pivots[side+'Arm']=p;
  const shoulder=joint(.13);p.add(shoulder);
  const up=limb(.12,.66,f.bodyMat,.76);up.position.y=-.35;p.add(up);
  const elbow=new THREE.Group();elbow.position.y=-.68;p.add(elbow);elbow.add(joint(.09));
  const low=limb(.095,.58,f.bodyMat,.68);low.position.y=-.31;elbow.add(low);
  const wrist=new THREE.Group();wrist.position.y=-.62;elbow.add(wrist);wrist.add(joint(.072));
  const hand=ellipsoid(.085,.13,.07,f.bodyMat,16);hand.position.y=-.13;hand.rotation.z=.05*sg;wrist.add(hand);
  const anchor=new THREE.Group();anchor.position.set(0,-.15,0);wrist.add(anchor);
  f.refs[side+'Hand']=anchor;f.refs[side+'Elbow']=elbow;f.refs[side+'Wrist']=wrist;
}
function addLeg(f,side){
  const sg=side==='left'?-1:1,p=new THREE.Group();p.position.set(.22*sg,-.93,0);f.pelvisPivot.add(p);f.pivots[side+'Leg']=p;
  const hip=joint(.135);p.add(hip);
  const up=limb(.165,.84,f.bodyMat,.76);up.position.y=-.44;p.add(up);
  const knee=new THREE.Group();knee.position.y=-.86;p.add(knee);knee.add(joint(.11));
  const low=limb(.13,.78,f.bodyMat,.66);low.position.y=-.4;knee.add(low);
  const ankle=new THREE.Group();ankle.position.y=-.81;knee.add(ankle);ankle.add(joint(.07));
  const foot=ellipsoid(.135,.075,.285,f.bodyMat,16);foot.position.set(0,-.08,.13);ankle.add(foot);
  f.refs[side+'Knee']=knee;f.refs[side+'Ankle']=ankle;
}
function fighter(team,x,facing,type){
  const color=team==='red'?0xff3b47:0x3d7cff;
  const f={team,color,x,z:team==='red'?-.58:.58,facing,weapon:type,weaponHeld:true,bleed:0,bleedRate:0,parts:parts(),vx:0,cool:.45+Math.random()*.35,action:'neutral',actionTime:0,actionDur:0,attackKind:null,target:null,hitDone:false,blocked:false,stagger:0,reactionCD:0,parryCD:0,clashCD:0,seed:Math.random()*1000,group:new THREE.Group(),pivots:{},refs:{},bodyMat:mat(color,.32,.34)};
  f.group.position.set(x,0,f.z);scene.add(f.group);
  const sh=new THREE.Mesh(new THREE.CircleGeometry(.72,32),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.32}));sh.rotation.x=-Math.PI/2;sh.position.y=.03;f.group.add(sh);f.shadow=sh;
  const waist=new THREE.Group();waist.position.y=2.62;f.group.add(waist);f.waistPivot=waist;f.pelvisPivot=waist;
  const pelvis=ellipsoid(.4,.24,.29,f.bodyMat,22);pelvis.position.y=-.74;waist.add(pelvis);
  const abdomen=mesh(new THREE.CylinderGeometry(.31,.36,.54,18),f.bodyMat);abdomen.position.y=-.35;waist.add(abdomen);
  const tp=new THREE.Group();tp.position.y=.08;waist.add(tp);f.torsoPivot=tp;f.pivots.torso=tp;
  const chest=ellipsoid(.53,.58,.29,f.bodyMat,24);chest.position.y=.28;tp.add(chest);
  const upperChest=ellipsoid(.59,.25,.3,f.bodyMat,24);upperChest.position.y=.7;tp.add(upperChest);
  const sternum=ellipsoid(.16,.38,.035,mat(color,.72,.16),18);sternum.position.set(.01,.29,.285);tp.add(sternum);
  const neckPivot=new THREE.Group();neckPivot.position.y=1.1;tp.add(neckPivot);f.pivots.neck=neckPivot;
  const neck=mesh(new THREE.CylinderGeometry(.1,.115,.28,14),f.bodyMat);neck.position.y=.02;neckPivot.add(neck);
  const hp=new THREE.Group();hp.position.y=.21;neckPivot.add(hp);f.pivots.head=hp;
  const head=ellipsoid(.31,.4,.31,f.bodyMat,24);head.position.y=.27;hp.add(head);
  const jaw=ellipsoid(.25,.14,.255,f.bodyMat,20);jaw.position.set(.06,.06,0);hp.add(jaw);
  const eyeWhite=mat(0xf3f6fb,.15,.2),pupilMat=new THREE.MeshStandardMaterial({color:0x05080d,metalness:.1,roughness:.2,emissive:0x0b1220,emissiveIntensity:.25});
  for(const z of [-.105,.105]){
    const eye=ellipsoid(.045,.055,.045,eyeWhite,14);eye.position.set(.285,.34,z);hp.add(eye);
    const pupil=ellipsoid(.012,.023,.023,pupilMat,12);pupil.position.set(.327,.34,z);hp.add(pupil);
  }
  addArm(f,'left');addArm(f,'right');addLeg(f,'left');addLeg(f,'right');
  const w=weapon(type);w.position.set(type==='spear'?.08:.24,-.02,0);f.refs.rightHand.add(w);f.weaponObj=w;return f;
}
function mobility(f){const n=+f.parts.leftLeg.attached + +f.parts.rightLeg.attached;if(n===2)return 1;if(n===1)return .54;return (f.parts.leftArm.attached||f.parts.rightArm.attached)?.15:0;}
function profile(f){if(f.weaponHeld&&f.parts.rightArm.attached)return f.weapon==='spear'?{kind:'spear',reach:3.25,min:12,max:23,dur:.58,label:'창 찌르기'}:{kind:'knife',reach:1.9,min:15,max:28,dur:.46,label:'검 베기'};if(f.parts.leftArm.attached||f.parts.rightArm.attached)return{kind:'punch',reach:1.2,min:6,max:11,dur:.38,label:'남은 팔 공격'};if(f.parts.leftLeg.attached||f.parts.rightLeg.attached)return{kind:'kick',reach:1.45,min:8,max:13,dur:.44,label:'다리 공격'};return null;}
function attackProgress(f){return f.action==='attack'?1-f.actionTime/f.actionDur:0;}
function parryProgress(f){return f.action==='parry'?1-f.actionTime/f.actionDur:0;}
function activeAttack(f){const p=attackProgress(f);return f.action==='attack'&&p>.35&&p<.76;}
function activeParry(f){const p=parryProgress(f);return f.action==='parry'&&p>.18&&p<.86;}
function desiredRange(f){if(f.weaponHeld&&f.weapon==='spear')return 2.7;if(f.weaponHeld&&f.weapon==='knife')return 1.38;return 1.05;}
function pick(enemy,a){const arr=TARGETS.filter(k=>enemy.parts[k].attached);if(!arr.length)return'torso';if(a.weaponHeld&&a.weapon==='spear'){const r=Math.random();if(r<.62)return'torso';if(r<.78)return'rightArm';if(r<.9)return'leftArm';return'head';}if(a.weaponHeld&&a.weapon==='knife'){const l=LIMBS.filter(k=>enemy.parts[k].attached);if(l.length&&Math.random()<.58)return l[Math.floor(Math.random()*l.length)];}return arr[Math.floor(Math.random()*arr.length)];}
function startAttack(f,e){const p=profile(f);if(!p)return;f.action='attack';f.actionDur=p.dur;f.actionTime=p.dur;f.attackKind=p.kind;f.target=pick(e,f);f.hitDone=false;f.blocked=false;f.cool=.55+Math.random()*.45+(1-cfg().agg)*.55;}
function startParry(f){if(!f.weaponHeld||!f.parts.rightArm.attached||f.parryCD>0)return false;f.action='parry';f.actionDur=.34;f.actionTime=.34;f.attackKind=null;f.hitDone=true;f.parryCD=.72+Math.random()*.3;f.reactionCD=.35;return true;}
function startEvade(f,e){f.action='evade';f.actionDur=.34;f.actionTime=.34;f.vx=(f.x<e.x?-1:1)*(2.8+Math.random());f.reactionCD=.45;}
function enemyThreat(e,f){if(e.action!=='attack')return false;const p=profile(e),prog=attackProgress(e),dist=Math.abs(e.x-f.x);return !!p&&prog>.12&&prog<.64&&dist<p.reach+.75;}
function updateAction(f,dt){f.cool=Math.max(0,f.cool-dt);f.stagger=Math.max(0,f.stagger-dt);f.reactionCD=Math.max(0,f.reactionCD-dt);f.parryCD=Math.max(0,f.parryCD-dt);f.clashCD=Math.max(0,f.clashCD-dt);if(f.action!=='neutral'){f.actionTime-=dt;if(f.actionTime<=0){if(f.action==='attack'||f.action==='parry'){f.action='recover';f.actionDur=.18;f.actionTime=.18;}else f.action='neutral';}}}
function ai(f,e,dt){
  updateAction(f,dt);f.facing=e.x>f.x?1:-1;if(f.stagger>0){f.vx*=Math.pow(.05,dt);return;}
  if(f.action==='attack'||f.action==='parry'||f.action==='recover'){f.vx*=Math.pow(.18,dt);return;}
  if(f.action==='evade'){f.x=THREE.MathUtils.clamp(f.x+f.vx*dt,-5.8,5.8);f.vx*=Math.pow(.16,dt);return;}
  const p=profile(f);if(!p){f.vx*=Math.pow(.02,dt);return;}
  const dist=Math.abs(e.x-f.x),m=mobility(f),ag=cfg().agg;
  if(enemyThreat(e,f)&&f.reactionCD<=0){
    const skill=.38+ag*.22+(f.weaponHeld?.08:0);
    if(f.weaponHeld&&Math.random()<skill&&startParry(f)){log(f.team,'공격을 읽고 패링 준비');return;}
    if(Math.random()<.68){startEvade(f,e);log(f.team,'공격을 읽고 거리 이탈');return;}
  }
  const ideal=desiredRange(f),tooClose=ideal*(f.weapon==='spear'?.67:.58),tooFar=ideal*1.13;let desired=0;
  if(dist>tooFar)desired=(e.x>f.x?1:-1)*(2.15+ag*1.55)*m;
  else if(dist<tooClose)desired=(e.x>f.x?-1:1)*(f.weapon==='spear'?3.1:1.65)*m;
  else{desired=(Math.random()-.5)*.32*m;if(f.cool<=0){const opportunity=e.action==='recover'||e.stagger>0||Math.random()<.58+ag*.25;if(opportunity&&Math.random()<dt*(2.2+ag*3.2)){startAttack(f,e);return;}}}
  f.vx+=(desired-f.vx)*Math.min(1,dt*6);f.x=THREE.MathUtils.clamp(f.x+f.vx*dt,-5.8,5.8);
}
function point(f,name){(f.pivots[name]||f.torsoPivot).getWorldPosition(tmp);return tmp.clone();}
function weaponSegment(f){if(!f.weaponHeld||!f.weaponObj||!f.parts.rightArm.attached)return null;const a=new THREE.Vector3(),b=new THREE.Vector3();f.weaponObj.userData.rear.getWorldPosition(a);f.weaponObj.userData.tip.getWorldPosition(b);return{a,b};}
function closestOnSegment(a,b,p){const ab=tmp.copy(b).sub(a),den=ab.lengthSq();if(!den)return a.clone();const t=THREE.MathUtils.clamp(tmp2.copy(p).sub(a).dot(ab)/den,0,1);return a.clone().add(ab.multiplyScalar(t));}
function segmentDistance(s1,s2){let best=Infinity,p1=null,p2=null;for(let i=0;i<7;i++){const t=i/6,p=s1.a.clone().lerp(s1.b,t),q=closestOnSegment(s2.a,s2.b,p),d=p.distanceTo(q);if(d<best){best=d;p1=p;p2=q;}}for(let i=0;i<7;i++){const t=i/6,p=s2.a.clone().lerp(s2.b,t),q=closestOnSegment(s1.a,s1.b,p),d=p.distanceTo(q);if(d<best){best=d;p1=q;p2=p;}}return{distance:best,point:p1&&p2?p1.add(p2).multiplyScalar(.5):new THREE.Vector3()};}
function spark(pos,c=0xffe7ad,n=10){for(let i=0;i<n;i++){const m=mesh(new THREE.SphereGeometry(.025+Math.random()*.035,8,6),new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:1}));m.position.copy(pos);scene.add(m);S.sparks.push({mesh:m,vx:(Math.random()-.5)*4.2,vy:.8+Math.random()*3.2,vz:(Math.random()-.5)*2.8,life:.2+Math.random()*.25,max:.42});}}
function clash(a,b,pos,parryBy=null){a.blocked=true;b.blocked=true;a.hitDone=true;b.hitDone=true;a.clashCD=.28;b.clashCD=.28;a.vx-=a.facing*.65;b.vx-=b.facing*.65;spark(pos,0xffe6a6,15);if(parryBy){const attacker=parryBy===a?b:a,def=parryBy;attacker.action='recover';attacker.actionDur=.34;attacker.actionTime=.34;attacker.stagger=.18;def.action='recover';def.actionDur=.12;def.actionTime=.12;log(def.team,'패링 성공 · 상대 공격 무력화');}else{a.action='recover';a.actionDur=.24;a.actionTime=.24;b.action='recover';b.actionDur=.24;b.actionTime=.24;log('SYSTEM','무기 충돌 · 두 공격이 서로 튕김');}}
function checkWeaponClash(a,b){if(a.clashCD>0||b.clashCD>0)return;const sa=weaponSegment(a),sb=weaponSegment(b);if(!sa||!sb)return;const eligible=(activeAttack(a)||activeParry(a))&&(activeAttack(b)||activeParry(b));if(!eligible)return;const c=segmentDistance(sa,sb);if(c.distance<.16){const parryBy=activeParry(a)&&activeAttack(b)?a:activeParry(b)&&activeAttack(a)?b:null;clash(a,b,c.point,parryBy);}}
function resolvePendingHit(a,d){if(a.action!=='attack'||a.hitDone||a.blocked)return;const prog=attackProgress(a),trigger=a.attackKind==='spear'?.58:.55;if(prog<trigger)return;a.hitDone=true;const p=profile(a);if(!p)return;const dist=Math.abs(d.x-a.x);if(dist>p.reach+.35){log(a.team,p.label+' 빗나감');return;}if(d.action==='evade'&&Math.random()<.72){log(a.team,p.label+' 회피됨');return;}if(Math.random()>.8+cfg().agg*.09){log(a.team,p.label+' 빗나감');return;}const name=d.parts[a.target]?.attached?a.target:'torso',part=d.parts[name],damage=p.min+Math.random()*(p.max-p.min),wf=p.kind==='knife'?1.15:p.kind==='spear'?.92:.4;part.hp=Math.max(0,part.hp-damage);d.bleed+=damage*.11*wf;d.bleedRate+=damage*.0025*wf;d.stagger=.12+damage*.007;d.vx+=a.facing*damage*.045;spark(point(d,name),a.color,7);log(a.team,p.label+' → '+LABEL[name]+' ('+Math.round(damage)+' 손상)');if(LIMBS.includes(name)&&part.hp<=0&&part.attached){const chance=cfg().detach*(p.kind==='knife'?1.15:p.kind==='spear'?.72:.14);if(Math.random()<chance)detachPart(d,name,a.facing);else{part.hp=3;d.bleedRate+=.035;}}finishCheck();}
function debrisMesh(f,name){const g=new THREE.Group(),m=mat(f.color,.28,.38),leg=name.includes('Leg');const a=limb(leg?.16:.13,leg?.68:.52,m);a.position.y=leg?.31:.25;const b=limb(leg?.135:.105,leg?.65:.5,m);b.position.y=leg?-.43:-.32;g.add(a,b);return g;}
function detachPart(f,name,dir){const part=f.parts[name];if(!part.attached)return;const pos=point(f,name);part.attached=false;part.hp=0;f.pivots[name].visible=false;const m=debrisMesh(f,name);m.position.copy(pos);scene.add(m);S.debris.push({mesh:m,vx:dir*(1.3+Math.random()),vy:2.2+Math.random(),vz:(Math.random()-.5),vr:(Math.random()-.5)*5,life:18});f.bleed+=5.5;f.bleedRate+=name.includes('Leg')?.22:.17;spark(pos,f.color,10);log(f.team,LABEL[name]+' 파츠 분리');if(name==='rightArm'&&f.weaponHeld){f.weaponHeld=false;f.weaponObj.visible=false;const w=weapon(f.weapon);w.position.copy(pos);scene.add(w);S.weapons.push({mesh:w,vx:dir*(1+Math.random()),vy:1.5+Math.random()*.7,vz:(Math.random()-.5)*.8,vr:(Math.random()-.5)*5});log(f.team,'오른팔 분리 → 무기 드롭');}}
function bleed(f,dt){const ex=(1-f.parts.torso.hp/f.parts.torso.max)*.018+(1-f.parts.head.hp/f.parts.head.max)*.009;f.bleed+=(f.bleedRate+ex)*dt*8;f.bleedRate*=Math.pow(.996,dt*60);}
function finishCheck(){const l=cfg().limit;if(S.red.bleed>=l||S.blue.bleed>=l)finish(S.red.bleed>=l?S.blue:S.red);}
function finish(w){if(S.finished)return;S.finished=true;S.running=false;ui.state.textContent='COMPLETE';ui.live.classList.remove('running');ui.winner.textContent=w.team.toUpperCase()+' WINS';ui.winner.style.color='#'+w.color.toString(16).padStart(6,'0');ui.overlay.classList.remove('hidden');log('SYSTEM',w.team.toUpperCase()+' 승리. 상대가 출혈 한계에 먼저 도달함.');}
function smooth(a,b,x){const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
function animate(f,dt){
  const t=S.time,m=Math.min(1,Math.abs(f.vx)/3),walk=Math.sin(t*7+f.seed)*m,ap=attackProgress(f),pp=parryProgress(f),ps=Math.sin(Math.min(1,pp)*Math.PI);
  const wind=smooth(0,.28,ap)*(1-smooth(.28,.46,ap)),strike=smooth(.25,.56,ap)*(1-smooth(.62,.86,ap)),recover=smooth(.62,1,ap);
  const lunge=f.action==='attack'?(f.attackKind==='spear'?.46*strike:f.attackKind==='knife'?.24*strike:0):0;
  f.group.position.set(f.x+f.facing*lunge,0,f.z);
  const target=f.facing>0?0:Math.PI;let diff=((target-f.group.rotation.y+Math.PI)%(Math.PI*2))-Math.PI;f.group.rotation.y+=diff*Math.min(1,dt*9);

  const baseY=2.62+Math.abs(Math.sin(t*7+f.seed))*.055*m;
  f.waistPivot.position.y=baseY-(f.action==='attack'?.07*strike:0);
  f.pelvisPivot.rotation.y=THREE.MathUtils.lerp(f.pelvisPivot.rotation.y,-walk*.035,Math.min(1,dt*8));
  let torsoZ=f.stagger>0?-.08:f.vx*.018,torsoY=0,torsoX=0;
  if(f.action==='attack'&&f.attackKind==='spear'){torsoZ=-.11*strike+.045*wind;torsoY=-.08*wind+.05*strike;torsoX=-.035*strike;}
  if(f.action==='attack'&&f.attackKind==='knife'){torsoZ=-.055*strike;torsoY=-.38*wind+.58*strike-.18*recover;torsoX=-.03*strike;}
  f.torsoPivot.rotation.z=THREE.MathUtils.lerp(f.torsoPivot.rotation.z,torsoZ,Math.min(1,dt*10));
  f.torsoPivot.rotation.y=THREE.MathUtils.lerp(f.torsoPivot.rotation.y,torsoY,Math.min(1,dt*10));
  f.torsoPivot.rotation.x=THREE.MathUtils.lerp(f.torsoPivot.rotation.x,torsoX,Math.min(1,dt*10));
  f.pivots.neck.rotation.y=THREE.MathUtils.lerp(f.pivots.neck.rotation.y,.05*f.facing-(f.action==='attack'?.04*strike:0),Math.min(1,dt*8));
  f.pivots.neck.rotation.z=THREE.MathUtils.lerp(f.pivots.neck.rotation.z,-torsoZ*.35,Math.min(1,dt*8));
  f.pivots.head.rotation.z=Math.sin(t*2.1+f.seed)*.018-(f.action==='attack'?.025*strike:0);
  f.pivots.head.rotation.x=THREE.MathUtils.lerp(f.pivots.head.rotation.x,(f.action==='attack'&&f.attackKind==='spear'?-0.04*strike:0),Math.min(1,dt*8));

  let leftLeg=.17*walk,rightLeg=-.17*walk;
  if(f.action==='attack'&&f.attackKind==='spear'){leftLeg-=.18*wind;rightLeg+=.32*strike;}
  if(f.action==='attack'&&f.attackKind==='knife'){leftLeg-=.13*wind;rightLeg+=.2*strike;}
  if(f.attackKind==='kick'&&f.action==='attack'){leftLeg+=.82*strike;rightLeg+=.42*strike;}
  if(f.parts.leftLeg.attached){f.pivots.leftLeg.rotation.x=leftLeg;f.refs.leftKnee.rotation.x=.14*Math.max(0,-walk)+.09*strike;f.refs.leftAnkle.rotation.x=-.09*walk-.04*strike;}
  if(f.parts.rightLeg.attached){f.pivots.rightLeg.rotation.x=rightLeg;f.refs.rightKnee.rotation.x=.14*Math.max(0,walk)+.11*strike;f.refs.rightAnkle.rotation.x=.09*walk+.03*strike;}

  if(f.parts.leftArm.attached){
    let lx=-.08-.1*walk,lz=.08,ly=0;
    if(f.weaponHeld&&f.weapon==='spear'){
      lx=-.02;ly=-.08;lz=1.02;
      f.refs.leftElbow.rotation.z=.28;
      if(f.action==='attack'){lz=1.02;f.refs.leftElbow.rotation.z=.28;}
      if(f.action==='parry'){lz=.72+.38*ps;f.refs.leftElbow.rotation.z=.5+.16*ps;}
    }else{
      f.refs.leftElbow.rotation.z=0;
      if(f.action==='parry'){lz=.62+.38*ps;lx=-.18;}
      if(!f.weaponHeld&&f.attackKind==='punch'&&f.action==='attack')lz=.92*strike;
    }
    f.pivots.leftArm.rotation.set(lx,ly,lz);
    f.refs.leftWrist.rotation.x=.08*Math.sin(t*3+f.seed)+(f.action==='parry'?.18*ps:0);
    f.refs.leftWrist.rotation.z=f.weaponHeld&&f.weapon==='spear'?.12:0;
  }

  if(f.parts.rightArm.attached){
    let rx=-.06+.1*walk,rz=.15,ry=0;f.refs.rightElbow.rotation.z=0;
    if(f.weaponHeld&&f.weapon==='spear'){
      rx=-.015;ry=0;rz=1.02;f.refs.rightElbow.rotation.z=.34;
      if(f.action==='attack'){
        rz=1.02;
        f.refs.rightElbow.rotation.z=.34;
      }else if(f.action==='parry'){
        rz=.74+.34*ps;ry=.12*ps;f.refs.rightElbow.rotation.z=.5+.12*ps;
      }
    }else if(f.weaponHeld&&f.weapon==='knife'){
      rz=.24;rx=-.1;
      if(f.action==='attack'){rz=.18-.72*wind+1.38*strike-.45*recover;rx=-.12-.18*strike;ry=-.34*wind+.24*strike;}
      if(f.action==='parry'){rz=.5+.9*ps;rx=-.12-.22*ps;ry=.22*ps;}
    }else if(f.attackKind==='punch'&&f.action==='attack')rz=.98*strike;
    f.pivots.rightArm.rotation.set(rx,ry,rz);
    let wristX=.04*Math.sin(t*2.7+f.seed),wristY=0,wristZ=0;
    if(f.weaponHeld&&f.weapon==='knife'&&f.action==='attack'){wristY=-.18*wind+.16*strike;wristZ=.22*strike;}
    if(f.weaponHeld&&f.weapon==='spear'){wristX=0;wristY=0;wristZ=0;}
    if(f.action==='parry'){wristY=.16*ps;wristZ=-.18*ps;}
    f.refs.rightWrist.rotation.set(wristX,wristY,wristZ);
  }

  if(f.weaponObj&&f.weaponHeld){
    f.weaponObj.position.y=-.02;f.weaponObj.position.z=0;
    if(f.weapon==='spear'){
      f.weaponObj.position.x=.08;
      f.weaponObj.rotation.set(0,0,0);
    }else{
      f.weaponObj.position.x=.24;
      f.weaponObj.rotation.set(0,0,f.action==='parry'?-.35*ps:0);
    }
  }
  f.shadow.scale.setScalar(1+m*.06+(f.action==='attack'?.04*strike:0));
}
function physics(dt){for(const d of S.debris){d.vy-=5.8*dt;d.mesh.position.x+=d.vx*dt;d.mesh.position.y+=d.vy*dt;d.mesh.position.z+=d.vz*dt;d.mesh.rotation.x+=d.vr*dt;d.mesh.rotation.z+=d.vr*.7*dt;if(d.mesh.position.y<.18){d.mesh.position.y=.18;d.vy*=-.2;d.vx*=.8;d.vz*=.8;}d.life-=dt;}S.debris=S.debris.filter(d=>{if(d.life>0)return true;scene.remove(d.mesh);return false;});for(const w of S.weapons){w.vy-=5.8*dt;w.mesh.position.x+=w.vx*dt;w.mesh.position.y+=w.vy*dt;w.mesh.position.z+=w.vz*dt;w.mesh.rotation.z+=w.vr*dt;if(w.mesh.position.y<.1){w.mesh.position.y=.1;w.vy*=-.18;w.vx*=.78;w.vz*=.78;w.vr*=.8;}}for(const p of S.sparks){p.vy-=4.5*dt;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;p.life-=dt;p.mesh.material.opacity=Math.max(0,p.life/p.max);}S.sparks=S.sparks.filter(p=>{if(p.life>0)return true;scene.remove(p.mesh);return false;});}
function status(f,root){root.innerHTML=['head','torso','leftArm','rightArm','leftLeg','rightLeg'].map(n=>{const p=f.parts[n],pct=Math.max(0,p.hp/p.max),cl=!p.attached?'off':pct<.36?'warn':'';return '<div class="limb-chip '+cl+'"><span>'+LABEL[n]+'</span><b>'+(p.attached?Math.round(pct*100)+'%':'분리')+'</b></div>'}).join('');}
function updateUI(){const l=cfg().limit,r=Math.min(l,S.red.bleed),b=Math.min(l,S.blue.bleed);ui.redBar.style.width=r/l*100+'%';ui.blueBar.style.width=b/l*100+'%';ui.redText.textContent=r.toFixed(1)+' / '+l;ui.blueText.textContent=b.toFixed(1)+' / '+l;ui.time.textContent=S.time.toFixed(1).padStart(4,'0')+'s';status(S.red,ui.redStatus);status(S.blue,ui.blueStatus);}
function log(team,msg){const row=document.createElement('div'),cl=team==='red'||team==='blue'?team:'';row.className='log-line';row.innerHTML='<span class="log-time">'+S.time.toFixed(1).padStart(4,'0')+'s</span><span class="log-team '+cl+'">'+team.toUpperCase()+'</span><span class="log-message">'+msg+'</span>';ui.log.prepend(row);while(ui.log.children.length>70)ui.log.lastChild.remove();}
function cleanup(){for(const x of [...S.debris,...S.weapons,...S.sparks])scene.remove(x.mesh);S.debris=[];S.weapons=[];S.sparks=[];if(S.red)scene.remove(S.red.group);if(S.blue)scene.remove(S.blue.group);}
function reset(){cleanup();S.running=false;S.finished=false;S.time=0;S.red=fighter('red',-3.25,1,'knife');S.blue=fighter('blue',3.25,-1,'spear');ui.overlay.classList.add('hidden');ui.state.textContent='READY';ui.live.classList.remove('running');ui.log.innerHTML='';log('SYSTEM','전술 AI 초기화 · 창은 찌르기 전용 · 패링 활성화');updateUI();}
function start(){if(S.finished)reset();S.running=true;ui.state.textContent='RUNNING';ui.live.classList.add('running');}
function pause(){if(S.finished)return;S.running=!S.running;ui.state.textContent=S.running?'RUNNING':'PAUSED';ui.live.classList.toggle('running',S.running);}
function resize(){const r=viewport.getBoundingClientRect();camera.aspect=Math.max(1,r.width)/Math.max(1,r.height);camera.updateProjectionMatrix();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);}
function tick(){const raw=Math.min(.033,clock.getDelta()||0),dt=raw*S.speed;if(S.running&&!S.finished){S.time+=dt;ai(S.red,S.blue,dt);ai(S.blue,S.red,dt);bleed(S.red,dt);bleed(S.blue,dt);}animate(S.red,dt);animate(S.blue,dt);if(S.running&&!S.finished){checkWeaponClash(S.red,S.blue);resolvePendingHit(S.red,S.blue);resolvePendingHit(S.blue,S.red);finishCheck();updateUI();}physics(dt);camera.position.x+=(((S.red.x+S.blue.x)*.1)-camera.position.x)*Math.min(1,raw*2.8);const dist=Math.abs(S.red.x-S.blue.x);camera.position.z+=((12.1+Math.min(2.5,dist*.25))-camera.position.z)*Math.min(1,raw*1.7);camera.lookAt((S.red.x+S.blue.x)*.07,2.55,0);renderer.render(scene,camera);requestAnimationFrame(tick);}

ui.start.onclick=start;ui.pause.onclick=pause;ui.reset.onclick=reset;ui.again.onclick=()=>{reset();start();};ui.clear.onclick=()=>ui.log.innerHTML='';ui.speed.oninput=()=>{S.speed=+ui.speed.value;ui.speedLabel.textContent=S.speed.toFixed(2)+'×';};ui.limit.oninput=()=>{ui.limitVal.textContent=ui.limit.value;ui.limitTop.textContent=ui.limit.value;updateUI();};ui.detach.oninput=()=>ui.detachVal.textContent=ui.detach.value+'%';ui.agg.oninput=()=>ui.aggVal.textContent=ui.agg.value+'%';addEventListener('resize',resize);
environment();resize();reset();requestAnimationFrame(tick);