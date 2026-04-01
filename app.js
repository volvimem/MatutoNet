// =========================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO DO FIREBASE
// =========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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

window.clienteIdEditando = null;
let clienteAtualHistorico = null;
let dadosClientes = {};
let dadosHistorico = {};
let mostrandoAtrasados = false;
const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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
onValue(ref(db, 'clientes'), snp => { 
    dadosClientes = snp.val() || {}; 
    window.renderizarClientes(); 
    window.atualizarMiniDashboard(); 
});

onValue(ref(db, 'historico'), snp => { 
    dadosHistorico = snp.val() || {}; 
    window.renderizarClientes();
    window.atualizarMiniDashboard();
});

// =========================================================================
// 4. MINI-DASHBOARD FINANCEIRO DO MÊS ATUAL
// =========================================================================
window.atualizarMiniDashboard = function() {
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1; // 1 a 12
    const anoAtual = hoje.getFullYear();

    let previsaoTotal = 0;
    let recebidoMes = 0;

    Object.keys(dadosClientes).forEach(id => {
        const cliente = dadosClientes[id];
        const valorPlano = parseFloat(cliente.plano) || 0;
        
        previsaoTotal += valorPlano;

        // Verifica se no histórico deste ano e deste mês, o status é "pago"
        if (dadosHistorico[id] && dadosHistorico[id][anoAtual] && dadosHistorico[id][anoAtual][mesAtual] === 'pago') {
            recebidoMes += valorPlano;
        }
    });

    const emAberto = previsaoTotal - recebidoMes;

    document.getElementById('resumoPrevisao').innerText = `R$ ${previsaoTotal.toFixed(2)}`;
    document.getElementById('resumoRecebido').innerText = `R$ ${recebidoMes.toFixed(2)}`;
    document.getElementById('resumoAberto').innerText = `R$ ${(emAberto > 0 ? emAberto : 0).toFixed(2)}`;
};

// =========================================================================
// 5. GESTÃO DE CADASTRO E EDIÇÃO DE CLIENTES
// =========================================================================
document.getElementById('formNovoCliente').addEventListener('submit', function(e) {
    e.preventDefault();
    const nomeInput = document.getElementById('nomeCliente').value.trim();
    
    const cData = {
        nome: nomeInput, 
        cpf: document.getElementById('cpfCliente').value,
        telefone: document.getElementById('telCliente').value,
        bairro: document.getElementById('bairroCliente').value,
        cidade: document.getElementById('cidadeCliente').value,
        referencia: document.getElementById('refCliente').value || "Não informada",
        localizacao: document.getElementById('locCliente').value || "",
        vencimento: document.getElementById('vencimentoCliente').value,
        plano: parseFloat(document.getElementById('planoCliente').value) || 0,
        emAtraso: false
    };

    const acao = window.clienteIdEditando ? update(ref(db, 'clientes/' + window.clienteIdEditando), cData) : push(ref(db, 'clientes'), cData);
    
    acao.then(() => {
        Swal.fire('Sucesso!', 'Dados do cliente salvos.', 'success');
        document.getElementById('formNovoCliente').reset();
        document.getElementById('modalCliente').style.display = 'none';
        window.clienteIdEditando = null;
    });
});

window.editarCliente = id => {
    const d = dadosClientes[id]; 
    window.clienteIdEditando = id;
    
    document.getElementById('nomeCliente').value = d.nome;
    document.getElementById('cpfCliente').value = d.cpf;
    document.getElementById('telCliente').value = d.telefone;
    document.getElementById('bairroCliente').value = d.bairro;
    document.getElementById('cidadeCliente').value = d.cidade;
    document.getElementById('refCliente').value = d.referencia || "";
    document.getElementById('locCliente').value = d.localizacao || "";
    document.getElementById('vencimentoCliente').value = d.vencimento;
    document.getElementById('planoCliente').value = d.plano;
    
    document.getElementById('tituloModalCliente').innerText = "Editar Cliente";
    document.getElementById('modalCliente').style.display = 'block';
};

window.excluirRegistro = (c, id) => {
    Swal.fire({ title: 'Apagar Cliente?', text: "Isso não poderá ser desfeito!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sim, apagar!' }).then(r => {
        if(r.isConfirmed) { 
            remove(ref(db, `${c}/${id}`)); 
            // Opcional: Remover o histórico do cliente também
            remove(ref(db, `historico/${id}`));
            Swal.fire('Removido', 'Cliente apagado com sucesso.', 'success'); 
        }
    });
};

// =========================================================================
// 6. RENDERIZAÇÃO DA LISTA, BUSCA E FILTROS
// =========================================================================
window.filtrarAtrasados = function() {
    mostrandoAtrasados = !mostrandoAtrasados;
    const btn = document.getElementById('btnFiltroAtrasados');
    if(mostrandoAtrasados) {
        btn.innerHTML = '<i class="fas fa-users"></i> Ver Todos';
        btn.style.background = '#f59e0b';
    } else {
        btn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ver Atrasados';
        btn.style.background = '#ef4444';
    }
    window.renderizarClientes();
};

window.renderizarClientes = function() {
    const lista = document.getElementById('listaClientes');
    lista.innerHTML = ""; 
    
    // Captura o que foi digitado na barra de busca
    const buscaInput = document.getElementById('buscaCliente');
    const termoBusca = buscaInput ? buscaInput.value.toLowerCase().trim() : "";
    
    Object.keys(dadosClientes).forEach(id => {
        const d = dadosClientes[id];
        
        // Flag de atraso
        let estaAtrasado = false;
        if(dadosHistorico[id]) {
            Object.values(dadosHistorico[id]).forEach(anoObj => {
                if(Object.values(anoObj).includes('atrasado')) estaAtrasado = true;
            });
        }

        // Filtro 1: Apenas atrasados
        if(mostrandoAtrasados && !estaAtrasado) return;

        // Filtro 2: Barra de Busca (Nome ou CPF)
        if (termoBusca) {
            const nomeCliente = (d.nome || "").toLowerCase();
            const cpfCliente = (d.cpf || "");
            if (!nomeCliente.includes(termoBusca) && !cpfCliente.includes(termoBusca)) {
                return; // Pula este cliente se não bater com a busca
            }
        }

        const numW = (d.telefone || "").replace(/\D/g, '');
        const badge = estaAtrasado ? '<span class="badge-atraso" style="background:#ef4444; color:white; padding:4px 8px; border-radius:12px; font-size:11px; font-weight:bold;">⚠️ ATRASADO</span>' : '<span style="color: #10b981; font-weight: bold; font-size: 13px;">✅ EM DIA</span>';
        
        lista.innerHTML += `
            <div class="card-cliente" style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.08); border-left: 6px solid ${estaAtrasado ? '#ef4444' : '#3b82f6'}; margin-bottom: 15px;">
                <div class="resumo-cliente" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 16px; color: #1e3a8a;">${d.nome}</h3>
                    ${badge}
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <a href="https://wa.me/55${numW}" target="_blank" style="flex: 1; background: #25D366; color: white; text-align: center; padding: 10px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 14px;">
                        <i class="fab fa-whatsapp"></i> Zap
                    </a>
                    <button onclick="toggleDetalhes('${id}')" style="flex: 1; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                        <i class="fas fa-id-card"></i> Dados
                    </button>
                </div>

                <div id="detalhes-${id}" class="detalhes-cliente" style="display:none; background: #f8fafc; padding: 15px; margin-top: 15px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px;">
                    <p style="margin-bottom: 5px;"><strong>Vencimento:</strong> Dia ${d.vencimento}</p>
                    <p style="margin-bottom: 5px;"><strong>Plano:</strong> R$ ${parseFloat(d.plano).toFixed(2)}</p>
                    <p style="margin-bottom: 5px;"><strong>CPF:</strong> ${d.cpf}</p>
                    <p style="margin-bottom: 5px;"><strong>Endereço:</strong> ${d.bairro}, ${d.cidade}</p>
                    <p style="margin-bottom: 5px;"><strong>Ref:</strong> ${d.referencia}</p>
                    ${d.localizacao ? `<p style="margin-bottom: 15px;"><a href="${d.localizacao}" target="_blank" style="color:#3b82f6; text-decoration: none; font-weight: bold;"><i class="fas fa-map-marker-alt"></i> Ver no Mapa</a></p>` : '<br>'}
                    
                    <button onclick="abrirModalHistorico('${id}')" style="width: 100%; background: #1e3a8a; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                        <i class="fas fa-calendar-alt"></i> Controle de Pagamentos
                    </button>

                    <div class="acoes-card" style="margin-top:15px; display: flex; gap: 10px;">
                        <button onclick="editarCliente('${id}')" style="flex: 1; background: #f59e0b; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;"><i class="fas fa-pen"></i> Editar</button>
                        <button onclick="excluirRegistro('clientes', '${id}')" style="flex: 1; background: #ef4444; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;"><i class="fas fa-trash"></i> Apagar</button>
                    </div>
                </div>
            </div>`;
    });
};

window.toggleDetalhes = id => { 
    const el = document.getElementById(`detalhes-${id}`); 
    el.style.display = el.style.display === "block" ? "none" : "block"; 
};

// =========================================================================
// 7. HISTÓRICO DE MESES E NOTIFICAÇÃO
// =========================================================================
window.abrirModalHistorico = function(id) {
    clienteAtualHistorico = id;
    document.getElementById('nomeClienteHistorico').innerText = dadosClientes[id].nome;
    document.getElementById('modalHistorico').style.display = 'block';
    
    const d = new Date();
    document.getElementById('filtroAno').value = d.getFullYear();
    window.carregarMesesHistorico();
};

window.carregarMesesHistorico = function() {
    const a = document.getElementById('filtroAno').value;
    const g = document.getElementById('gridMeses'); 
    g.innerHTML = '';
    const dH = dadosHistorico[clienteAtualHistorico]?.[a] || {};

    mesesNomes.forEach((nM, i) => {
        const n = i + 1; 
        const st = dH[n] || 'pendente'; 
        let cor = 'status-pendente'; 
        let ico = '⏳';
        
        if(st === 'pago') { cor = 'status-pago'; ico = '✅'; }
        if(st === 'atrasado') { cor = 'status-atrasado'; ico = '❌'; }
        
        g.innerHTML += `<button class="btn-mes ${cor}" onclick="mudarStatusMes(${n}, '${st}', '${nM}')" style="padding: 15px 5px; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); width: 100%; font-size: 14px;">${nM}<br><span style="font-size: 11px; display: block; margin-top: 5px;">${ico} ${st.toUpperCase()}</span></button>`;
    });
};

window.mudarStatusMes = function(m, st, nomeMes) {
    let nSt = st === 'pendente' ? 'pago' : (st === 'pago' ? 'atrasado' : 'pendente');
    const a = document.getElementById('filtroAno').value;
    
    let colorIcon = nSt === 'pago' ? '#10b981' : (nSt === 'atrasado' ? '#ef4444' : '#f59e0b');

    Swal.fire({
        title: 'Confirmar Pagamento?',
        html: `Deseja marcar a fatura de <b>${nomeMes}</b> como <b style="color:${colorIcon};">${nSt.toUpperCase()}</b>?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: colorIcon,
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Sim, alterar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            update(ref(db, `historico/${clienteAtualHistorico}/${a}`), { [m]: nSt }).then(() => {
                Swal.fire({
                    title: 'Atualizado!',
                    text: 'Status salvo com sucesso.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
                window.carregarMesesHistorico();
                // A atualização da tela principal e do mini-dashboard acontece sozinha via onValue (Firebase)
            });
        }
    });
};
