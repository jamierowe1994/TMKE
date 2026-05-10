// ============================================================== reveal on scroll
(()=>{
  const els = document.querySelectorAll('.reveal, .calendar, .around, .quote, .scroll, .tiles, .soon');
  els.forEach(e=>e.classList.add('reveal'));
  if('IntersectionObserver' in window){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){ e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, {threshold:.12, rootMargin:'0px 0px -8% 0px'});
    els.forEach(e=>io.observe(e));
  } else {
    els.forEach(e=>e.classList.add('is-in'));
  }
})();

// build calendar tape with multiple months
(()=>{
  const tape = document.getElementById('ptape-inner');
  if(!tape) return;
  const months = [
    {name:'May', year:2026, start:5, days:31, style:'Contemporary'},
    {name:'June', year:2026, start:1, days:30, style:'Classic'},
    {name:'July', year:2026, start:3, days:31, style:'Contemporary'},
    {name:'August', year:2026, start:6, days:31, style:'Classic'},
  ];
  const palette = ['#7a6e5c','#9a8c79','#8c7a64','#3d3a48','#5a5466','#a8a09a','#867c70','#c2b8a8','#7d6f5e','#4e4856','#8a7e6a','#6e6470','#a99f93','#574f5e','#9a8e7e','#b6ac9c','#3f3b48','#7d7286','#a89e90','#615968','#8e8478','#4a4452','#bfb5a4'];
  const types=['Educ.','Reel','Carousel','Static','Post','Promo','Service','Local'];

  const html = (m)=>{
    let tiles = '';
    for(let i=0;i<m.start-1;i++) tiles += '<div class="ptile" style="background:#5b5566;opacity:.35"></div>';
    for(let d=1; d<=m.days; d++){
      const c = palette[(d*3)%palette.length];
      const isNum = d===1 || d%7===2;
      const inner = isNum
        ? `<span class="ptile__num">${d}</span>`
        : `<span class="ptile__type">${types[(d*2)%types.length]}</span>`;
      tiles += `<div class="ptile" style="--bg:${c}">${inner}</div>`;
    }
    return `<div class="pmonth"><div class="pmonth__head"><span class="pmonth__name">${m.name} ${m.year}</span><span class="pmonth__sub">${m.style}</span></div><div class="pmonth__grid">${tiles}</div></div>`;
  };
  // duplicated for seamless loop
  const oneSet = months.map(html).join('');
  tape.innerHTML = oneSet + oneSet;
})();

(()=>{
  const screens = [...document.querySelectorAll('.pscreen')];
  const dots = [...document.querySelectorAll('#phone-pager .pager__dot')];
  if(!screens.length) return;

  // assign --i to tiles for stagger
  document.querySelectorAll('.pscreen__grid').forEach(g=>{
    [...g.children].forEach((c,i)=>c.style.setProperty('--i', i));
  });

  // animate counters
  const animateNumbers = (root)=>{
    root.querySelectorAll('.pstat__n').forEach(el=>{
      const target = +el.dataset.target;
      let n = 0; const dur = 900; const start = performance.now();
      const tick = (t)=>{
        const k = Math.min(1, (t-start)/dur);
        const eased = 1 - Math.pow(1-k, 3);
        el.textContent = Math.round(target*eased);
        if(k<1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  };

  let i = 0;
  let timer;
  const setActive = (idx, fromUser)=>{
    i = (idx+screens.length)%screens.length;
    screens.forEach((s,n)=>s.classList.toggle('pscreen--active', n===i));
    dots.forEach((d,n)=>d.classList.toggle('is-active', n===i));
    if(screens[i].dataset.i==='2') animateNumbers(screens[i]);
    // restart any per-screen tile animation
    screens[i].querySelectorAll('.ptile:not(.ptile--empty)').forEach(t=>{
      t.style.animation = 'none'; t.offsetHeight; t.style.animation = '';
    });
    if(timer) clearTimeout(timer);
    if(!fromUser) timer = setTimeout(()=>setActive(i+1), 4200);
    else timer = setTimeout(()=>setActive(i+1), 6200);
  };
  dots.forEach((d,n)=>d.addEventListener('click', ()=>setActive(n, true)));
  // start auto cycle once visible
  const phone = document.getElementById('phone');
  const start = ()=>{ setActive(0); io.disconnect(); };
  const io = new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting) start(); }), {threshold:.3});
  io.observe(phone);
})();

// ============================================================== Stop the Scroll: tabs + drag
(()=>{
  const pages = [...document.querySelectorAll('.rail__page')];
  const tabs = [...document.querySelectorAll('#scroll-tabs .tab')];
  const dots = [...document.querySelectorAll('#rail-pager .pager__dot')];
  if(!pages.length) return;

  // duplicate cards for seamless marquee
  pages.forEach(p=>{
    const track = p.querySelector('.rail__track');
    const clone = track.cloneNode(true);
    [...clone.children].forEach(c=>track.appendChild(c.cloneNode(true)));
    // remove the empty cloned wrapper
  });

  let active = 0;
  const setActive = (idx)=>{
    active = (idx+pages.length)%pages.length;
    pages.forEach((p,n)=>p.classList.toggle('is-active', n===active));
    tabs.forEach((t,n)=>t.setAttribute('aria-selected', n===active ? 'true':'false'));
    dots.forEach((d,n)=>d.classList.toggle('is-active', n===active));
  };
  tabs.forEach((t,n)=>t.addEventListener('click', ()=>setActive(n)));
  dots.forEach((d,n)=>d.addEventListener('click', ()=>setActive(n)));

  // drag-to-scrub on each track: when dragging, switch to manual translateX
  pages.forEach(page=>{
    const track = page.querySelector('.rail__track');
    let down=false, startX=0, baseX=0, ax=0;

    const getCurrentX = ()=>{
      const t = getComputedStyle(track).transform;
      if(t === 'none') return 0;
      const m = t.match(/matrix.*\((.+)\)/);
      if(!m) return 0;
      const vals = m[1].split(',').map(Number);
      return vals[vals.length-2] || 0;
    };

    const onDown = (e)=>{
      down=true;
      startX = (e.touches?e.touches[0].clientX:e.clientX);
      baseX = getCurrentX();
      // freeze animation, switch to transform-based control
      track.style.animation='none';
      track.style.transform = `translateX(${baseX}px)`;
      ax = baseX;
      track.style.transition='none';
    };
    const onMove = (e)=>{
      if(!down) return;
      const x = (e.touches?e.touches[0].clientX:e.clientX);
      ax = baseX + (x-startX);
      // clamp to half (since duplicated)
      const max = -track.scrollWidth/2;
      if(ax < max) ax = max + (ax - max)*.3;
      if(ax > 0) ax = ax*.3;
      track.style.transform = `translateX(${ax}px)`;
    };
    const onUp = ()=>{
      if(!down) return;
      down=false;
      // smoothly resume marquee from current position by animating remaining distance
      const trackW = track.scrollWidth/2;
      const cur = ax;
      // figure out remaining time at marquee speed (60s for full -trackW)
      const speed = trackW/60; // px per s
      const dist = trackW + cur; // distance left to travel to -trackW (since cur is negative)
      const dur = Math.max(2, dist/speed);
      track.style.transition=`transform ${dur}s linear`;
      track.style.transform=`translateX(${-trackW}px)`;
      track.addEventListener('transitionend', ()=>{
        track.style.transition='none';
        track.style.transform='';
        track.style.animation='';
      }, {once:true});
    };

    track.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    track.addEventListener('touchstart', onDown, {passive:true});
    window.addEventListener('touchmove', onMove, {passive:true});
    window.addEventListener('touchend', onUp);
  });
})();
