import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, off, remove, update, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// =========================================================================
// 1. CONFIGURAÇÃO DO FIREBASE
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
const auth = getAuth(app); 

// VARIÁVEIS GLOBAIS
window.clienteIdEditando = null;
let clienteAtualHistorico = null;
let clienteParaImprimir = null;
let dadosClientes = {};
let dadosHistorico = {};
let chavePixGlobal = "Não configurada";
let whatsappDonoGlobal = "";
let mostrandoAtrasados = localStorage.getItem('filtroAtrasado_MatutoNet') === 'true';
const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// MÁSCARAS DOS CAMPOS
const campoTel = document.getElementById('telCliente');
if(campoTel) {
    campoTel.addEventListener('input', e => { 
        let v = e.target.value.replace(/\D/g, "").slice(0, 11); 
        if (v.length > 2) v = v.replace(/^(\d{2})(\d)/g, "($1) $2"); 
        if (v.length > 7) v = v.replace(/(\d{1})(\d{4})(\d{4})$/, "$1 $2-$3"); 
        e.target.value = v; 
    });
}

const campoCpf = document.getElementById('cpfCliente');
if(campoCpf) {
    campoCpf.addEventListener('input', e => { 
        let v = e.target.value.replace(/\D/g, "").slice(0, 11); 
        if (v.length > 3) v = v.replace(/^(\d{3})(\d)/, "$1.$2"); 
        if (v.length > 6) v = v.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3"); 
        if (v.length > 9) v = v.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4"); 
        e.target.value = v; 
    });
}

// RASCUNHOS DOS FORMULÁRIOS
const camposTexto = ['buscaCliente', 'nomeCliente', 'cpfCliente', 'telCliente', 'bairroCliente', 'cidadeCliente', 'refCliente', 'locCliente', 'vencimentoCliente', 'planoCliente'];
camposTexto.forEach(id => { 
    const campo = document.getElementById(id); 
    if (campo) { 
        const salvo = localStorage.getItem('rascunho_' + id); 
        if (salvo !== null) campo.value = salvo; 
        campo.addEventListener('input', () => { localStorage.setItem('rascunho_' + id, campo.value); }); 
    } 
});

window.limparRascunhoFormulario = function() { 
    camposTexto.forEach(id => { 
        if (id !== 'buscaCliente') { 
            localStorage.removeItem('rascunho_' + id); 
            const c = document.getElementById(id); 
            if (c) c.value = ''; 
        } 
    }); 
    localStorage.removeItem('modalAberto_MatutoNet'); 
};

// =========================================================================
// 2. SISTEMA DE LOGIN E AUTENTICAÇÃO
// =========================================================================
onAuthStateChanged(auth, (user) => { 
    if (user) { 
        document.getElementById('telaLogin').style.display = 'none'; 
        document.getElementById('sistemaApp').style.display = 'block'; 
        iniciarBancoDeDados(user.uid); 
    } else { 
        document.getElementById('telaLogin').style.display = 'flex'; 
        document.getElementById('sistemaApp').style.display = 'none'; 
        trancarPortasDoBanco(); 
    } 
});

const formLogin = document.getElementById('formLogin');
if(formLogin) {
    formLogin.addEventListener('submit', (e) => { 
        e.preventDefault(); 
        const email = document.getElementById('emailLogin').value; 
        const senha = document.getElementById('senhaLogin').value; 
        Swal.fire({ title: 'Autenticando...', didOpen: () => Swal.showLoading() }); 
        signInWithEmailAndPassword(auth, email, senha)
            .then(() => { Swal.close(); })
            .catch((error) => { Swal.fire('Acesso Negado!', 'E-mail ou senha incorretos.', 'error'); }); 
    });
}

window.sairDoSistema = function() { 
    signOut(auth).then(() => { Swal.fire('Desconectado', 'Você saiu do sistema de forma segura.', 'success'); }); 
};

window.recuperarSenha = async function() {
    const { value: email } = await Swal.fire({ 
        title: 'Recuperar Senha', input: 'email', inputPlaceholder: 'exemplo@email.com', 
        showCancelButton: true, confirmButtonColor: '#1e3a8a', confirmButtonText: 'Enviar Link', cancelButtonText: 'Cancelar' 
    });
    if (email) {
        Swal.fire({ title: 'Enviando...', didOpen: () => Swal.showLoading() });
        sendPasswordResetEmail(auth, email)
            .then(() => { Swal.fire('Sucesso!', 'Link enviado! Verifique também a caixa de spam.', 'success'); })
            .catch((error) => { Swal.fire('Erro', 'Não foi possível enviar. E-mail não encontrado.', 'error'); });
    }
};

// =========================================================================
// 3. INICIALIZAÇÃO DO BANCO DE DADOS E ROBÔ
// =========================================================================
window.solicitarQrCode = function() {
    if (!auth.currentUser) return;
    Swal.fire({ title: 'Solicitando...', text: 'O robô está acordando e gerando seu código.', icon: 'info', timer: 2000, showConfirmButton: false });
    update(ref(db, `config/${auth.currentUser.uid}`), { statusRobo: 'iniciar', qrCode: null });
};

let refClientes, refHistorico, refConfig;

function iniciarBancoDeDados(uid) {
    refClientes = ref(db, `clientes/${uid}`); 
    refHistorico = ref(db, `historico/${uid}`); 
    refConfig = ref(db, `config/${uid}`);
    
    onValue(refClientes, snap => { dadosClientes = snap.val() || {}; window.renderizarClientes(); window.atualizarMiniDashboard(); });
    onValue(refHistorico, snap => { dadosHistorico = snap.val() || {}; window.renderizarClientes(); window.atualizarMiniDashboard(); });
    
    onValue(refConfig, snap => { 
        const config = snap.val() || {}; 
        chavePixGlobal = config.chavePix || ""; 
        whatsappDonoGlobal = config.whatsappDono || ""; 
        
        document.getElementById('chavePixConfig').value = chavePixGlobal; 
        document.getElementById('whatsappDonoConfig').value = whatsappDonoGlobal; 
        document.getElementById('diasLembrete').value = config.diasLembrete || 5; 
        document.getElementById('horaLembrete').value = config.horaLembrete || "08:00"; 
        document.getElementById('repetirLembrete').checked = config.repetirLembrete === true || config.repetirLembrete === "true"; 
        document.getElementById('horaCobranca').value = config.horaCobranca || "09:00"; 
        document.getElementById('repetirCobranca').checked = config.repetirCobranca === true || config.repetirCobranca === "true";

        const statusEl = document.getElementById('statusConexaoRobo'); 
        const imgQr = document.getElementById('imgQrCode'); 
        const dicaQr = document.getElementById('dicaQrCode');

        if (config.statusRobo === 'conectado') {
            statusEl.innerHTML = '✅ Robô Conectado e Pronto!'; 
            statusEl.style.color = '#10b981'; imgQr.style.display = 'none'; dicaQr.style.display = 'none';
        } else if (config.qrCode) {
            statusEl.innerHTML = '📱 Escaneie o QR Code abaixo:'; 
            statusEl.style.color = '#1e3a8a'; 
            imgQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(config.qrCode)}`; 
            imgQr.style.display = 'block'; dicaQr.style.display = 'block';
        } else if (config.statusRobo === 'iniciar') {
            statusEl.innerHTML = '⚙️ O servidor está preparando o QR Code...'; 
            statusEl.style.color = '#f59e0b'; imgQr.style.display = 'none'; dicaQr.style.display = 'none';
        } else {
            statusEl.innerHTML = '❌ Desconectado (Clique no botão para ligar)'; 
            statusEl.style.color = '#ef4444'; imgQr.style.display = 'none'; dicaQr.style.display = 'none';
        }
    });
}

function trancarPortasDoBanco() { 
    dadosClientes = {}; 
    dadosHistorico = {}; 
    if(refClientes) off(refClientes); 
    if(refHistorico) off(refHistorico); 
    if(refConfig) off(refConfig); 
}

// =========================================================================
// 4. CONFIGURAÇÕES E BACKUP
// =========================================================================
window.salvarConfiguracoes = function(e) { 
    e.preventDefault(); 
    if (!auth.currentUser) return; 
    
    update(refConfig, { 
        chavePix: document.getElementById('chavePixConfig').value.trim(), 
        whatsappDono: document.getElementById('whatsappDonoConfig').value.replace(/\D/g, ''), 
        diasLembrete: parseInt(document.getElementById('diasLembrete').value) || 5, 
        horaLembrete: document.getElementById('horaLembrete').value || "08:00", 
        repetirLembrete: document.getElementById('repetirLembrete').checked, 
        horaCobranca: document.getElementById('horaCobranca').value || "09:00", 
        repetirCobranca: document.getElementById('repetirCobranca').checked 
    }).then(() => { 
        Swal.fire('OK!', 'Configurações salvas com sucesso!', 'success'); 
        window.fecharModalConfig(); 
    }).catch(err => { 
        Swal.fire('Erro', 'Sem permissão para salvar.', 'error'); 
    }); 
};

window.fazerBackupManual = function() { 
    Swal.fire({ title: 'Baixar Backup?', text: "Isso vai salvar uma cópia segura.", icon: 'info', showCancelButton: true, confirmButtonColor: '#8b5cf6', confirmButtonText: 'Sim, baixar' }).then((result) => { 
        if (result.isConfirmed) { 
            const backupData = { clientes: dadosClientes, historico: dadosHistorico }; 
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" }); 
            const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; 
            const dataHoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-'); 
            a.download = `Backup_MatutoNet_${dataHoje}.json`; 
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); 
            Swal.fire('Salvo!', 'O arquivo foi baixado com sucesso.', 'success'); 
        } 
    }); 
};

window.restaurarBackup = function(event) { 
    const file = event.target.files[0]; if (!file) return; 
    const reader = new FileReader(); 
    reader.onload = function(e) { 
        try { 
            const dados = JSON.parse(e.target.result); 
            if (dados.clientes || dados.historico) { 
                Swal.fire({ title: 'Restaurar Banco?', text: "Vai apagar dados atuais e substituir.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sim, restaurar!' }).then((result) => { 
                    if (result.isConfirmed) { 
                        Swal.fire({ title: 'Restaurando...', didOpen: () => Swal.showLoading() }); 
                        const updates = {}; 
                        if (dados.clientes) updates[`clientes/${auth.currentUser.uid}`] = dados.clientes; 
                        if (dados.historico) updates[`historico/${auth.currentUser.uid}`] = dados.historico; 
                        update(ref(db), updates).then(() => { Swal.fire('Restaurado!', 'Seus dados voltaram.', 'success'); document.getElementById('arquivoBackup').value = ''; }); 
                    } else { document.getElementById('arquivoBackup').value = ''; } 
                }); 
            } else { Swal.fire('Erro', 'Arquivo inválido.', 'error'); } 
        } catch (err) { Swal.fire('Erro', 'Falha ao ler JSON.', 'error'); } 
    }; 
    reader.readAsText(file); 
};

// =========================================================================
// 5. PAINEL DE CLIENTES E RENDIMENTOS
// =========================================================================
window.atualizarMiniDashboard = function() { 
    const hj = new Date(); const m = hj.getMonth() + 1; const a = hj.getFullYear(); let prev = 0, rec = 0; 
    Object.keys(dadosClientes).forEach(id => { 
        const vPlano = parseFloat(dadosClientes[id].plano) || 0; prev += vPlano; 
        if (dadosHistorico[id]?.[a]?.[m] === 'pago') rec += vPlano; 
    }); 
    document.getElementById('resumoPrevisao').innerText = `R$ ${prev.toFixed(2)}`; 
    document.getElementById('resumoRecebido').innerText = `R$ ${rec.toFixed(2)}`; 
    document.getElementById('resumoAberto').innerText = `R$ ${(prev - rec > 0 ? prev - rec : 0).toFixed(2)}`; 
};

const formNovoCliente = document.getElementById('formNovoCliente');
if(formNovoCliente) {
    formNovoCliente.addEventListener('submit', function(e) { 
        e.preventDefault(); 
        const hoje = new Date(); 
        const cData = { 
            nome: document.getElementById('nomeCliente').value.trim(), 
            cpf: document.getElementById('cpfCliente').value, 
            telefone: document.getElementById('telCliente').value, 
            bairro: document.getElementById('bairroCliente').value, 
            cidade: document.getElementById('cidadeCliente').value, 
            referencia: document.getElementById('refCliente').value || "", 
            localizacao: document.getElementById('locCliente').value || "", 
            vencimento: document.getElementById('vencimentoCliente').value, 
            plano: parseFloat(document.getElementById('planoCliente').value) || 0, 
            mesCadastro: hoje.getMonth() + 1, anoCadastro: hoje.getFullYear() 
        }; 
        const acao = window.clienteIdEditando ? update(ref(db, `clientes/${auth.currentUser.uid}/${window.clienteIdEditando}`), cData) : push(refClientes, cData); 
        acao.then(() => { Swal.fire('Sucesso!', 'Salvo com sucesso.', 'success'); window.fecharModalCliente(); window.limparRascunhoFormulario(); }); 
    });
}

window.filtrarAtrasados = function() { 
    mostrandoAtrasados = !mostrandoAtrasados; 
    localStorage.setItem('filtroAtrasado_MatutoNet', mostrandoAtrasados); 
    const btn = document.getElementById('btnFiltroAtrasados'); 
    if(mostrandoAtrasados) { btn.innerHTML = '<i class="fas fa-users"></i> Ver Todos'; btn.style.background = '#f59e0b'; } 
    else { btn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ver Atrasados'; btn.style.background = '#ef4444'; } 
    window.renderizarClientes(); 
};

window.renderizarClientes = function() { 
    const lista = document.getElementById('listaClientes'); lista.innerHTML = ""; 
    const tBusca = (document.getElementById('buscaCliente')?.value || "").toLowerCase().trim(); 
    
    const hoje = new Date(); 
    hoje.setHours(0,0,0,0); 
    const anoAtual = hoje.getFullYear(); 
    const mesAtual = hoje.getMonth() + 1; 
    
    const btnFiltro = document.getElementById('btnFiltroAtrasados'); 
    if(btnFiltro) { 
        if(mostrandoAtrasados) { btnFiltro.innerHTML = '<i class="fas fa-users"></i> Ver Todos'; btnFiltro.style.background = '#f59e0b'; } 
        else { btnFiltro.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ver Atrasados'; btnFiltro.style.background = '#ef4444'; } 
    } 
    
    Object.keys(dadosClientes).forEach(id => { 
        const d = dadosClientes[id]; 
        let atrasado = false; 
        let v = parseInt(d.vencimento); 
        
        let statusAtual = dadosHistorico[id]?.[anoAtual]?.[mesAtual] || 'pendente'; 
        
        // MATEMÁTICA CORRIGIDA E INFALÍVEL
        let dataVenc = new Date(anoAtual, mesAtual - 1, v);
        // Se a pessoa contratou depois do dia 20 para vencer antes do dia 10, empurra pro próximo mês
        if (hoje.getDate() > 20 && v < 10) { dataVenc.setMonth(dataVenc.getMonth() + 1); }
        dataVenc.setHours(0,0,0,0);
        
        let diffDias = Math.round((dataVenc - hoje) / (1000 * 60 * 60 * 24));
        
        if (statusAtual !== 'pago' && diffDias < 0) {
            atrasado = true; // Se a diferença é menor que zero, o dia já passou
        } 
        
        if(dadosHistorico[id]) {
            Object.values(dadosHistorico[id]).forEach(anoObj => { if(Object.values(anoObj).includes('atrasado')) atrasado = true; }); 
        }

        if(mostrandoAtrasados && !atrasado) return; 
        if(tBusca && !d.nome.toLowerCase().includes(tBusca) && !(d.cpf || "").includes(tBusca)) return; 
        
        const w = (d.telefone || "").replace(/\D/g, ''); 
        const bdg = atrasado ? '<span style="background:#ef4444; color:white; padding:4px 8px; border-radius:12px; font-size:11px; font-weight:bold;">⚠️ ATRASADO</span>' : '<span style="color: #10b981; font-weight: bold; font-size: 13px;">✅ EM DIA</span>'; 
        
        lista.innerHTML += ` 
            <div class="card-cliente" style="background:white; padding:20px; border-radius:10px; box-shadow:0 4px 8px rgba(0,0,0,0.08); border-left:6px solid ${atrasado ? '#ef4444' : '#3b82f6'}; margin-bottom:15px;"> 
                <div style="display:flex; justify-content:space-between; align-items:center;"><h3 style="margin:0; font-size:16px; color:#1e3a8a;">${d.nome}</h3> ${bdg}</div> 
                <div style="display:flex; gap:10px; margin-top:15px;"> 
                    <a href="https://wa.me/55${w}" target="_blank" style="flex:1; background:#25D366; color:white; text-align:center; padding:10px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:14px;"><i class="fab fa-whatsapp"></i> Zap</a> 
                    <button onclick="window.toggleDetalhes('${id}')" style="flex:1; background:#f3f4f6; color:#374151; border:1px solid #d1d5db; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;"><i class="fas fa-id-card"></i> Dados</button> 
                </div> 
                <div id="detalhes-${id}" style="display:none; background:#f8fafc; padding:15px; margin-top:15px; border-radius:8px; border:1px solid #e2e8f0; font-size:14px;"> 
                    <p><strong>Venc.:</strong> Dia ${d.vencimento} | <strong>Plano:</strong> R$ ${parseFloat(d.plano).toFixed(2)}</p> 
                    <p><strong>Endereço:</strong> ${d.bairro}, ${d.cidade}</p> 
                    <div style="display:flex; gap:10px; margin-top: 15px;"> 
                        <button onclick="window.abrirModalHistorico('${id}')" style="flex: 1; background: #1e3a8a; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;"><i class="fas fa-calendar-alt"></i> Controle</button> 
                        <button onclick="window.abrirModalImpressao('${id}')" style="flex: 1; background: #8b5cf6; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;"><i class="fas fa-print"></i> Carnê / Foto</button> 
                    </div> 
                    <div style="margin-top:15px; display:flex; gap:10px;"> 
                        <button onclick="window.editarCliente('${id}')" style="flex:1; background:#f59e0b; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;"><i class="fas fa-pen"></i> Editar</button> 
                        <button onclick="window.excluirRegistro('${id}')" style="flex:1; background:#ef4444; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;"><i class="fas fa-trash"></i> Apagar</button> 
                    </div> 
                </div> 
            </div>`; 
    }); 
};

window.toggleDetalhes = id => { const e = document.getElementById(`detalhes-${id}`); e.style.display = e.style.display === "block" ? "none" : "block"; };

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

window.excluirRegistro = (id) => { 
    Swal.fire({ title: 'Apagar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sim' }).then(r => { 
        if(r.isConfirmed) { 
            remove(ref(db, `clientes/${auth.currentUser.uid}/${id}`)); 
            remove(ref(db, `historico/${auth.currentUser.uid}/${id}`)); 
            Swal.fire('Removido'); 
        } 
    }); 
};

// =========================================================================
// 6. GERAÇÃO DE PIX E COMPARTILHAMENTO
// =========================================================================
function calcularCRC16(payload) { let crc = 0xFFFF; for (let i = 0; i < payload.length; i++) { crc ^= (payload.charCodeAt(i) << 8); for (let j = 0; j < 8; j++) { if ((crc & 0x8000) > 0) crc = (crc << 1) ^ 0x1021; else crc = crc << 1; } } return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'); }
function gerarPayloadPix(chave, valorPlano) { let c = chave.trim(); if (c.startsWith('000201')) return c; if (c.includes('(') || c.includes('-') || c.includes(' ')) { let limpo = c.replace(/\D/g, ''); if (limpo.length === 11) c = "+55" + limpo; else c = limpo; } let payload = "0002010014br.gov.bcb.pix"; let chaveStr = `01${c.length.toString().padStart(2, '0')}${c}`; payload += `26${(22 + chaveStr.length).toString().padStart(2, '0')}0014br.gov.bcb.pix${chaveStr}520400005303986`; if (valorPlano && parseFloat(valorPlano) > 0) { let v = parseFloat(valorPlano).toFixed(2); payload += `54${v.length.toString().padStart(2, '0')}${v}`; } payload += `5802BR5909MATUTONET6007SURUBIM62070503***6304`; return payload + calcularCRC16(payload); }

window.abrirModalImpressao = function(id) { 
    clienteParaImprimir = id; 
    document.getElementById('modalImprimir').style.display = 'block'; 
    document.getElementById('printAno').value = new Date().getFullYear(); 
};

function criarHTMLFatura(d, m, a) { 
    const dataVenc = `${String(d.vencimento).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`; 
    const payloadValido = gerarPayloadPix(chavePixGlobal, d.plano); 
    const urlQRCode = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(payloadValido)}`; 
    return `<div class="fatura-print" style="border: 1px solid #000; border-radius: 8px; padding: 15px; font-family: Arial; color: #333; display: flex; flex-direction: column; justify-content: space-between; margin-bottom: 20px; page-break-inside: avoid;"><div style="display: flex; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 5px; margin-bottom: 10px;"><h1 style="color: #1e3a8a; margin: 0; font-size: 18px;">📡 MatutoNet</h1><h2 style="margin: 0; color: #555; font-size: 14px;">FATURA PIX</h2></div><div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 12px;"><div><strong>SACADO:</strong> ${d.nome.toUpperCase()}<br>CPF: ${d.cpf} | End: ${d.bairro}, ${d.cidade}</div><div style="text-align: right;"><strong>VENCIMENTO:</strong><br><span style="font-size: 16px; color: #ef4444; font-weight: bold;">${dataVenc}</span></div></div><table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12px;"><tr style="background: #1e3a8a; color: white;"><th style="padding: 5px; text-align: left;">Descrição do Serviço</th><th style="padding: 5px; text-align: right;">Valor</th></tr><tr><td style="padding: 5px; border-bottom: 1px solid #ccc;">Mensalidade Internet - Ref: ${mesesNomes[m-1]}/${a}</td><td style="padding: 5px; border-bottom: 1px solid #ccc; text-align: right; font-weight: bold; font-size: 14px;">R$ ${parseFloat(d.plano).toFixed(2)}</td></tr></table><div style="display: flex; align-items: center; justify-content: space-between; border: 1px dashed #10b981; padding: 10px; border-radius: 8px; background: #f8fafc;"><div style="flex: 1; word-break: break-all; padding-right: 15px;"><p style="margin: 0; font-size: 14px; color: #10b981; font-weight: bold;">PAGUE VIA PIX</p><p style="font-size: 11px; margin: 5px 0;"><strong>Código Copia e Cola:</strong><br> ${payloadValido}</p></div><div><img crossorigin="anonymous" src="${urlQRCode}" alt="QR Code PIX" style="width: 70px; height: 70px; border-radius: 5px; border: 2px solid #10b981; padding: 2px; background: white;"></div></div></div>`; 
}

// CORRIGIDO: BOTÃO IMPRIMIR
window.gerarEImprimirFaturas = function() { 
    const d = dadosClientes[clienteParaImprimir]; 
    const mEscolha = parseInt(document.getElementById('printMes').value); 
    const a = document.getElementById('printAno').value; 
    
    // Criar uma div temporária para a impressão
    const area = document.createElement('div');
    area.id = 'areaImpressaoTemp';
    document.body.appendChild(area);
    
    const meses = mEscolha === 0 ? [1,2,3,4,5,6,7,8,9,10,11,12] : [mEscolha]; 
    meses.forEach(m => area.innerHTML += criarHTMLFatura(d, m, a)); 
    
    // Esconde o sistema e mostra só a fatura
    document.getElementById('sistemaApp').style.display = 'none';
    
    window.print();
    
    // Volta ao normal depois que a janela de print fecha
    setTimeout(() => { 
        document.getElementById('sistemaApp').style.display = 'block';
        document.body.removeChild(area);
        window.fecharModalImprimir(); 
    }, 500); 
};

// CORRIGIDO: BOTÃO COMPARTILHAR
window.compartilharFatura = function() { 
    const d = dadosClientes[clienteParaImprimir]; 
    const mEscolha = parseInt(document.getElementById('printMes').value); 
    const a = document.getElementById('printAno').value; 
    
    // Criar um molde invisível para tirar o print
    const molde = document.createElement('div');
    molde.style.position = 'absolute';
    molde.style.left = '-9999px';
    molde.style.width = '650px';
    document.body.appendChild(molde);
    
    const meses = mEscolha === 0 ? [1,2,3,4,5,6,7,8,9,10,11,12] : [mEscolha]; 
    meses.forEach(m => molde.innerHTML += criarHTMLFatura(d, m, a)); 
    
    const textoMensagem = `Olá *${d.nome.split(' ')[0]}*, tudo bem?\nSua fatura da *MatutoNet* já está disponível!\n\nValor: *R$ ${parseFloat(d.plano).toFixed(2)}*\n\nPara facilitar, vou enviar o código *PIX Copia e Cola* logo abaixo na próxima mensagem.`; 
    const payloadValido = gerarPayloadPix(chavePixGlobal, d.plano); 
    
    Swal.fire({ title: 'Gerando Imagem...', didOpen: () => Swal.showLoading() }); 
    
    html2canvas(molde, { scale: 1.5, useCORS: true, logging: false }).then(canvas => { 
        document.body.removeChild(molde); // Limpa o molde invisível
        
        canvas.toBlob(async function(blob) { 
            const file = new File([blob], `Fatura_${d.nome.replace(/\s+/g, '_')}.png`, { type: 'image/png' }); 
            if (navigator.share) { 
                try { 
                    await navigator.share({ title: 'Fatura MatutoNet', text: textoMensagem, files: [file] }); 
                    window.fecharModalImprimir(); 
                    Swal.fire({ title: 'Foto Compartilhada!', html: `Deseja copiar também o código PIX solto para colar?<br><br><textarea id="codigoPixUnico" style="width: 100%; height: 80px; padding: 10px; border-radius: 6px; border: 1px solid #ccc; font-size: 12px; margin-bottom: 10px;" readonly>${payloadValido}</textarea>`, showConfirmButton: true, confirmButtonText: 'Copiar PIX', confirmButtonColor: '#10b981' }).then((res) => { if(res.isConfirmed) { document.getElementById("codigoPixUnico").select(); document.execCommand("copy"); Swal.fire({title: 'Copiado!', text: 'Cole no Zap!', icon: 'success', timer: 2000, showConfirmButton: false}); } }); 
                } catch (err) { mostrarFallback(canvas.toDataURL('image/png'), textoMensagem, payloadValido); } 
            } else { mostrarFallback(canvas.toDataURL('image/png'), textoMensagem, payloadValido); } 
        }, 'image/png'); 
    }); 
};

function mostrarFallback(imgData, texto, pix) { window.fecharModalImprimir(); Swal.fire({ title: 'Fatura Pronta!', html: `<p style="font-size: 13px; margin-bottom: 5px;">1️⃣ Segure a imagem para <b>Salvar</b> ou <b>Copiar</b>.</p><div style="max-height:200px; overflow-y:auto; border:1px solid #ccc; border-radius:8px; margin-bottom: 15px;"><img src="${imgData}" style="width: 100%;"></div><p style="font-size: 13px; text-align: left; margin-bottom: 5px;">2️⃣ <b>Mensagem ao cliente:</b></p><textarea id="textoMsg" style="width: 100%; height: 60px; padding: 5px; border-radius: 6px; border: 1px solid #ccc; font-size: 12px; margin-bottom: 5px;" readonly>${texto}</textarea><button onclick="window.copiarTextoZap('textoMsg')" style="background: #3b82f6; color: white; padding: 8px; border: none; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold; margin-bottom: 15px;">Copiar Mensagem</button><p style="font-size: 13px; text-align: left; margin-bottom: 5px;">3️⃣ <b>Código PIX (Para mandar sozinho):</b></p><textarea id="textoPix" style="width: 100%; height: 60px; padding: 5px; border-radius: 6px; border: 1px solid #ccc; font-size: 12px; margin-bottom: 5px;" readonly>${pix}</textarea><button onclick="window.copiarTextoZap('textoPix')" style="background: #10b981; color: white; padding: 8px; border: none; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold;">Copiar SÓ O PIX</button>`, showConfirmButton: true, confirmButtonText: 'Fechar e Voltar' }); }

window.copiarTextoZap = function(idCampo) { document.getElementById(idCampo).select(); document.execCommand("copy"); Swal.fire({ title: 'Copiado!', text: 'Vá no WhatsApp e cole na conversa.', icon: 'success', timer: 2000, showConfirmButton: false }); }

// =========================================================================
// 7. O CÉREBRO DO HISTÓRICO
// =========================================================================
window.abrirModalHistorico = function(id) { 
    clienteAtualHistorico = id; 
    document.getElementById('nomeClienteHistorico').innerText = dadosClientes[id].nome; 
    document.getElementById('modalHistorico').style.display = 'block'; 
    document.getElementById('filtroAno').value = new Date().getFullYear(); 
    window.carregarMesesHistorico(); 
};

window.carregarMesesHistorico = function() { 
    const anoFiltro = parseInt(document.getElementById('filtroAno').value); 
    const g = document.getElementById('gridMeses'); g.innerHTML = ''; 
    const cliente = dadosClientes[clienteAtualHistorico]; 
    const dH = dadosHistorico[clienteAtualHistorico]?.[anoFiltro] || {}; 
    const mesCad = cliente.mesCadastro || 1; const anoCad = cliente.anoCadastro || 2024; const vDia = parseInt(cliente.vencimento); 
    const hoje = new Date(); const diaHoje = hoje.getDate(); const mesHoje = hoje.getMonth() + 1; const anoHoje = hoje.getFullYear(); 
    
    mesesNomes.forEach((nM, i) => { 
        const n = i + 1; 
        if (anoFiltro < anoCad || (anoFiltro === anoCad && n < mesCad)) { g.innerHTML += `<div style="visibility: hidden;"></div>`; return; } 
        let st = dH[n] || 'pendente'; 
        if (st !== 'pago') { if (anoHoje > anoFiltro) st = 'atrasado'; else if (anoHoje === anoFiltro && mesHoje > n) st = 'atrasado'; else if (anoHoje === anoFiltro && mesHoje === n && diaHoje > vDia) st = 'atrasado'; } 
        let cor = st==='pago'?'status-pago':st==='atrasado'?'status-atrasado':'status-pendente'; 
        let ico = st==='pago'?'✅':st==='atrasado'?'❌':'⏳'; 
        g.innerHTML += `<button class="btn-mes ${cor}" onclick="window.abrirPainelStatus(${n}, '${st}', '${nM}')" style="padding: 15px 5px; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold; width: 100%; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 14px;">${nM}<br><span style="font-size: 11px; display: block; margin-top: 5px;">${ico} ${st.toUpperCase()}</span></button>`; 
    }); 
};

window.abrirPainelStatus = function(m, stAtual, nomeMes) { 
    Swal.fire({ 
        title: `Mês de ${nomeMes}`, 
        html: `<p style="margin-bottom: 15px; color: #555;">Selecione o novo status abaixo:</p><div style="display: flex; flex-direction: column; gap: 10px;"><button onclick="window.salvarStatusMes(${m}, 'pago', '${stAtual}')" style="padding: 15px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer;">✅ Marcar como PAGO</button><button onclick="window.salvarStatusMes(${m}, 'pendente', '${stAtual}')" style="padding: 15px; background: #f59e0b; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer;">⏳ Marcar como PENDENTE</button><button onclick="window.salvarStatusMes(${m}, 'atrasado', '${stAtual}')" style="padding: 15px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer;">❌ Marcar como ATRASADO</button></div>`, 
        showConfirmButton: false, showCancelButton: true, cancelButtonText: 'Cancelar', cancelButtonColor: '#9ca3af' 
    }); 
};

window.salvarStatusMes = function(m, novoStatus, stAtual) { 
    Swal.close(); 
    if (novoStatus !== stAtual) { 
        update(ref(db, `historico/${auth.currentUser.uid}/${clienteAtualHistorico}/${document.getElementById('filtroAno').value}`), { [m]: novoStatus }).then(() => { 
            Swal.fire({ title: 'Atualizado!', icon: 'success', timer: 1500, showConfirmButton: false }); window.carregarMesesHistorico(); 
        }); 
    } 
};
