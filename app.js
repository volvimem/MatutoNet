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

// Variáveis Globais
let clienteIdEditando = null;
let custoIdEditando = null;
let graficoAtual = null;

let dadosClientes = {};
let dadosCustos = {};
let dadosHistorico = {};
const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

window.onload = () => {
    const d = new Date();
    document.getElementById('dashMes').value = d.getMonth() + 1;
    document.getElementById('dashAno').value = d.getFullYear();
    document.getElementById('filtroMesCustos').value = d.getMonth() + 1;
    document.getElementById('filtroAnoCustos').value = d.getFullYear();
};

// =========================================================================
// 2. MÁSCARAS (Telefone e CPF)
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

// =========================================================================
// 3. SINCRONIZAÇÃO EM TEMPO REAL
// =========================================================================
onValue(ref(db, 'clientes'), snp => { dadosClientes = snp.val() || {}; window.renderizarClientes(); window.atualizarDashboard(); });
onValue(ref(db, 'custos'), snp => { dadosCustos = snp.val() || {}; window.renderizarCustos(); window.atualizarDashboard(); });
onValue(ref(db, 'historico'), snp => { dadosHistorico = snp.val() || {}; window.atualizarDashboard(); });

// =========================================================================
// 4. DASHBOARD E RELATÓRIOS
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
// 5. GESTÃO DE CLIENTES (COM TRAVA DE DUPLICIDADE)
// =========================================================================
document.getElementById('formNovoCliente').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const nomeInput = document.getElementById('nomeCliente').value.trim();
    const cpfInput = document.getElementById('cpfCliente').value.trim();

    // REGRA DE DUPLICIDADE (Ponto 1)
    if (!clienteIdEditando) { // Só checa se for um novo cadastro
        const jaExiste = Object.values(dadosClientes).some(c => 
            c.nome.toLowerCase() === nomeInput.toLowerCase() && 
            c.cpf === cpfInput
        );

        if (jaExiste) {
            Swal.fire('Atenção!', 'Este cliente (Nome e CPF) já consta no sistema.', 'warning');
            return;
        }
    }

    const cData = {
        nome: nomeInput, cpf: cpfInput,
        telefone: document.getElementById('telCliente').value,
        bairro: document.getElementById('bairroCliente').value,
        cidade: document.getElementById('cidadeCliente').value,
        vencimento: document.getElementById('vencimentoCliente').value,
        plano: parseFloat(document.getElementById('planoCliente').value) || 0,
        emAtraso: false
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
    const lista = document.getElementById('listaClientes');
    lista.innerHTML = ""; 
    Object.keys(dadosClientes).forEach(id => {
        const d = dadosClientes[id];
        const numW = (d.telefone || "").replace(/\D/g, '');
        const badge = d.emAtraso ? '<span class="badge-atraso">⚠️ PENDENTE</span>' : '<span style="color: #10b981; font-weight: bold;">✅ EM DIA</span>';
        
        lista.innerHTML += `
            <div class="card-cliente">
                <div class="resumo-cliente"><h3>${d.nome}</h3>${badge}</div>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <a href="https://wa.me/55${numW}" target="_blank" class="btn-pix" style="background:#25D366; text-decoration:none; text-align:center;">Zap</a>
                    <button onclick="toggleDetalhes('${id}')" class="btn-pix" style="background:#3b82f6;">Perfil</button>
                </div>
                <div id="detalhes-${id}" class="detalhes-cliente" style="display:none;">
                    <p>Venc: ${d.vencimento} | R$ ${parseFloat(d.plano).toFixed(2)}</p>
                    <button onclick="abrirModalHistorico('${id}')" style="width:100%; padding:10px; margin-top:10px; cursor:pointer;">Histórico de Meses</button>
                    <div class="acoes-card" style="margin-top:10px;">
                        <button onclick="editarCliente('${id}')" class="btn-acao btn-editar">Editar</button>
                        <button onclick="excluirRegistro('clientes', '${id}')" class="btn-acao btn-excluir">Apagar</button>
                    </div>
                </div>
            </div>`;
    });
};

// =========================================================================
// 6. HISTÓRICO (CORRIGIDO: Agora usa apenas o ID)
// =========================================================================
let clienteAtualHistorico = null;
window.abrirModalHistorico = function(id) {
    clienteAtualHistorico = id;
    // Busca o nome direto da base global pelo ID
    document.getElementById('nomeClienteHistorico').innerText = dadosClientes[id].nome;
    document.getElementById('modalHistorico').style.display = 'block';
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
        g.innerHTML += `<button class="btn-mes ${cor}" onclick="mudarStatusMes(${n}, '${st}')">${nM}<br><small>${ico} ${st}</small></button>`;
    });
};

window.mudarStatusMes = function(m, st) {
    let nSt = st === 'pendente' ? 'pago' : (st === 'pago' ? 'atrasado' : 'pendente');
    const a = document.getElementById('filtroAno').value;
    update(ref(db, `historico/${clienteAtualHistorico}/${a}`), { [m]: nSt }).then(() => window.carregarMesesHistorico());
};

// =========================================================================
// 7. GESTÃO DE CUSTOS (Lista Compacta)
// =========================================================================
window.renderizarCustos = function() {
    const mF = parseInt(document.getElementById('filtroMesCustos').value);
    const aF = document.getElementById('filtroAnoCustos').value;
    const lista = document.getElementById('listaCustos'); lista.innerHTML = ""; 

    Object.keys(dadosCustos).forEach(id => {
        const d = dadosCustos[id]; const p = (d.data || "").split('/');
        if (p.length === 3 && p[2] === aF && (mF === 0 || parseInt(p[1]) === mF)) {
            lista.innerHTML += `
                <div style="background:white; margin-bottom:5px; padding:10px; display:flex; justify-content:space-between; align-items:center; border-radius:5px; border-left:4px solid #ef4444;">
                    <div><strong>${d.descricao}</strong><br><small>${d.data}</small></div>
                    <div><span style="color:#ef4444; font-weight:bold; margin-right:10px;">R$ ${parseFloat(d.valor).toFixed(2)}</span>
                    <button onclick="editarCusto('${id}')" style="color:#f59e0b; border:none; background:none; cursor:pointer;"><i class="fas fa-pen"></i></button>
                    <button onclick="excluirRegistro('custos', '${id}')" style="color:#ef4444; border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button></div>
                </div>`;
        }
    });
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
            push(ref(db, 'custos'), { descricao: d + (parc > 1 ? ` (${i+1}/${parc})` : ""), valor: vP, tipo: t, data: dP.toLocaleDateString('pt-BR') });
        }
        Swal.fire('OK!', 'Lançado.', 'success'); document.getElementById('formCusto').reset();
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

// Funções Auxiliares
window.toggleDetalhes = id => { const el = document.getElementById(`detalhes-${id}`); el.style.display = el.style.display === "block" ? "none" : "block"; };
window.excluirRegistro = (c, id) => {
    Swal.fire({ title: 'Apagar?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim' }).then(r => {
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
