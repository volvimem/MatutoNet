import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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
let graficoAtual = null; // Variável para o gráfico Chart.js

// ==========================================
// 1. SALVAR CLIENTE (Premium Alerts)
// ==========================================
document.getElementById('formNovoCliente').addEventListener('submit', function(e) {
    e.preventDefault();

    const clienteData = {
        nome: document.getElementById('nomeCliente').value,
        cpf: document.getElementById('cpfCliente').value,
        telefone: document.getElementById('telCliente').value,
        bairro: document.getElementById('bairroCliente').value,
        cidade: document.getElementById('cidadeCliente').value,
        vencimento: document.getElementById('vencimentoCliente').value,
        plano: parseFloat(document.getElementById('planoCliente').value), // Salva como número para o gráfico
        emAtraso: false
    };

    if (clienteIdEditando) {
        update(ref(db, 'clientes/' + clienteIdEditando), clienteData).then(() => {
            Swal.fire('Premium!', 'Cliente atualizado com sucesso!', 'success');
            fecharModalE_Resetar();
        });
    } else {
        push(ref(db, 'clientes'), clienteData).then(() => {
            Swal.fire('Premium!', 'Novo cliente cadastrado!', 'success');
            fecharModalE_Resetar();
        });
    }
});

function fecharModalE_Resetar() {
    document.getElementById('formNovoCliente').reset();
    document.getElementById('modalCliente').style.display = 'none';
    clienteIdEditando = null;
}

// ==========================================
// 2. CORREÇÃO: SALVAR CUSTO (Ponto 3)
// ==========================================
document.getElementById('formCusto').addEventListener('submit', function(e) {
    e.preventDefault(); // ISSO IMPEDE A PÁGINA DE RECARREGAR E VOLTAR PRO INÍCIO!

    const custoData = {
        descricao: document.getElementById('descCusto').value,
        valor: parseFloat(document.getElementById('valorCusto').value),
        tipo: document.getElementById('tipoCusto').value,
        data: new Date().toLocaleDateString('pt-BR')
    };

    push(ref(db, 'custos'), custoData).then(() => {
        Swal.fire('Salvo!', 'Custo registrado no financeiro.', 'success');
        document.getElementById('formCusto').reset();
    }).catch(erro => {
        Swal.fire('Erro!', 'Falha ao salvar custo.', 'error');
    });
});

// ==========================================
// 3. LISTAR CLIENTES (WhatsApp e Ponto 5)
// ==========================================
onValue(ref(db, 'clientes'), (snapshot) => {
    const lista = document.getElementById('listaClientes');
    lista.innerHTML = ""; 
    let receitaTotal = 0;

    snapshot.forEach((filho) => {
        const id = filho.key;
        const dados = filho.val();
        receitaTotal += dados.plano || 0; // Soma para o gráfico

        // Formata o telefone para link do WhatsApp (Remove espaços e parênteses)
        const numWhats = dados.telefone.replace(/\D/g, '');
        
        const badgeAtraso = dados.emAtraso ? '<span class="badge-atraso">⚠️ PENDENTE</span>' : '<span style="color: #10b981; font-weight: bold; font-size: 12px;">✅ EM DIA</span>';
        const botaoStatus = dados.emAtraso 
            ? `<button onclick="alterarStatus('${id}', false)" style="background: #10b981; color: white; border: none; padding: 5px; border-radius: 3px; cursor: pointer;">Pagamento Recebido</button>` 
            : `<button onclick="alterarStatus('${id}', true)" style="background: #ef4444; color: white; border: none; padding: 5px; border-radius: 3px; cursor: pointer;">Marcar Pendente</button>`;

        const card = `
            <div class="card-cliente">
                <h3>${dados.nome} ${badgeAtraso}</h3>
                <p><strong>Vencimento:</strong> Dia ${dados.vencimento} | <strong>Valor:</strong> R$ ${dados.plano}</p>
                <div style="margin-top: 10px; margin-bottom: 10px;">${botaoStatus}</div>
                
                <a href="https://wa.me/55${numWhats}" target="_blank" style="display: block; background: #25D366; color: white; text-align: center; padding: 8px; border-radius: 5px; text-decoration: none; margin-bottom: 10px;">
                    <i class="fab fa-whatsapp"></i> Abrir WhatsApp
                </a>

                <div class="acoes-card">
                    <button onclick="editarCliente('${id}', '${dados.nome}', '${dados.cpf}', '${dados.telefone}', '${dados.bairro}', '${dados.cidade}', '${dados.vencimento}', '${dados.plano}')" class="btn-acao btn-editar" title="Editar"><i class="fas fa-pen"></i></button>
                    <button onclick="excluirRegistro('clientes', '${id}')" class="btn-acao btn-excluir" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
                <button class="btn-pix" onclick="gerarPixEditavel('${dados.nome}', '${dados.plano}')"><i class="fa-brands fa-pix"></i> Gerar PIX</button>
            </div>
        `;
        lista.innerHTML += card;
    });

    document.getElementById('totalReceita').innerText = `R$ ${receitaTotal.toFixed(2)}`;
    atualizarGrafico(); // Atualiza o gráfico quando clientes mudam
});

// ==========================================
// 4. LISTAR CUSTOS
// ==========================================
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
                    <button onclick="excluirRegistro('custos', '${id}')" class="btn-acao btn-excluir"><i class="fas fa-trash"></i> Excluir</button>
                </div>
            </div>
        `;
        lista.innerHTML += card;
    });

    document.getElementById('totalCustos').innerText = `R$ ${custoTotal.toFixed(2)}`;
    atualizarGrafico(); // Atualiza o gráfico quando custos mudam
});

// ==========================================
// 5. FUNÇÕES GLOBAIS (Excluir, Editar, PIX)
// ==========================================
window.alterarStatus = function(id, status) {
    update(ref(db, 'clientes/' + id), { emAtraso: status });
};

window.excluirRegistro = function(caminho, id) {
    Swal.fire({
        title: 'Tem certeza?',
        text: "Essa exclusão é permanente!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar'
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
    document.getElementById('tituloModalCliente').innerText = "Editar Cliente";
};

// Gerador de PIX com Campos Editáveis (Ponto 1)
window.gerarPixEditavel = function(nomeCliente, valorPlano) {
    Swal.fire({
        title: 'Gerar Cobrança PIX',
        html: `
            <p style="margin-bottom: 10px;">Cliente: <b>${nomeCliente}</b></p>
            <input type="text" id="chavePix" class="swal2-input" placeholder="Sua Chave PIX" value="seu-email@pix.com.br">
            <input type="number" id="valorPix" class="swal2-input" placeholder="Valor do PIX" value="${valorPlano}">
        `,
        confirmButtonText: 'Copiar Mensagem de Cobrança',
        confirmButtonColor: '#32bcad',
        preConfirm: () => {
            const chave = document.getElementById('chavePix').value;
            const valor = document.getElementById('valorPix').value;
            return { chave: chave, valor: valor };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            const msg = `Olá ${nomeCliente}! Seu vencimento está próximo. O valor do seu plano é R$${result.value.valor}. Por favor, realize o pagamento na Chave PIX: ${result.value.chave}`;
            navigator.clipboard.writeText(msg);
            Swal.fire('Copiado!', 'Mensagem de cobrança copiada. Agora é só colar no WhatsApp do cliente!', 'success');
        }
    });
};

// ==========================================
// 6. GRÁFICO INTELIGENTE (Ponto 4)
// ==========================================
function atualizarGrafico() {
    const textoReceita = document.getElementById('totalReceita').innerText.replace('R$ ', '');
    const textoCustos = document.getElementById('totalCustos').innerText.replace('R$ ', '');
    
    const receita = parseFloat(textoReceita) || 0;
    const custos = parseFloat(textoCustos) || 0;
    const lucro = receita - custos;

    const ctx = document.getElementById('graficoFinanceiro').getContext('2d');
    
    if(graficoAtual) { graficoAtual.destroy(); } // Destrói o anterior para não sobrepor

    graficoAtual = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Receita Esperada', 'Custos', 'Lucro/Prejuízo'],
            datasets: [{
                label: 'Controle Financeiro (R$)',
                data: [receita, custos, lucro],
                backgroundColor: ['#10b981', '#ef4444', lucro >= 0 ? '#3b82f6' : '#f59e0b'],
                borderRadius: 5
            }]
        },
        options: { responsive: true }
    });
}
