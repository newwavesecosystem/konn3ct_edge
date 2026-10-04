/* Read-only, isolated forensic checks. Does not contact a server or edit source.
 * Usage: node reproduce.cjs <absolute repository path>
 * Requires that repository's locked TypeScript and jsonwebtoken dependencies.
 * Executes source-extracted callbacks and the real transpiled WebRTCClient;
 * network, browser, clock and framework boundaries are deliberately stubbed.
 * Passing means the reported defect was reproduced, NOT that the product passed QA.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const repo = path.resolve(process.argv[2] || '.');
const ts = require(path.join(repo, 'node_modules/typescript'));
const jwt = require(path.join(repo, 'node_modules/jsonwebtoken'));
const read = p => fs.readFileSync(path.join(repo, p), 'utf8');
const contextPath = 'frontend/lib/meeting-context.tsx';
const contextText = read(contextPath);
const ast = ts.createSourceFile(contextPath, contextText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const results = [];
const silent = { log() {}, warn() {}, error() {}, info() {} };
function transpile(s, filename='isolated.ts') {
  return ts.transpileModule(s, { fileName: filename, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop:true
  }}).outputText;
}
function callback(name, bindings) {
  let found;
  function visit(n) {
    if (ts.isBinaryExpression(n) && n.left.getText(ast) === `client.${name}` && ts.isArrowFunction(n.right)) found = n.right;
    ts.forEachChild(n, visit);
  }
  visit(ast);
  assert.ok(found, `Missing production callback ${name}`);
  return vm.runInNewContext(transpile(`const extracted = ${found.getText(ast)}; extracted;`), {
    console: silent, setTimeout: () => 0, clearTimeout() {}, Date, ...bindings
  });
}
function extractNode(file, predicate, bindings, expression=false) {
  const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  let found;
  function visit(n) { if(predicate(n,tree)) found=n; ts.forEachChild(n,visit); }
  visit(tree);assert.ok(found,`Missing production node in ${file}`);
  const text=found.getText(tree).replace(/^export\s+/, '');
  return vm.runInNewContext(transpile(`const extracted = (${text}); extracted;`,file),{console:silent,Date,...bindings});
}
function participantBindings(initial) {
  let state = initial;
  const self = initial.find(p => p.id === 'self-part');
  const bindings = {
    setParticipants(fn) { state = fn(state); },
    isLocalIdentifier: id => id === 'self-part' || id === 'self-user',
    hasLeftMeetingRef: {current: false},
    prefsRef: {current: {notifications: {}}},
    currentUser: self, initialCurrentUser: {...self}, clientParticipantId: 'self-part',
    webrtcClient: {current: {userId:'self-user',participantId:'self-part'}},
    client: {emitTelemetry() {}}, isMuted: true, isCameraOn: true,
    localAudioTrackRef: {current:null}, localCameraTrackRef: {current:null},
    isScreenSharing: false, isMobileClient: false
  };
  return {bindings, get: () => state};
}
const self = () => ({id:'self-part',userId:'self-user',name:'Me',role:'host'});
async function check(id, title, fn) {
  try { results.push({id,title,status:'DEFECT_REPRODUCED',observed:await fn()}); }
  catch(e) { results.push({id,title,status:'CHECK_FAILED',error:e.stack}); }
}
function clientFixture() {
  const timeouts = [], intervals = [], logs = [];
  class FakeSocket {
    static OPEN = 1; static CLOSED = 3; static CLOSING = 2;
    readyState = 1; sent = [];
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState=3; }
  }
  const mod = {exports:{}};
  vm.runInNewContext(transpile(read('frontend/lib/webrtc.ts')), {
    exports:mod.exports, module:mod,
    require(p) {
      if(p === './video-processor') return {VideoProcessor:class {}};
      if(p === './network-adaptation-controller') return {NetworkAdaptationController:class {removeConsumer() {}}};
      throw new Error(`Unexpected module import ${p}`);
    },
    WebSocket:FakeSocket, navigator:{userAgent:'audit-fixture'},
    process:{env:{NEXT_PUBLIC_BACKEND_DOMAIN:'audit.invalid'}},
    crypto:crypto.webcrypto, performance, Date,
    console:{log(...x){logs.push(x)},warn(...x){logs.push(x)},error(...x){logs.push(x)}},
    setTimeout(fn,ms){const t={fn,ms};timeouts.push(t);return t;}, clearTimeout() {},
    setInterval(fn,ms){const t={fn,ms};intervals.push(t);return t;}, clearInterval() {}
  });
  const client = new mod.exports.WebRTCClient('audit-room','synthetic-token','self-part');
  return {client,timeouts,intervals,logs};
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function installMediaFixture(client, resumeReject=false) {
  let seq=0; const requests=[];
  client.device={loaded:true,rtpCapabilities:{}};
  client.recvTransport={id:'recv-1',connectionState:'connected',consume:async p=>({
    ...p, track:{id:`track-${p.id}`,kind:p.kind,readyState:'live'},
    on() {},close() {},closed:false
  })};
  client.request=async (type,expect,payload)=>{
    requests.push({type,expect,payload});
    if(type==='consume') return {id:`consumer-${++seq}`,kind:'audio',rtpParameters:{}};
    if(type==='resume' && resumeReject) throw new Error('synthetic resume timeout');
    return {};
  };
  return requests;
}

const Fragment = Symbol('Fragment');
const jsx = { Fragment, createElement(type, props, ...children) { return {type, props:{...props, children}}; } };
function nodes(tree, predicate) {
  if (tree == null) return [];
  if (Array.isArray(tree)) return tree.flatMap(x=>nodes(x,predicate));
  if (typeof tree !== 'object') return [];
  return [...(predicate(tree)?[tree]:[]), ...nodes(tree.props?.children,predicate)];
}
function globalRendererFixture() {
  let slotState, effects=[];
  const Marker = function AudioRendererMarker() {};
  const render = extractNode(contextPath,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='GlobalAudioRenderer',{
    React:jsx,MAX_AUDIO_SLOTS:8,AudioRenderer:Marker,
    useMeeting:()=>({selectedDevices:{audioOutput:''},meetingInfo:{roomType:'meeting'}}),
    useMemo:fn=>fn(),
    useState:initial=>{if(slotState===undefined)slotState=initial;return [slotState,next=>{slotState=typeof next==='function'?next(slotState):next}]},
    useEffect:fn=>effects.push(fn),
  });
  return {
    render(participants,currentUserId){effects=[];return render({participants,currentUserId,outputVolume:100,setAudioPlaybackError(){}})},
    commitEffects(){const scheduled=effects;effects=[];scheduled.forEach(fn=>fn())},
    audioNodes(tree){return nodes(tree,n=>n.type===Marker)},
    slots:()=>slotState,
  };
}
function currentUserFromSource(state, bindings) {
  const fn=extractNode(contextPath,(n,tree)=>ts.isArrowFunction(n)&&ts.isCallExpression(n.parent)&&n.parent.expression.getText(tree)==='useMemo'&&ts.isVariableDeclaration(n.parent.parent)&&n.parent.parent.name.getText(tree)==='currentUser',{
    ...bindings,participants:state
  });
  return fn();
}
async function runActualAudioRenderer(props) {
  let playCalls=0;
  const effects=[];
  const element={srcObject:null,paused:true,play:async()=>{playCalls++;element.paused=false},addEventListener(){},removeEventListener(){}};
  const render=extractNode(contextPath,n=>ts.isFunctionDeclaration(n)&&n.name?.text==='AudioRenderer',{
    React:jsx,useRef:()=>({current:element}),useEffect:fn=>effects.push(fn),
    MediaStream:class {constructor(tracks){this.tracks=[...tracks]} getAudioTracks(){return this.tracks} removeTrack(t){this.tracks=this.tracks.filter(x=>x!==t)} addTrack(t){this.tracks.push(t)}},
    document:{addEventListener(){},removeEventListener(){},visibilityState:'visible'},
    window:{addEventListener(){},removeEventListener(){}},setTimeout:()=>0
  });
  const tree=render(props);effects.forEach(fn=>fn());await settle();
  return {element,tree,playCalls};
}
const checks=[];
async function observe(id,title,expectedStatus,fn) {
  try {checks.push({id,title,status:expectedStatus,observed:await fn()})}
  catch(error){checks.push({id,title,status:'CHECK_FAILED',error:error.stack})}
}
(async()=>{
  await observe('E00','Normal self microphone is excluded from the remote audio pool','CONTROL_CONFIRMED',()=>{
    const track={id:'synthetic-local-mic',kind:'audio',readyState:'live',enabled:true};
    const local={...self(),audioTrack:track};
    const ui=globalRendererFixture();ui.render([local],'self-part');ui.commitEffects();
    const tree=ui.render([local],'self-part');
    assert.equal(ui.audioNodes(tree).some(n=>n.props.track===track),false);
    return {localCaptureSelected:false};
  });
  await observe('E01','Duplicate remote roster identity sends retained local capture to an unmuted audio element','DEFECT_REPRODUCED',async()=>{
    const track={id:'synthetic-local-mic',kind:'audio',readyState:'live',enabled:true};
    const local={...self(),audioTrack:track};
    const state=participantBindings([local]);
    state.bindings.isMuted=false;state.bindings.localAudioTrackRef.current=track;
    callback('onParticipantsList',state.bindings)([
      {participantId:'self-part',userId:'self-user',name:'Me',role:'host'},
      {participantId:'remote-1',userId:'remote-user',name:'Remote',role:'attendee'},
      {participantId:'remote-2',userId:'remote-user',name:'Remote duplicate',role:'attendee'}
    ]);
    assert.equal(local.id,'remote-2');assert.equal(local.audioTrack,track);
    const current=currentUserFromSource(state.get(),state.bindings);
    assert.equal(current.id,'self-part');
    const ui=globalRendererFixture();ui.render(state.get(),current.id);ui.commitEffects();
    const tree=ui.render(state.get(),current.id);
    const routed=ui.audioNodes(tree).find(n=>n.props.track===track);
    assert.ok(routed);assert.equal(routed.props.isLocal,false);
    const playback=await runActualAudioRenderer(routed.props);
    assert.equal(playback.element.srcObject.getAudioTracks()[0],track);
    assert.equal(playback.tree.props.muted,false);assert.equal(playback.playCalls,1);
    return {initialTrackOwner:'self-part',corruptedRowId:local.id,resolvedCurrentUser:current.id,localCaptureRetained:true,passedAsLocal:false,audioMuted:false,playInvocations:playback.playCalls,scope:'Synthetic live track and mocked playback; proves application routing, not measured audible echo'};
  });
  await observe('E02','An existing warm slot can render current self before the parent reconciliation effect clears it','DEFECT_REPRODUCED',()=>{
    const remoteTrack={id:'remote-track',kind:'audio'};
    const localTrack={id:'local-track-after-identity-transition',kind:'audio'};
    const ui=globalRendererFixture();
    ui.render([{id:'slot-owner',userId:'remote-user',audioTrack:remoteTrack}],'old-self');ui.commitEffects();
    assert.equal(ui.slots()[0].participantId,'slot-owner');
    const local=[{id:'slot-owner',userId:'self-user',audioTrack:localTrack}];
    const beforeEffect=ui.render(local,'slot-owner');
    const node=ui.audioNodes(beforeEffect).find(n=>n.props.track===localTrack);
    assert.ok(node);assert.equal(node.props.isLocal,false);
    ui.commitEffects();
    const afterEffect=ui.render(local,'slot-owner');
    assert.equal(ui.audioNodes(afterEffect).some(n=>n.props.track===localTrack),false);
    return {currentSelfRoutedBeforeEffect:true,isLocalProp:false,removedAfterEffect:true,scope:'Boundary test of an identity/slot transition; browser scheduling and audible duration not measured'};
  });
  await observe('E03','Screen audio uses a weaker identity exclusion than microphone slots','DEFECT_REPRODUCED',()=>{
    const mic={id:'self-mic',kind:'audio'},screen={id:'self-screen',kind:'audio'};
    const local=[{id:'transitioning-participant-id',userId:'self-user',audioTrack:mic,screenAudioTrack:screen}];
    const ui=globalRendererFixture();ui.render(local,'self-user');ui.commitEffects();
    const tree=ui.render(local,'self-user');const rendered=ui.audioNodes(tree);
    assert.equal(rendered.some(n=>n.props.track===mic),false);
    assert.equal(rendered.some(n=>n.props.track===screen&&n.props.isLocal===false),true);
    return {selfMatchedViaUserId:true,microphoneExcluded:true,screenTrackExcluded:false,scope:'Synthetic boundary state demonstrates inconsistent guards; does not prove ordinary local screen capture enters participant state'};
  });
  await observe('P01','Proposed generic resume error is not correlated to the pending resume promise by the current client','PLAN_GAP_REPRODUCED',async()=>{
    const {client}=clientFixture();await client.connect();
    let settled=false;
    const pending=client.request('resume','resumed',{consumerId:'synthetic-consumer'});
    pending.then(()=>{settled=true},()=>{settled=true});
    const requestId=client.ws.sent.at(-1).requestId;
    await client.ws.onmessage({data:JSON.stringify({type:'error',requestId,errorCode:'RESUME_FAILED',message:'Synthetic missing consumer'})});
    await settle();assert.equal(settled,false);assert.equal(client.pendingRequests.get('resumed').length,1);
    return {correlatedErrorDelivered:true,promiseSettled:false,stillPendingUntilTimeout:true};
  });
  console.log(JSON.stringify({
    repositoryRevision:'67780bdf0f3e4ad206ad0bc32183cee6fac168d4',
    methodology:'Unchanged source-extracted callbacks, current-user selector and audio renderers; real transpiled WebRTCClient. React hooks, browser playback, tracks, timers and network mocked. No live server or acoustic reproduction.',
    sourceHashes:Object.fromEntries([contextPath,'frontend/lib/webrtc.ts'].map(p=>[p,crypto.createHash('sha256').update(read(p)).digest('hex')])),
    checks,checkFailures:checks.filter(x=>x.status==='CHECK_FAILED').length
  },null,2));
  process.exitCode=checks.some(x=>x.status==='CHECK_FAILED')?1:0;
})();
