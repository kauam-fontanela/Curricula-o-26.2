/* A Aventura das Letras — lógica do jogo */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const CHAVE = 'exploradores_v1';
  const CORES_OPC = ['#ff9f43', '#35c2b5', '#8b7bff', '#ff7eb6'];
  const POR_MUNDO = 5;

  /* ---------------- mensagens (sempre gentis) ---------------- */
  const ACERTOS = [
    'Muito bem!', 'Parabéns!', 'Isso mesmo!', 'Você é demais!', 'Que legal, você acertou!',
    'Uhuul! Mandou bem!', 'Perfeito!', 'Boa! Você é um(a) craque!'
  ];
  const TENTE_DE_NOVO = [
    'Não foi dessa vez, tente de novo! Você vai conseguir! 💛',
    'Quase! Vamos tentar mais uma vez? Eu acredito em você! 💛',
    'Tudo bem, é assim que a gente aprende! Tente de novo! 🌈',
    'Ops, não foi essa! Olhe com calma e tente outra vez, você consegue! ⭐',
    'Não foi dessa vez, mas na próxima você vai conseguir! 💪'
  ];
    const INTRO = [
    'Toque na resposta que você achar certa!',
    'Vamos lá! Escolha a sua resposta!',
    'Olhe com atenção e toque na resposta!'
  ];
  const sorteia = a => a[Math.floor(Math.random() * a.length)];

  /* ---------------- estado e progresso ---------------- */
  let progresso = carregar();          // { feitas: { "0": {t: tentativasErradas}, ... } }
  let som = true;
  let mundoAtual = 0, indiceAtual = 0, erros = 0, resolvida = false;

  function carregar() {
    try {
      const j = JSON.parse(localStorage.getItem(CHAVE));
      if (j && j.feitas) return j;
    } catch (e) { /* sem armazenamento: tudo bem */ }
    return { feitas: {} };
  }
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(progresso)); } catch (e) { /* ignora */ }
  }
  const qid = (w, i) => w * POR_MUNDO + i;
  const feita = id => progresso.feitas[id] !== undefined;
  const totalFeitas = () => Object.keys(progresso.feitas).length;
  const mundoCompleto = w => Array.from({ length: POR_MUNDO }, (_, i) => feita(qid(w, i))).every(Boolean);
  const mundosCompletos = () => WORLDS.filter(m => mundoCompleto(m.id)).length;
  const proximoMundo = () => { const m = WORLDS.find(m => !mundoCompleto(m.id)); return m ? m.id : -1; };

  /* ---------------- telas ---------------- */
  function mostrar(id) {
    $$('.tela').forEach(t => t.classList.toggle('ativa', t.id === id));
    window.scrollTo(0, 0);
    if (id !== 'tela-pergunta') calar();
  }

  /* ---------------- voz (leitura em voz alta) ---------------- */
  const temVoz = 'speechSynthesis' in window;
  let vozPt = null;
  function escolherVoz() {
    if (!temVoz) return;
    const vs = speechSynthesis.getVoices();
    vozPt = vs.find(v => /pt[-_]BR/i.test(v.lang)) || vs.find(v => /^pt/i.test(v.lang)) || null;
  }
  if (temVoz) { escolherVoz(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', escolherVoz); }

  function falar(texto, aoFim) {
    if (!temVoz || !som || !texto) { aoFim && aoFim(); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR'; if (vozPt) u.voice = vozPt;
      u.rate = 0.88; u.pitch = 1.15;
      u.onend = () => aoFim && aoFim();
      u.onerror = () => aoFim && aoFim();
      speechSynthesis.speak(u);
    } catch (e) { aoFim && aoFim(); }
  }
  /* ---- narração das perguntas: arquivos em audio/questao-NN.mp3 ---- */
  let narracao = null;
  function tocarNarracao(num, aoFim, textoReserva) {
    pararNarracao();
    if (!som) { aoFim && aoFim(); return; }
    const a = new Audio('audio/questao-' + String(num).padStart(2, '0') + '.mp3');
    narracao = a;
    let fim = false; const acabar = () => { if (!fim) { fim = true; aoFim && aoFim(); } };
    a.addEventListener('ended', acabar);
    a.addEventListener('error', () => { if (narracao === a) falar(textoReserva, aoFim); });
    a.play().catch(() => acabar());
  }
  function tocarLatido() {
    if (!som) return;
    pararNarracao(); try { temVoz && speechSynthesis.cancel(); } catch (e) { /* ignora */ }
    const a = new Audio('audio/latido.mp3'); narracao = a;
    a.addEventListener('error', () => sfx.latido());
    a.play().catch(() => sfx.latido());
  }
  function pararNarracao() { if (narracao) { narracao.pause(); narracao = null; } }
  function calar() { pararNarracao(); try { temVoz && speechSynthesis.cancel(); } catch (e) { /* ignora */ } }

  /* ---------------- efeitos sonoros (WebAudio, sem arquivos) ---------------- */
  let ctx = null;
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tom(freq, ini, dur, tipo = 'sine', vol = 0.18, slide) {
    const c = audio(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(freq, c.currentTime + ini);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + ini + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime + ini);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + ini + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ini + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + ini); o.stop(c.currentTime + ini + dur + 0.05);
  }
  const sfx = {
    acerto() { if (!som) return; [523, 659, 784, 1047].forEach((f, i) => tom(f, i * 0.09, 0.28, 'triangle', 0.2)); },
    tente()  { if (!som) return; tom(392, 0, 0.18, 'sine', 0.12); tom(523, 0.14, 0.26, 'sine', 0.12); }, // "bu-bip" suave e amigável
    toque()  { if (!som) return; tom(660, 0, 0.08, 'sine', 0.08); },
    fim()    { if (!som) return; [523, 659, 784, 659, 784, 1047].forEach((f, i) => tom(f, i * 0.13, 0.32, 'triangle', 0.2)); },
    palma()  {
      if (!som) return; const c = audio(); if (!c) return;
      const n = c.sampleRate * 0.08, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
      const s = c.createBufferSource(); s.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7;
      const g = c.createGain(); g.gain.value = 0.9;
      s.connect(f).connect(g).connect(c.destination); s.start();
    },
    latido() {
      if (!som) return;
      [0, 0.38].forEach(t => {
        tom(520, t, 0.2, 'sawtooth', 0.16, 190);
        tom(260, t, 0.2, 'square', 0.07, 120);
      });
    }
  };

  /* ---------------- confete ---------------- */
  function confete(qtd = 20) {
    const box = $('#confete');
    const em = ['⭐', '✨', '🎉', '💛', '🌟', '🎈'];
    for (let i = 0; i < qtd; i++) {
      const s = document.createElement('span');
      s.className = 'conf'; s.textContent = sorteia(em);
      s.style.left = Math.random() * 100 + 'vw';
      s.style.fontSize = 18 + Math.random() * 26 + 'px';
      s.style.animationDuration = 2 + Math.random() * 2.2 + 's';
      s.style.animationDelay = Math.random() * 0.5 + 's';
      box.appendChild(s);
      setTimeout(() => s.remove(), 5000);
    }
  }

  /* ---------------- mapa ---------------- */
  function desenharMapa() {
    const ol = $('#trilha'); ol.innerHTML = '';
    const prox = proximoMundo();
    WORLDS.forEach(m => {
      const li = document.createElement('li');
      li.className = 'estacao' + (mundoCompleto(m.id) ? ' completo' : '') + (m.id === prox ? ' proximo' : '');
      li.style.setProperty('--cor', m.cor);
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `${m.nome}. ${Array.from({ length: POR_MUNDO }, (_, i) => feita(qid(m.id, i))).filter(Boolean).length} de 5 estrelas`);
      const mini = Array.from({ length: POR_MUNDO }, (_, i) => `<i class="${feita(qid(m.id, i)) ? 'on' : ''}">⭐</i>`).join('');
      b.innerHTML = `<span class="bola" aria-hidden="true">${m.emoji}</span><span class="nome">${m.curto}</span><span class="mini" aria-hidden="true">${mini}</span>`;
      b.addEventListener('click', () => { sfx.toque(); abrirMundo(m.id); });
      li.appendChild(b); ol.appendChild(li);
    });
    $('#total-estrelas').textContent = `⭐ ${totalFeitas()} / ${WORLDS.length * POR_MUNDO}`;
    $('#btn-premio').hidden = mundosCompletos() < WORLDS.length;
    const falaMapa = $('#balao-mapa');
    if (mundosCompletos() === WORLDS.length) falaMapa.textContent = 'Você explorou tudo! Toque no troféu para ver seu prêmio! 🏆';
    else if (totalFeitas() === 0) falaMapa.textContent = 'Toque em um lugar para começar! Eu vou com você!';
    else falaMapa.textContent = 'Muito bem! Escolha outro lugar para explorar! ✨';
  }

  function irParaMapa() { desenharMapa(); mostrar('tela-mapa'); }

  /* ---------------- perguntas ---------------- */
  function abrirMundo(w) {
    mundoAtual = w;
    let i = 0;
    while (i < POR_MUNDO && feita(qid(w, i))) i++;
    if (i >= POR_MUNDO) i = 0;            // mundo já completo: revisitar do começo
    indiceAtual = i;
    mostrarPergunta();
  }

  function pontinhos() {
    const box = $('#pontinhos'); box.innerHTML = '';
    for (let i = 0; i < POR_MUNDO; i++) {
      const p = document.createElement('span');
      p.className = 'ponto' + (feita(qid(mundoAtual, i)) ? ' feito' : '') + (i === indiceAtual ? ' atual' : '');
      p.textContent = feita(qid(mundoAtual, i)) ? '⭐' : '';
      box.appendChild(p);
    }
  }

  function textoParaFalar(q) {
    const base = q.say || q.q;
    const ops = q.opts.map(o => o.say || o.t).join(', ou ');
    return `${base} ${ops}?`;
  }

  function mostrarPergunta() {
    const m = WORLDS[mundoAtual];
    const q = QUESTIONS[qid(mundoAtual, indiceAtual)];
    erros = 0; resolvida = false;
    mostrar('tela-pergunta');
    $('#mundo-nome').textContent = `${m.emoji} ${m.curto}`;
    pontinhos();
    $('#enunciado').textContent = q.q;

    // mídia
    const midia = $('#midia'); midia.innerHTML = '';
    if (q.eq) {
      const d = document.createElement('div'); d.className = 'eq'; d.setAttribute('role', 'img');
      d.setAttribute('aria-label', q.q);
      d.innerHTML = q.eq.map(t => ['+', '='].includes(t) ? `<span class="op">${t}</span>` : `<span>${t}</span>`).join('');
      midia.appendChild(d);
    } else if (q.img) {
      const im = document.createElement('img'); im.src = q.img; im.alt = q.alt || ''; im.draggable = false;
      midia.appendChild(im);
    } else if (q.placeholder) {
      const d = document.createElement('div'); d.className = 'misterio'; d.textContent = q.placeholder; d.setAttribute('aria-hidden', 'true');
      midia.appendChild(d);
    }

    // widgets especiais
    const wd = $('#widget'); wd.innerHTML = '';
    if (q.widget === 'bark') {
      const b = botaoWidget('🔊 Ouvir o som do bichinho', () => tocarLatido());
      wd.appendChild(b);
    } else if (q.widget === 'frase') {
      const b = botaoWidget('🎧 Ouvir a frase', () => falar(q.frase));
      wd.appendChild(b);
    } else if (q.widget === 'clap') {
      let n = 0;
      const sil = document.createElement('div'); sil.className = 'silabas'; sil.textContent = q.silabas !== undefined ? q.silabas : 'BA – NA – NA';
      if (!sil.textContent) sil.style.display = 'none';
      const box = document.createElement('div'); box.className = 'palmas-box';
      const cont = document.createElement('div'); cont.className = 'contador'; cont.textContent = '0'; cont.setAttribute('aria-live', 'polite');
      const bt = botaoWidget('👏 Bater palmas', (ev) => {
        n++; cont.textContent = String(n); sfx.palma();
        const p = document.createElement('span'); p.className = 'palma-pop'; p.textContent = '👏';
        const r = ev.currentTarget.getBoundingClientRect();
        p.style.left = (r.left + r.width / 2 - 20 + (Math.random() * 40 - 20)) + 'px'; p.style.top = (r.top - 10) + 'px';
        document.body.appendChild(p); setTimeout(() => p.remove(), 1000);
      });
      const zera = document.createElement('button'); zera.className = 'btn btn-pequeno btn-claro'; zera.type = 'button';
      zera.textContent = '↺'; zera.setAttribute('aria-label', 'Contar de novo');
      zera.addEventListener('click', () => { n = 0; cont.textContent = '0'; sfx.toque(); });
      box.append(bt, cont, zera);
      wd.append(sil, box);
    }

    // opções
    const op = $('#opcoes'); op.innerHTML = '';
    op.style.setProperty('--n', q.opts.length);
    q.opts.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'opcao'; b.dataset.i = i;
      b.style.setProperty('--c', o.sw || CORES_OPC[i % CORES_OPC.length]);
      b.setAttribute('aria-label', o.t);
      let h = '';
      if (o.img) h += `<img src="${o.img}" alt="" draggable="false">`;
      if (o.sw && !o.big) h += `<span class="cor" style="background:${o.sw}" aria-hidden="true"></span>`;
      if (o.e) h += `<span class="em" aria-hidden="true">${o.e}</span>`;
      if (o.big) h += `<span class="big${o.small ? ' small' : ''}" aria-hidden="true">${o.big}</span>`;
      if (!o.big || o.t.toLowerCase() !== o.big.toLowerCase()) h += `<span class="rot">${o.t}</span>`;
      b.innerHTML = h;
      b.addEventListener('click', () => escolher(i, b));
      op.appendChild(b);
    });

    // fala da Lulu
    setFala(sorteia(INTRO), '');
    $('#btn-proxima').hidden = true;
    $('#btn-proxima').innerHTML = (indiceAtual === POR_MUNDO - 1) ? 'Terminar este mundo <span class="ic">➜</span>' : 'Continuar <span class="ic">➜</span>';
    $('#mascote').className = 'mascote';

    // leitura automática (depois do primeiro toque do jogador, os navegadores permitem)
    setTimeout(() => { if (!resolvida && $('#tela-pergunta').classList.contains('ativa')) ouvirPergunta(); }, 350);
  }

  function botaoWidget(texto, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-grande btn-som-widget'; b.textContent = texto;
    b.addEventListener('click', fn);
    return b;
  }

  function setFala(txt, tipo) {
    const b = $('#balao'); b.textContent = txt; b.className = 'balao' + (tipo ? ' ' + tipo : '');
  }
  function animaMascote(c) {
    const m = $('#mascote'); m.className = 'mascote'; void m.offsetWidth; m.classList.add(c);
  }

  function ouvirPergunta() {
    const q = QUESTIONS[qid(mundoAtual, indiceAtual)];
    const bt = $('#btn-ouvir'); bt.classList.add('falando');
    if (q.semAudio) falar(textoParaFalar(q), () => bt.classList.remove('falando'));
    else tocarNarracao(qid(mundoAtual, indiceAtual) + 1, () => bt.classList.remove('falando'), textoParaFalar(q));
    if (!som) bt.classList.remove('falando');
  }

  function escolher(i, btn) {
    if (resolvida || btn.classList.contains('tentou')) return;
    const q = QUESTIONS[qid(mundoAtual, indiceAtual)];
    if (i === q.ok) return acertou(q, btn);
    // ----- tentativa que não deu certo: sempre com carinho -----
    erros++;
    btn.classList.add('tentou'); btn.disabled = true;
    sfx.tente();
    animaMascote('inclina');
    const restantes = $$('.opcao').filter(b => !b.classList.contains('tentou'));
    const msg = sorteia(TENTE_DE_NOVO);
    let texto = msg, voz = msg.replace(/[💛🌈⭐💪]/gu, '');
    if (erros >= 2 || restantes.length === 1) {
      $$('.opcao')[q.ok].classList.add('dica');
      texto += '  Olha, uma figurinha está brilhando! 😊';
      voz += ' Olha, uma figurinha está brilhando!';
    } else if (q.hint) {
      texto += '  Dica: ' + q.hint; voz += ' Dica: ' + q.hint;
    }
    setFala(texto, 'gentil'); falar(voz);
    $('#balao').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function acertou(q, btn) {
    resolvida = true;
    const id = qid(mundoAtual, indiceAtual);
    if (!feita(id)) { progresso.feitas[id] = { t: erros }; salvar(); }
    $$('.opcao').forEach(b => { b.disabled = true; b.classList.remove('dica'); });
    btn.classList.add('certa');
    sfx.acerto(); confete(); animaMascote('pula');
    // sem elogio da Lulu: só mostra a resposta certa (sem falar em voz alta)
    calar();
    setFala(`A resposta é: ${q.opts[q.ok].t}. ⭐`, 'bom');
    if (q.reveal) {
      const midia = $('#midia'); midia.innerHTML = '';
      const im = document.createElement('img'); im.src = q.reveal; im.alt = q.revealAlt || ''; im.className = 'revela';
      midia.appendChild(im);
    }
    pontinhos();
    $('#btn-proxima').hidden = false;
    setTimeout(() => $('#btn-proxima').focus({ preventScroll: true }), 50);
    $('#btn-proxima').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function proxima() {
    sfx.toque(); calar();
    if (indiceAtual < POR_MUNDO - 1) { indiceAtual++; mostrarPergunta(); return; }
    fimDoMundo();
  }

  function fimDoMundo() {
    const m = WORLDS[mundoAtual];
    desenharMapa(); mostrar('tela-mapa');
    if (mundosCompletos() === WORLDS.length) { setTimeout(mostrarFinal, 300); return; }
    $('#mm-emoji').textContent = m.emoji;
    $('#mm-titulo').textContent = 'Você completou: ' + m.curto + '!';
    $('#mm-texto').textContent = 'Parabéns! Você ganhou 5 estrelas novinhas!';
    $('#mm-estrelas').innerHTML = '<span>⭐</span><span style="animation-delay:.15s">⭐</span><span style="animation-delay:.3s">⭐</span><span style="animation-delay:.45s">⭐</span><span style="animation-delay:.6s">⭐</span>';
    $('#modal-mundo').hidden = false;
    sfx.fim(); confete(40);
    falar('Parabéns! Você completou ' + m.curto + ' e ganhou cinco estrelas!');
    setTimeout(() => $('#mm-ok').focus(), 60);
  }

  /* ---------------- final ---------------- */
  function mostrarFinal() {
    const box = $('#estrelas-final'); box.innerHTML = '';
    const total = totalFeitas();
    for (let i = 0; i < total; i++) {
      const s = document.createElement('span'); s.textContent = '⭐'; s.style.animationDelay = (i % 10) * 0.12 + 's'; box.appendChild(s);
    }
    $('#total-final').textContent = `Você ganhou ${total} estrelas!`;
    mostrar('tela-final');
    sfx.fim(); confete(60);
    falar(`Parabéns, explorador! Você completou a aventura e ganhou ${total} estrelas!`);
  }

  /* ---------------- área do adulto ---------------- */
  function abrirAdulto() {
    const linhas = WORLDS.map(m => {
      let ok = 0, feitas = 0, ajuda = [];
      for (let i = 0; i < POR_MUNDO; i++) {
        const r = progresso.feitas[qid(m.id, i)];
        if (r !== undefined) { feitas++; if (r.t === 0) ok++; else ajuda.push(m.id * POR_MUNDO + i + 1); }
      }
      return `<tr><td>${m.emoji} ${m.nome}</td><td class="n">${feitas}/5</td><td class="n">${ok}</td><td>${ajuda.length ? 'Nº ' + ajuda.join(', ') : '—'}</td></tr>`;
    }).join('');
    const totalOk = Object.values(progresso.feitas).filter(r => r.t === 0).length;
    $('#ad-corpo').innerHTML = `
      <table class="ad-tabela"><thead><tr><th>Tema</th><th>Feitas</th><th>De primeira</th><th>Precisou de ajuda</th></tr></thead><tbody>${linhas}</tbody></table>
      <p><b>Total:</b> ${totalFeitas()} de 40 questões concluídas · ${totalOk} respondidas de primeira.</p>
      <p class="ad-ajuda">Dica: os números indicam as questões do trabalho (1 a 40) em que a criança precisou tentar mais de uma vez — bons pontos para conversar e reforçar em outra brincadeira. Nenhuma pontuação é mostrada para a criança.</p>`;
    $('#modal-adulto').hidden = false; $('#ad-fechar').focus();
  }

  /* ---------------- ligações ---------------- */
  function iniciarJogo() {
    audio(); sfx.toque();
    if (mundosCompletos() === WORLDS.length) { desenharMapa(); mostrar('tela-mapa'); return; }
    desenharMapa(); mostrar('tela-mapa');
    falar($('#balao-mapa').textContent.replace(/[🦉✨🏆]/gu, ''));
  }
  function recomecar() {
    progresso = { feitas: {} }; salvar(); atualizarInicio();
  }
  function atualizarInicio() {
    const tem = totalFeitas() > 0;
    $('#txt-jogar').textContent = tem ? 'Continuar' : 'Jogar';
    $('#btn-recomecar').hidden = !tem;
  }

  $('#btn-jogar').addEventListener('click', iniciarJogo);
  $('#btn-recomecar').addEventListener('click', () => { audio(); sfx.toque(); recomecar(); iniciarJogo(); });
  $('#btn-jogar-de-novo').addEventListener('click', () => { sfx.toque(); recomecar(); desenharMapa(); mostrar('tela-mapa'); });
  $('#btn-premio').addEventListener('click', () => { sfx.toque(); mostrarFinal(); });
  $('#btn-ouvir').addEventListener('click', () => { audio(); ouvirPergunta(); });
  $('#btn-proxima').addEventListener('click', proxima);
  $('#mm-ok').addEventListener('click', () => { $('#modal-mundo').hidden = true; sfx.toque(); calar(); desenharMapa(); });
  $('#btn-adulto-inicio').addEventListener('click', abrirAdulto);
  const btnCred = $('#btn-creditos'), telaCred = $('#tela-creditos');
  if (btnCred) btnCred.addEventListener('click', () => { audio(); sfx.toque(); mostrar('tela-creditos'); });
  if (telaCred) telaCred.addEventListener('click', () => { sfx.toque(); atualizarInicio(); mostrar('tela-inicio'); });
  $('#btn-adulto-final').addEventListener('click', abrirAdulto);
  $('#ad-fechar').addEventListener('click', () => { $('#modal-adulto').hidden = true; });
  $$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m && m.id === 'modal-adulto') m.hidden = true; }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#modal-adulto').hidden = true; });

  $$('[data-acao]').forEach(b => b.addEventListener('click', () => {
    sfx.toque();
    if (b.dataset.acao === 'mapa') { irParaMapa(); }
    if (b.dataset.acao === 'inicio') { atualizarInicio(); mostrar('tela-inicio'); }
  }));

  $$('.btn-som').forEach(b => b.addEventListener('click', () => {
    som = !som;
    $$('.btn-som').forEach(x => x.textContent = som ? '🔊' : '🔇');
    if (!som) calar(); else sfx.toque();
  }));

  atualizarInicio();
})();
