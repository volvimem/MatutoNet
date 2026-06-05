import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, off, remove, update, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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

window.clienteIdEditando = null;
let clienteAtualHistorico = null;
let clienteParaImprimir = null;
let dadosClientes = {};
let dadosHistorico = {};
let chavePixGlobal = "Não configurada";
let nomeTitularPixGlobal = "Não configurado"; // Variável nova pro Nome do Titular
let whatsappDonoGlobal = "";
let mostrandoAtrasados = localStorage.getItem('filtroAtrasado_MatutoNet') === 'true';
const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function extrairDataVencimento(cliente) {
    if (!cliente) return new Date();
    let v = String(cliente.vencimento || 1);
    if (v.includes('-')) {
        return new Date(v + "T00:00:00");
    } else {
        let dia = parseInt(v) || 1;
        let mes = cliente.mesCadastro || 1;
        let ano = cliente.anoCadastro || new Date().getFullYear();
        return new Date(ano, mes - 1, dia);
    }
}

// === MOTOR INTELIGENTE ===
window.sincronizarStatusAutomatico = function() {
    if (!auth.currentUser || !dadosClientes || !dadosHistorico) return;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    Object.keys(dadosClientes).forEach(id => {
        const d = dadosClientes[id];
        let dataPrimeiroVenc = extrairDataVencimento(d);
        dataPrimeiroVenc.setHours(0, 0, 0, 0);
        
        // Ignora se o primeiro vencimento ainda nem chegou
        if (hoje < dataPrimeiroVenc) return; 

        let vDia = dataPrimeiroVenc.getDate();
        let dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), vDia);
        
        if (hoje.getDate() > 20 && vDia < 15) { 
            dataVenc.setMonth(dataVenc.getMonth() + 1); 
        } 
        dataVenc.setHours(0, 0, 0, 0);

        let mesAlvo = dataVenc.getMonth() + 1;
        let anoAlvo = dataVenc.getFullYear();
        let stBd = dadosHistorico[id]?.[anoAlvo]?.[mesAlvo] || 'pendente';

        if (hoje > dataVenc && stBd === 'pendente') {
            update(ref(db, `historico/${auth.currentUser.uid}/${id}/${anoAlvo}`), { [mesAlvo]: 'atrasado' });
        }
    });
};

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

const camposTexto = ['buscaCliente', 'nomeCliente', 'cpfCliente', 'telCliente', 'bairroCliente', 'cidadeCliente', 'refCliente', 'locCliente', 'vencimentoCliente', 'planoCliente', 'pausaCliente'];
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
        signInWithEmailAndPassword(auth, email, senha).then(() => { Swal.close(); }).catch(() => { Swal.fire('Acesso Negado!', 'E-mail ou senha incorretos.', 'error'); }); 
    }); 
}

window.sairDoSistema = function() { signOut(auth).then(() => { Swal.fire('Desconectado', 'Você saiu.', 'success'); }); };

window.recuperarSenha = async function() { 
    const { value: email } = await Swal.fire({ title: 'Recuperar Senha', input: 'email', inputPlaceholder: 'exemplo@email.com', showCancelButton: true, confirmButtonColor: '#1e3a8a', confirmButtonText: 'Enviar Link', cancelButtonText: 'Cancelar' }); 
    if (email) { 
        Swal.fire({ title: 'Enviando...', didOpen: () => Swal.showLoading() }); 
        sendPasswordResetEmail(auth, email).then(() => { Swal.fire('Sucesso!', 'Link enviado!', 'success'); }).catch(() => { Swal.fire('Erro', 'Não foi possível enviar.', 'error'); }); 
    } 
};

window.solicitarQrCode = function() { 
    if (!auth.currentUser) return; 
    Swal.fire({ title: 'Solicitando...', text: 'O robô está acordando...', icon: 'info', timer: 2000, showConfirmButton: false }); 
    update(ref(db, `config/${auth.currentUser.uid}`), { statusRobo: 'iniciar', qrCode: null }); 
};

let refClientes, refHistorico, refConfig;

function iniciarBancoDeDados(uid) {
    try {
        refClientes = ref(db, `clientes/${uid}`); 
        refHistorico = ref(db, `historico/${uid}`); 
        refConfig = ref(db, `config/${uid}`);
        
        onValue(refClientes, snap => { dadosClientes = snap.val() || {}; window.renderizarClientes(); window.atualizarMiniDashboard(); });
        onValue(refHistorico, snap => { 
            dadosHistorico = snap.val() || {}; 
            window.renderizarClientes(); 
            window.atualizarMiniDashboard(); 
            window.sincronizarStatusAutomatico(); 
        });
        
        onValue(refConfig, snap => { 
            const config = snap.val() || {}; 
            chavePixGlobal = config.chavePix || ""; 
            nomeTitularPixGlobal = config.nomeTitularPix || ""; // Puxa o Titular do Firebase
            whatsappDonoGlobal = config.whatsappDono || ""; 
            
            document.getElementById('chavePixConfig').value = chavePixGlobal; 
            
            const campoNomeTitular = document.getElementById('nomeTitularPixConfig');
            if (campoNomeTitular) campoNomeTitular.value = nomeTitularPixGlobal;

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
                statusEl.innerHTML = '✅ Robô Conectado e Pronto!'; statusEl.style.color = '#10b981'; imgQr.style.display = 'none'; dicaQr.style.display = 'none'; 
            } else if (config.qrCode) { 
                statusEl.innerHTML = '📱 Escaneie o QR Code abaixo:'; statusEl.style.color = '#1e3a8a'; imgQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(config.qrCode)}`; imgQr.style.display = 'block'; dicaQr.style.display = 'block'; 
            } else if (config.statusRobo === 'iniciar') { 
                statusEl.innerHTML = '⚙️ O servidor está preparando o QR Code...'; statusEl.style.color = '#f59e0b'; imgQr.style.display = 'none'; dicaQr.style.display = 'none'; 
            } else { 
                statusEl.innerHTML = '❌ Desconectado (Clique no botão para ligar)'; statusEl.style.color = '#ef4444'; imgQr.style.display = 'none'; dicaQr.style.display = 'none'; 
            }
        });
    } catch (e) {
        console.error("Erro no DB:", e);
    }
}

function trancarPortasDoBanco() { 
    dadosClientes = {}; 
    dadosHistorico = {}; 
    if(refClientes) off(refClientes); 
    if(refHistorico) off(refHistorico); 
    if(refConfig) off(refConfig); 
}

window.salvarConfiguracoes = function(e) { 
    e.preventDefault(); 
    if (!auth.currentUser) return; 
    
    const campoNomeTitular = document.getElementById('nomeTitularPixConfig');
    const valorNomeTitular = campoNomeTitular ? campoNomeTitular.value.trim() : "";

    update(refConfig, { 
        chavePix: document.getElementById('chavePixConfig').value.trim(), 
        nomeTitularPix: valorNomeTitular, // Salva o nome do Titular
        whatsappDono: document.getElementById('whatsappDonoConfig').value.replace(/\D/g, ''), 
        diasLembrete: parseInt(document.getElementById('diasLembrete').value) || 5, 
        horaLembrete: document.getElementById('horaLembrete').value || "08:00", 
        repetirLembrete: document.getElementById('repetirLembrete').checked, 
        horaCobranca: document.getElementById('horaCobranca').value || "09:00", 
        repetirCobranca: document.getElementById('repetirCobranca').checked 
    }).then(() => { Swal.fire('OK!', 'Configurações salvas.', 'success'); window.fecharModalConfig(); }); 
};

window.atualizarMiniDashboard = function() { 
    try {
        const hj = new Date(); const m = hj.getMonth() + 1; const a = hj.getFullYear(); let prev = 0, rec = 0; 
        Object.keys(dadosClientes).forEach(id => { 
            const vPlano = parseFloat(dadosClientes[id].plano) || 0; prev += vPlano; 
            if (dadosHistorico[id]?.[a]?.[m] === 'pago') rec += vPlano; 
        }); 
        document.getElementById('resumoPrevisao').innerText = `R$ ${prev.toFixed(2)}`; 
        document.getElementById('resumoRecebido').innerText = `R$ ${rec.toFixed(2)}`; 
        document.getElementById('resumoAberto').innerText = `R$ ${(prev - rec > 0 ? prev - rec : 0).toFixed(2)}`; 
    } catch (e) { console.error("Erro no dash:", e); }
};

const formNovoCliente = document.getElementById('formNovoCliente');
if(formNovoCliente) {
    formNovoCliente.addEventListener('submit', function(e) { 
        e.preventDefault(); 
        try {
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
                pausaCobranca: document.getElementById('pausaCliente').value || "", 
                mesCadastro: hoje.getMonth() + 1, 
                anoCadastro: hoje.getFullYear() 
            }; 
            
            const acao = window.clienteIdEditando ? update(ref(db, `clientes/${auth.currentUser.uid}/${window.clienteIdEditando}`), cData) : push(refClientes, cData); 
            acao.then(() => { 
                Swal.fire('Sucesso!', 'Salvo com sucesso.', 'success'); 
                window.fecharModalCliente(); 
                window.limparRascunhoFormulario(); 
            }).catch(() => { Swal.fire('Erro!', 'Problema de conexão.', 'error'); });
        } catch(error) { Swal.fire('Erro!', 'Preencha todos os campos.', 'error'); }
    });
}

window.editarCliente = id => { 
    const d = dadosClientes[id]; 
    if(!d) return;
    window.clienteIdEditando = id; 
    document.getElementById('nomeCliente').value = d.nome || ""; 
    document.getElementById('cpfCliente').value = d.cpf || ""; 
    document.getElementById('telCliente').value = d.telefone || ""; 
    document.getElementById('bairroCliente').value = d.bairro || ""; 
    document.getElementById('cidadeCliente').value = d.cidade || ""; 
    document.getElementById('refCliente').value = d.referencia || ""; 
    document.getElementById('locCliente').value = d.localizacao || ""; 
    
    let dataFormatada = "";
    if (d.vencimento) {
        if (String(d.vencimento).includes('-')) {
            dataFormatada = d.vencimento;
        } else {
            let dataV = extrairDataVencimento(d);
            if(dataV && !isNaN(dataV)) { dataFormatada = dataV.toISOString().split('T')[0]; }
        }
    }
    document.getElementById('vencimentoCliente').value = dataFormatada;
    document.getElementById('planoCliente').value = d.plano || ""; 
    document.getElementById('pausaCliente').value = d.pausaCobranca || "";
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

window.filtrarAtrasados = function() { 
    mostrandoAtrasados = !mostrandoAtrasados; 
    localStorage.setItem('filtroAtrasado_MatutoNet', mostrandoAtrasados); 
    window.renderizarClientes(); 
};

// === RENDERIZAÇÃO INTELIGENTE ===
window.renderizarClientes = function() { 
    try {
        const lista = document.getElementById('listaClientes'); 
        if(!lista) return;
        lista.innerHTML = ""; 
        const tBusca = (document.getElementById('buscaCliente')?.value || "").toLowerCase().trim(); 
        const hoje = new Date(); 
        hoje.setHours(0,0,0,0); 
        
        const btnFiltro = document.getElementById('btnFiltroAtrasados'); 
        if(btnFiltro) { 
            if(mostrandoAtrasados) { 
                btnFiltro.innerHTML = '<i class="fas fa-users"></i> Ver Todos'; btnFiltro.style.background = '#f59e0b'; 
            } else { 
                btnFiltro.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ver Atrasados'; btnFiltro.style.background = '#ef4444'; 
            } 
        } 
        
        if(!dadosClientes) return;

        Object.keys(dadosClientes).forEach(id => { 
            const d = dadosClientes[id]; 
            if(!d) return;

            let atrasado = false; 
            let dataPrimeiroVenc = extrairDataVencimento(d);
            dataPrimeiroVenc.setHours(0, 0, 0, 0);
            let vDia = dataPrimeiroVenc.getDate();
            
            if (dadosHistorico[id] && typeof dadosHistorico[id] === 'object') {
                Object.keys(dadosHistorico[id]).forEach(ano => {
                    if(dadosHistorico[id][ano]) {
                        Object.keys(dadosHistorico[id][ano]).forEach(mes => {
                            if (dadosHistorico[id][ano][mes] === 'atrasado') { atrasado = true; }
                        }); 
                    }
                }); 
            }

            if(!atrasado && hoje >= dataPrimeiroVenc) {
                let mesAtual = hoje.getMonth() + 1;
                let anoAtual = hoje.getFullYear();
                let dataVencMesAtual = new Date(anoAtual, mesAtual - 1, vDia);

                if (hoje.getDate() > 20 && vDia < 15) {
                    dataVencMesAtual.setMonth(dataVencMesAtual.getMonth() + 1);
                    mesAtual = dataVencMesAtual.getMonth() + 1;
                    anoAtual = dataVencMesAtual.getFullYear();
                }
                dataVencMesAtual.setHours(0,0,0,0);

                let statusAtual = dadosHistorico[id]?.[anoAtual]?.[mesAtual] || 'pendente';
                if (hoje > dataVencMesAtual && statusAtual === 'pendente') {
                    atrasado = true;
                }
            }

            let emPausa = false;
            let dataPausaFormatada = "";
            if (d.pausaCobranca) {
                const dp = new Date(d.pausaCobranca + "T23:59:59");
                if (dp >= hoje) {
                    emPausa = true;
                    dataPausaFormatada = d.pausaCobranca.split('-').reverse().join('/');
                }
            }

            let nCliente = (d.nome || "").toLowerCase();
            let cCliente = (d.cpf || "");
            if(mostrandoAtrasados && !atrasado) return; 
            if(tBusca && !nCliente.includes(tBusca) && !cCliente.includes(tBusca)) return; 
            
            const w = (d.telefone || "").replace(/\D/g, ''); 
            let bdg = '';
            if (emPausa) {
                bdg = `<span style="background:#8b5cf6; color:white; padding:4px 8px; border-radius:12px; font-size:11px; font-weight:bold;">⏸️ PAUSA: ${dataPausaFormatada}</span>`;
            } else {
                bdg = atrasado ? '<span style="background:#ef4444; color:white; padding:4px 8px; border-radius:12px; font-size:11px; font-weight:bold;">⚠️ ATRASADO</span>' : '<span style="color: #10b981; font-weight: bold; font-size: 13px;">✅ EM DIA</span>';
            }

            let nExibicao = d.nome || "Cliente sem Nome";

            lista.innerHTML += ` 
                <div class="card-cliente" style="background:white; padding:20px; border-radius:10px; box-shadow:0 4px 8px rgba(0,0,0,0.08); border-left:6px solid ${emPausa ? '#8b5cf6' : (atrasado ? '#ef4444' : '#3b82f6')}; margin-bottom:15px;"> 
                    <div style="display:flex; justify-content:space-between; align-items:center;"><h3 style="margin:0; font-size:16px; color:#1e3a8a;">${nExibicao}</h3> ${bdg}</div> 
                    <div style="display:flex; gap:10px; margin-top:15px;"> 
                        <a href="https://wa.me/55${w}" target="_blank" style="flex:1; background:#25D366; color:white; text-align:center; padding:10px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:14px;"><i class="fab fa-whatsapp"></i> Zap</a> 
                        <button onclick="window.toggleDetalhes('${id}')" style="flex:1; background:#f3f4f6; color:#374151; border:1px solid #d1d5db; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;"><i class="fas fa-id-card"></i> Dados</button> 
                    </div> 
                    <div id="detalhes-${id}" style="display:none; background:#f8fafc; padding:15px; margin-top:15px; border-radius:8px; border:1px solid #e2e8f0; font-size:14px;"> 
                        <p><strong>Vencimento:</strong> Dia ${vDia} | <strong>Plano:</strong> R$ ${parseFloat(d.plano || 0).toFixed(2)}</p> 
                        <p><strong>Endereço:</strong> ${d.bairro || ""}, ${d.cidade || ""}</p> 
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
    } catch(e) { console.error("Erro renderizando:", e); }
};

window.toggleDetalhes = id => { 
    const e = document.getElementById(`detalhes-${id}`); 
    if(e) e.style.display = e.style.display === "block" ? "none" : "block"; 
};

function calcularCRC16(payload) { 
    let crc = 0xFFFF; 
    for (let i = 0; i < payload.length; i++) { 
        crc ^= (payload.charCodeAt(i) << 8); 
        for (let j = 0; j < 8; j++) { 
            if ((crc & 0x8000) > 0) crc = (crc << 1) ^ 0x1021; else crc = crc << 1; 
        } 
    } 
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'); 
}

// ATUALIZADA: Agora recebe o nome do titular e formata nas regras rígidas do Banco Central
function gerarPayloadPix(chave, valor, titular) { 
    let c = chave.trim();
    if (c.startsWith('000201')) return c; 
    if (!c.includes('@') && !(c.length === 36 && c.includes('-'))) {
        let numeros = c.replace(/\D/g, '');
        if (numeros.length === 11) { c = (c.includes('(') || c.includes('-') || c.includes(' ')) ? "+55" + numeros : numeros; }
        else if (numeros.length === 14) { c = numeros; }
        else if (numeros.length > 11 && numeros.startsWith('55')) { c = "+" + numeros; }
        else { c = numeros; }
    }
    let merchantAccountInfo = `0014br.gov.bcb.pix01${c.length.toString().padStart(2, '0')}${c}`;
    let payload = `00020126${merchantAccountInfo.length.toString().padStart(2, '0')}${merchantAccountInfo}520400005303986`;
    if (valor && parseFloat(valor) > 0) {
        let v = parseFloat(valor).toFixed(2);
        payload += `54${v.length.toString().padStart(2, '0')}${v}`;
    }

    // Regra do banco: Nome do favorecido precisa ir sem acentos e com no máximo 25 caracteres.
    let nomeTratado = "MATUTONET";
    if (titular) {
        nomeTratado = titular.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, "").substring(0, 25).trim().toUpperCase() || "MATUTONET";
    }
    let lenNomeTratado = nomeTratado.length.toString().padStart(2, '0');

    // Insere o nome através da Tag 59 do padrão EMV PIX
    payload += `5802BR59${lenNomeTratado}${nomeTratado}6007SURUBIM62070503***6304`;
    return payload + calcularCRC16(payload);
}

window.abrirModalImpressao = function(id) { 
    clienteParaImprimir = id; 
    document.getElementById('modalImprimir').style.display = 'block'; 
    document.getElementById('printAno').value = new Date().getFullYear(); 
};

function criarHTMLFatura(d, m, a) { 
    const dataPrimeiroVenc = extrairDataVencimento(d);
    const diaFatura = dataPrimeiroVenc.getDate();
    const dataVenc = `${String(diaFatura).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`; 
    
    // GERA O CÓDIGO COM O NOME
    const payloadValido = gerarPayloadPix(chavePixGlobal, d.plano, nomeTitularPixGlobal); 
    const urlQRCode = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(payloadValido)}`; 
    
    // Formata o WhatsApp do provedor para o cabeçalho
    const whatsProvedor = whatsappDonoGlobal.length >= 10 ? `(${whatsappDonoGlobal.substring(0,2)}) ${whatsappDonoGlobal.substring(2,7)}-${whatsappDonoGlobal.substring(7,11)}` : 'Não informado';

    return `
    <div class="fatura-print" style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; font-family: 'Segoe UI', Arial, sans-serif; color: #374151; display: flex; flex-direction: column; justify-content: space-between; margin-bottom: 20px; page-break-inside: avoid; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); background: #ffffff;">

        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 12px;">
            <div>
                <h1 style="color: #1e3a8a; margin: 0; font-size: 22px; letter-spacing: -0.5px;">📡 MatutoNet</h1>
                <p style="margin: 3px 0 0 0; font-size: 10px; color: #6b7280; font-weight: bold;">PROVEDOR DE INTERNET</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6b7280;">Surubim - PE | Suporte: ${whatsProvedor}</p>
            </div>
            <div style="text-align: right;">
                <h2 style="margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 800; background: #e0e7ff; padding: 4px 10px; border-radius: 6px; display: inline-block;">FATURA MENSAL</h2>
                <p style="margin: 5px 0 0 0; font-size: 11px; color: #4b5563;">Ref: <strong>${mesesNomes[m-1].toUpperCase()} / ${a}</strong></p>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 12px;">
            <div style="flex: 1; background: #f9fafb; padding: 10px; border-radius: 8px; border: 1px solid #f3f4f6;">
                <p style="margin: 0 0 4px 0; font-size: 10px; color: #6b7280; font-weight: bold; text-transform: uppercase;">Dados do Cliente (Sacado)</p>
                <p style="margin: 0; font-size: 12px; color: #111827; font-weight: bold;">${d.nome.toUpperCase()}</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #4b5563;">CPF: ${d.cpf}</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #4b5563;">${d.bairro}, ${d.cidade}</p>
            </div>
            <div style="width: 130px; display: flex; flex-direction: column; gap: 8px;">
                <div style="background: #fef2f2; padding: 8px; border-radius: 8px; border: 1px solid #fee2e2; text-align: center;">
                    <p style="margin: 0; font-size: 9px; color: #991b1b; font-weight: bold; text-transform: uppercase;">Vencimento</p>
                    <p style="margin: 2px 0 0 0; font-size: 14px; color: #ef4444; font-weight: 900;">${dataVenc}</p>
                </div>
                <div style="background: #f0fdfa; padding: 8px; border-radius: 8px; border: 1px solid #ccfbf1; text-align: center;">
                    <p style="margin: 0; font-size: 9px; color: #0f766e; font-weight: bold; text-transform: uppercase;">Valor a Pagar</p>
                    <p style="margin: 2px 0 0 0; font-size: 14px; color: #0d9488; font-weight: 900;">R$ ${parseFloat(d.plano).toFixed(2)}</p>
                </div>
            </div>
        </div>

        <div style="margin-bottom: 12px; font-size: 11px; color: #4b5563; background: #fffbeb; padding: 8px; border-radius: 6px; border-left: 3px solid #f59e0b;">
            <strong>Atenção:</strong> Após o vencimento, o serviço poderá ser suspenso. Evite multas pagando em dia!
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; border: 2px solid #10b981; padding: 12px; border-radius: 10px; background: #f0fdf4;">
            <div style="flex: 1; padding-right: 15px;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                    <span style="background: #10b981; color: white; font-size: 10px; font-weight: bold; padding: 3px 8px; border-radius: 4px;">PAGAMENTO VIA PIX</span>
                </div>
                <p style="font-size: 11px; margin: 0 0 4px 0; color: #166534;"><strong>Titular:</strong> ${nomeTitularPixGlobal || "Não informado"}</p>
                <p style="font-size: 11px; margin: 0 0 4px 0; color: #166534;"><strong>Chave PIX:</strong> ${chavePixGlobal || "Não configurada"}</p>
                <p style="font-size: 11px; margin: 0; color: #166534;"><strong>Copia e Cola:</strong></p>
                <div style="background: white; border: 1px solid #bbf7d0; padding: 4px; border-radius: 4px; margin-top: 4px; font-size: 9px; color: #15803d; word-break: break-all; max-height: 28px; overflow: hidden; font-family: monospace;">
                    ${payloadValido}
                </div>
            </div>
            <div style="background: white; padding: 4px; border-radius: 8px; border: 1px solid #10b981; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);">
                <img crossorigin="anonymous" src="${urlQRCode}" alt="QR Code PIX" style="width: 75px; height: 75px; display: block;">
            </div>
        </div>

        <div style="text-align: center; margin-top: 10px; font-size: 9px; color: #9ca3af; font-weight: bold;">
            A MatutoNet agradece a preferência! 💙
        </div>
    </div>
    `; 
}

window.gerarEImprimirFaturas = function() { 
    const d = dadosClientes[clienteParaImprimir]; 
    const mEscolha = parseInt(document.getElementById('printMes').value); 
    const a = document.getElementById('printAno').value; 
    const area = document.createElement('div'); 
    area.id = 'areaImpressaoTemp'; 
    document.body.appendChild(area); 
    const meses = mEscolha === 0 ? [1,2,3,4,5,6,7,8,9,10,11,12] : [mEscolha]; 
    meses.forEach(m => area.innerHTML += criarHTMLFatura(d, m, a)); 
    window.fecharModalImprimir(); 
    document.getElementById('sistemaApp').style.display = 'none'; 
    window.print(); 
    setTimeout(() => { document.getElementById('sistemaApp').style.display = 'block'; document.body.removeChild(area); }, 500); 
};

window.compartilharFatura = function() { 
    const d = dadosClientes[clienteParaImprimir]; 
    const mEscolha = parseInt(document.getElementById('printMes').value); 
    const a = document.getElementById('printAno').value; 
    const molde = document.createElement('div'); 
    molde.style.position = 'absolute'; molde.style.left = '-9999px'; molde.style.width = '650px'; 
    document.body.appendChild(molde); 
    const meses = mEscolha === 0 ? [1,2,3,4,5,6,7,8,9,10,11,12] : [mEscolha]; 
    meses.forEach(m => molde.innerHTML += criarHTMLFatura(d, m, a)); 
    
    // EXIBE O NOME DO TITULAR NA MENSAGEM DO WHATSAPP
    const textoMensagem = `Olá *${(d.nome||"").split(' ')[0]}*, tudo bem?\nSua fatura da *MatutoNet* já está disponível!\n\nValor: *R$ ${parseFloat(d.plano||0).toFixed(2)}*\nFavorecido (Titular): *${nomeTitularPixGlobal || "Não configurado"}*\n\nPara facilitar, vou enviar o código *PIX Copia e Cola* logo abaixo na próxima mensagem.`; 
    
    const payloadValido = gerarPayloadPix(chavePixGlobal, d.plano, nomeTitularPixGlobal); 
    Swal.fire({ title: 'Gerando Imagem...', didOpen: () => Swal.showLoading() }); 
    const escalaAjustada = meses.length > 1 ? 1 : 1.5; 
    html2canvas(molde, { scale: escalaAjustada, useCORS: true, logging: false }).then(canvas => { 
        document.body.removeChild(molde); 
        canvas.toBlob(async function(blob) { 
            const file = new File([blob], `Fatura_${(d.nome||"").replace(/\s+/g, '_')}.png`, { type: 'image/png' }); 
            if (navigator.share) { 
                try { 
                    await navigator.share({ title: 'Fatura MatutoNet', text: textoMensagem, files: [file] }); 
                    window.fecharModalImprimir(); 
                    Swal.fire({ title: 'Foto Compartilhada!', html: `Deseja copiar o código PIX para colar solto na conversa?<br><br><textarea id="codigoPixUnico" style="width: 100%; height: 80px; padding: 10px; border-radius: 6px; border: 1px solid #ccc; font-size: 12px; margin-bottom: 10px;" readonly>${payloadValido}</textarea>`, showConfirmButton: true, confirmButtonText: 'Copiar PIX', confirmButtonColor: '#10b981' }).then((res) => { if(res.isConfirmed) { document.getElementById("codigoPixUnico").select(); document.execCommand("copy"); Swal.fire({title: 'Copiado!', text: 'Cole no Zap!', icon: 'success', timer: 2000, showConfirmButton: false}); } }); 
                } catch (err) { mostrarFallback(canvas.toDataURL('image/png'), textoMensagem, payloadValido); } 
            } else { mostrarFallback(canvas.toDataURL('image/png'), textoMensagem, payloadValido); } 
        }, 'image/png'); 
    }); 
};

function mostrarFallback(imgData, texto, pix) { 
    window.fecharModalImprimir(); 
    Swal.fire({ title: 'Fatura Pronta!', html: `<p style="font-size: 13px; margin-bottom: 5px;">1️⃣ Segure a imagem para <b>Salvar</b> ou <b>Copiar</b>.</p><div style="max-height:200px; overflow-y:auto; border:1px solid #ccc; border-radius:8px; margin-bottom: 15px;"><img src="${imgData}" style="width: 100%;"></div><p style="font-size: 13px; text-align: left; margin-bottom: 5px;">2️⃣ <b>Mensagem ao cliente:</b></p><textarea id="textoMsg" style="width: 100%; height: 60px; padding: 5px; border-radius: 6px; border: 1px solid #ccc; font-size: 12px; margin-bottom: 5px;" readonly>${texto}</textarea><button onclick="window.copiarTextoZap('textoMsg')" style="background: #3b82f6; color: white; padding: 8px; border: none; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold; margin-bottom: 15px;">Copiar Mensagem</button><p style="font-size: 13px; text-align: left; margin-bottom: 5px;">3️⃣ <b>Código PIX (Para mandar sozinho):</b></p><textarea id="textoPix" style="width: 100%; height: 60px; padding: 5px; border-radius: 6px; border: 1px solid #ccc; font-size: 12px; margin-bottom: 5px;" readonly>${pix}</textarea><button onclick="window.copiarTextoZap('textoPix')" style="background: #10b981; color: white; padding: 8px; border: none; border-radius: 6px; cursor: pointer; width: 100%; font-weight: bold;">Copiar SÓ O PIX</button>`, showConfirmButton: true, confirmButtonText: 'Fechar e Voltar' }); 
}

window.copiarTextoZap = function(idCampo) { document.getElementById(idCampo).select(); document.execCommand("copy"); Swal.fire({ title: 'Copiado!', text: 'Vá no WhatsApp e cole na conversa.', icon: 'success', timer: 2000, showConfirmButton: false }); }

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
    const dataPrimeiroVenc = extrairDataVencimento(cliente);
    dataPrimeiroVenc.setHours(0, 0, 0, 0);
    const mesCad = dataPrimeiroVenc.getMonth() + 1; 
    const anoCad = dataPrimeiroVenc.getFullYear(); 
    const vDia = dataPrimeiroVenc.getDate(); 
    const hoje = new Date(); 
    hoje.setHours(0, 0, 0, 0);
    
    mesesNomes.forEach((nM, i) => { 
        const n = i + 1; 
        if (anoFiltro < anoCad || (anoFiltro === anoCad && n < mesCad)) { g.innerHTML += `<div style="visibility: hidden;"></div>`; return; } 
        let st = dH[n] || 'pendente'; 
        
        let dataVencMesHistorico = new Date(anoFiltro, n - 1, vDia);
        dataVencMesHistorico.setHours(0, 0, 0, 0);

        if (st !== 'pago' && hoje > dataVencMesHistorico && hoje >= dataPrimeiroVenc) { 
            st = 'atrasado'; 
        } 
        
        let cor = st === 'pago' ? 'status-pago' : st === 'atrasado' ? 'status-atrasado' : 'status-pendente'; 
        let ico = st === 'pago' ? '✅' : st === 'atrasado' ? '❌' : '⏳'; 
        g.innerHTML += `<button class="btn-mes ${cor}" onclick="window.abrirPainelStatus(${n}, '${st}', '${nM}')" style="padding: 15px 5px; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold; width: 100%; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 14px;">${nM}<br><span style="font-size: 11px; display: block; margin-top: 5px;">${ico} ${st.toUpperCase()}</span></button>`; 
    }); 
};

window.abrirPainelStatus = function(m, stAtual, nomeMes) { 
    Swal.fire({ title: `Mês de ${nomeMes}`, html: `<p style="margin-bottom: 15px; color: #555;">Selecione o novo status abaixo:</p><div style="display: flex; flex-direction: column; gap: 10px;"><button onclick="window.salvarStatusMes(${m}, 'pago', '${stAtual}')" style="padding: 15px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer;">✅ Marcar como PAGO</button><button onclick="window.salvarStatusMes(${m}, 'pendente', '${stAtual}')" style="padding: 15px; background: #f59e0b; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer;">⏳ Marcar como PENDENTE</button><button onclick="window.salvarStatusMes(${m}, 'atrasado', '${stAtual}')" style="padding: 15px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer;">❌ Marcar como ATRASADO</button></div>`, showConfirmButton: false, showCancelButton: true, cancelButtonText: 'Cancelar', cancelButtonColor: '#9ca3af' }); 
};

window.salvarStatusMes = function(m, novoStatus, stAtual) { 
    Swal.close(); 
    if (novoStatus !== stAtual) { update(ref(db, `historico/${auth.currentUser.uid}/${clienteAtualHistorico}/${document.getElementById('filtroAno').value}`), { [m]: novoStatus }).then(() => { Swal.fire({ title: 'Atualizado!', icon: 'success', timer: 1500, showConfirmButton: false }); window.carregarMesesHistorico(); }); } 
};
