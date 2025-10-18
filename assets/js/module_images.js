import { renderBars } from './ui.js';
import { ModelHelper } from './models.js';
import { setStatus, setLatency } from './main.js';

export class ImagesModule{
  constructor(){
    this.video = document.getElementById('imgVideo');
    this.canvas = document.getElementById('imgCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.badge = document.getElementById('imgBadge');
    this.top3El = document.getElementById('imgTop3');
    this.tooltip = document.getElementById('imgTooltip');
    this.sourceSel = document.getElementById('imgSource');
    this.fpsSel = document.getElementById('imgFps');
    this.upload = document.getElementById('imgUpload');
    this.btnStart = document.getElementById('imgStart');
    this.btnFreeze = document.getElementById('imgFreeze');
    this.model = new ModelHelper('./public/models/waste_sorting','image');
    this.running = false; this.frozen = false; this.stream = null;
    this.about = `<h4>Clasificación de desechos</h4>
      <p>Clases: papel, cartón, plástico, vidrio, metales. Usa webcam o imagen subida.</p>
      <p>Limitaciones: iluminación y ángulo pueden afectar el resultado. Limpia y seca los residuos.</p>
      <p>Para entrenar/mejorar: agrega más ejemplos variados por clase (iluminación, fondo, tamaños).</p>`;
  }
  async mount(){
    setStatus('Cargando…'); await this.model.load(); setStatus('OK','ok');
    this.btnStart.onclick = () => this.start();
    this.btnFreeze.onclick = () => { this.frozen = !this.frozen; this.btnFreeze.textContent = this.frozen?'▶️ Reanudar':'⏸️ Congelar'; };
    this.fpsSel.onchange = () => this.loop();
    this.sourceSel.onchange = () => this.switchSource();
    this.upload.onchange = (e) => this.onUpload(e);
    this.running = true; await this.switchSource();
  }
  async unmount(){ this.running = false; this.stopStream(); }
  async switchSource(){
    const src = this.sourceSel.value;
    if (src === 'webcam'){ await this.start(); } else { this.stopStream(); }
  }
  async onUpload(e){
    const file = e.target.files?.[0]; if (!file) return;
    const img = new Image();
    img.onload = async () => { this.canvas.width=img.width; this.canvas.height=img.height; this.ctx.drawImage(img,0,0);
      const out = await this.model.inferImage(this.canvas); this.render(out); };
    img.src = URL.createObjectURL(file);
  }
  async start(){
    try{
      this.stream = await navigator.mediaDevices.getUserMedia({video:true, audio:false});
      this.video.srcObject = this.stream; await this.video.play();
      this.canvas.width = this.video.videoWidth || 640; this.canvas.height = this.video.videoHeight || 360; this.loop();
    }catch(e){ setStatus('Sin permisos','warn'); console.error(e); }
  }
  stopStream(){ if (this.stream){ this.stream.getTracks().forEach(t=>t.stop()); this.stream=null; } }
  async loop(){
    const targetFps = parseInt(this.fpsSel.value||'15',10); const interval=1000/targetFps; if (!this.running) return;
    const step = async () => {
      if (!this.running) return;
      const t0 = performance.now();
      if (this.stream && !this.frozen){ this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height); }
      const out = await this.model.inferImage(this.canvas); this.render(out);
      const t1 = performance.now(); const spent = t1 - t0; const wait = Math.max(0, interval - spent); setTimeout(step, wait);
    };
    step();
  }
  render({top1, top3, latencyMs}){
    this.badge.textContent = `${top1.label.toUpperCase()} ${(top1.prob*100).toFixed(0)}%`;
    renderBars(this.top3El, top3, {'papel':'paper','cartón':'carton','plástico':'plastico','vidrio':'vidrio','metales':'metales'});
    setLatency(latencyMs);
    const tips={papel:'Papel: evita que esté sucio o húmedo; retira grapas si es posible.',
      'cartón':'Cartón: dóblalo para ahorrar espacio; límpialo si tiene grasa.',
      'plástico':'Plástico: enjuaga botellas y separa tapas si tu ciudad lo pide.',
      'vidrio':'Vidrio: enjuaga frascos; evita romperlos para seguridad.',
      'metales':'Metales: latas limpias y aplastadas; cuidado con bordes afilados.'};
    document.getElementById('imgTooltip').textContent = tips[top1.label] || 'Limpia y seca los residuos antes de separarlos.';
  }
}