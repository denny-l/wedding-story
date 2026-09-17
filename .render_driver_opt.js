// [최적화 오프라인 렌더 드라이버] 화면밖 컬링 + toBlob raw POST. 병렬(warmup) 지원.
// 검증: 컬링 프레임 == 원본 프레임 픽셀 동일(max diff 0). 카메라 화면-x = ax + camX (cam CSS translate3d).
// 사용: 각 탭에서 이 스크립트 주입 후 window.__job = window.__render(startIdx, endIdx) 로 비동기 발사, 디스크 폴링.
window.__render = async function(startIdx, endIdx){
  const fps=120, W=1280, Hh=720, M=300, VBW=1920;
  const scene=document.getElementById('scene'), grain=document.getElementById('grain');
  const cap=document.getElementById('caption'), capText=document.getElementById('capText');
  const camEl=document.getElementById('cam');
  const cv=document.createElement('canvas'); cv.width=W; cv.height=Hh; const ctx=cv.getContext('2d');
  const VARS=':root,svg{--board:#0e0e0f;--chalk:#f2ede2;--gold:#e9c552;--rose:#ef8fa9;--azure:#6fa9d9;--leaf:#7cb972;--ember:#e8677d;--lilac:#b79ce0;--coral:#f2a65a;--cloud:#cfe0ea;--moon:#f4e6a8;--muted:rgba(242,237,226,.55)}';
  const XS=new XMLSerializer();
  function toImg(el){ let s=XS.serializeToString(el).replace(/(<svg\b[^>]*>)/,'$1<style>'+VARS+'</style>'); const b=new Blob([s],{type:'image/svg+xml;charset=utf-8'}); const u=URL.createObjectURL(b); return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res([im,u]);im.onerror=()=>rej('e');im.src=u;}); }
  function blobOf(){ return new Promise(res=>cv.toBlob(res,'image/jpeg',0.92)); }
  window.requestAnimationFrame=function(){return 0;}; await document.fonts.ready; reset(); frame(0);
  for(let i=0;i<startIdx;i++){ frame(i/fps*1000); }   // warmup (no save)
  const t0=performance.now(); window.__done=startIdx; window.__err='';
  for(let i=startIdx;i<endIdx;i++){
    frame(i/fps*1000);
    const lg=document.getElementById('lineG'); if(lg) lg.style.opacity='1';
    items.forEach(it=>{ if(it._culled){ it.node.style.display=''; it._culled=false; } });
    // ── 화면밖 오브젝트 컬링(직렬화 대상 축소) ──
    const tm=/translate3d\(\s*(-?[\d.]+)px/.exec(camEl.style.transform||''); const camX=tm?+tm[1]:0;
    const det=[];
    items.forEach(it=>{ if(!it.node||!it.node.parentNode||it.ax==null||it.pin) return;
      const sx=it.ax+camX; if(sx<-M||sx>VBW+M){ det.push([it.node,it.node.parentNode,it.node.nextSibling]); it.node.parentNode.removeChild(it.node); } });
    ctx.fillStyle='#0e0e0f'; ctx.fillRect(0,0,W,Hh);
    try{ const r=await toImg(scene); ctx.drawImage(r[0],0,0,W,Hh); URL.revokeObjectURL(r[1]); }catch(e){ window.__err='scene:'+e; }
    for(let k=det.length-1;k>=0;k--){ try{ det[k][1].insertBefore(det[k][0],det[k][2]); }catch(e){ det[k][1].appendChild(det[k][0]); } }
    try{ const r=await toImg(grain); ctx.globalAlpha=0.5; ctx.drawImage(r[0],0,0,W,Hh); ctx.globalAlpha=1; URL.revokeObjectURL(r[1]); }catch(e){}
    const op=parseFloat(getComputedStyle(cap).opacity)||0, txt=(capText.textContent||'');
    if(op>0.01&&txt){ ctx.save(); ctx.globalAlpha=Math.min(1,op);
      const isMid=cap.classList.contains('mid'); const fs=Math.round(W*(isMid?0.040:0.031));
      ctx.font='400 '+fs+'px Gaegu, sans-serif'; ctx.fillStyle=getComputedStyle(cap).color||'#f2ede2'; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.shadowColor='rgba(242,237,226,.4)'; ctx.shadowBlur=W*0.012;
      const Ls=txt.split('\n'), lh=fs*1.55; let y = isMid ? (Hh*0.5 - Ls.length*lh/2 + lh*0.15) : Hh*0.855;   // mid=화면 세로 중앙(인트로 타이틀), 기본=하단
      let lastY=y, lastLine='';
      for(const ln of Ls){ ctx.fillText(ln,W/2,y); if(ln!==''){ lastY=y; lastLine=ln; } y+=lh; } ctx.restore();
      // ── 분필 조각(chalkStick) 합성: 자막 쓰는 동안 텍스트 끝에 백묵(회전 wobble) + 가루 glow ──
      try{ const cs=document.getElementById('chalkStick'); const csOp=parseFloat(getComputedStyle(cs).opacity)||0;
        if(csOp>0.01 && lastLine!==''){ ctx.save(); ctx.font='400 '+fs+'px Gaegu, sans-serif';
          const lw=ctx.measureText(lastLine).width, sw=0.26*fs, sh=0.92*fs;
          const sx=W/2+lw/2+0.12*fs, sTop=lastY+0.06*fs, sBot=sTop+sh, cxp=sx+sw/2;
          const rm=/rotate\(([-0-9.]+)deg\)/.exec(cs.style.transform||''); const ang=rm?parseFloat(rm[1])*Math.PI/180:0;
          ctx.globalAlpha=Math.min(1,op*csOp);
          ctx.translate(cxp,sBot); ctx.rotate(ang); ctx.translate(-cxp,-sBot);
          var _cc=getComputedStyle(cap).color, _gm=/(\d+)\D+(\d+)\D+(\d+)/.exec(_cc), _gold=_gm&&+_gm[1]>200&&+_gm[2]>150&&+_gm[3]<130;   // 자막 gold면 분필도 gold(페이지 일치)
          const g=ctx.createLinearGradient(sx,sTop,sx+sw,sBot);
          if(_gold){ g.addColorStop(0,'#fff6cf'); g.addColorStop(.48,'#eecb56'); g.addColorStop(1,'#caa233'); }
          else { g.addColorStop(0,'#fffdf5'); g.addColorStop(.48,'#f0e9da'); g.addColorStop(1,'#cec5b0'); }
          ctx.shadowColor='rgba(255,253,245,.45)'; ctx.shadowBlur=12; ctx.fillStyle=g;
          ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(sx,sTop,sw,sh,[sw*0.22,sw*0.22,sw*0.4,sw*0.4]); else ctx.rect(sx,sTop,sw,sh); ctx.fill();
          ctx.shadowBlur=6; ctx.fillStyle='rgba(255,253,245,.5)'; ctx.beginPath(); ctx.arc(cxp,sBot+0.1*fs,0.17*fs,0,7); ctx.fill();
          ctx.restore(); }
      }catch(e){} }
    const blob=await blobOf();
    await fetch('/?name=f_'+String(i).padStart(5,'0')+'.jpg',{method:'POST',body:blob});   // raw binary(=base64 인코딩 생략)
    window.__done=i+1;
  }
  window.__ms=performance.now()-t0; return window.__done;
};
'opt driver defined';
