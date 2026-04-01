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

// MÁSCARAS
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

// SINCRONIZAÇÃO
onValue(ref(db, 'clientes'), snp => { dadosClientes = snp.val() || {}; window.renderizarClientes(); });
onValue(ref(db, 'historico'), snp => { dadosHistorico = snp.val() || {}; });

// =========================================================================
// GESTÃO DE CLIENTES
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
        Swal.fire('Sucesso!', 'Dados salvos.', 'success');
        document.getElementById('formNovoCliente').reset();
        document.getElementById('modalCliente').style.display = 'none';
        window.clienteIdEditando = null;
    });
});

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
    
    Object.keys(dadosClientes).forEach(id => {
        const d = dadosClientes[id];
        
        // Verifica se tem algum mês atrasado no histórico para setar a flag automaticamente
        let estaAtrasado = false;
        if(dadosHistorico[id]) {
            Object.values(dadosHistorico[id]).forEach(anoObj => {
                if(Object.values(anoObj).includes('atrasado')) estaAtrasado = true;
            });
        }

        if(mostrandoAtrasados && !estaAtrasado) return; // Filtro de atrasados

        const numW = (d.telefone || "").replace(/\D/g, '');
        const badge = estaAtrasado ? '<span class="badge-atraso">⚠️ ATRASADO</span>' : '<span style="color: #10b981; font-weight: bold;">✅ EM DIA</span>';
        
        lista.innerHTML += `
            <div class="card-cliente" style="${estaAtrasado ? 'border-left-color: #ef4444;' : ''}">
                <div class="resumo-cliente">
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
                    <p><strong>Venc.:</strong> Dia ${d.vencimento} | <strong>Plano:</strong> R$ ${parseFloat(d.plano).toFixed(2)}</p>
                    <p><strong>Ref:</strong> ${d.referencia || 'Nenhuma'}</p>
                    ${d.localizacao ? `<p><a href="${d.localizacao}" target="_blank" style="color:#3b82f6;"><i class="fas fa-map-marker-alt"></i> Ver no Mapa</a></p>` : ''}
                    
                    <div style="display:flex; gap:10px; margin-top: 15px;">
                        <button onclick="abrirModalHistorico('${id}')" style="flex: 1; background: #1e3a8a; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                            <i class="fas fa-calendar-alt"></i> Histórico
                        </button>
                        <button onclick="gerarFatura('${id}')" style="flex: 1; background: #8b5cf6; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                            <i class="fas fa-file-invoice-dollar"></i> Gerar Fatura
                        </button>
                    </div>

                    <div class="acoes-card" style="margin-top:15px; display: flex; gap: 10px;">
                        <button onclick="editarCliente('${id}')" class="btn-acao btn-editar" style="flex: 1;"><i class="fas fa-pen"></i> Editar</button>
                        <button onclick="excluirRegistro('clientes', '${id}')" class="btn-acao btn-excluir" style="flex: 1;"><i class="fas fa-trash"></i> Apagar</button>
                    </div>
                </div>
            </div>`;
    });
};

// =========================================================================
// HISTÓRICO E NOTIFICAÇÃO PREMIUM
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
    const g = document.getElementById('gridMeses'); g.innerHTML = '';
    const dH = dadosHistorico[clienteAtualHistorico]?.[a] || {};

    mesesNomes.forEach((nM, i) => {
        const n = i + 1; const st = dH[n] || 'pendente'; 
        let cor = 'status-pendente'; let ico = '⏳';
        if(st === 'pago') { cor = 'status-pago'; ico = '✅'; }
        if(st === 'atrasado') { cor = 'status-atrasado'; ico = '❌'; }
        g.innerHTML += `<button class="btn-mes ${cor}" onclick="mudarStatusMes(${n}, '${st}', '${nM}')">${nM}<br><span style="font-size: 11px; display: block; margin-top: 5px;">${ico} ${st.toUpperCase()}</span></button>`;
    });
};

// Notificação Premium ao Mudar Status
window.mudarStatusMes = function(m, st, nomeMes) {
    let nSt = st === 'pendente' ? 'pago' : (st === 'pago' ? 'atrasado' : 'pendente');
    const a = document.getElementById('filtroAno').value;
    
    let colorIcon = nSt === 'pago' ? '#10b981' : (nSt === 'atrasado' ? '#ef4444' : '#f59e0b');

    Swal.fire({
        title: 'Confirmar Alteração',
        html: `Deseja marcar o mês de <b>${nomeMes}</b> como <b style="color:${colorIcon};">${nSt.toUpperCase()}</b>?`,
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
                window.renderizarClientes(); // Para atualizar a flag de atraso na tela principal
            });
        }
    });
};

// =========================================================================
// GERAÇÃO DE FATURA EM IMAGEM
// =========================================================================
window.gerarFatura = function(id) {
    const d = dadosClientes[id];
    const dataVenc = `${String(d.vencimento).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`;
    
    // Preenche o molde com os dados do cliente [cite: 50] e dados da cobrança [cite: 12, 13]
    document.getElementById('faturaNomeCliente').innerText = d.nome.toUpperCase();
    document.getElementById('faturaCpfCliente').innerText = d.cpf;
    document.getElementById('faturaVencimento').innerText = dataVenc;
    document.getElementById('faturaValor').innerText = `R$ ${parseFloat(d.plano).toFixed(2)}`;

    // Mostra um carregando pro usuário
    Swal.fire({ title: 'Gerando Fatura...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

    // Captura a Div e transforma em imagem
    const molde = document.getElementById('moldeFatura');
    
    html2canvas(molde, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        
        Swal.fire({
            title: 'Fatura Pronta!',
            html: `
                <p>A imagem foi gerada. Clique com o botão direito (ou segure no celular) sobre a imagem abaixo para <b>Copiar/Salvar</b> e enviar para o cliente.</p>
                <img src="${imgData}" style="width:100%; max-width:400px; border: 1px solid #ccc; border-radius: 8px; margin-top: 10px;">
                <br><br>
                <a href="https://wa.me/55${d.telefone.replace(/\D/g, '')}?text=Olá ${d.nome.split(' ')[0]}, segue sua fatura MatutoNet atualizada para o dia ${dataVenc}. O valor é R$ ${parseFloat(d.plano).toFixed(2)}." target="_blank" style="background:#25D366; color:white; padding:10px 20px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">
                    <i class="fab fa-whatsapp"></i> Chamar no WhatsApp
                </a>
            `,
            width: 600,
            showConfirmButton: true,
            confirmButtonText: 'Fechar'
        });
    });
};

// =========================================================================
// FUNÇÕES AUXILIARES
// =========================================================================
window.toggleDetalhes = id => { const el = document.getElementById(`detalhes-${id}`); el.style.display = el.style.display === "block" ? "none" : "block"; };

window.excluirRegistro = (c, id) => {
    Swal.fire({ title: 'Apagar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sim' }).then(r => {
        if(r.isConfirmed) { remove(ref(db, `${c}/${id}`)); Swal.fire('Removido'); }
    });
};

window.editarCliente = id => {
    const d = dadosClientes[id]; window.clienteIdEditando = id;
    document.getElementById('nomeCliente').value = d.nome;
    document.getElementById('cpfCliente').value = d.cpf;
    document.getElementById('telCliente').value = d.telefone;
    document.getElementById('bairroCliente').value = d.bairro;
    document.getElementById('cidadeCliente').value = d.cidade;
    document.getElementById('refCliente').value = d.referencia || "";
    document.getElementById('locCliente').value = d.localizacao || "";
    document.getElementById('vencimentoCliente').value = d.vencimento;
    document.getElementById('planoCliente').value = d.plano;
    document.getElementById('modalCliente').style.display = 'block';
};
