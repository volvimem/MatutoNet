// =========================================================================
// 1. IMPORTAÇÕES DO FIREBASE (Sempre no topo do arquivo)
// =========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// =========================================================================
// 2. CONFIGURAÇÃO DO SEU BANCO DE DADOS
// =========================================================================
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

// Variáveis para sabermos se estamos salvando um NOVO cadastro ou EDITANDO um existente
let clienteIdEditando = null;
let custoIdEditando = null;

// =========================================================================
// 3. MÁSCARAS E VALIDAÇÕES (Pontos 7)
// =========================================================================

// Máscara de Telefone: Oculta o +55 na visão, mas formata (XX) X XXXX-XXXX
document.getElementById('telCliente').addEventListener('input', function(e) {
    let valor = e.target.value.replace(/\D/g, ""); // Tira tudo que não é número
    if (valor.length > 11) valor = valor.slice(0, 11); // Limita a 11 números
    
    // Aplica a formatação visual
    if (valor.length > 2) valor = valor.replace(/^(\d{2})(\d)/g, "($1) $2");
    if (valor.length > 7) valor = valor.replace(/(\d{1})(\d{4})(\d{4})$/, "$1 $2-$3");
    
    e.target.value = valor;
});

// Máscara e Validação de CPF (Fica Verde se for válido)
document.getElementById('cpfCliente').addEventListener('input', function(e) {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.slice(0, 11);
    
    // Aplica a formatação visual (XXX.XXX.XXX-XX)
    if (valor.length > 3) valor = valor.replace(/^(\d{3})(\d)/, "$1.$2");
    if (valor.length > 6) valor = valor.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3");
    if (valor.length > 9) valor = valor.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
    
    e.target.value = valor;

    // Checa se é válido e pinta de verde
    if (valor.replace(/\D/g, "").length === 11) {
        if (validarCPF(valor.replace(/\D/g, ""))) {
            e.target.classList.add('input-valido'); // Fica verde (pelo CSS)
        } else {
            e.target.classList.remove('input-valido');
        }
    } else {
        e.target.classList.remove('input-valido');
    }
});

// Função matemática que descobre se o CPF é real
function validarCPF(cpf) {
    if (/^(\d)\1{10}$/.test(cpf)) return false; // Bloqueia 111.111.111-11
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
// 4. CADASTRAR / EDITAR CLIENTE (Pontos 3, 5, 7, 9)
// =========================================================================
document.getElementById('formNovoCliente').addEventListener('submit', function(e) {
    e.preventDefault();

    // Se o CPF estiver preenchido completo, verifica se é válido antes de salvar
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
        plano: document.getElementById('planoCliente').value,
        linkMaps: document.getElementById('linkMaps').value || "", // Opcional
        emAtraso: false // Todo cliente novo começa em dia
    };

    if (clienteIdEditando) {
        // ATUALIZAR CLIENTE EXISTENTE
        update(ref(db, 'clientes/' + clienteIdEditando), clienteData)
            .then(() => {
                Swal.fire('Sucesso!', 'Cliente atualizado com sucesso.', 'success');
                resetarFormularioCliente();
            });
    } else {
        // CRIAR NOVO CLIENTE
        push(ref(db, 'clientes'), clienteData)
            .then(() => {
                Swal.fire('Premium!', 'Novo cliente cadastrado com sucesso.', 'success');
                resetarFormularioCliente();
            });
    }
});

function resetarFormularioCliente() {
    document.getElementById('formNovoCliente').reset();
    document.getElementById('cpfCliente').classList.remove('input-valido');
    clienteIdEditando = null;
    document.querySelector('#formNovoCliente button').textContent = "Salvar Cliente";
}

// =========================================================================
// 5. LISTAR CLIENTES EM TEMPO REAL E BOTÕES DE AÇÃO
// =========================================================================
onValue(ref(db, 'clientes'), (snapshot) => {
    const lista = document.getElementById('listaClientes');
    lista.innerHTML = ""; // Limpa a lista antes de preencher

    snapshot.forEach((filho) => {
        const id = filho.key;
        const dados = filho.val();

        // Lógica visual do Atraso (Ponto 5)
        const badgeAtraso = dados.emAtraso ? '<span class="badge-atraso">⚠️ PENDENTE</span>' : '<span style="color: #10b981; font-weight: bold; font-size: 12px;">✅ EM DIA</span>';
        const botaoStatus = dados.emAtraso 
            ? `<button onclick="alterarStatus('${id}', false)" style="background: #10b981; color: white; border: none; padding: 5px; border-radius: 3px; cursor: pointer; font-size: 12px;">Marcar como Pago</button>` 
            : `<button onclick="alterarStatus('${id}', true)" style="background: #ef4444; color: white; border: none; padding: 5px; border-radius: 3px; cursor: pointer; font-size: 12px;">Marcar Pendente</button>`;

        // Botão Mapa (só aparece se tiver link)
        const botaoMapa = dados.linkMaps ? `<a href="${dados.linkMaps}" target="_blank" class="btn-mapa"><i class="fas fa-map-marker-alt"></i> Ver Mapa</a>` : '';

        const card = `
            <div class="card-cliente">
                <h3>${dados.nome} ${badgeAtraso}</h3>
                <p><strong>Vencimento:</strong> Dia ${dados.vencimento} | <strong>Plano:</strong> ${dados.plano}</p>
                <p><strong>WhatsApp:</strong> ${dados.telefone}</p>
                <p><strong>Local:</strong> ${dados.bairro}, ${dados.cidade}</p>
                
                <div style="margin-top: 10px; margin-bottom: 10px;">${botaoStatus}</div>
                
                <div class="acoes-card">
                    <button onclick="editarCliente('${id}', '${dados.nome}', '${dados.cpf}', '${dados.telefone}', '${dados.bairro}', '${dados.cidade}', '${dados.vencimento}', '${dados.plano}', '${dados.linkMaps}')" class="btn-acao btn-editar" title="Editar"><i class="fas fa-pen"></i></button>
                    <button onclick="excluirCliente('${id}')" class="btn-acao btn-excluir" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
                ${botaoMapa}
                <button class="btn-pix" onclick="gerarPix()"><i class="fa-brands fa-pix"></i> Gerar PIX Mensal</button>
            </div>
        `;
        lista.innerHTML += card;
    });
});

// Funções globais atreladas à janela (Para os botões do HTML gerado funcionarem)
window.alterarStatus = function(id, status) {
    update(ref(db, 'clientes/' + id), { emAtraso: status });
    // Não precisa de alerta, a mudança de cor já é imediata
};

window.excluirCliente = function(id) {
    Swal.fire({
        title: 'Excluir Cliente?',
        text: "Essa ação não pode ser desfeita!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            remove(ref(db, 'clientes/' + id));
            Swal.fire('Excluído!', 'O cliente foi removido do sistema.', 'success');
        }
    });
};

window.editarCliente = function(id, nome, cpf, telefone, bairro, cidade, vencimento, plano, linkMaps) {
    clienteIdEditando = id;
    document.getElementById('nomeCliente').value = nome;
    document.getElementById('cpfCliente').value = cpf;
    document.getElementById('telCliente').value = telefone;
    document.getElementById('bairroCliente').value = bairro;
    document.getElementById('cidadeCliente').value = cidade;
    document.getElementById('vencimentoCliente').value = vencimento;
    document.getElementById('planoCliente').value = plano;
    if(linkMaps !== 'undefined') document.getElementById('linkMaps').value = linkMaps;
    
    // O CPF já vem validado, mas forçamos a cor verde para continuar bonito
    document.getElementById('cpfCliente').classList.add('input-valido');
    
    document.querySelector('#formNovoCliente button').textContent = "Atualizar Cadastro";
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Rola a tela pra cima
};

window.gerarPix = function() {
    Swal.fire({
        title: 'Gerador de PIX',
        text: 'A integração com API de PIX automático e envio de WhatsApp (Asaas/MercadoPago) requer um Back-end ativo. Em breve configuraremos!',
        icon: 'info'
    });
}
