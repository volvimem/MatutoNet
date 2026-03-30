// =========================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO DO FIREBASE
// =========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDyCmGEBYtXmlbUhjpxK9799zs1QRNHNog",
  authDomain: "matutonett.firebaseapp.com",
  databaseURL: "https://matutonett-default-rtdb.firebaseio.com",
  projectId: "matutonett",
  storageBucket: "matutonett.firebasestorage.app",
  messagingSenderId: "200313185232",
  appId: "1:200313185232:web:1f092ca06d81bfc3d94fd5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let clienteIdEditando = null;
let custoIdEditando = null;
let graficoAtual = null;
let clienteAtualHistorico = null;
let deferredPrompt;

let dadosClientes = {};
let dadosCustos = {};
let dadosHistorico = {};
const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// =========================================================================
// 2. INICIALIZAÇÃO, PWA E LOCALSTORAGE
// =========================================================================
window.onload = () => {
    const d = new Date();
    
    // Recupera a aba
    const sessaoSalva = localStorage.getItem('sessaoAtual') || 'dashboard';
    window.mostrarSessao(sessaoSalva);

    // Filtros
    document.getElementById('dashMes').value = localStorage.getItem('dashMes') || "0";
    document.getElementById('dashAno').value = localStorage.getItem('dashAno') || d.getFullYear();
    document.getElementById('filtroMesCustos').value = localStorage.getItem('filtroMesCustos') || "0";
    document.getElementById('filtroAnoCustos').value = localStorage.getItem('filtroAnoCustos') || d.getFullYear();

    // Carrega Configurações de Cobrança Padrão ou Salvas
    const textoPadrao = `Olá, {nome}! Tudo bem? 📡\n\nConsta em nosso sistema da *MatutoNet* um débito pendente referente à sua internet no valor de *R$ {valor}*.\n\nO vencimento foi no dia *{vencimento}*. Para regularizar e evitar a suspensão do sinal, por favor, realize o pagamento via PIX para a chave abaixo e nos envie o comprovante:\n\n*Chave PIX:* {pix}\n\nQualquer dúvida, estamos à disposição. Muito obrigado!`;
    document.getElementById('configPix').value = localStorage.getItem('chavePix') || "";
    document.getElementById('configTexto').value = localStorage.getItem('textoCobranca') || textoPadrao;

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW erro:', err));
    }
};

['dashMes', 'dashAno', 'filtroMesCustos', 'filtroAnoCustos'].forEach(id => {
    document.getElementById(id).addEventListener('change', e => {
        localStorage.setItem(id, e.target.value);
        if (id.includes('dash')) window.atualizarDashboard();
        else window.renderizarCustos();
    });
});

// INSTALAÇÃO DO PWA (Banner visível no topo)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('bannerInstalacao');
    if (banner) {
        banner.style.display = 'block';
        banner.addEventListener('click', () => {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => {
                deferredPrompt = null;
                banner.style.display = 'none';
            });
        });
    }
});

window.mostrarSessao = function(idSessao) {
    document.querySelectorAll('.sessao').forEach(sessao => sessao.style.display = 'none');
    const el = document.getElementById(idSessao);
    if(el) el.style.display = 'block';
    localStorage.setItem('sessaoAtual', idSessao); 
};

// =========================================================================
// 3. MÁSCARAS E FORMULÁRIO DE CONFIGURAÇÃO
// =========================================================================
document.getElementById('telCliente').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    if (v.length > 7) v = v.replace(/(\d{1})(\d{4})(\d{4})$/, "$1 $2-$3");
    e.target.value = v;
});

document.getElementById('cpfCliente').addEventListener('input', e => {
    let v = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (v.length > 3) v = v.replace(/^(\d{3})(\d)/, "$1.$2");
    if (v.length > 6) v = v.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3");
    if (v.length > 9) v = v.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
    e.target.value = v;
});

// Salvar Ajustes
document.getElementById('formConfig').addEventListener('submit', function(e) {
    e.preventDefault();
    localStorage.setItem('chavePix', document.getElementById('configPix').value);
    localStorage.setItem('textoCobranca', document.getElementById('configTexto').value);
    Swal.fire('OK!', 'Suas configurações de cobrança foram salvas.', 'success');
    window.renderizarClientes(); // Atualiza os links do ZAP na hora
});

// =========================================================================
// 4. SINCRONIZAÇÃO EM TEMPO REAL
// =========================================================================
onValue(ref(db, 'clientes'), snp => { dadosClientes = snp.val() || {}; window.renderizarClientes(); window.atualizarDashboard(); });
onValue(ref(db, 'custos'), snp => { dadosCustos = snp.val() || {}; window.renderizarCustos(); window.atualizarDashboard(); });
onValue(ref(db, 'historico'), snp => { dadosHistorico = snp.val() || {}; window.renderizarClientes(); window.atualizarDashboard(); });

// =========================================================================
// 5. DASHBOARD E RELATÓRIOS
// =========================================================================
window.atualizarDashboard = function() {
    const mesF = parseInt(document.getElementById('dashMes').value);
    const anoF = document.getElementById('dashAno').value;
    let rec = 0, exp = 0, cst = 0;
    let arrR = Array(12).fill(0), arrC = Array(12).fill(0), arrL = Array(12).fill(0);

    Object.keys(dadosClientes).forEach(id => {
        const c = dadosClientes[id];
        const vP = parseFloat(c.plano) || 0;
        for(let m=1; m<=12; m++) {
            if (mesF === 0 || m === mesF) exp += vP;
            if (dadosHistorico[id]?.[anoF]?.[m] === 'pago') {
                arrR[m-1] += vP;
                if (mesF === 0 || m === mesF) rec += vP;
            }
        }
    });

    Object.keys(dadosCustos).forEach(id => {
        const p = (dadosCustos[id].data || "").split('/');
        if (p.length === 3 && p[2] === anoF) {
            const v = parseFloat(dadosCustos[id].valor) || 0;
            const m = parseInt(p[1], 10);
            arrC[m-1] += v;
            if (mesF === 0 || m === mesF) cst += v;
        }
    });

    document.getElementById('dashRecebido').innerText = `R$ ${rec.toFixed(2)}`;
    document.getElementById('dashPendente').innerText = `R$ ${(exp - rec) > 0 ? (exp - rec).toFixed(2) : '0.00'}`;
    document.getElementById('dashCustos').innerText = `R$ ${cst.toFixed(2)}`;
    document.getElementById('dashLucro').innerText = `R$ ${(rec - cst).toFixed(2)}`;

    for(let i=0; i<12; i++) arrL[i] = arrR[i] - arrC[i];
    const ctx = document.getElementById('graficoFinanceiro').getContext('2d');
    if(graficoAtual) graficoAtual.destroy();
    graficoAtual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: mesesNomes,
            datasets: [
                { label: 'Entradas', data: arrR, backgroundColor: '#10b981' },
                { label: 'Custos', data: arrC, backgroundColor: '#ef4444' },
                { label: 'Lucro', data: arrL, type: 'line', borderColor: '#3b82f6', fill: false }
            ]
        }
    });
};

// =========================================================================
// 6. GESTÃO DE CLIENTES (COM ATRASO AUTOMÁTICO E ABAS SEPARADAS)
// =========================================================================
document.getElementById('formNovoCliente').addEventListener('submit', function(e) {
    e.preventDefault();
    const nomeInput = document.getElementById('nomeCliente').value.trim();
    const cpfInput = document.getElementById('cpfCliente').value.trim();

    if (!clienteIdEditando) {
        const jaExiste = Object.values(dadosClientes).some(c => c.nome.toLowerCase() === nomeInput.toLowerCase() && c.cpf === cpfInput);
        if (jaExiste) { Swal.fire('Atenção!', 'Cliente já cadastrado.', 'warning'); return; }
    }

    const cData = {
        nome: nomeInput, cpf: cpfInput,
        telefone: document.getElementById('telCliente').value,
        bairro: document.getElementById('bairroCliente').value,
        cidade: document.getElementById('cidadeCliente').value,
        vencimento: document.getElementById('vencimentoCliente').value,
        plano: parseFloat(document.getElementById('planoCliente').value) || 0,
    };

    const acao = clienteIdEditando ? update(ref(db, 'clientes/' + clienteIdEditando), cData) : push(ref(db, 'clientes'), cData);
    acao.then(() => {
        Swal.fire('Sucesso!', 'Dados salvos.', 'success');
        document.getElementById('formNovoCliente').reset();
        document.getElementById('modalCliente').style.display = 'none';
        clienteIdEditando = null;
    });
});

window.renderizarClientes = function() {
    const listaNormal = document.getElementById('listaClientes');
    const listaAtrasados = document.getElementById('listaAtrasados');
    listaNormal.innerHTML = ""; 
    listaAtrasados.innerHTML = ""; 
    
    let qtdTotal = 0;
    let qtdAtrasados = 0;

    const hoje = new Date();
    const diaAtual = hoje.getDate();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear().toString();

    // Pega as configurações salvas ou mostra um aviso para configurar
    const chavePix = localStorage.getItem('chavePix') || "CHAVE_NAO_CONFIGURADA";
    const msgTemplate = localStorage.getItem('textoCobranca') || "Olá, {nome}! Você tem um débito de R$ {valor}. PIX: {pix}";

    Object.keys(dadosClientes).forEach(id => {
        qtdTotal++;
        const d = dadosClientes[id];
        const numW = (d.telefone || "").replace(/\D/g, '');
        const statusMesAtual = dadosHistorico[id]?.[anoAtual]?.[mesAtual] || 'pendente';
        const diaVencimento = parseInt(d.vencimento) || 0;

        const taAtrasado = (diaAtual > diaVencimento && statusMesAtual !== 'pago');
        if(taAtrasado) qtdAtrasados++;
        
        const badge = taAtrasado 
            ? '<span style="background-color: #ef4444; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">⚠️ ATRASADO</span>' 
            : '<span style="color: #10b981; font-weight: bold; font-size: 12px;">✅ EM DIA</span>';
        
        const valorFormatado = parseFloat(d.plano).toFixed(2);
        
        // Troca as palavras mágicas pelo valor real do cliente
        let textoCobrancaFinal = msgTemplate
            .replace(/{nome}/g, d.nome)
            .replace(/{valor}/g, valorFormatado)
            .replace(/{vencimento}/g, d.vencimento)
            .replace(/{pix}/g, chavePix);

        const linkCobranca = `https://wa.me/55${numW}?text=${encodeURIComponent(textoCobrancaFinal)}`;
        
        const cardHTML = `
            <div class="card-cliente">
                <div class="resumo-cliente" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 16px;">${d.nome}</h3>
                    ${badge}
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <a href="https://wa.me/55${numW}" target="_blank" style="flex: 1; background: #25D366; color: white; text-align: center; padding: 10px; border-radius: 6px; text-decoration: none; font-weight: bold;">
                        <i class="fab fa-whatsapp"></i> Zap
                    </a>
                    <button onclick="toggleDetalhes('${id}')" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-user"></i> Perfil
                    </button>
                </div>

                <div id="detalhes-${id}" class="detalhes-cliente" style="display:none; background: #f8fafc; padding: 15px; margin-top: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p><strong>Venc.:</strong> Dia ${d.vencimento} | <strong>Plano:</strong> R$ ${valorFormatado}</p>
                    <p><strong>CPF:</strong> ${d.cpf} | <strong>Endereço:</strong> ${d.bairro}, ${d.cidade}</p>
                    
                    <button onclick="abrirModalHistorico('${id}')" style="width: 100%; background: #1e3a8a; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; margin-top: 15px; font-weight: bold;">
                        <i class="fas fa-calendar-alt"></i> Histórico de Meses
                    </button>

                    ${taAtrasado ? `
                    <a href="${linkCobranca}" target="_blank" style="display: block; width: 100%; background: #f59e0b; color: white; text-align: center; padding: 12px; border-radius: 6px; text-decoration: none; margin-top: 10px; font-weight: bold;">
                        <i class="fab fa-whatsapp"></i> Enviar Cobrança PIX
                    </a>` : ''}

                    <div class="acoes-card" style="margin-top:15px; display: flex; gap: 10px;">
                        <button onclick="editarCliente('${id}')" class="btn-acao btn-editar" style="flex: 1;"><i class="fas fa-pen"></i> Editar</button>
                        <button onclick="excluirRegistro('clientes', '${id}')" class="btn-acao btn-excluir" style="flex: 1;"><i class="fas fa-trash"></i> Apagar</button>
                    </div>
                </div>
            </div>`;

        // Renderiza nas listas correspondentes
        listaNormal.innerHTML += cardHTML;
        if(taAtrasado) listaAtrasados.innerHTML += cardHTML;
    });

    // Atualiza os contadores na tela
    document.getElementById('qtdTotalClientes').innerText = qtdTotal;
    document.getElementById('qtdAtrasados').innerText = qtdAtrasados;
};

// =========================================================================
// 7. HISTÓRICO DE MESES DO CLIENTE
// =========================================================================
window.abrirModalHistorico = function(id) {
    clienteAtualHistorico = id;
    document.getElementById('nomeClienteHistorico').innerText = dadosClientes[id].nome;
    document.getElementById('modalHistorico').style.display = 'block';
    document.getElementById('filtroAno').value = document.getElementById('dashAno').value;
    window.carregarMesesHistorico();
};

window.carregarMesesHistorico = function() {
    const a = document.getElementById('filtroAno').value;
    const g = document.getElementById('gridMeses'); g.innerHTML = '';
    const dH = dadosHistorico[clienteAtualHistorico]?.[a] || {};

    mesesNomes.forEach((nM, i) => {
        const n = i + 1; const st = dH[n] || 'pendente'; 
        let cor = 'status-pendente'; let ico = '⏳';
        if(st === 'pago') { cor = 'status-pago'; ico = '✅'; }
        if(st === 'atrasado') { cor = 'status-atrasado'; ico = '❌'; }
        g.innerHTML += `<button class="btn-mes ${cor}" onclick="mudarStatusMes(${n}, '${st}')" style="padding: 15px 5px; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">${nM}<br><span style="font-size: 11px; display: block; margin-top: 5px;">${ico} ${st.toUpperCase()}</span></button>`;
    });
};

window.mudarStatusMes = function(m, st) {
    let nSt = st === 'pendente' ? 'pago' : (st === 'pago' ? 'atrasado' : 'pendente');
    const a = document.getElementById('filtroAno').value;
    update(ref(db, `historico/${clienteAtualHistorico}/${a}`), { [m]: nSt }).then(() => window.carregarMesesHistorico());
};

// =========================================================================
// 8. GESTÃO DE CUSTOS 
// =========================================================================
window.renderizarCustos = function() {
    const mF = parseInt(document.getElementById('filtroMesCustos').value);
    const aF = document.getElementById('filtroAnoCustos').value;
    const lista = document.getElementById('listaCustos'); lista.innerHTML = ""; 

    Object.keys(dadosCustos).forEach(id => {
        const d = dadosCustos[id]; const p = (d.data || "").split('/');
        
        if (p.length === 3 && p[2] === aF && (mF === 0 || parseInt(p[1]) === mF)) {
            const statusCusto = d.status || 'pendente';
            const corStatus = statusCusto === 'pago' ? '#10b981' : '#f59e0b';
            const txtStatus = statusCusto === 'pago' ? '✅ PAGO' : '⏳ PENDENTE';

            lista.innerHTML += `
                <div style="background:white; margin-bottom:10px; padding:15px; display:flex; justify-content:space-between; align-items:center; border-radius:8px; border-left:5px solid ${corStatus}; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div>
                        <strong style="font-size: 15px; color: #333;">${d.descricao}</strong><br>
                        <small style="color:#6b7280;">${d.data} • ${d.tipo}</small><br>
                        <button onclick="mudarStatusCusto('${id}', '${statusCusto}')" style="margin-top: 8px; background: ${corStatus}; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; transition: 0.2s;">
                            ${txtStatus}
                        </button>
                    </div>
                    <div style="text-align: right;">
                        <span style="color:#ef4444; font-weight:bold; font-size: 16px; display: block; margin-bottom: 10px;">R$ ${parseFloat(d.valor).toFixed(2)}</span>
                        <div>
                            <button onclick="editarCusto('${id}')" style="color:#f59e0b; border:none; background:none; cursor:pointer; font-size: 16px; margin-right: 10px;"><i class="fas fa-pen"></i></button>
                            <button onclick="excluirRegistro('custos', '${id}')" style="color:#ef4444; border:none; background:none; cursor:pointer; font-size: 16px;"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>`;
        }
    });
};

window.mudarStatusCusto = function(id, statusAtual) {
    let novoStatus = statusAtual === 'pago' ? 'pendente' : 'pago';
    update(ref(db, 'custos/' + id), { status: novoStatus });
};

document.getElementById('formCusto').addEventListener('submit', function(e) {
    e.preventDefault();
    const d = document.getElementById('descCusto').value;
    const v = parseFloat(document.getElementById('valorCusto').value);
    const t = document.getElementById('tipoCusto').value;

    if (custoIdEditando) {
        update(ref(db, 'custos/' + custoIdEditando), { descricao: d, valor: v, tipo: t }).then(() => {
            Swal.fire('OK!', 'Custo editado.', 'success');
            document.getElementById('formCusto').reset(); custoIdEditando = null;
            document.getElementById('parcelasCusto').disabled = false;
        });
    } else {
        const parc = parseInt(document.getElementById('parcelasCusto').value) || 1;
        const vP = v / parc; const hj = new Date();
        for (let i = 0; i < parc; i++) {
            let dP = new Date(hj.getFullYear(), hj.getMonth() + i, hj.getDate());
            push(ref(db, 'custos'), { 
                descricao: d + (parc > 1 ? ` (${i+1}/${parc})` : ""), 
                valor: vP, 
                tipo: t, 
                data: dP.toLocaleDateString('pt-BR'),
                status: 'pendente' 
            });
        }
        Swal.fire('OK!', 'Despesa lançada.', 'success'); document.getElementById('formCusto').reset();
    }
});

window.editarCusto = function(id) {
    const d = dadosCustos[id]; custoIdEditando = id;
    document.getElementById('descCusto').value = d.descricao;
    document.getElementById('valorCusto').value = d.valor;
    document.getElementById('tipoCusto').value = d.tipo;
    document.getElementById('parcelasCusto').disabled = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// =========================================================================
// 9. FUNÇÕES DE INTERFACE AUXILIARES
// =========================================================================
window.toggleDetalhes = id => { const el = document.getElementById(`detalhes-${id}`); el.style.display = el.style.display === "block" ? "none" : "block"; };
window.excluirRegistro = (c, id) => {
    Swal.fire({ title: 'Apagar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sim' }).then(r => {
        if(r.isConfirmed) { remove(ref(db, `${c}/${id}`)); Swal.fire('Removido'); }
    });
};
window.editarCliente = id => {
    const d = dadosClientes[id]; clienteIdEditando = id;
    document.getElementById('nomeCliente').value = d.nome;
    document.getElementById('cpfCliente').value = d.cpf;
    document.getElementById('telCliente').value = d.telefone;
    document.getElementById('bairroCliente').value = d.bairro;
    document.getElementById('cidadeCliente').value = d.cidade;
    document.getElementById('vencimentoCliente').value = d.vencimento;
    document.getElementById('planoCliente').value = d.plano;
    document.getElementById('modalCliente').style.display = 'block';
};
