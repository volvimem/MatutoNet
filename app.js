// =========================================================================
// 1. IMPORTAÇÕES DO FIREBASE (CORRIGIDO: Agora com o 'push' e todos os comandos)
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

// =========================================================================
// 2. VARIÁVEIS GLOBAIS DE ESTADO
// =========================================================================
let clienteIdEditando = null;
let custoIdEditando = null;
let graficoAtual = null;

let dadosClientes = {};
let dadosCustos = {};
let dadosHistorico = {};

const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Inicia o Dashboard com o mês e ano atuais automaticamente
window.onload = () => {
    const dataHoje = new Date();
    document.getElementById('dashMes').value = dataHoje.getMonth() + 1; // Ex: Março = 3
    document.getElementById('dashAno').value = dataHoje.getFullYear(); // Ex: 2026
};

// =========================================================================
// 3. MÁSCARAS E VALIDAÇÕES (Telefone e CPF)
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

    if (valor.replace(/\D/g, "").length === 11 && validarCPF(valor.replace(/\D/g, ""))) {
        e.target.classList.add('input-valido');
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
// 4. ESCUTADORES DO FIREBASE (Puxa os dados em Tempo Real)
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
// 5. DASHBOARD INTELIGENTE (Filtros e Gráficos)
// =========================================================================
window.atualizarDashboard = function() {
    const mesSelecionado = parseInt(document.getElementById('dashMes').value); // 0 = Ano Todo
    const anoSelecionado = document.getElementById('dashAno').value;

    let receitaRecebidaFiltro = 0;
    let receitaEsperadaFiltro = 0;
    let custosFiltro = 0;

    let arrayReceitas = [0,0,0,0,0,0,0,0,0,0,0,0];
    let arrayCustos = [0,0,0,0,0,0,0,0,0,0,0,0];
    let arrayLucro = [0,0,0,0,0,0,0,0,0,0,0,0];

    // Lógica de Receitas baseada no Histórico de Pagamentos
    Object.keys(dadosClientes).forEach(id => {
        const cliente = dadosClientes[id];
        const valorPlano = parseFloat(cliente.plano) || 0;
        
        for(let m = 1; m <= 12; m++) {
            // Soma o que deveria entrar (Pendente) se bater com o filtro
            if (mesSelecionado === 0 || m === mesSelecionado) {
                receitaEsperadaFiltro += valorPlano;
            }

            // Verifica se o mês 'm' está pago no ano selecionado
            if (dadosHistorico[id] && dadosHistorico[id][anoSelecionado] && dadosHistorico[id][anoSelecionado][m] === 'pago') {
                arrayReceitas[m-1] += valorPlano; // Alimenta o Gráfico Anual
                
                // Alimenta os Cartões se bater com o filtro
                if (mesSelecionado === 0 || m === mesSelecionado) {
                    receitaRecebidaFiltro += valorPlano;
                }
            }
        }
    });

    // Lógica de Custos
    Object.keys(dadosCustos).forEach(id => {
        const custo = dadosCustos[id];
        const valorCusto = parseFloat(custo.valor) || 0;
        const partesData = custo.data.split('/');
        
        if (partesData.length === 3) {
            const mesCusto = parseInt(partesData[1], 10);
            const anoCusto = partesData[2];

            if (anoCusto === anoSelecionado) {
                arrayCustos[mesCusto-1] += valorCusto; // Alimenta o Gráfico Anual
                
                // Alimenta os Cartões do topo
                if (mesSelecionado === 0 || mesCusto === mesSelecionado) {
                    custosFiltro += valorCusto;
                }
            }
        }
    });

    // Atualiza os Valores nos Cartões na Tela
    const pendente = receitaEsperadaFiltro - receitaRecebidaFiltro;
    document.getElementById('dashRecebido').innerText = `R$ ${receitaRecebidaFiltro.toFixed(2)}`;
    document.getElementById('dashPendente').innerText = `R$ ${pendente > 0 ? pendente.toFixed(2) : '0.00'}`;
    document.getElementById('dashCustos').innerText = `R$ ${custosFiltro.toFixed(2)}`;
    document.getElementById('dashLucro').innerText = `R$ ${(receitaRecebidaFiltro - custosFiltro).toFixed(2)}`;

    // Renderiza o Gráfico de 12 Meses
    for(let i=0; i<12; i++) {
        arrayLucro[i] = arrayReceitas[i] - arrayCustos[i];
    }

    const ctx = document.getElementById('graficoFinanceiro').getContext('2d');
    if(graficoAtual) { graficoAtual.destroy(); }

    graficoAtual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: mesesNomes,
            datasets: [
                { label: 'Entradas (Pagos)', data: arrayReceitas, backgroundColor: '#10b981', order: 2 },
                { label: 'Custos', data: arrayCustos, backgroundColor: '#ef4444', order: 3 },
                { label: 'Lucro Líquido', data: arrayLucro, type: 'line', borderColor: '#3b82f6', backgroundColor: '#3b82f6', borderWidth: 3, fill: false, tension: 0.3, order: 1 }
            ]
        },
        options: { responsive: true }
    });
};

// =========================================================================
// 6. GESTÃO DE CUSTOS E PARCELAMENTOS (Até 24x)
// =========================================================================
document.getElementById('formCusto').addEventListener('submit', function(e) {
    e.preventDefault(); // Impede a tela de piscar e apagar os dados

    const descricao = document.getElementById('descCusto').value;
    const valorTotal = parseFloat(document.getElementById('valorCusto').value);
    const tipo = document.getElementById('tipoCusto').value;
    
    if (custoIdEditando) {
        // ATUALIZAR CUSTO EXISTENTE (A Caneta)
        update(ref(db, 'custos/' + custoIdEditando), { descricao, valor: valorTotal, tipo }).then(() => {
            Swal.fire('Atualizado!', 'Custo modificado com sucesso.', 'success');
            resetarFormCusto();
        });
    } else {
        // CRIAR NOVO CUSTO PARCELADO
        const parcelas = parseInt(document.getElementById('parcelasCusto').value) || 1;
        const valorParcela = valorTotal / parcelas;
        const dataAtual = new Date(); // Pega a data de hoje para começar a contar

        for (let i = 0; i < parcelas; i++) {
            // Empurra os meses para a frente dependendo da parcela
            let dataParcela = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + i, dataAtual.getDate());
            let labelParcela = parcelas > 1 ? ` (Parc. ${i+1}/${parcelas})` : "";
            
            // push: O "carteiro" salvando o dado lá no banco!
            push(ref(db, 'custos'), {
                descricao: descricao + labelParcela,
                valor: valorParcela,
                tipo: tipo,
                data: dataParcela.toLocaleDateString('pt-BR') // Ex: 28/03/2026
            });
        }
        Swal.fire('Salvo!', parcelas > 1 ? `Custo parcelado em ${parcelas}x com sucesso.` : 'Custo registrado.', 'success');
        resetarFormCusto();
    }
});

function resetarFormCusto() {
    document.getElementById('formCusto').reset();
    custoIdEditando = null;
    document.getElementById('btnSalvarCusto').innerText = "Salvar Custo no Financeiro";
    document.getElementById('tituloSecaoCusto').innerText = "Lançar Novo Custo";
    document.getElementById('parcelasCusto').disabled = false; // Libera o campo de parcelas de novo
}

window.editarCusto = function(id, descricao, valor, tipo) {
    custoIdEditando = id;
    document.getElementById('descCusto').value = descricao;
    document.getElementById('valorCusto').value = valor;
    document.getElementById('tipoCusto').value = tipo;
    
    // Trava as parcelas para não duplicar na edição
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
                    <button onclick="editarCusto('${id}', '${dados.descricao}', ${dados.valor}, '${dados.tipo}')" class="btn-acao btn-editar"><i class="fas fa-pen"></i> Editar</button>
                    <button onclick="excluirRegistro('custos', '${id}')" class="btn-acao btn-excluir"><i class="fas fa-trash"></i> Apagar</button>
                </div>
            </div>
        `;
    });
}

// =========================================================================
// 7. GESTÃO DE CLIENTES
// =========================================================================
document.getElementById('formNovoCliente').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const cpfCru = document.getElementById('cpfCliente').value.replace(/\D/g, "");
    if (!validarCPF(cpfCru)) {
        Swal.fire('Erro!', 'Por favor, digite um CPF válido.', 'error'); return;
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
            Swal.fire('Sucesso!', 'Cadastro atualizado.', 'success');
            fecharModalE_ResetarCliente();
        });
    } else {
        push(ref(db, 'clientes'), clienteData).then(() => {
            Swal.fire('Sucesso!', 'Novo cliente cadastrado.', 'success');
            fecharModalE_ResetarCliente();
        });
    }
});

function fecharModalE_ResetarCliente() {
    document.getElementById('formNovoCliente').reset();
    document.getElementById('cpfCliente').classList.remove('input-valido');
    document.getElementById('modalCliente').style.display = 'none';
    clienteIdEditando = null;
}

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
                    <h3 style="margin: 0; font-size: 16px;">${dados.nome}</h3>${badgeAtraso}
                </div>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <a href="https://wa.me/55${numWhats}" target="_blank" style="flex: 1; background: #25D366; color: white; text-align: center; padding: 10px; border-radius: 6px; text-decoration: none; font-weight: bold;"><i class="fab fa-whatsapp"></i> Zap</a>
                    <button onclick="toggleDetalhes('${id}')" style="flex: 1; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;"><i class="fas fa-user"></i> Perfil</button>
                </div>
                <div id="detalhes-${id}" class="detalhes-cliente" style="display: none; background: #f8fafc; padding: 15px; margin-top: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <p><strong>Venc.:</strong> Dia ${dados.vencimento} | <strong>Plano:</strong> R$ ${dados.plano.toFixed(2)}</p>
                    <p><strong>CPF:</strong> ${dados.cpf} | <strong>Endereço:</strong> ${dados.bairro}, ${dados.cidade}</p>
                    
                    <button onclick="abrirModalHistorico('${id}', '${dados.nome}')" style="width: 100%; background: #1e3a8a; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; margin-top: 15px; font-weight: bold;">
                        <i class="fas fa-calendar-alt"></i> Histórico de Meses
                    </button>

                    <div class="acoes-card" style="margin-top: 15px;">
                        <button onclick="editarCliente('${id}', '${dados.nome}', '${dados.cpf}', '${dados.telefone}', '${dados.bairro}', '${dados.cidade}', '${dados.vencimento}', '${dados.plano}')" class="btn-acao btn-editar"><i class="fas fa-pen"></i> Editar</button>
                        <button onclick="excluirRegistro('clientes', '${id}')" class="btn-acao btn-excluir"><i class="fas fa-trash"></i> Excluir</button>
                    </div>
                </div>
            </div>
        `;
    });
}

// =========================================================================
// 8. HISTÓRICO DE MESES E FUNÇÕES AUXILIARES
// =========================================================================
let clienteAtualHistorico = null;

window.abrirModalHistorico = function(idCliente, nomeCliente) {
    clienteAtualHistorico = idCliente;
    document.getElementById('nomeClienteHistorico').innerText = nomeCliente;
    document.getElementById('modalHistorico').style.display = 'block';
    
    // Abre já no ano selecionado no Dashboard
    document.getElementById('filtroAno').value = document.getElementById('dashAno').value;
    window.carregarMesesHistorico();
};

window.carregarMesesHistorico = function() {
    const ano = document.getElementById('filtroAno').value;
    const grid = document.getElementById('gridMeses');
    grid.innerHTML = '';
    
    const dadosAno = (dadosHistorico[clienteAtualHistorico] && dadosHistorico[clienteAtualHistorico][ano]) ? dadosHistorico[clienteAtualHistorico][ano] : {};

    mesesNomes.forEach((nomeMes, index) => {
        const numMes = index + 1;
        const statusAtual = dadosAno[numMes] || 'pendente'; 
        
        let classeCor = 'status-pendente'; let icone = '⏳';
        if(statusAtual === 'pago') { classeCor = 'status-pago'; icone = '✅'; }
        if(statusAtual === 'atrasado') { classeCor = 'status-atrasado'; icone = '❌'; }

        grid.innerHTML += `
            <button class="btn-mes ${classeCor}" style="padding: 15px 5px; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onclick="mudarStatusMes(${numMes}, '${statusAtual}')">
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
        window.carregarMesesHistorico(); // Atualiza a cor na hora
    });
};

window.toggleDetalhes = function(id) {
    const div = document.getElementById(`detalhes-${id}`);
    div.style.display = div.style.display === "block" ? "none" : "block";
};

window.excluirRegistro = function(caminho, id) {
    Swal.fire({
        title: 'Tem certeza?', text: "Essa exclusão é permanente!", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
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
    
    document.getElementById('cpfCliente').classList.add('input-valido');
    document.getElementById('modalCliente').style.display = 'block';
};
