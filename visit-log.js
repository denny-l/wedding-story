/* [방문 로그] 공용 — 방문자 IP·위치·기기·브라우저를 구글시트(Apps Script)에 기록.
   모든 페이지(index·1·2·3·video·library)에서 <script src="./visit-log.js"> 로 로드.
   매 접속마다 1행. no-cors fire-and-forget. IP API 차단 시 IP 없이라도 기록. */
(function(){
  var LOG_ENDPOINT='https://script.google.com/macros/s/AKfycbz_82M6GUCpo7rKJKpjVzVE2pLEV7X2A5all1oF4FkjNcPg1TPLL8P9ag9Y8c9S4l1J5A/exec';
  if(!/^https:\/\/script\.google\.com\//.test(LOG_ENDPOINT)) return;

  // 방문자 식별 — 브라우저 단위 영구 UUID(localStorage). 시크릿·캐시삭제·타브라우저면 새 ID.
  // 하드웨어 기기ID는 웹에서 취득 불가 → 이게 현실적 최선(재방문·순방문자 판별용).
  function visitorId(){
    try{
      var k='wsv_id', v=localStorage.getItem(k);
      if(!v){
        v=(window.crypto&&crypto.randomUUID)?crypto.randomUUID()
          :('x'+Date.now().toString(36)+Math.random().toString(36).slice(2,10));
        localStorage.setItem(k, v);
      }
      return v;
    }catch(e){ return ''; } // 저장 불가(시크릿 등)면 빈값
  }
  // 첫 방문 여부(같은 브라우저에서 이번이 처음 저장이면 true)
  function isFirstVisit(){
    try{ var f='wsv_seen'; if(localStorage.getItem(f)) return false; localStorage.setItem(f,'1'); return true; }
    catch(e){ return ''; }
  }

  // 모바일망 추정 — IP만으로는 확정 불가. 한국 이동통신 ASN/사업자명 키워드로 best-effort 추정.
  function netType(geo, dev){
    var asn=String((geo.connection&&geo.connection.asn)||geo.asn||'').toUpperCase();
    var org=String((geo.connection&&geo.connection.org)||geo.org||geo.isp||'').toUpperCase();
    // SKT AS9644 = 이동통신 전용. KT/LGU+는 유선·무선 공용 ASN이라 org 키워드로 보조 판단.
    if(/AS9644/.test(asn)) return '모바일(추정)';
    if(/SK TELECOM|SKTELECOM/.test(org)) return '모바일(추정)';
    if(/AS45996|AS55644/.test(asn)) return '모바일(추정)'; // KT/LGU+ 모바일 세부 ASN
    if(/LTE|5G|MOBILE|WIRELESS/.test(org)) return '모바일(추정)';
    return ''; // 그 외는 유선/미상 (빈값)
  }

  function parseUA(ua){
    var device='PC', os='', br='', m;
    // 기기
    if(/iPhone/.test(ua)) device='iPhone';
    else if(/iPad/.test(ua)) device='iPad';
    else if(/Android/.test(ua)) device=/Mobile/.test(ua)?'Android폰':'Android태블릿';
    else if(/Macintosh|Mac OS X/.test(ua)) device='Mac';
    else if(/Windows/.test(ua)) device='Windows';
    else if(/CrOS/.test(ua)) device='ChromeOS';
    // OS 버전
    if(m=ua.match(/iPhone OS (\d+)[_.](\d+)/)) os='iOS '+m[1]+'.'+m[2];
    else if(m=ua.match(/CPU OS (\d+)[_.](\d+)/)) os='iPadOS '+m[1]+'.'+m[2];
    else if(m=ua.match(/Android (\d+(?:\.\d+)?)/)) os='Android '+m[1];
    else if(m=ua.match(/Mac OS X (\d+)[_.](\d+)/)) os='macOS '+m[1]+'.'+m[2];
    else if(/Windows NT 10/.test(ua)) os='Windows 10/11';
    else if(m=ua.match(/Windows NT (\d+\.\d+)/)) os='Windows '+m[1];
    // 브라우저 (앱 내부 브라우저 우선)
    if(/KAKAOTALK/i.test(ua)) br='카카오톡';
    else if(/Instagram/i.test(ua)) br='인스타그램';
    else if(/\bLine\//i.test(ua) || /\bLIFF\b/.test(ua)) br='라인';
    else if(/NAVER\(inapp/i.test(ua) || /NAVER/i.test(ua)) br='네이버앱';
    else if(/FBAN|FBAV|FB_IAB/i.test(ua)) br='페이스북';
    else if(/DaumApps|daumdevice/i.test(ua)) br='다음앱';
    else if(/SamsungBrowser/i.test(ua)) br='삼성인터넷';
    else if(/EdgA?\//i.test(ua)) br='엣지';
    else if(/CriOS/i.test(ua)) br='크롬(iOS)';
    else if(/Chrome/i.test(ua)) br='크롬';
    else if(/FxiOS|Firefox/i.test(ua)) br='파이어폭스';
    else if(/Safari/i.test(ua)) br='사파리';
    else br='기타';
    return {device:device, os:os, browser:br};
  }

  function post(geo){
    var kst=new Date(Date.now()+9*3600*1000);
    var ua=navigator.userAgent||'', pu=parseUA(ua);
    var p={
      ts_kst: kst.toISOString().replace('T',' ').slice(0,19),
      visitor_id: visitorId(), first_visit: isFirstVisit(),
      net_type: netType(geo, pu.device),
      device: pu.device, os: pu.os, browser: pu.browser,
      ip: geo.ip||'', city: geo.city||'', region: geo.region||geo.region_name||'',
      country: geo.country||geo.country_name||'', country_code: geo.country_code||'',
      org: (geo.connection&&geo.connection.org)||geo.org||geo.isp||'',
      asn: (geo.connection&&geo.connection.asn)||geo.asn||'',
      lat: geo.latitude!=null?geo.latitude:'', lon: geo.longitude!=null?geo.longitude:'',
      postal: geo.postal||'', geo_tz: (geo.timezone&&(geo.timezone.id||geo.timezone))||'',
      lang: navigator.language||'', platform: navigator.platform||'',
      referrer: document.referrer||'',
      screen: (screen.width+'x'+screen.height), viewport: (innerWidth+'x'+innerHeight),
      dpr: window.devicePixelRatio||1, tz: (Intl.DateTimeFormat().resolvedOptions().timeZone)||'',
      page: location.pathname+location.search, ua: ua
    };
    try{ fetch(LOG_ENDPOINT,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(p)}); }catch(e){}
  }

  // IPinfo 응답 → 공통 geo 형태로 정규화 (loc="lat,lon", org="AS#### 이름")
  function fromIpinfo(d){
    var loc=(d.loc||'').split(','), org=d.org||'', asn='', mm=org.match(/^AS(\d+)\s+(.*)$/);
    if(mm){ asn='AS'+mm[1]; org=mm[2]; }
    return {ip:d.ip, city:d.city, region:d.region, country:d.country, country_code:d.country,
            org:org, asn:asn, latitude:loc[0]?+loc[0]:null, longitude:loc[1]?+loc[1]:null,
            postal:d.postal, timezone:d.timezone};
  }
  // 1차 IPinfo(무토큰, 유선 정확도 최상) → 2차 ipwho.is → 3차 ipapi.co → 실패면 IP 없이라도 기록
  fetch('https://ipinfo.io/json').then(function(r){return r.json();}).then(function(d){
    if(d&&d.ip&&!d.error){ post(fromIpinfo(d)); } else { throw 0; }
  }).catch(function(){
    fetch('https://ipwho.is/').then(function(r){return r.json();}).then(function(d){
      if(d&&d.success!==false&&d.ip){ post(d); } else { throw 0; }
    }).catch(function(){
      fetch('https://ipapi.co/json/').then(function(r){return r.json();}).then(function(d){
        post(d&&d.ip?d:{});
      }).catch(function(){ post({}); });
    });
  });
})();
