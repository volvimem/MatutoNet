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

let dadosClientes = {};
let dadosCustos = {};
let dadosHistorico = {};
const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Inicia com Mês e Ano atuais em todos os filtros
window.onload = () => {
    const d = new Date();
    document.getElementById('dashMes').value = d.getMonth() + 1;
    document.getElementById('dashAno').value = d.getFullYear();
    document.getElementById('filtroMesCustos').value = d.getMonth() + 1;
    document.getElementById('filtroAnoCustos').value = d.getFullYear();
};

// =========================================================================
// MÁSCARAS E FIREBASE (Sincronização)
// =========================================================================
document.getElementById('telCliente').addEventListener('input', function(e) {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 2) v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    if (v.length > 7) v = v.replace(/(\d{1})(\d{4})(\d{4})$/, "$1 $2-$3");
    e.target.value = v;
});
document.getElementById('cpfCliente').addEventListener('input', function(e) {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 3) v = v.replace(/^(\d{3})(\d)/, "$1.$2");
    if (v.length > 6) v = v.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3");
    if (v.length > 9) v = v.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
    e.target.value = v;
});

onValue(ref(db, 'clientes'), (snapshot) => {
    dadosClientes = snapshot.val() || {};
    window.renderizarClientes();
    window.atualizarDashboard();
});

onValue(ref(db, 'custos'), (snapshot) => {
    dadosCustos = snapshot.val() || {};
    window.renderizarCustos();
    window.atualizarDashboard();
});

onValue(ref(db, 'historico'), (snapshot) => {
    dadosHistorico = snapshot.val() || {};
    window.atualizarDashboard();
});

// =========================================================================
// DASHBOARD
// =========================================================================
window.atualizarDashboard = function() {
    const mesFiltro = parseInt(document.getElementById('dashMes').value);
    const anoFiltro = document.getElementById('dashAno').value;
    let rec = 0, exp = 0, cust = 0;
    let arrR = [0,0,0,0,0,0,0,0,0,0,0,0], arrC = [0,0,0,0,0,0,0,0,0,0,0,0], arrL = [0,0,0,0,0,0,0,0,0,0,0,0];

    Object.keys(dadosClientes).forEach(id => {
        const c = dadosClientes[id];
        const vPlano = parseFloat(c.plano) || 0;
        for(let m=1; m<=12; m++) {
            if (mesFiltro === 0 || m === mesFiltro) exp += vPlano;
            if (dadosHistorico[id] && dadosHistorico[id][anoFiltro] && dadosHistorico[id][anoFiltro][m] === 'pago') {
                arrR[m-1] += vPlano;
                if (mesFiltro === 0 || m === mesFiltro) rec += vPlano;
            }
        }
    });

    Object.keys(dadosCustos).forEach(id => {
        const p = (dadosCustos[id].data || "").split('/');
        if (p.length === 3 && p[2] === anoFiltro) {
            const val = parseFloat(dadosCustos[id].valor) || 0;
            const mCusto = parseInt(p[1], 10);
            arrC[mCusto-1] += val;
            if (mesFiltro === 0 || mCusto === mesFiltro) cust += val;
        }
    });

    document.getElementById('dashRecebido').innerText = `R$ ${rec.toFixed(2)}`;
    document.getElementById('dashPendente').innerText = `R$ ${(exp - rec) > 0 ? (exp - rec).toFixed(2) : '0.00'}`;
    document.getElementById('dashCustos').innerText = `R$ ${cust.toFixed(2)}`;
    document.getElementById('dashLucro').innerText = `R$ ${(rec - cust).toFixed(2)}`;

    for(let i=0; i<12; i++) arrL[i] = arrR[i] - arrC[i];
    const ctx = document.getElementById('graficoFinanceiro').getContext('2d');
    if(graficoAtual) graficoAtual.destroy();
    graficoAtual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: mesesNomes,
            datasets: [
                { label: 'Entradas', data: arrR, backgroundColor: '#10b981', order: 2 },
                { label: 'Custos', data: arrC, backgroundColor: '#ef4444', order: 3 },
                { label: 'Lucro Líquido', data: arrL, type: 'line', borderColor: '#3b82f6', backgroundColor: '#3b82f6', fill: false, tension: 0.3, order: 1 }
            ]
        },
        options: { responsive: true }
    });
};

// =========================================================================
// RENDERIZAÇÃO BLINDADA DOS CLIENTES
// =========================================================================
window.renderizarClientes = function() {
    const lista = document.getElementById('listaClientes');
    lista.innerHTML = ""; 

    Object.keys(dadosClientes).forEach(id => {
        try {
            const dados = dadosClientes[id];
            
            // TRATAMENTO DE ERROS PARA DADOS ANTIGOS OU INCOMPLETOS
            const nome = dados.nome || "Cliente Sem Nome";
            const cpf = dados.cpf || "000.000.000-00";
            const telefone = dados.telefone || "";
            const numWhats = telefone.replace(/\D/g, ''); // Agora é seguro!
            const venc = dados.vencimento || "--";
            const bairro = dados.bairro || "Sem bairro";
            const cidade = dados.cidade || "";
            const planoVal = parseFloat(dados.plano || 0).toFixed(2); // Seguro!
            const badgeAtraso = dados.emAtraso ? '<span class="badge-atraso">⚠️ PENDENTE</span>' : '<span style="color: #10b981; font-weight: bold; font-size: 14px;">✅ EM DIA</span>';

            lista.innerHTML += `
                <div class="card-cliente">
                    <div class="resumo-cliente" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                        <h3 style="margin: 0; font-size: 16px;">${nome}</h3>${badgeAtraso}
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        <a href="https://wa.me/55${numWhats}" target="_blank" style="flex: 1; background: #25D366; color: white; text-align: center; padding: 10px; border-radius: 6px; text-decoration: none; font-weight: bold;"><i class="fab fa-whatsapp"></i> Zap</a>
                        <button onclick="toggleDetalhes('${id}')" style="flex: 1; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;"><i class="fas fa-user"></i> Perfil</button>
                    </div>
                    <div id="detalhes-${id}" class="detalhes-cliente" style="display: none; background: #f8fafc; padding: 15px; margin-top: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <p><strong>Venc.:</strong> Dia ${venc} | <strong>Plano:</strong> R$ ${planoVal}</p>
                        <p><strong>CPF:</strong> ${cpf} | <strong>Endereço:</strong> ${bairro}, ${cidade}</p>
                        <button onclick="abrirModalHistorico('${id}', '${nome}')" style="width: 100%; background: #1e3a8a; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; margin-top: 15px; font-weight: bold;">
                            <i class="fas fa-calendar-alt"></i> Histórico
                        </button>
                        <div class="acoes-card" style="margin-top: 15px;">
                            <button onclick="editarCliente('${id}')" class="btn-acao btn-editar"><i class="fas fa-pen"></i> Editar</button>
                            <button onclick="excluirRegistro('clientes', '${id}')" class="btn-acao btn-excluir"><i class="fas fa-trash"></i> Apagar</button>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error("Erro ao desenhar cliente ID:", id, error);
            // Ignora o cliente defeituoso e continua desenhando os outros
        }
    });
}

// Edição de Cliente agora pega direto do objeto global para evitar erros de string naspas
window.editarCliente = function(id) {
    const dados = dadosClientes[id];
    clienteIdEditando = id;
    document.getElementById('nomeCliente').value = dados.nome || "";
    document.getElementById('cpfCliente').value = dados.cpf || "";
    document.getElementById('telCliente').value = dados.telefone || "";
    document.getElementById('bairroCliente').value = dados.bairro || "";
    document.getElementById('cidadeCliente').value = dados.cidade || "";
    document.getElementById('vencimentoCliente').value = dados.vencimento || "";
    document.getElementById('planoCliente').value = parseFloat(dados.plano || 0);
    
    document.getElementById('modalCliente').style.display = 'block';
};

// =========================================================================
// GESTÃO DE CUSTOS (Lista Compacta + Filtros)
// =========================================================================
window.renderizarCustos = function() {
    const mesFiltro = parseInt(document.getElementById('filtroMesCustos').value);
    const anoFiltro = document.getElementById('filtroAnoCustos').value;
    const lista = document.getElementById('listaCustos');
    lista.innerHTML = ""; 
    
    Object.keys(dadosCustos).forEach(id => {
        try {
            const dados = dadosCustos[id];
            const partes = (dados.data || "").split('/');
            
            // Só renderiza se a data for válida e bater com o Filtro (Ano Todo = 0)
            if (partes.length === 3) {
                const mCusto = parseInt(partes[1], 10);
                const aCusto = partes[2];

                if ((mesFiltro === 0 || mCusto === mesFiltro) && aCusto === anoFiltro) {
                    const valorSeguro = parseFloat(dados.valor || 0).toFixed(2);
                    
                    // HTML Menor e Mais Compacto (Extrato Bancário)
                    lista.innerHTML += `
                        <div style="background: white; border-left: 4px solid #ef4444; border-radius: 6px; padding: 12px 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <div>
                                <h4 style="margin: 0; font-size: 15px; color: #333;">${dados.descricao || "Custo"}</h4>
                                <span style="font-size: 12px; color: #6b7280;">${dados.data} • ${dados.tipo || ""}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <strong style="color: #ef4444; font-size: 15px;">R$ ${valorSeguro}</strong>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="editarCusto('${id}')" style="background: none; border: none; color: #f59e0b; cursor: pointer; font-size: 16px;"><i class="fas fa-pen"></i></button>
                                    <button onclick="excluirRegistro('custos', '${id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px;"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }
        } catch (e) {
            console.error("Erro no custo ID:", id, e);
        }
    });
};

window.editarCusto = function(id) {
    const dados = dadosCustos[id];
    custoIdEditando = id;
    document.getElementById('descCusto').value = dados.descricao || "";
    document.getElementById('valorCusto').value = parseFloat(dados.valor || 0);
    document.getElementById('tipoCusto').value = dados.tipo || "";
    document.getElementById('parcelasCusto').value = 1;
    document.getElementById('parcelasCusto').disabled = true; 
    
    document.getElementById('btnSalvarCusto').innerText = "Atualizar";
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
};

document.getElementById('formCusto').addEventListener('submit', function(e) {
    e.preventDefault(); 
    const descricao = document.getElementById('descCusto').value;
    const valorTotal = parseFloat(document.getElementById('valorCusto').value);
    const tipo = document.getElementById('tipoCusto').value;
    
    if (custoIdEditando) {
        update(ref(db, 'custos/' + custoIdEditando), { descricao, valor: valorTotal, tipo }).then(() => {
            Swal.fire('Atualizado!', 'Custo salvo.', 'success'); document.getElementById('formCusto').reset(); custoIdEditando = null; document.getElementById('parcelasCusto').disabled = false;
        });
    } else {
        const parcelas = parseInt(document.getElementById('parcelasCusto').value) || 1;
        const valParc = valorTotal / parcelas;
        const hj = new Date(); 
        for (let i = 0; i < parcelas; i++) {
            let dParc = new Date(hj.getFullYear(), hj.getMonth() + i, hj.getDate());
            let lb = parcelas > 1 ? ` (${i+1}/${parcelas})` : "";
            push(ref(db, 'custos'), { descricao: descricao + lb, valor: valParc, tipo: tipo, data: dParc.toLocaleDateString('pt-BR') });
        }
        Swal.fire('Salvo!', 'Despesa lançada.', 'success'); document.getElementById('formCusto').reset();
    }
});

// =========================================================================
// SALVAR CLIENTES E FUNÇÕES AUXILIARES
// =========================================================================
document.getElementById('formNovoCliente').addEventListener('submit', function(e) {
    e.preventDefault();
    const cData = {
        nome: document.getElementById('nomeCliente').value, cpf: document.getElementById('cpfCliente').value,
        telefone: document.getElementById('telCliente').value, bairro: document.getElementById('bairroCliente').value,
        cidade: document.getElementById('cidadeCliente').value, vencimento: document.getElementById('vencimentoCliente').value,
        plano: parseFloat(document.getElementById('planoCliente').value), emAtraso: false
    };
    if (clienteIdEditando) {
        update(ref(db, 'clientes/' + clienteIdEditando), cData).then(() => { Swal.fire('Salvo!', 'Atualizado.', 'success'); fecharModal(); });
    } else {
        push(ref(db, 'clientes'), cData).then(() => { Swal.fire('Salvo!', 'Cadastrado.', 'success'); fecharModal(); });
    }
});

function fecharModal() {
    document.getElementById('formNovoCliente').reset();
    document.getElementById('cpfCliente').classList.remove('input-valido');
    document.getElementById('modalCliente').style.display = 'none';
    clienteIdEditando = null;
}

// Histórico de Meses
window.abrirModalHistorico = function(idC, nomeC) {
    clienteAtualHistorico = idC; document.getElementById('nomeClienteHistorico').innerText = nomeC;
    document.getElementById('filtroAno').value = document.getElementById('dashAno').value;
    document.getElementById('modalHistorico').style.display = 'block'; window.carregarMesesHistorico();
};
window.carregarMesesHistorico = function() {
    const a = document.getElementById('filtroAno').value; const g = document.getElementById('gridMeses'); g.innerHTML = '';
    const dAno = (dadosHistorico[clienteAtualHistorico] && dadosHistorico[clienteAtualHistorico][a]) ? dadosHistorico[clienteAtualHistorico][a] : {};
    mesesNomes.forEach((nM, i) => {
        const num = i + 1; const st = dAno[num] || 'pendente'; 
        let cor = 'status-pendente'; let ico = '⏳';
        if(st === 'pago') { cor = 'status-pago'; ico = '✅'; }
        if(st === 'atrasado') { cor = 'status-atrasado'; ico = '❌'; }
        g.innerHTML += `<button class="btn-mes ${cor}" style="padding: 15px 5px; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onclick="mudarStatusMes(${num}, '${st}')">${nM}<br><span style="font-size: 11px;">${ico} ${st.toUpperCase()}</span></button>`;
    });
};
window.mudarStatusMes = function(mes, stAtual) {
    let nSt = 'pago'; if(stAtual === 'pendente') nSt = 'pago'; else if(stAtual === 'pago') nSt = 'atrasado'; else if(stAtual === 'atrasado') nSt = 'pendente';
    const a = document.getElementById('filtroAno').value;
    update(ref(db, `historico/${clienteAtualHistorico}/${a}`), { [mes]: nSt }).then(() => { window.carregarMesesHistorico(); });
};

window.toggleDetalhes = function(id) { const d = document.getElementById(`detalhes-${id}`); d.style.display = d.style.display === "block" ? "none" : "block"; };
window.excluirRegistro = function(cam, id) {
    Swal.fire({ title: 'Tem certeza?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Excluir!' }).then((r) => {
        if (r.isConfirmed) { remove(ref(db, `${cam}/${id}`)); Swal.fire('Excluído!', '', 'success'); }
    });
};
