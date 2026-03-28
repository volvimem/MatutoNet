// =========================================================================
// 1. IMPORTAÇÕES E CONFIGURAÇÃO DO FIREBASE
// =========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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

// Variáveis Globais de Controle
let clienteIdEditando = null;
let graficoAtual = null;
let clienteAtualHistorico = null;
const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// =========================================================================
// 2. MÁSCARAS E VALIDAÇÃO (Telefone e CPF)
// =========================================================================
document.getElementById('telCliente').addEventListener('input', function(e) {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.slice(0, 11);
    if (valor.length > 2) valor = valor.replace(/^(\d{2})(\d)/g, "($1) $2");
    if (valor.length > 7) valor = valor.replace(/(\d{1})(\d{4})(\d{4})$/, "$1 $2-$3");
    e.target.value = valor;
});

document.getElementById('cpfCliente').addEventListener('input', function(e) {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.slice(0, 11);
    if (valor.length > 3) valor = valor.replace(/^(\d{3})(\d)/, "$1.$2");
    if (valor.length > 6) valor = valor.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3");
    if (valor.length > 9) valor = valor.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
    e.target.value = valor;

    if (valor.replace(/\D/g, "").length === 11) {
        if (validarCPF(valor.replace(/\D/g, ""))) {
            e.target.classList.add('input-valido');
        } else {
            e.target.classList.remove('input-valido');
        }
    } else {
        e.target.classList.remove('input-valido');
    }
});

function validarCPF(cpf) {
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto == 10) || (resto == 11)) resto = 0;
    if (resto != parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto == 10) || (resto == 11)) resto = 0;
    if (resto != parseInt(cpf.substring(10, 11))) return false;
    return true;
}

// =========================================================================
// 3. CADASTRAR / EDITAR CLIENTE
// =========================================================================
document.getElementById('formNovoCliente').addEventListener('submit', function(e) {
    e.preventDefault();

    const cpfCru = document.getElementById('cpfCliente').value.replace(/\D/g, "");
    if (!validarCPF(cpfCru)) {
        Swal.fire('Erro!', 'Por favor, digite um CPF válido.', 'error');
        return;
    }

    const clienteData = {
        nome: document.getElementById('nomeCliente').value,
        cpf: document.getElementById('cpfCliente').value,
        telefone: document.getElementById('telCliente').value,
        bairro: document.getElementById('bairroCliente').value,
        cidade: document.getElementById('cidadeCliente').value,
        vencimento: document.getElementById('vencimentoCliente').value,
        plano: parseFloat(document.getElementById('planoCliente').value),
        emAtraso: false
    };

    if (clienteIdEditando) {
        update(ref(db, 'clientes/' + clienteIdEditando), clienteData).then(() => {
            Swal.fire('Premium!', 'Cliente atualizado com sucesso.', 'success');
            fecharEResetarCliente();
        });
    } else {
        push(ref(db, 'clientes'), clienteData).then(() => {
            Swal.fire('Premium!', 'Novo cliente cadastrado com sucesso!', 'success');
            fecharEResetarCliente();
        });
    }
});

function fecharEResetarCliente() {
    document.getElementById('formNovoCliente').reset();
    document.getElementById('cpfCliente').classList.remove('input-valido');
    document.getElementById('modalCliente').style.display = 'none';
    clienteIdEditando = null;
}

// =========================================================================
// 4. SALVAR CUSTO COM PARCELAS (Ponto 3)
// =========================================================================
document.getElementById('formCusto').addEventListener('submit', function(e) {
    e.preventDefault();

    const descricao = document.getElementById('descCusto').value;
    const valorTotal = parseFloat(document.getElementById('valorCusto').value);
    const tipo = document.getElementById('tipoCusto').value;
    const parcelas = parseInt(document.getElementById('parcelasCusto').value) || 1;
    
    const valorParcela = valorTotal / parcelas;
    const dataAtual = new Date();

    for (let i = 1; i <= parcelas; i++) {
        let descFinal = parcelas > 1 ? `${descricao} (Parc. ${i}/${parcelas})` : descricao;
        let dataParcela = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + (i - 1), dataAtual.getDate());
        
        push(ref(db, 'custos'), {
            descricao: descFinal,
            valor: valorParcela,
            tipo: tipo,
            data: dataParcela.toLocaleDateString('pt-BR')
        });
    }

    Swal.fire('Salvo!', parcelas > 1 ? `${parcelas} parcelas registradas no financeiro.` : 'Custo registrado.', 'success');
    document.getElementById('formCusto').reset();
});

// =========================================================================
// 5. LISTAR CLIENTES EM TEMPO REAL (Design Limpo Sanfona)
// =========================================================================
onValue(ref(db, 'clientes'), (snapshot) => {
    const lista = document.getElementById('listaClientes');
    lista.innerHTML = ""; 
    let receitaTotal = 0;

    snapshot.forEach((filho) => {
        const id = filho.key;
        const dados = filho.val();
        receitaTotal += dados.plano || 0;

        const numWhats = dados.telefone.replace(/\D/g, '');
        const badgeAtraso = dados.emAtraso ? '<span class="badge-atraso" style="font-size: 14px;">⚠️ PENDENTE</span>' : '<span style="color: #10b981; font-weight: bold; font-size: 14px;">✅ EM DIA</span>';

        const card = `
            <div class="card-cliente">
                <div class="resumo-cliente" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <h3 style="margin: 0;">${dados.nome}</h3>
                    ${badgeAtraso}
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <a href="https://wa.me/55${numWhats}" target="_blank" style="flex: 1; background: #25D366; color: white; text-align: center; padding: 10px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
                        <i class="fab fa-whatsapp"></i> Zap
                    </a>
                    <button onclick="toggleDetalhes('${id}')" style="flex: 1; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 15px;">
                        <i class="fas fa-user"></i> Perfil
                    </button>
                </div>

                <div id="detalhes-${id}" class="detalhes-cliente" style="display: none; background: #f8fafc; padding: 15px; margin-top: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p><strong>Venc.:</strong> Dia ${dados.vencimento} | <strong>Plano:</strong> R$ ${dados.plano}</p>
                    <p><strong>CPF:</strong> ${dados.cpf}</p>
                    <p><strong>Endereço:</strong> ${dados.bairro}, ${dados.cidade}</p>
                    
                    <button onclick="abrirModalHistorico('${id}', '${dados.nome}')" style="width: 100%; background: #1e3a8a; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; margin-top: 15px; font-weight: bold;">
                        <i class="fas fa-calendar-alt"></i> Histórico de Meses
                    </button>

                    <div class="acoes-card" style="margin-top: 15px; display: flex; gap: 10px;">
                        <button onclick="editarCliente('${id}', '${dados.nome}', '${dados.cpf}', '${dados.telefone}', '${dados.bairro}', '${dados.cidade}', '${dados.vencimento}', '${dados.plano}')" class="btn-acao btn-editar" style="flex: 1;"><i class="fas fa-pen"></i> Editar</button>
                        <button onclick="excluirRegistro('clientes', '${id}')" class="btn-acao btn-excluir" style="flex: 1;"><i class="fas fa-trash"></i> Excluir</button>
                    </div>
                    
                    <button onclick="alterarStatus('${id}', ${!dados.emAtraso})" style="width: 100%; background: ${dados.emAtraso ? '#10b981' : '#f59e0b'}; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; margin-top: 10px; font-weight: bold;">
                        ${dados.emAtraso ? 'Marcar como EM DIA' : 'Marcar como PENDENTE'}
                    </button>
                </div>
            </div>
        `;
        lista.innerHTML += card;
    });

    document.getElementById('totalReceita').innerText = `R$ ${receitaTotal.toFixed(2)}`;
    atualizarGrafico();
});

// =========================================================================
// 6. LISTAR CUSTOS E ATUALIZAR GRÁFICO
// =========================================================================
onValue(ref(db, 'custos'), (snapshot) => {
    const lista = document.getElementById('listaCustos');
    lista.innerHTML = ""; 
    let custoTotal = 0;

    snapshot.forEach((filho) => {
        const id = filho.key;
        const dados = filho.val();
        custoTotal += dados.valor || 0;

        const card = `
            <div class="card-cliente" style="border-left-color: #ef4444;">
                <h3>${dados.descricao}</h3>
                <p><strong>Tipo:</strong> ${dados.tipo} | <strong>Data:</strong> ${dados.data}</p>
                <p><strong>Valor:</strong> R$ ${dados.valor.toFixed(2)}</p>
                <div class="acoes-card">
                    <button onclick="excluirRegistro('custos', '${id}')" class="btn-acao btn-excluir"><i class="fas fa-trash"></i> Excluir Custo</button>
                </div>
            </div>
        `;
        lista.innerHTML += card;
    });

    document.getElementById('totalCustos').innerText = `R$ ${custoTotal.toFixed(2)}`;
    atualizarGrafico();
});

function atualizarGrafico() {
    const receita = parseFloat(document.getElementById('totalReceita').innerText.replace('R$ ', '')) || 0;
    const custos = parseFloat(document.getElementById('totalCustos').innerText.replace('R$ ', '')) || 0;
    const lucro = receita - custos;

    const ctx = document.getElementById('graficoFinanceiro').getContext('2d');
    if(graficoAtual) { graficoAtual.destroy(); }

    graficoAtual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Receita Total', 'Custos Totais', 'Lucro / Prejuízo'],
            datasets: [{
                label: 'Visão Geral (R$)',
                data: [receita, custos, lucro],
                backgroundColor: ['#10b981', '#ef4444', lucro >= 0 ? '#3b82f6' : '#f59e0b'],
                borderRadius: 6
            }]
        },
        options: { responsive: true }
    });
}

// =========================================================================
// 7. FUNÇÕES DO HISTÓRICO DE MESES (2026/2027)
// =========================================================================
window.abrirModalHistorico = function(idCliente, nomeCliente) {
    clienteAtualHistorico = idCliente;
    document.getElementById('nomeClienteHistorico').innerText = nomeCliente;
    document.getElementById('modalHistorico').style.display = 'block';
    window.carregarMesesHistorico();
};

window.fecharModalHistorico = function() {
    document.getElementById('modalHistorico').style.display = 'none';
};

window.carregarMesesHistorico = function() {
    const ano = document.getElementById('filtroAno').value;
    const grid = document.getElementById('gridMeses');
    grid.innerHTML = '<p style="text-align:center; grid-column: span 3;">Carregando...</p>';

    get(ref(db, `historico/${clienteAtualHistorico}/${ano}`)).then((snapshot) => {
        const dadosAno = snapshot.val() || {};
        grid.innerHTML = '';

        mesesNomes.forEach((nomeMes, index) => {
            const numMes = index + 1;
            const statusAtual = dadosAno[numMes] || 'pendente'; 
            
            let classeCor = 'status-pendente';
            let icone = '⏳';
            if(statusAtual === 'pago') { classeCor = 'status-pago'; icone = '✅'; }
            if(statusAtual === 'atrasado') { classeCor = 'status-atrasado'; icone = '❌'; }

            grid.innerHTML += `
                <button class="btn-mes ${classeCor}" style="padding: 15px 5px; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold;" onclick="mudarStatusMes(${numMes}, '${statusAtual}')">
                    ${nomeMes}<br><span style="font-size: 11px; display: block; margin-top: 5px;">${icone} ${statusAtual.toUpperCase()}</span>
                </button>
            `;
        });
    });
};

window.mudarStatusMes = function(mes, statusAtual) {
    let novoStatus = 'pago';
    if(statusAtual === 'pendente') novoStatus = 'pago';
    else if(statusAtual === 'pago') novoStatus = 'atrasado';
    else if(statusAtual === 'atrasado') novoStatus = 'pendente';

    const ano = document.getElementById('filtroAno').value;
    
    update(ref(db, `historico/${clienteAtualHistorico}/${ano}`), {
        [mes]: novoStatus
    }).then(() => {
        window.carregarMesesHistorico(); // Recarrega a grade com a nova cor
    });
};

// =========================================================================
// 8. FUNÇÕES GLOBAIS (Janelas, Exclusão, Edição)
// =========================================================================
window.toggleDetalhes = function(id) {
    const div = document.getElementById(`detalhes-${id}`);
    div.style.display = div.style.display === "block" ? "none" : "block";
};

window.alterarStatus = function(id, statusAtrasado) {
    update(ref(db, 'clientes/' + id), { emAtraso: statusAtrasado });
};

window.excluirRegistro = function(caminho, id) {
    Swal.fire({
        title: 'Tem certeza?',
        text: "Essa exclusão é permanente!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            remove(ref(db, `${caminho}/${id}`));
            Swal.fire('Excluído!', 'O registro foi apagado permanentemente.', 'success');
        }
    });
};

window.editarCliente = function(id, nome, cpf, telefone, bairro, cidade, vencimento, plano) {
    clienteIdEditando = id;
    document.getElementById('nomeCliente').value = nome;
    document.getElementById('cpfCliente').value = cpf;
    document.getElementById('telCliente').value = telefone;
    document.getElementById('bairroCliente').value = bairro;
    document.getElementById('cidadeCliente').value = cidade;
    document.getElementById('vencimentoCliente').value = vencimento;
    document.getElementById('planoCliente').value = plano;
    
    document.getElementById('cpfCliente').classList.add('input-valido');
    document.getElementById('modalCliente').style.display = 'block';
    document.getElementById('tituloModalCliente').innerText = "Editar Cliente";
};
