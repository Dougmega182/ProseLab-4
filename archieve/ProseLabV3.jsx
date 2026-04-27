import { useState, useRef, useEffect } from "react";
const SAVE_KEY = "proselab_v3";
async function persist(data) { try { await window.storage.set(SAVE_KEY, JSON.stringify(data)); } catch(e) {} }
async function restore() { try { const r = await window.storage.get(SAVE_KEY); return r ? JSON.parse(r.value) : null; } catch(e) { return null; } }

const GF = "@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Courier+Prime:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0;}textarea:focus,select:focus{outline:none;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#060504;}::-webkit-scrollbar-thumb{background:#2a2018;}.fd{animation:fi .3s ease;}@keyframes fi{from{opacity:0;transform:translateY(4px);}to{opacity:1;}}";
const C = {bg:"#060504",sur:"#0d0b09",card:"#111009",brd:"#222018",gold:"#c8963e",gdim:"#4a3820",txt:"#e5dac8",mut:"#5e5444",grn:"#4e9e56",gBg:"#080f08",gBr:"#1e3e22",red:"#c86a6a",rBg:"#130808",rBr:"#3e1a1a",pur:"#9a72ce",amb:"#d4943a",aBg:"#130e04",aBr:"#3e2a08"};
const PF = {fontFamily:"'Playfair Display',serif"};
const CP = {fontFamily:"'Courier Prime',monospace"};
const DS = {fontFamily:"'DM Sans',sans-serif"};

// TECHNIQUE LIBRARY — extracted craft mechanics, not author identities
const TECHNIQUES = {
  "Syntactic Guillotine": {
    source:"Morgan / Jemisin / Delany",
    desc:"Build momentum with accumulating clauses, then amputate with a declarative of 5 words or fewer. The cut lands on a blunt physical fact.",
    instruction:"Apply the Syntactic Guillotine: build breathless momentum through accumulating detail or action, then cut hard to a short blunt declarative of 5 words or fewer. The break IS the meaning. No softening the landing."
  },
  "Physical Reduction of Emotion": {
    source:"Morgan / Butler",
    desc:"Replace every emotional label with involuntary physiological reaction. Fear becomes muscle. Grief becomes an inability to move.",
    instruction:"Apply Physical Reduction: replace every abstract emotional word with an involuntary physiological reaction or the mechanical effort required to suppress it. The body betrays the feeling. Never name it directly."
  },
  "Casual Integration of the Radical": {
    source:"Morgan / Jemisin",
    desc:"Embed speculative world mechanics into casual habit, legal procedure, or physical gesture. Never pause to explain.",
    instruction:"Apply Casual Integration: embed every speculative world element into casual physical habit or procedural reality. Treat radical technology as mundane police procedure or habitual gesture. Never explain. Never marvel."
  },
  "Synesthetic Metaphor": {
    source:"Bester",
    desc:"Map nouns to the wrong sensory verbs. Touch becomes taste. Sound becomes texture. Forces the reader into disorientation.",
    instruction:"Apply Synesthetic Metaphor: map sensory experience to the wrong sense. Touch becomes taste, metal becomes salt, sound becomes weight. Force the reader into the character's disorientation by cross-wiring the senses."
  },
  "Typographical Acceleration": {
    source:"Bester",
    desc:"In cognitive breakdown or assault, abandon standard formatting. Capitalized fragments. No grammatical safety rails.",
    instruction:"Apply Typographical Acceleration where the mind is under siege: abandon standard formatting, use capitalized staccato fragments, remove grammatical safety rails. The breakdown IS the sentence structure."
  },
  "Cognitive Stuttering": {
    source:"Bester",
    desc:"Enact psychic collapse or trauma at the syntactic level. Memory and present action merge into one broken state.",
    instruction:"Apply Cognitive Stuttering for trauma or psychic assault: merge memory fragments and present action into broken syntax. 'P... Pa... Papa...' The mind fails on the page, not in summary."
  },
  "Scale-Shattering Preposition": {
    source:"Bester / Jemisin",
    desc:"Bridge impossible distances or scales by treating them as adjacent rooms. Collapse cosmic into immediate physical.",
    instruction:"Apply Scale-Shattering Preposition: collapse vast distances or scales into immediate physical sensation. The galaxy becomes the next breath. No travel prose. Just the location and the body's response to it."
  },
  "Periodic Expansion": {
    source:"Le Guin / Delany",
    desc:"Short thesis statement, then increasingly longer sentences deferring resolution, crashing on a monosyllabic absolute.",
    instruction:"Apply Periodic Expansion: open with a short definitive statement, then extend with increasingly complex sentences that defer resolution, crash at last on a stark monosyllabic absolute. The long sentence must feel like it could have gone further."
  },
  "Phantom Prop Transition": {
    source:"Le Guin",
    desc:"Anchor the reader in a tactile sensation, then remove it to shift time, place, or emotional register.",
    instruction:"Apply Phantom Prop: anchor the reader in a specific physical sensation or object, then remove it abruptly in the next sentence to shift time, place, or emotional register. No conventional transition words."
  },
  "Syntactic Normalization of the Bizarre": {
    source:"Wolfe / Morgan",
    desc:"Place the impossible in identical grammatical weight and flat tone as the mundane. Never signal that something is extraordinary.",
    instruction:"Apply Syntactic Normalization: place every speculative or impossible element in the exact same grammatical position and flat declarative tone as trivial physical acts. Never use italics or exclamation to signal the extraordinary."
  },
  "Em-Dash Whiplash": {
    source:"Delany / Bester",
    desc:"Build a frantic list of past actions, amputate with an em-dash, land in a calm present-tense inventory.",
    instruction:"Apply Em-Dash Whiplash: build a kinetic list of actions or memories, cut with an em-dash, land in a contrasting calm present-tense moment. The violence of the cut IS the effect."
  },
  "Staccato Erasure": {
    source:"Butler / Morgan",
    desc:"Strip all ornament. Brutal short declaratives looping toward an inescapable truth. No grace notes.",
    instruction:"Apply Staccato Erasure: strip all metaphor and ornament. Short blunt declaratives repeating and spiraling toward an inescapable conclusion. No transitions. No grace notes. The repetition is the dread."
  },
};

// Build generator system prompt from user's voice profile + selected techniques
function buildGeneratorSys(voiceProfile, selectedTechs) {
  const techInstructions = selectedTechs.map(t => TECHNIQUES[t] ? "- " + t + ": " + TECHNIQUES[t].instruction : "").filter(Boolean).join("\n");
  return "You are a writing assistant helping develop an original author's unique prose voice. Your job is NOT to impersonate any named author. Your job is to apply specific craft techniques to THIS writer's own voice and instincts.\n\nTHIS WRITER'S VOICE PROFILE:\n" + (voiceProfile || "No voice profile set yet. Write in a clear, direct, original style.") + "\n\nCRAFT TECHNIQUES TO APPLY THIS PARAGRAPH:\n" + (techInstructions || "Apply good prose craft: strong verbs, physical specificity, no abstract emotional labels.") + "\n\nCRITICAL RULES:\n- The voice must sound like THIS writer, not like any named author\n- Techniques are tools, not identities -- apply them in service of this writer's instincts\n- Every metaphor must be original to this writer's world, not borrowed from any corpus\n- Do NOT produce prose that reads as a pastiche or imitation of any existing author\n- The paragraph must be unmistakably original\n\nWrite ONLY the single paragraph. No title, no preamble.";
}

const CRIT_SYS = "You are a brutally precise prose critic trained on corpus extraction sessions from Hugo-winning SF and noir SF thriller. Penalise safety and the readable mean as aggressively as direct failure.\n\nFAILURE MODES:\n1. spectacle_pause: Marveling at powers by pausing the narrative. Fix (Jemisin): 'he shuts down a subsurface aftershock and pokes at the fire in apparent boredom.' Identical grammatical weight for impossible and mundane.\n2. emotional_labeling: Abstract labels instead of physical revolt. Fix (Butler): 'My stomach heaved, and I had to force myself to stay where I was.' Fix (Morgan): 'I felt my lips peeling back from the clenched teeth in something that was more a grin than a grimace.' Replace every emotional word with involuntary physiology.\n3. detached_realization: Summarizing a shock with fluid grammar. Fix (Bester): 'The picture was a mirror. The face was his own.' Isolate the object first, delay the horror, two blunt declaratives.\n4. existential_cliche: Emotional adjectives summarizing defeat or despair. Fix (Le Guin): 'Nothing he did was meaningful... He had come up against the wall for good.' Polysyndetic rhythm of losses, no emotional adjective, monosyllabic absolute.\n5. narrative_summary: Explaining a speculative concept as a neat summary. Fix (Miev): 'They spoke me: they said me.' Fix (Morgan): 'the twin just gets its cortical stack blown out through the back of its neck before we can make the bust.' Embed the world-mechanic in police procedure or physical habit -- never explain it.\n6. vague_metaphor: Borrowed or decorative imagery that dissolves under examination. Fix (Delany): 'a grey eel of smoke slithered the sidewalk.' Fix (Bester): 'Touch was taste to him... metal was salt, stone tasted sour-sweet to the touch of his fingers.'\n7. announced_comparison: Using 'like', 'as if', 'resembled'. Fix: Direct Equation, Appositive, Genitive Replacement, Verb Metaphor, or Sensory Equation.\n8. rhythm_collapse: Identical sentence length and structure across 3+ consecutive sentences. No pulse, no Guillotine, no Acceleration.\n9. smooth_transition: Conventional time markers or transitional sentences. Fix (Bester): collapse cosmic distance into immediate physical failure with no travel prose.\n10. safe_landing: Paragraph ends on the expected comfortable note rather than a live wire.\n11. cognitive_exposition: Explaining what the character is thinking or feeling rather than enacting the cognitive state in the syntax itself. Fix (Bester): 'ABOLISH. DESTROY. DELETE.' -- the breakdown IS the sentence structure.\n\nSCORING 1-10: rhythm, metaphor, specificity, emotional_weight, originality\nCALIBRATION: 9-10 exceptional. 7-8 genuinely distinctive. 5-6 competent but forgettable = FAILURE. Penalise safety.\nAPPROVAL: ALL five scores must be 7 or above. Any below 7 = REWRITE.\n\nCRITICAL LENGTH RULE: annotation must be under 60 words. rewrite_instruction must be one sentence under 25 words. Brevity is mandatory.\n\nReturn ONLY valid JSON. No markdown. No preamble. First char { last char }.\n{\"scores\":{\"rhythm\":0,\"metaphor\":0,\"specificity\":0,\"emotional_weight\":0,\"originality\":0},\"failure_modes_flagged\":[],\"verdict\":\"APPROVED or REWRITE\",\"annotation\":\"under 60 words: quote the exact failing phrase and name the failure mode\",\"rewrite_instruction\":\"one sentence under 25 words\"}";

const makeGov = (b) => "You are the Chapter Governor. Ensure approved scenes remain on the chapter's dramatic spine. You do not evaluate prose quality.\n\nCHAPTER BRIEF:\nDramatic purpose: " + b.purpose + "\nEmotional arc: " + b.emotionalArc + "\nMust establish: " + b.mustEstablish + "\nMust leave open: " + b.mustLeaveOpen + "\nMust never happen: " + b.mustNotHappen + "\n\nWORLD TEXTURE STANDARDS [Session D]:\n- Ecological Lexicon: world-specific vocabulary in casual action and dialogue, no Earth-normal references crept in?\n- Casual Integration of the Miraculous: speculative element treated as mundane, or pausing to marvel?\n- Unspoken Biological Baseline: world's biology as absolute norm, standard human biology reading as strange?\n- Incomprehensible Scale: vast things rendered at their actual scale, not anthropomorphized?\n- Weaponized Cognitive Dissonance: world's rules require psychological effort -- is that toll in the syntax itself?\n\nPACING STANDARDS [Session E]:\n- High-tension: staccato syntax, asyndeton, monosyllabic kinetic verbs, short paragraphs, sensory overload.\n- Reflective: polysyndeton, periodic sentences, heavy abstract nouns, philosophical interruption of physical action.\n- Transitions must happen INSIDE the sentence: Phantom Prop, Material Transmutation, Em-Dash Whiplash, Tense Bleed. Flag any conventional time marker or flashback frame.\n- Flag any scene ending on a smooth comfortable landing rather than a live wire.\n\nSPINE STATUS:\n- ON_TRACK: scenes pulling toward chapter destination at correct pacing register.\n- DRIFTING: momentum subtly redirecting -- constraint needed for next scene prompt.\n- CRITICAL_DRIFT: chapter has moved significantly away from its purpose -- human must intervene.\n\nReturn ONLY valid JSON. No markdown. No preamble. First char { last char }.\n{\"spine_status\":\"ON_TRACK or DRIFTING or CRITICAL_DRIFT\",\"scene_count_evaluated\":0,\"what_has_been_established\":[],\"premature_resolutions\":[],\"missing_threads\":[],\"pacing_flags\":[],\"texture_flags\":[],\"next_scene_constraints\":[],\"governor_note\":\"one direct paragraph on spine status, pacing register, texture drift, and what to do before the next scene\"}";

const AUTH_LIST = {
  "N.K. Jemisin":     "Syntactic Guillotine -- Geological morality -- Second-person dissociation",
  "Ursula K. Le Guin":"Periodic Expansion -- Earned absolutes -- Biological dualism",
  "Gene Wolfe":       "Syntactic Normalization -- Archaic friction -- What is withheld",
  "Octavia Butler":   "Physical Reduction -- Staccato Erasure -- No ornament, no distance",
  "Samuel R. Delany": "Syntactic Guillotine -- Genitive Replacement -- Language examining itself",
  "Richard K. Morgan":"Syntactic Guillotine -- Physical Reduction -- Hardboiled noir SF",
  "Alfred Bester":    "Typographical Acceleration -- Synesthetic Metaphor -- Cognitive Stuttering",
};

async function callAPI(system, userMsg) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:2000, system, messages:[{role:"user",content:userMsg}] })
  });
  if (!r.ok) throw new Error("API " + r.status);
  const d = await r.json();
  return d.content[0].text.trim();
}

async function generate(scene, author, fb) {
  let msg = "Write one paragraph for this scene:\n\n" + scene;
  if (fb) msg = "REJECTED. Annotation: " + fb.annotation + "\nRewrite instruction: " + fb.rewrite_instruction + "\nThe safe version failed. Risk something irreversible.\n\nScene: " + scene;
  return callAPI(A_SYS[author], msg);
}

function recoverScores(raw) {
  // Extract scores even from truncated JSON by reading each field independently
  const extract = (key) => { const m = raw.match(new RegExp('"' + key + '"\\s*:\\s*(\\d+)')); return m ? parseInt(m[1]) : 5; };
  const scores = { rhythm:extract("rhythm"), metaphor:extract("metaphor"), specificity:extract("specificity"), emotional_weight:extract("emotional_weight"), originality:extract("originality") };
  const allPass = Object.values(scores).every(v => v >= 7);
  const annotMatch = raw.match(/"annotation"\s*:\s*"([^"]+)"/);
  const rewriteMatch = raw.match(/"rewrite_instruction"\s*:\s*"([^"]+)"/);
  const flagMatch = raw.match(/"failure_modes_flagged"\s*:\s*\[([^\]]*)\]/);
  const flags = flagMatch ? flagMatch[1].replace(/"/g,"").split(",").map(s=>s.trim()).filter(Boolean) : [];
  return {
    scores,
    failure_modes_flagged: flags,
    verdict: allPass ? "APPROVED" : "REWRITE",
    annotation: annotMatch ? annotMatch[1] : "(Score recovery mode -- annotation truncated)",
    rewrite_instruction: rewriteMatch ? rewriteMatch[1] : "Response was truncated. Scores recovered successfully -- see above."
  };
}

async function critique(para, author) {
  const raw = await callAPI(CRIT_SYS, "Evaluate this paragraph in the style of " + author + ":\n\n" + para);
  const clean = raw.replace(/^```json\s*/i,"").replace(/\s*```$/,"").trim();
  try { return JSON.parse(clean); }
  catch { 
    // Attempt score recovery from partial JSON before giving up
    try { return recoverScores(clean); }
    catch { return {scores:{rhythm:3,metaphor:3,specificity:3,emotional_weight:3,originality:3},failure_modes_flagged:["parse_error"],verdict:"REWRITE",annotation:"Parse error -- could not recover scores. Raw: "+clean.slice(0,80),rewrite_instruction:"Retry."}; }
  }
}

async function governor(brief, scenes) {
  const txt = scenes.map((s,i) => "SCENE "+(i+1)+" ("+s.prompt+")\n"+s.paragraphs.join("\n\n")).join("\n\n---\n\n");
  const raw = await callAPI(makeGov(brief), "Evaluate " + scenes.length + " scene(s):\n\n" + txt);
  const clean = raw.replace(/^```json\s*/i,"").replace(/\s*```$/,"").trim();
  try { return JSON.parse(clean); }
  catch { return {spine_status:"DRIFTING",scene_count_evaluated:scenes.length,what_has_been_established:[],premature_resolutions:[],missing_threads:[],pacing_flags:["Parse error"],texture_flags:[],next_scene_constraints:["Retry"],governor_note:"Parse error: "+clean.slice(0,80)}; }
}

function Bar({label,val}) {
  const col = val>=7?C.gold:val>=5?"#7a6040":C.red;
  return (
    <div style={{marginBottom:6}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
        <span style={{...CP,fontSize:13,color:C.mut,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label.replace(/_/g," ")}</span>
        <span style={{...CP,fontSize:15,fontWeight:700,color:col}}>{val}/10</span>
      </div>
      <div style={{height:2,background:C.brd,borderRadius:1}}>
        <div style={{height:"100%",width:val*10+"%",background:col,borderRadius:1,transition:"width .6s"}} />
      </div>
    </div>
  );
}

function Lbl({c,children}) { return <div style={{...CP,fontSize:13,color:c||C.mut,letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:7}}>{children}</div>; }
function Bx({brd,bg,pad,children,style}) { return <div style={{background:bg||C.card,border:"1px solid "+(brd||C.brd),borderRadius:4,padding:pad||0,...(style||{})}}>{children}</div>; }

function PriBtn({children,onClick,disabled,bg,fg}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{background:disabled?C.sur:(bg||C.gold),color:disabled?C.mut:(fg||"#060504"),border:"none",padding:"10px 20px",...DS,fontSize:16,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",borderRadius:3,cursor:disabled?"not-allowed":"pointer"}}>
      {children}
    </button>
  );
}

function GhostBtn({children,onClick,active}) {
  return (
    <button onClick={onClick} style={{background:active?C.gdim:"none",border:"1px solid "+(active?C.gold:C.brd),color:active?C.gold:C.mut,padding:"6px 14px",...CP,fontSize:14,cursor:"pointer",borderRadius:2}}>
      {children}
    </button>
  );
}

function IterCard({iter}) {
  const {num,paragraph,critique:crit} = iter;
  if (!crit) return null;
  const ok = crit.verdict === "APPROVED";
  return (
    <div className="fd" style={{border:"1px solid "+(ok?C.gBr:C.rBr),borderRadius:4,marginBottom:14,overflow:"hidden"}}>
      <div style={{background:ok?C.gBg:C.rBg,padding:"6px 16px",display:"flex",justifyContent:"space-between",borderBottom:"1px solid "+(ok?C.gBr:C.rBr)}}>
        <span style={{...CP,fontSize:13,color:C.mut}}>ITERATION {num}</span>
        <span style={{...DS,fontSize:15,fontWeight:700,color:ok?C.grn:C.red}}>{ok?"APPROVED":"REWRITE"}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr"}}>
        <div style={{padding:"16px 18px",borderRight:"1px solid "+C.brd}}>
          <Lbl>Generator Output</Lbl>
          <p style={{...PF,fontSize:18,lineHeight:1.9,color:C.txt,fontStyle:"italic"}}>{paragraph}</p>
        </div>
        <div style={{padding:"16px 18px"}}>
          <Lbl>Critic Scores</Lbl>
          {Object.entries(crit.scores).map(([k,v]) => <Bar key={k} label={k} val={v} />)}
          {(crit.failure_modes_flagged||[]).length > 0 && (
            <div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
              {crit.failure_modes_flagged.map(f => <span key={f} style={{...DS,fontSize:14,background:C.rBg,border:"1px solid "+C.rBr,color:C.red,padding:"2px 7px",borderRadius:2}}>{f.replace(/_/g," ")}</span>)}
            </div>
          )}
          <div style={{padding:"10px 12px",background:C.sur,borderRadius:3,borderLeft:"2px solid "+(ok?C.grn:C.red),marginTop:8}}>
            <Lbl>Annotation</Lbl>
            <p style={{...DS,fontSize:16,lineHeight:1.6,color:C.txt}}>{crit.annotation}</p>
          </div>
          {!ok && crit.rewrite_instruction && (
            <div style={{marginTop:7,padding:"8px 12px",background:"#140f04",borderRadius:3,borderLeft:"2px solid "+C.gold}}>
              <Lbl c={C.gold}>Rewrite Instruction</Lbl>
              <p style={{...DS,fontSize:16,lineHeight:1.5,color:C.txt}}>{crit.rewrite_instruction}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GovPanel({report,onProceed,onHalt}) {
  if (!report) return null;
  const sc = {ON_TRACK:C.grn,DRIFTING:C.amb,CRITICAL_DRIFT:C.red}[report.spine_status]||C.mut;
  const sbg = {ON_TRACK:C.gBg,DRIFTING:C.aBg,CRITICAL_DRIFT:C.rBg}[report.spine_status]||C.sur;
  const sbr = {ON_TRACK:C.gBr,DRIFTING:C.aBr,CRITICAL_DRIFT:C.rBr}[report.spine_status]||C.brd;
  const sl = {ON_TRACK:"ON TRACK",DRIFTING:"DRIFTING",CRITICAL_DRIFT:"CRITICAL DRIFT"}[report.spine_status]||report.spine_status;
  return (
    <div className="fd" style={{border:"1px solid "+sbr,borderRadius:4,overflow:"hidden",marginTop:18}}>
      <div style={{background:sbg,padding:"10px 18px",borderBottom:"1px solid "+sbr,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{...CP,fontSize:13,color:C.mut}}>CHAPTER GOVERNOR -- SCENE {report.scene_count_evaluated} REPORT</span>
        <span style={{...DS,fontSize:16,fontWeight:700,color:sc}}>{sl}</span>
      </div>
      <div style={{padding:"18px 20px"}}>
        <div style={{padding:"12px 14px",background:C.sur,borderRadius:3,borderLeft:"2px solid "+sc,marginBottom:16}}>
          <Lbl>Governor Assessment</Lbl>
          <p style={{...DS,fontSize:17,lineHeight:1.7,color:C.txt}}>{report.governor_note}</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          {[
            {label:"Established",items:report.what_has_been_established||[],col:C.txt},
            {label:"Premature Resolutions",items:report.premature_resolutions||[],col:C.red,empty:"None -- good."},
            {label:"Missing Threads",items:report.missing_threads||[],col:C.amb,empty:"None detected."},
            {label:"Pacing + Texture Flags",items:[...(report.pacing_flags||[]),...(report.texture_flags||[])],col:C.pur,empty:"None."},
          ].map(({label,items,col,empty}) => (
            <Bx key={label} pad="11px 13px">
              <Lbl>{label}</Lbl>
              {items.length === 0
                ? <p style={{...DS,fontSize:15,color:C.mut}}>{empty||"--"}</p>
                : <ul style={{paddingLeft:14}}>{items.map((x,i) => <li key={i} style={{...DS,fontSize:15,color:col,lineHeight:1.6,marginBottom:2}}>{x}</li>)}</ul>}
            </Bx>
          ))}
        </div>
        <Bx brd={C.gdim} bg="#100c02" pad="13px 15px" style={{marginBottom:14}}>
          <Lbl c={C.gold}>Next Scene Constraints -- read before writing your next scene prompt</Lbl>
          <ul style={{paddingLeft:16}}>
            {(report.next_scene_constraints||[]).map((c,i) => <li key={i} style={{...DS,fontSize:17,color:C.gold,lineHeight:1.7,marginBottom:3}}>{c}</li>)}
          </ul>
        </Bx>
        <div style={{display:"flex",gap:10}}>
          {report.spine_status !== "CRITICAL_DRIFT" && <PriBtn onClick={onProceed} bg={C.grn}>Proceed to Next Scene</PriBtn>}
          <PriBtn onClick={onHalt} bg={report.spine_status==="CRITICAL_DRIFT"?C.red:"#3a2a10"} fg={report.spine_status==="CRITICAL_DRIFT"?"#fff":C.gold}>{report.spine_status==="CRITICAL_DRIFT"?"Halt -- Revise Brief":"Revise + Restart"}</PriBtn>
        </div>
      </div>
    </div>
  );
}

export default function ProseLabV3() {
  const [tab,setTab] = useState("brief");
  const [brief,setBrief] = useState({purpose:"",emotionalArc:"",mustEstablish:"",mustLeaveOpen:"",mustNotHappen:""});
  const [locked,setLocked] = useState(false);
  const [author,setAuthor] = useState("N.K. Jemisin");
  const [scene,setScene] = useState("");
  const [iters,setIters] = useState([]);
  const [paras,setParas] = useState([]);
  const [scenes,setScenes] = useState([]);
  const [lp,setLp] = useState("idle");
  const [gp,setGp] = useState("idle");
  const [gov,setGov] = useState(null);
  const [busy,setBusy] = useState(false);
  const [constraints,setConstraints] = useState([]);
  const [loaded,setLoaded] = useState(false);
  const [saveMsg,setSaveMsg] = useState("");
  const ref = useRef(null);

  // Restore on mount
  useEffect(() => {
    restore().then(saved => {
      if (saved) {
        if (saved.brief) setBrief(saved.brief);
        if (saved.locked !== undefined) setLocked(saved.locked);
        if (saved.author) setAuthor(saved.author);
        if (saved.scenes) setScenes(saved.scenes);
        if (saved.constraints) setConstraints(saved.constraints);
        if (saved.paras) setParas(saved.paras);
        if (saved.scene) setScene(saved.scene);
        setSaveMsg("Session restored.");
        setTimeout(() => setSaveMsg(""), 2500);
      }
      setLoaded(true);
    });
  }, []);

  // Auto-save whenever key state changes
  useEffect(() => {
    if (!loaded) return;
    persist({ brief, locked, author, scenes, constraints, paras, scene });
    setSaveMsg("Saved.");
    const t = setTimeout(() => setSaveMsg(""), 1200);
    return () => clearTimeout(t);
  }, [brief, locked, author, scenes, constraints, paras, scene, loaded]);

  const clearAll = async () => {
    if (!window.confirm("Clear all work? This cannot be undone.")) return;
    try { await window.storage.delete(SAVE_KEY); } catch(e) {}
    setBrief({purpose:"",emotionalArc:"",mustEstablish:"",mustLeaveOpen:"",mustNotHappen:""});
    setLocked(false); setAuthor("N.K. Jemisin"); setScene(""); setIters([]);
    setParas([]); setScenes([]); setLp("idle"); setGp("idle"); setGov(null); setConstraints([]);
  };

  const briefOk = brief.purpose && brief.emotionalArc && brief.mustLeaveOpen;

  const runLoop = async () => {
    if (!scene.trim() || busy) return;
    setBusy(true); setIters([]); setLp("generating"); setGov(null);
    let fb = null;
    for (let i = 0; i < 3; i++) {
      let para;
      try { para = await generate(scene, author, fb); }
      catch(e) {
        setIters(p => [...p,{num:i+1,paragraph:"[Error: "+e.message+"]",critique:{scores:{rhythm:0,metaphor:0,specificity:0,emotional_weight:0,originality:0},failure_modes_flagged:["api_error"],verdict:"REWRITE",annotation:e.message,rewrite_instruction:"Check connection."}}]);
        setLp("error"); setBusy(false); return;
      }
      setLp("critiquing");
      let crit;
      try { crit = await critique(para, author); }
      catch(e) { crit = {scores:{rhythm:3,metaphor:3,specificity:3,emotional_weight:3,originality:3},failure_modes_flagged:["api_error"],verdict:"REWRITE",annotation:"Critic error: "+e.message,rewrite_instruction:"Retry."}; }
      setIters(p => [...p,{num:i+1,paragraph:para,critique:crit}]);
      setTimeout(() => ref.current && ref.current.scrollIntoView({behavior:"smooth",block:"nearest"}), 80);
      if (crit.verdict === "APPROVED") { setParas(p => [...p,para]); setLp("approved"); setBusy(false); return; }
      fb = crit;
      if (i < 2) setLp("generating");
    }
    setLp("human_review"); setBusy(false);
  };

  const submitGov = async () => {
    if (paras.length === 0 || !locked) return;
    const obj = {prompt:scene, paragraphs:[...paras]};
    const all = [...scenes, obj];
    setGp("running");
    try {
      const rep = await governor(brief, all);
      setGov(rep);
      setScenes(all.map((s,i) => i===all.length-1 ? {...s,govReport:rep} : s));
      setGp("done");
      if (rep.next_scene_constraints) setConstraints(rep.next_scene_constraints);
    } catch(e) {
      setGp("done");
      setGov({spine_status:"DRIFTING",scene_count_evaluated:all.length,what_has_been_established:[],premature_resolutions:[],missing_threads:[],pacing_flags:["Error: "+e.message],texture_flags:[],next_scene_constraints:["Retry governor"],governor_note:"Error: "+e.message});
    }
  };

  const reset = () => { setIters([]); setParas([]); setScene(""); setLp("idle"); setGov(null); setGp("idle"); };

  const phases = {idle:null,generating:[C.gold,"GENERATING..."],critiquing:[C.pur,"CRITIQUING..."],approved:[C.grn,"PARAGRAPH APPROVED"],human_review:[C.red,"HUMAN REVIEW -- 3 FAILURES"],error:[C.red,"ERROR"]};
  const ph = phases[lp];

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.txt,...DS}}>
      <style>{GF}</style>

      <div style={{borderBottom:"1px solid "+C.brd,padding:"14px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:C.bg,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <span style={{...PF,fontSize:26,fontWeight:900}}>PROSE<span style={{color:C.gold}}>LAB</span></span>
          <span style={{...CP,fontSize:13,color:C.mut,letterSpacing:"0.16em"}}>v3 -- CORPUS-INJECTED</span>
          {saveMsg && <span style={{...CP,fontSize:13,color:saveMsg.startsWith("Session")?C.grn:C.mut,letterSpacing:"0.1em"}}>{saveMsg}</span>}
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          {[["brief","BRIEF"],["write","WRITE"],["chapter","MANUSCRIPT"],["corpus","CORPUS"]].map(([id,lbl]) => (
            <GhostBtn key={id} onClick={() => setTab(id)} active={tab===id}>{lbl}</GhostBtn>
          ))}
          <button onClick={clearAll} style={{background:"none",border:"1px solid "+C.rBr,color:C.red,padding:"6px 10px",...CP,fontSize:13,cursor:"pointer",borderRadius:2,marginLeft:6}}>CLEAR ALL</button>
        </div>
      </div>

      <div style={{padding:"24px",maxWidth:1140,margin:"0 auto"}}>

        {tab === "brief" && (
          <div className="fd">
            <h2 style={{...PF,fontSize:28,fontWeight:700,marginBottom:6}}>Chapter Brief</h2>
            <p style={{fontSize:17,color:C.mut,lineHeight:1.6,marginBottom:18}}>The Governor reads this document after every approved scene. A vague brief produces a governor with no teeth.</p>
            {locked && (
              <div style={{marginBottom:14,padding:"8px 14px",background:C.gBg,border:"1px solid "+C.gBr,borderRadius:3,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{...CP,fontSize:14,color:C.grn}}>BRIEF LOCKED -- Governor initialised</span>
                <GhostBtn onClick={() => setLocked(false)}>Edit Brief</GhostBtn>
              </div>
            )}
            <div style={{display:"grid",gap:14}}>
              {[
                {k:"purpose",l:"Dramatic Purpose -- one sentence only. If you cannot write it in one sentence, the chapter does not have one yet.",ph:"e.g. The protagonist discovers the resistance she has been leading is a construct of the system she is fighting."},
                {k:"emotionalArc",l:"Emotional Arc -- where does the reader enter and where do they exit?",ph:"e.g. Enters with cautious hope. Exits with certainty that betrayal is structural, not personal."},
                {k:"mustEstablish",l:"What this chapter must establish, seed, or resolve for the larger novel",ph:"e.g. The reader must begin to doubt the narrator's account of the founding event."},
                {k:"mustLeaveOpen",l:"What must remain unresolved when the chapter closes",ph:"e.g. Whether Yeine knows she is being manipulated or is herself the manipulator."},
                {k:"mustNotHappen",l:"What must never happen in this chapter under any circumstances",ph:"e.g. The secondary antagonist must not be revealed. The protagonist must not find hope."},
              ].map(({k,l,ph}) => (
                <Bx key={k} pad="14px 16px">
                  <Lbl>{l}</Lbl>
                  <textarea disabled={locked} value={brief[k]} onChange={e => setBrief(p => ({...p,[k]:e.target.value}))} placeholder={ph} rows={2}
                    style={{width:"100%",background:locked?C.bg:C.sur,border:"1px solid "+(locked?C.brd:C.gdim),borderRadius:3,color:C.txt,padding:"9px 11px",...DS,fontSize:17,lineHeight:1.6,resize:"vertical",opacity:locked?0.7:1}} />
                </Bx>
              ))}
            </div>
            <div style={{marginTop:18,display:"flex",gap:10,alignItems:"center"}}>
              {!locked && <PriBtn onClick={() => { if (briefOk) { setLocked(true); setTab("write"); }}} disabled={!briefOk}>Lock Brief + Start Writing</PriBtn>}
              {!briefOk && <span style={{...CP,fontSize:14,color:C.mut}}>Complete Purpose, Emotional Arc, and Must Leave Open to proceed</span>}
            </div>
          </div>
        )}

        {tab === "write" && (
          <div className="fd">
            {!locked && (
              <div style={{padding:"10px 14px",background:C.rBg,border:"1px solid "+C.rBr,borderRadius:3,marginBottom:18,display:"flex",alignItems:"center",gap:14}}>
                <span style={{...CP,fontSize:14,color:C.red}}>No locked brief -- Governor cannot operate.</span>
                <GhostBtn onClick={() => setTab("brief")}>Go to Brief</GhostBtn>
              </div>
            )}
            {constraints.length > 0 && (
              <Bx brd={C.gdim} bg="#100c02" pad="13px 15px" style={{marginBottom:18}}>
                <Lbl c={C.gold}>Active Governor Constraints -- read before writing this scene prompt</Lbl>
                <ul style={{paddingLeft:16}}>{constraints.map((c,i) => <li key={i} style={{fontSize:17,color:C.gold,lineHeight:1.7,marginBottom:3}}>{c}</li>)}</ul>
              </Bx>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:16,marginBottom:16,alignItems:"start"}}>
              <div>
                <Lbl>Scene Prompt -- a director's note, not a summary</Lbl>
                <textarea value={scene} onChange={e => setScene(e.target.value)} disabled={busy}
                  placeholder={"Describe the dramatic action, who is present, and what shifts from start to end.\n\ne.g. Syen realises mid-conversation that the orogene child she has been training to survive is the same child whose death she was ordered to prevent. She does not let it show."}
                  rows={5} style={{width:"100%",background:C.sur,border:"1px solid "+C.gdim,borderRadius:3,color:C.txt,padding:"11px 13px",...DS,fontSize:17,lineHeight:1.6,resize:"vertical"}} />
              </div>
              <div>
                <Lbl>Author Style</Lbl>
                <select value={author} onChange={e => setAuthor(e.target.value)}
                  style={{width:"100%",background:C.sur,border:"1px solid "+C.brd,color:C.txt,padding:"9px 10px",...DS,fontSize:17,borderRadius:3,cursor:"pointer",marginBottom:8}}>
                  {Object.keys(AUTH_LIST).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <p style={{...CP,fontSize:13,color:C.mut,lineHeight:1.7}}>{AUTH_LIST[author]}</p>
                {paras.length > 0 && (
                  <Bx bg={C.gBg} brd={C.gBr} pad="10px 12px" style={{marginTop:12}}>
                    <Lbl>Approved Paragraphs This Scene</Lbl>
                    <span style={{...PF,fontSize:30,fontWeight:700,color:C.grn}}>{paras.length}</span>
                  </Bx>
                )}
              </div>
            </div>

            <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:22}}>
              <PriBtn onClick={runLoop} disabled={busy || !scene.trim()}>{busy ? "Running Loop..." : "Run Generator + Critic Loop"}</PriBtn>
              {ph && <span style={{...CP,fontSize:15,color:ph[0],letterSpacing:"0.08em"}}>{ph[1]}</span>}
              {iters.length > 0 && !busy && <GhostBtn onClick={() => { setIters([]); setLp("idle"); }}>Clear Iterations</GhostBtn>}
            </div>

            <div ref={ref}>{iters.map(it => <IterCard key={it.num} iter={it} />)}</div>

            {paras.length > 0 && (
              <Bx brd={C.gBr} pad="16px 18px" style={{marginTop:14,marginBottom:18}}>
                <Lbl>Scene So Far -- {paras.length} approved paragraph{paras.length!==1?"s":""}</Lbl>
                {paras.map((p,i) => <p key={i} style={{...PF,fontSize:18,lineHeight:1.95,color:C.txt,fontStyle:"italic",marginBottom:16,textIndent:"2em"}}>{p}</p>)}
                <div style={{borderTop:"1px solid "+C.brd,paddingTop:12,display:"flex",gap:10,flexWrap:"wrap"}}>
                  {locked && <PriBtn onClick={submitGov} disabled={gp==="running"} bg={C.pur} fg="#fff">{gp==="running"?"Governor Running...":"Scene Complete -- Submit to Governor"}</PriBtn>}
                  <GhostBtn onClick={runLoop}>Add Another Paragraph</GhostBtn>
                </div>
              </Bx>
            )}

            <GovPanel report={gov}
              onProceed={() => { reset(); setTab("write"); }}
              onHalt={() => { reset(); setLocked(false); setTab("brief"); }} />
          </div>
        )}

        {tab === "chapter" && (
          <div className="fd">
            <div style={{marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
              <h2 style={{...PF,fontSize:28,fontWeight:700}}>Manuscript</h2>
              <span style={{...CP,fontSize:14,color:C.mut}}>{scenes.length} approved scene{scenes.length!==1?"s":""}</span>
            </div>
            {scenes.length === 0
              ? <p style={{fontSize:17,color:C.mut,padding:20}}>No approved scenes yet.</p>
              : scenes.map((s,si) => (
                <div key={si} style={{marginBottom:40}}>
                  <div style={{...CP,fontSize:13,color:C.mut,letterSpacing:"0.18em",marginBottom:16}}>SCENE {si+1} -- {s.prompt.slice(0,70)}{s.prompt.length>70?"...":""}</div>
                  {s.paragraphs.map((p,pi) => <p key={pi} style={{...PF,fontSize:19,lineHeight:2.05,color:C.txt,fontStyle:"italic",marginBottom:22,textIndent:"2em"}}>{p}</p>)}
                  {s.govReport && (
                    <div style={{marginTop:8,padding:"7px 12px",background:C.sur,border:"1px solid "+C.brd,borderRadius:3,display:"flex",gap:10,alignItems:"center"}}>
                      <span style={{...CP,fontSize:13,color:C.mut}}>GOVERNOR:</span>
                      <span style={{color:{ON_TRACK:C.grn,DRIFTING:C.amb,CRITICAL_DRIFT:C.red}[s.govReport.spine_status]||C.mut,...DS,fontSize:15,fontWeight:600}}>{s.govReport.spine_status}</span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {tab === "corpus" && (
          <div className="fd">
            <h2 style={{...PF,fontSize:28,fontWeight:700,marginBottom:6}}>Corpus Injection Map</h2>
            <p style={{fontSize:17,color:C.mut,lineHeight:1.6,marginBottom:22}}>What each NotebookLM session injected and which agent received it.</p>
            <div style={{display:"grid",gap:10}}>
              {[
                {s:"Session A -- Rhythm + Sentence Architecture",t:"Generator (all five authors)",c:"Syntactic Guillotine with exact corpus structure. Periodic Expansion with precise rhythm. Fragment taxonomy: trauma shock, exhausted inventory, isolated cognition, mythic incantation."},
                {s:"Session B -- Metaphor Strategy",t:"Generator + Critic failure taxonomy",c:"Four metaphor types with best/worst examples. Direct Equation, Appositive, Genitive Replacement, Verb Metaphor. Weakest patterns injected into Critic as vague_metaphor and announced_comparison."},
                {s:"Session C -- Emotional Rendering",t:"Generator + Critic failure taxonomy",c:"Ten emotional rendering patterns. Architecture of grief, dread, and wonder with exact corpus quotes. Three cases where direct emotional labels earn their place. Split between generator and Critic failure modes."},
                {s:"Session D -- World-Building Through Prose Texture",t:"Governor system prompt",c:"14 world-texture patterns with corpus quotes and generic failure versions. Ecological Lexicon, Casual Integration of the Miraculous, Unspoken Biological Baseline, Archaic Textural Friction. Governor checks these after every approved scene."},
                {s:"Session E -- Pacing + Momentum",t:"Governor system prompt",c:"Acceleration vs deceleration techniques. Ten transition mechanics: Phantom Prop, Material Transmutation, Tense Bleed, Em-Dash Whiplash, Scale-Shattering Preposition. Governor flags pacing mismatches and conventional transitions."},
                {s:"Session F -- Failure Mode Extraction",t:"Critic system prompt (primary source)",c:"Five before/after pairs: Over-explaining a shock (Bester), Emotional labeling (Butler), Marveling at magic (Jemisin), Safe detachment from alien concepts (Miev), Melodramatic summaries of failure (Le Guin). These are the primary failure mode definitions in the Critic's taxonomy."},
              ].map(({s,t,c}) => (
                <Bx key={s} pad="15px 17px" style={{borderLeft:"3px solid "+C.gdim}}>
                  <div style={{...CP,fontSize:13,fontWeight:700,color:C.gold,marginBottom:4}}>{s}</div>
                  <div style={{...CP,fontSize:13,color:C.pur,marginBottom:8}}>Injected into: {t}</div>
                  <p style={{fontSize:16,color:C.txt,lineHeight:1.65}}>{c}</p>
                </Bx>
              ))}
            </div>
            <Bx brd={C.gdim} bg={C.sur} pad="16px 18px" style={{marginTop:18}}>
              <Lbl c={C.gold}>API Keys -- where they go</Lbl>
              <p style={{fontSize:17,color:C.txt,lineHeight:1.75}}>
                Running inside Claude.ai: no key needed. The artifact uses Claude's built-in API access automatically.<br /><br />
                Running locally or in n8n: add your key as a request header in the callAPI function:<br />
                <span style={{...CP,fontSize:16,color:C.amb,display:"block",marginTop:8,padding:"8px 10px",background:C.card,borderRadius:3}}>"x-api-key": "sk-ant-YOUR_KEY_HERE"</span><br />
                For Gemini: swap the endpoint to generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent and add your Gemini key the same way.
              </p>
            </Bx>
          </div>
        )}

      </div>
    </div>
  );
}
