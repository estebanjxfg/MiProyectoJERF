import { softmax, topk } from './utils.js';
async function fetchJson(url){ const res = await fetch(url); if (!res.ok) throw new Error(`No se pudo cargar ${url}`); return res.json(); }
export class ModelHelper{
  constructor(baseUrl, kind='image'){ this.baseUrl=baseUrl; this.kind=kind; this.model=null; this.labels=null; }
  async load(){
    try{ const meta = await fetchJson(`${this.baseUrl}/metadata.json`); this.labels = meta.labels || meta.labelsMap || meta.classes || ["clase A","clase B"]; }
    catch(e){ if (this.kind==='image') this.labels=["papel","cartón","plástico","vidrio","metales"]; if (this.kind==='audio') this.labels=["reggaetón","rap","salsa","electrónica"]; if (this.kind==='pose') this.labels=["sentadilla","flexión","plancha","dominada","zancada","burpee"]; }
    try{
      if (window.tf){ this.model = await tf.loadGraphModel(`${this.baseUrl}/model.json`);
        if (this.kind==='image'){ const dummy=tf.zeros([1,224,224,3]); this.model.execute(dummy); dummy.dispose(); }
      }
    }catch(e){ console.warn('No se pudo cargar modelo TFJS, se usará modo demo:', e); this.model=null; }
  }
  async inferImage(imageLike){
    const t0=performance.now(); let probs;
    if (this.model && window.tf){
      const out = tf.tidy(()=>{ const inp=tf.browser.fromPixels(imageLike).resizeBilinear([224,224]).toFloat().div(255).expandDims(0); const pred=this.model.execute(inp); return Array.from(pred.dataSync()); });
      probs = softmax(out);
    }else{ const base=[Math.random(),Math.random(),Math.random(),Math.random(),Math.random()]; const s=base.reduce((a,b)=>a+b,0); probs=base.map(x=>x/s); }
    const t1=performance.now(); const { top1, top3 } = topk(this.labels, probs, 3); return { top1, top3, latencyMs: t1-t0 };
  }
  async inferAudio(featureVector){
    const t0=performance.now(); let probs;
    if (featureVector && featureVector.length){
      const mean=featureVector.reduce((a,b)=>a+b,0)/featureVector.length;
      const bass=featureVector.slice(0,10).reduce((a,b)=>a+b,0)/(10||1);
      const treble=featureVector.slice(-10).reduce((a,b)=>a+b,0)/(10||1);
      probs = softmax([bass, mean, treble, Math.abs(treble-bass)]);
    }else{ const base=[Math.random(),Math.random(),Math.random(),Math.random()]; const s=base.reduce((a,b)=>a+b,0); probs=base.map(x=>x/s); }
    const t1=performance.now(); const { top1, top3 } = topk(this.labels, probs, 3); return { top1, top3, latencyMs: t1-t0 };
  }
  async inferPose(poseFeatures){
    const t0=performance.now(); let probs;
    if (poseFeatures){ const { kneeAngle=180, elbowAngle=180, hipY=0.5 }=poseFeatures; probs=softmax([180-kneeAngle, 180-elbowAngle, 10, 5, 10*(1-hipY), 3]); }
    else { const base=[Math.random(),Math.random(),Math.random(),Math.random(),Math.random(),Math.random()]; const s=base.reduce((a,b)=>a+b,0); probs=base.map(x=>x/s); }
    const t1=performance.now(); const { top1, top3 } = topk(this.labels, probs, 3); return { top1, top3, latencyMs: t1-t0 };
  }
}