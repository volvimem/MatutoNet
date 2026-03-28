/* =========================================
   NAVEGAÇÃO DO APLICATIVO (MENU INFERIOR)
========================================= */
function mudarTela(idTela, elementoClicado) {
    const telas = document.querySelectorAll('.tela');
    telas.forEach(tela => tela.classList.remove('ativa'));

    const telaAtiva = document.getElementById(idTela);
    telaAtiva.classList.add('ativa');

    const botoes = document.querySelectorAll('.nav-item');
    botoes.forEach(botao => botao.classList.remove('ativo'));

    elementoClicado.classList.add('ativo');
}


/* =========================================
   CONTROLE DO MODAL DE CLIENTES
========================================= */
function abrirModalCliente() {
    document.getElementById('modal-cliente').style.display = 'block';
}

function fecharModalCliente() {
    document.getElementById('modal-cliente').style.display = 'none';
}


/* =========================================
   FUNCIONALIDADES DO FORMULÁRIO
========================================= */

// 1. Preview da Foto
function previewFoto(event) {
    const previewContainer = document.getElementById('preview-container');
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewContainer.innerHTML = `<img src="${e.target.result}" alt="Foto">`;
        }
        reader.readAsDataURL(file);
    }
}

// 2. Máscara de Telefone Automática (BR)
function mascaraTelefone(input) {
    let valor = input.value.replace(/\D/g, ''); 
    if (valor.length > 11) valor = valor.slice(0, 11); 

    if (valor.length > 2) valor = `(${valor.slice(0,2)}) ${valor.slice(2)}`;
    if (valor.length > 7) valor = `${valor.slice(0,6)} ${valor.slice(6)}`;
    if (valor.length > 12) valor = `${valor.slice(0,11)}-${valor.slice(11)}`;
    
    input.value = valor;
}

// 3. Validação e Máscara Inteligente de CPF
function mascaraEValidaCPF(input) {
    let cpf = input.value.replace(/\D/g, '');
    if (cpf.length > 11) cpf = cpf.slice(0, 11);

    let formatado = cpf;
    if (formatado.length > 3) formatado = `${formatado.slice(0,3)}.${formatado.slice(3)}`;
    if (formatado.length > 7) formatado = `${formatado.slice(0,7)}.${formatado.slice(7)}`;
    if (formatado.length > 11) formatado = `${formatado.slice(0,11)}-${formatado.slice(11)}`;
    input.value = formatado;

    const msgCpf = document.getElementById('msg-cpf');
    if (cpf.length === 11) {
        if (testaCPF(cpf)) {
            input.classList.remove('input-invalido');
            input.classList.add('input-valido');
            msgCpf.textContent = "CPF Válido ✓";
            msgCpf.className = "feedback-msg text-sucesso";
        } else {
            input.classList.remove('input-valido');
            input.classList.add('input-invalido');
            msgCpf.textContent = "CPF Inválido ✗";
            msgCpf.className = "feedback-msg text-erro";
        }
    } else {
        input.classList.remove('input-valido', 'input-invalido');
        msgCpf.textContent = "";
    }
}

// Cálculo Matemático Oficial de CPF
function testaCPF(strCPF) {
    let soma = 0, resto;
    if (strCPF == "00000000000" || strCPF == "11111111111" || strCPF == "22222222222" || strCPF == "33333333333" || strCPF == "44444444444" || strCPF == "55555555555" || strCPF == "66666666666" || strCPF == "77777777777" || strCPF == "88888888888" || strCPF == "99999999999") return false;
    for (let i=1; i<=9; i++) soma = soma + parseInt(strCPF.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto == 10) || (resto == 11)) resto = 0;
    if (resto != parseInt(strCPF.substring(9, 10)) ) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma = soma + parseInt(strCPF.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto == 10) || (resto == 11)) resto = 0;
    if (resto != parseInt(strCPF.substring(10, 11) ) ) return false;
    return true;
}

// 4. Captura de GPS via Navegador
function capturarLocalizacao() {
    const inputGps = document.getElementById('gps-cliente');
    inputGps.value = "Buscando satélite...";
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                inputGps.value = `${position.coords.latitude}, ${position.coords.longitude}`;
                inputGps.classList.remove('input-invalido');
                inputGps.classList.add('input-valido');
            },
            (error) => {
                alert("Erro ao buscar GPS. Verifique se o GPS do celular está ligado ou as permissões do navegador.");
                inputGps.value = "";
                inputGps.classList.add('input-invalido');
            },
            { enableHighAccuracy: true } // Força a buscar a precisão máxima
        );
    } else {
        alert("Seu dispositivo não suporta Geolocalização.");
        inputGps.value = "";
    }
}
