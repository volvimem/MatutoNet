import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDyCmGEBYtXmlbUhjpxK9799zs1QRNHNog",
  authDomain: "matutonett.firebaseapp.com",
  databaseURL: "https://matutonett-default-rtdb.firebaseio.com",
  projectId: "matutonett"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Variáveis Globais para alimentar o Gráfico Inteligente
let clienteIdEditando = null;
let custoIdEditando = null;
let graficoAtual = null;

let dadosClientes = {};
let dadosCustos = {};
let dadosHistorico = {};

const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Define Mês e Ano atuais nos filtros iniciais
window.onload = () => {
    const dataHoje = new Date();
    document.getElementById('dashMes').value = dataHoje.getMonth() + 1; // 1 a 12
    document.getElementById('dashAno').value = dataHoje.getFullYear(); // 2026
};

// =========================================================================
// 1. ESCUTADORES DE DADOS (Puxa tudo do Firebase em tempo real)
// =========================================================================
onValue(ref(db, 'clientes'), (snapshot) => {
    dadosClientes = snapshot.val() || {};
    renderizarClientes();
    window.atualizarDashboard();
});

onValue(ref(db, 'custos'), (snapshot) => {
    dadosCustos = snapshot.val() || {};
    renderizarCustos();
    window.atualizarDashboard();
});

onValue(ref(db, 'historico'), (snapshot) => {
    dadosHistorico = snapshot.val() || {};
    window.atualizarDashboard();
});

// =========================================================================
// 2. DASHBOARD INTELIGENTE (Cruzamento de Dados - A Mágica)
// =========================================================================
window.atualizarDashboard = function() {
    const mesSelecionado = parseInt(document.getElementById('dashMes').value);
    const anoSelecionado = document.getElementById('dashAno').value;

    let receitaRecebidaMes = 0;
    let receitaEsperadaMes = 0;
    let custosMes = 0;

    // Arrays para o Gráfico de 12 meses
    let arrayReceitas = [0,0,0,0,0,0,0,0,0,0,0,0];
    let arrayCustos = [0,0,0,0,0,0,0,0,0,0,0,0];
    let arrayLucro = [0,0,0,0,0,0,0,0,0,0,0,0];

    // 1. Calcula Receitas (Baseado em quem pagou no Histórico)
    Object.keys(dadosClientes).forEach(id => {
        const cliente = dadosClientes[id];
        const valorPlano = parseFloat(cliente.plano) || 0;
        
        receitaEsperadaMes += valorPlano; // O que deveria entrar

        // Preenche o gráfico anual e verifica o mês atual
        for(let m = 1; m <= 12; m++) {
            if (dadosHistorico[id] && dadosHistorico[id][anoSelecionado] && dadosHistorico[id][anoSelecionado][m] === 'pago') {
                arrayReceitas[m-1] += valorPlano;
                if (m === mesSelecionado) receitaRecebidaMes += valorPlano;
            }
        }
    });

    // 2. Calcula Custos
    Object.keys(dadosCustos).forEach(id => {
        const custo = dadosCustos[id];
        const valorCusto = parseFloat(custo.valor) || 0;
        
        // A data vem como DD/MM/YYYY. Vamos quebrar para descobrir mês e ano.
        const partesData = custo.data.split('/');
        if (partesData.length === 3) {
            const mesCusto = parseInt(partesData[1], 10);
            const anoCusto = partesData[2];

            if (anoCusto === anoSelecionado) {
                arrayCustos[mesCusto-1] += valorCusto;
                if (mesCusto === mesSelecionado) custosMes += valorCusto;
            }
        }
    });

    // Calcula Lucros do gráfico
    for(let i=0; i<12; i++) {
        arrayLucro[i] = arrayReceitas[i] - arrayCustos[i];
    }

    // Atualiza os Cartões da Tela
    const pendente = receitaEsperadaMes - receitaRecebidaMes;
    document.getElementById('dashRecebido').innerText = `R$ ${receitaRecebidaMes.toFixed(2)}`;
    document.getElementById('dashPendente').innerText = `R$ ${pendente > 0 ? pendente.toFixed(2) : '0.00'}`;
    document.getElementById('dashCustos').innerText = `R$ ${custosMes.toFixed(2)}`;
    document.getElementById('dashLucro').innerText = `R$ ${(receitaRecebidaMes - custosMes).toFixed(2)}`;

    // Renderiza o Gráfico Premium (Barras e Linha)
    const ctx = document.getElementById('graficoFinanceiro').getContext('2d');
    if(graficoAtual) { graficoAtual.destroy(); }

    graficoAtual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: mesesNomes,
            datasets: [
                {
                    label: 'Entradas Reais (Pagos)',
                    data: arrayReceitas,
                    backgroundColor: '#10b981', // Verde
                    order: 2
                },
                {
                    label: 'Custos',
                    data: arrayCustos,
                    backgroundColor: '#ef4444', // Vermelho
                    order: 3
                },
                {
                    label: 'Lucro Líquido',
                    data: arrayLucro,
                    type: 'line', // Uma linha passando por cima das barras
                    borderColor: '#3b82f6',
                    backgroundColor: '#3b82f6',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.3,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });
};

// =========================================================================
// 3. EDIÇÃO E SALVAMENTO DE CUSTOS (A Caneta!)
// =========================================================================
document.getElementById('formCusto').addEventListener('submit', function(e) {
    e.preventDefault();

    const descricao = document.getElementById('descCusto').value;
    const valorTotal = parseFloat(document.getElementById('valorCusto').value);
    const tipo = document.getElementById('tipoCusto').value;
    
    if (custoIdEditando) {
        // Atualiza Custo Existente (Mantém a data original)
        update(ref(db, 'custos/' + custoIdEditando), { descricao, valor: valorTotal, tipo }).then(() => {
            Swal.fire('Atualizado!', 'Custo modificado com sucesso.', 'success');
            resetarFormCusto();
        });
    } else {
        // Cria Novo Custo (Pode ser parcelado)
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
        Swal.fire('Salvo!', parcelas > 1 ? `${parcelas} parcelas registradas.` : 'Custo registrado.', 'success');
        resetarFormCusto();
    }
});

function resetarFormCusto() {
    document.getElementById('formCusto').reset();
    custoIdEditando = null;
    document.getElementById('btnSalvarCusto').innerText = "Salvar Custo";
    document.getElementById('tituloSecaoCusto').innerText = "Lançar Novo Custo";
    document.getElementById('parcelasCusto').disabled = false; // Reativa parcelas
}

window.editarCusto = function(id, descricao, valor, tipo) {
    custoIdEditando = id;
    document.getElementById('descCusto').value = descricao;
    document.getElementById('valorCusto').value = valor;
    document.getElementById('tipoCusto').value = tipo;
    
    // Na edição, bloqueamos o campo parcelas para não bagunçar datas futuras
    document.getElementById('parcelasCusto').value = 1;
    document.getElementById('parcelasCusto').disabled = true; 
    
    document.getElementById('btnSalvarCusto').innerText = "Atualizar Custo";
    document.getElementById('tituloSecaoCusto').innerText = "Editando Custo...";
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Rola pra cima
};

function renderizarCustos() {
    const lista = document.getElementById('listaCustos');
    lista.innerHTML = ""; 
    Object.keys(dadosCustos).forEach(id => {
        const dados = dadosCustos[id];
        lista.innerHTML += `
            <div class="card-cliente" style="border-left-color: #ef4444;">
                <h3>${dados.descricao}</h3>
                <p><strong>Data:</strong> ${dados.data} | <strong>Tipo:</strong> ${dados.tipo}</p>
                <p style="font-size: 18px; color: #ef4444; font-weight: bold;">R$ ${dados.valor.toFixed(2)}</p>
                <div class="acoes-card">
                    <button onclick="editarCusto('${id}', '${dados.descricao}', ${dados.valor}, '${dados.tipo}')" class="btn-acao btn-editar"><i class="fas fa-pen"></i></button>
                    <button onclick="excluirRegistro('custos', '${id}')" class="btn-acao btn-excluir"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });
}

// =========================================================================
// 4. RESTANTE DO CÓDIGO (Clientes, Histórico, Validações e Exclusão)
// =========================================================================
// (Essa parte é a mesma que gerencia o visual e a máscara, já testada e funcionando)

function renderizarClientes() {
    const lista = document.getElementById('listaClientes');
    lista.innerHTML = ""; 
    Object.keys(dadosClientes).forEach(id => {
        const dados = dadosClientes[id];
        const numWhats = dados.telefone.replace(/\D/g, '');
        const badgeAtraso = dados.emAtraso ? '<span class="badge-atraso">⚠️ PENDENTE</span>' : '<span style="color: #10b981; font-weight: bold; font-size: 14px;">✅ EM DIA</span>';

        lista.innerHTML += `
            <div class="card-cliente">
                <div class="resumo-cliente" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                    <h3 style="margin: 0;">${dados.nome}</h3>${badgeAtraso}
                </div>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <a href="https://wa.me/55${numWhats}" target="_blank" style="flex: 1; background: #25D366; color: white; text-align: center; padding: 10px; border-radius: 6px; text-decoration: none; font-weight: bold;"><i class="fab fa-whatsapp"></i> Zap</a>
                    <button onclick="toggleDetalhes('${id}')" style="flex: 1; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;"><i class="fas fa-user"></i> Perfil</button>
                </div>
                <div id="detalhes-${id}" class="detalhes-cliente" style="display: none; background: #f8fafc; padding: 15px; margin-top: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p><strong>Venc.:</strong> Dia ${dados.vencimento} | <strong>Plano:</strong> R$ ${dados.plano}</p>
                    <p><strong>CPF:</strong> ${dados.cpf} | <strong>Endereço:</strong> ${dados.bairro}, ${dados.cidade}</p>
                    
                    <button onclick="abrirModalHistorico('${id}', '${dados.nome}')" style="width: 100%; background: #1e3a8a; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; margin-top: 15px; font-weight: bold;">
                        <i class="fas fa-calendar-alt"></i> Histórico de Meses
                    </button>

                    <div class="acoes-card">
                        <button onclick="editarCliente('${id}', '${dados.nome}', '${dados.cpf}', '${dados.telefone}', '${dados.bairro}', '${dados.cidade}', '${dados.vencimento}', '${dados.plano}')" class="btn-acao btn-editar"><i class="fas fa-pen"></i></button>
                        <button onclick="excluirRegistro('clientes', '${id}')" class="btn-acao btn-excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    });
}

// Histórico de Meses
let clienteAtualHistorico = null;
window.abrirModalHistorico = function(idCliente, nomeCliente) {
    clienteAtualHistorico = idCliente;
    document.getElementById('nomeClienteHistorico').innerText = nomeCliente;
    document.getElementById('modalHistorico').style.display = 'block';
    window.carregarMesesHistorico();
};

window.carregarMesesHistorico = function() {
    const ano = document.getElementById('filtroAno').value;
    const grid = document.getElementById('gridMeses');
    grid.innerHTML = '';
    
    // Usa os dados globais puxados na inicialização
    const dadosAno = (dadosHistorico[clienteAtualHistorico] && dadosHistorico[clienteAtualHistorico][ano]) ? dadosHistorico[clienteAtualHistorico][ano] : {};

    mesesNomes.forEach((nomeMes, index) => {
        const numMes = index + 1;
        const statusAtual = dadosAno[numMes] || 'pendente'; 
        
        let classeCor = 'status-pendente'; let icone = '⏳';
        if(statusAtual === 'pago') { classeCor = 'status-pago'; icone = '✅'; }
        if(statusAtual === 'atrasado') { classeCor = 'status-atrasado'; icone = '❌'; }

        grid.innerHTML += `
            <button class="btn-mes ${classeCor}" style="padding: 15px 5px; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold;" onclick="mudarStatusMes(${numMes}, '${statusAtual}')">
                ${nomeMes}<br><span style="font-size: 11px;">${icone} ${statusAtual.toUpperCase()}</span>
            </button>
        `;
    });
};

window.mudarStatusMes = function(mes, statusAtual) {
    let novoStatus = 'pago';
    if(statusAtual === 'pendente') novoStatus = 'pago';
    else if(statusAtual === 'pago') novoStatus = 'atrasado';
    else if(statusAtual === 'atrasado') novoStatus = 'pendente';

    const ano = document.getElementById('filtroAno').value;
    update(ref(db, `historico/${clienteAtualHistorico}/${ano}`), { [mes]: novoStatus }).then(() => {
        window.carregarMesesHistorico(); // Atualiza janela
    });
};

// Funções de Interface Auxiliares
window.toggleDetalhes = function(id) {
    const div = document.getElementById(`detalhes-${id}`);
    div.style.display = div.style.display === "block" ? "none" : "block";
};

window.excluirRegistro = function(caminho, id) {
    Swal.fire({
        title: 'Tem certeza?',
        text: "Essa exclusão é permanente!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, excluir!'
    }).then((result) => {
        if (result.isConfirmed) {
            remove(ref(db, `${caminho}/${id}`));
            Swal.fire('Excluído!', 'O registro foi apagado.', 'success');
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
    
    document.getElementById('modalCliente').style.display = 'block';
};

// Salvamento Cliente
document.getElementById('formNovoCliente').addEventListener('submit', function(e) {
    e.preventDefault();
    const clienteData = {
        nome: document.getElementById('nomeCliente').value, cpf: document.getElementById('cpfCliente').value,
        telefone: document.getElementById('telCliente').value, bairro: document.getElementById('bairroCliente').value,
        cidade: document.getElementById('cidadeCliente').value, vencimento: document.getElementById('vencimentoCliente').value,
        plano: parseFloat(document.getElementById('planoCliente').value), emAtraso: false
    };

    if (clienteIdEditando) {
        update(ref(db, 'clientes/' + clienteIdEditando), clienteData).then(() => {
            Swal.fire('Premium!', 'Cliente atualizado.', 'success');
            document.getElementById('formNovoCliente').reset(); document.getElementById('modalCliente').style.display = 'none';
            clienteIdEditando = null;
        });
    } else {
        push(ref(db, 'clientes'), clienteData).then(() => {
            Swal.fire('Premium!', 'Cliente cadastrado.', 'success');
            document.getElementById('formNovoCliente').reset(); document.getElementById('modalCliente').style.display = 'none';
        });
    }
});
