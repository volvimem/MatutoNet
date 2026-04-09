const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const admin = require('firebase-admin');
const cron = require('node-cron');
const nodeHtmlToImage = require('node-html-to-image');
const fs = require('fs');

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://matutonett-default-rtdb.firebaseio.com"
});
const db = admin.database();

const sessoesWhatsApp = {};

// =========================================================================
// GERADOR DE QR CODE E CONEXÃO
// =========================================================================
function iniciarSessaoWhatsApp(uid) {
    console.log(`⏳ Iniciando/Verificando WhatsApp para o usuário: ${uid}`);

    // Se já tinha um robô travado, ele destrói e começa do zero
    if (sessoesWhatsApp[uid]) {
        sessoesWhatsApp[uid].destroy().catch(()=>{});
        delete sessoesWhatsApp[uid];
    }

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: uid }),
        puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }
    });

    client.on('qr', (qr) => {
        console.log(`📱 QR Code gerado para ${uid}. Aparecendo no painel web agora!`);
        db.ref(`config/${uid}/qrCode`).set(qr);
    });

    client.on('ready', () => {
        console.log(`✅ WhatsApp do usuário ${uid} conectado!`);
        db.ref(`config/${uid}/qrCode`).remove(); 
        db.ref(`config/${uid}/statusRobo`).set('conectado');
    });

    client.on('disconnected', (motivo) => {
        console.log(`❌ WhatsApp do usuário ${uid} desconectou.`);
        db.ref(`config/${uid}/statusRobo`).set('desconectado');
        delete sessoesWhatsApp[uid];
        client.destroy().catch(()=>{});
    });

    client.initialize();
    sessoesWhatsApp[uid] = client;
}

// =========================================================================
// O CÉREBRO QUE ESCUTA O BOTÃO DO SITE
// =========================================================================
db.ref('config').on('child_changed', (snapshot) => {
    const uid = snapshot.key;
    const config = snapshot.val();
    
    // Quando o usuário clicar no botão "Gerar QR Code" lá no site, o robô liga!
    if (config.statusRobo === 'iniciar') {
        console.log(`🔄 Usuário ${uid} clicou no botão! Gerando novo QR Code...`);
        iniciarSessaoWhatsApp(uid);
    }
});

// =========================================================================
// MOTOR DE AGENDAMENTOS E FUNÇÕES DE DISPARO 
// =========================================================================
cron.schedule('* * * * *', async () => {
    const agora = new Date();
    const hhmm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

    try {
        const snapConfig = await db.ref('config').once('value');
        const todasConfigs = snapConfig.val() || {};

        for (let uid in todasConfigs) {
            if (!sessoesWhatsApp[uid] || todasConfigs[uid]?.statusRobo !== 'conectado') continue;
            const configDoDono = todasConfigs[uid];
            const horaLembrete = configDoDono.horaLembrete || "08:00";
            const horaCobranca = configDoDono.horaCobranca || "09:00";

            if (horaLembrete === hhmm) await rotinaLembretesUID(uid, configDoDono);
            if (horaCobranca === hhmm) await rotinaAtrasadosUID(uid, configDoDono);
        }
    } catch (error) { console.error("Erro nos agendamentos:", error); }
}, { timezone: "America/Sao_Paulo" });

cron.schedule('0 23 * * 0', async () => { await rotinaBackupGeral(); }, { timezone: "America/Sao_Paulo" });

function calcularCRC16(payload) { let crc = 0xFFFF; for (let i = 0; i < payload.length; i++) { crc ^= (payload.charCodeAt(i) << 8); for (let j = 0; j < 8; j++) { if ((crc & 0x8000) > 0) crc = (crc << 1) ^ 0x1021; else crc = crc << 1; } } return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'); }
function gerarPayloadPix(chave, valorPlano) { let c = chave.trim(); if (c.startsWith('000201')) return c; if (c.includes('(') || c.includes('-') || c.includes(' ')) { let limpo = c.replace(/\D/g, ''); if (limpo.length === 11) c = "+55" + limpo; else c = limpo; } let payload = "0002010014br.gov.bcb.pix"; let chaveStr = `01${c.length.toString().padStart(2, '0')}${c}`; payload += `26${(22 + chaveStr.length).toString().padStart(2, '0')}0014br.gov.bcb.pix${chaveStr}520400005303986`; if (valorPlano && parseFloat(valorPlano) > 0) { let v = parseFloat(valorPlano).toFixed(2); payload += `54${v.length.toString().padStart(2, '0')}${v}`; } payload += `5802BR5909MATUTONET6007SURUBIM62070503***6304`; return payload + calcularCRC16(payload); }

async function dispararMensagem(uid, cliente, texto, pix) {
    let numFormatado = `55${cliente.telefone.replace(/\D/g, '')}@c.us`;
    try { const clientDoUsuario = sessoesWhatsApp[uid]; const contatoValido = await clientDoUsuario.getNumberId(numFormatado); if (!contatoValido) return; await clientDoUsuario.sendMessage(contatoValido._serialized, texto); setTimeout(async () => { await clientDoUsuario.sendMessage(contatoValido._serialized, pix); }, 1500); } catch (error) {}
}

async function enviarFaturaFoto(uid, cliente, dia, mes, ano, chaveSimples, pix) {
    let numFormatado = `55${cliente.telefone.replace(/\D/g, '')}@c.us`; const valor = parseFloat(cliente.plano).toFixed(2); const dataVenc = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
    const htmlFatura = `<html><body style="width: 600px; padding: 30px; font-family: Arial; color: #333; background: white; border: 1px solid #ccc;"><div style="display: flex; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;"><h1 style="color: #1e3a8a; margin: 0; font-size: 24px;">📡 MatutoNet</h1><h2 style="margin: 0; color: #555;">FATURA PIX</h2></div><p><strong>Cliente:</strong> ${cliente.nome}</p><p><strong>CPF:</strong> ${cliente.cpf}</p><hr><p><strong>Vencimento:</strong> <span style="font-size: 20px; color: #ef4444; font-weight: bold;">${dataVenc}</span></p><p><strong>Valor do Plano:</strong> <span style="font-size: 18px; font-weight: bold;">R$ ${valor}</span></p><div style="text-align: center; border: 2px dashed #10b981; padding: 20px; border-radius: 8px; margin-top: 20px;"><h3 style="margin-top: 0; color: #10b981;">PAGUE VIA PIX</h3><p><strong>Chave PIX:</strong> ${chaveSimples}</p></div></body></html>`;
    try { const clientDoUsuario = sessoesWhatsApp[uid]; const contatoValido = await clientDoUsuario.getNumberId(numFormatado); if (!contatoValido) return; const imageBuffer = await nodeHtmlToImage({ html: htmlFatura, puppeteerArgs: { args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] } }); const media = new MessageMedia('image/png', imageBuffer.toString('base64'), 'fatura.png'); const mensagemTexto = `Olá *${cliente.nome.split(' ')[0]}*, tudo bem? \n\nSua fatura da *MatutoNet* vence HOJE (${dataVenc}). \nValor: *R$ ${valor}*. \n\nPara facilitar, vou mandar o código PIX Copia e Cola logo abaixo.`; await clientDoUsuario.sendMessage(contatoValido._serialized, media, { caption: mensagemTexto }); setTimeout(async () => { await clientDoUsuario.sendMessage(contatoValido._serialized, pix); }, 1500); } catch (error) {}
}

async function rotinaLembretesUID(uid, config) {
    if (!config.chavePix) return; const diasLembrete = parseInt(config.diasLembrete) || 5; const repetirLembrete = config.repetirLembrete === true || config.repetirLembrete === "true";
    try {
        const snapClientes = await db.ref(`clientes/${uid}`).once('value'); const snapHistorico = await db.ref(`historico/${uid}`).once('value'); const clientes = snapClientes.val(); const historico = snapHistorico.val() || {}; if (!clientes) return; const hoje = new Date(); hoje.setHours(0,0,0,0);
        for (let id in clientes) {
            const cliente = clientes[id]; let v = parseInt(cliente.vencimento); if (!v) continue; let dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), v); if (hoje.getDate() > 15 && v < 15) dataVenc.setMonth(dataVenc.getMonth() + 1); else if (hoje.getDate() < 15 && v > 15) dataVenc.setMonth(dataVenc.getMonth() - 1); let mesAlvo = dataVenc.getMonth() + 1; let anoAlvo = dataVenc.getFullYear(); let status = historico[id]?.[anoAlvo]?.[mesAlvo] || 'pendente'; if (status === 'pago') continue;
            let diffDias = Math.round((dataVenc.getTime() - hoje.getTime()) / (1000 * 3600 * 24)); let strDataVenc = `${String(v).padStart(2, '0')}/${String(mesAlvo).padStart(2, '0')}/${anoAlvo}`; let pixCopiaCola = gerarPayloadPix(config.chavePix, cliente.plano);
            if (diffDias === diasLembrete) { let msg = `Olá *${cliente.nome.split(' ')[0]}*, tudo bem?\n\nPassando para lembrar que sua fatura da *MatutoNet* vence em ${diasLembrete} dias (*${strDataVenc}*).\n\nPara facilitar, vou enviar o código PIX Copia e Cola na próxima mensagem. Se já efetuou o pagamento, desconsidere!`; await dispararMensagem(uid, cliente, msg, pixCopiaCola); } else if (diffDias > 0 && diffDias < diasLembrete && repetirLembrete) { let msg = `Olá *${cliente.nome.split(' ')[0]}*.\nFaltam ${diffDias} dias para o vencimento da sua fatura *MatutoNet*.\nSegue seu código PIX logo abaixo caso deseje adiantar o pagamento:`; await dispararMensagem(uid, cliente, msg, pixCopiaCola); } else if (diffDias === 0) { await enviarFaturaFoto(uid, cliente, v, mesAlvo, anoAlvo, config.chavePix, pixCopiaCola); }
        }
    } catch (e) {}
}

async function rotinaAtrasadosUID(uid, config) {
    if (!config.chavePix) return; const repetirCobranca = config.repetirCobranca === true || config.repetirCobranca === "true";
    try {
        const snapClientes = await db.ref(`clientes/${uid}`).once('value'); const snapHistorico = await db.ref(`historico/${uid}`).once('value'); const clientes = snapClientes.val(); const historico = snapHistorico.val() || {}; if (!clientes) return; const hoje = new Date(); hoje.setHours(0,0,0,0);
        for (let id in clientes) {
            const cliente = clientes[id]; let v = parseInt(cliente.vencimento); if (!v) continue; let dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), v); if (hoje.getDate() > 15 && v < 15) dataVenc.setMonth(dataVenc.getMonth() + 1); else if (hoje.getDate() < 15 && v > 15) dataVenc.setMonth(dataVenc.getMonth() - 1); let mesAlvo = dataVenc.getMonth() + 1; let anoAlvo = dataVenc.getFullYear(); let status = historico[id]?.[anoAlvo]?.[mesAlvo] || 'pendente'; if (status === 'pago') continue;
            let diffDias = Math.round((dataVenc.getTime() - hoje.getTime()) / (1000 * 3600 * 24)); let strDataVenc = `${String(v).padStart(2, '0')}/${String(mesAlvo).padStart(2, '0')}/${anoAlvo}`; let pixCopiaCola = gerarPayloadPix(config.chavePix, cliente.plano);
            if (diffDias === -1) { await db.ref(`historico/${uid}/${id}/${anoAlvo}`).update({ [mesAlvo]: 'atrasado' }); let msgAtraso = `⚠️ Olá *${cliente.nome.split(' ')[0]}*.\n\nIdentificamos que a sua fatura da *MatutoNet* com vencimento em *${strDataVenc}* consta em aberto.\nEvite a suspensão do sinal! Vou enviar o código PIX na próxima mensagem.\n*(Se já pagou, envie o comprovante)*`; await dispararMensagem(uid, cliente, msgAtraso, pixCopiaCola); } else if (diffDias < -1 && repetirCobranca) { let msgAtrasoCont = `⚠️ *Aviso MatutoNet* ⚠️\n\nOlá *${cliente.nome.split(' ')[0]}*. Sua fatura vencida no dia *${strDataVenc}* continua em aberto. \nSegue abaixo o PIX para regularização e evitar o corte:`; await dispararMensagem(uid, cliente, msgAtrasoCont, pixCopiaCola); }
        }
    } catch (e) {}
}

async function rotinaBackupGeral() {
    try {
        const snapConfig = await db.ref('config').once('value'); const todasConfigs = snapConfig.val() || {}; const snapClientes = await db.ref('clientes').once('value'); const todosClientes = snapClientes.val() || {}; const snapHistorico = await db.ref('historico').once('value'); const todosHistoricos = snapHistorico.val() || {};
        for (let uid in todasConfigs) {
            const config = todasConfigs[uid]; if (!config.whatsappDono || !sessoesWhatsApp[uid]) continue; const backupData = { clientes: todosClientes[uid] || {}, historico: todosHistoricos[uid] || {} }; const path = `./Backup_MatutoNet_${uid}.json`; fs.writeFileSync(path, JSON.stringify(backupData, null, 2)); let numFormatado = `55${config.whatsappDono.replace(/\D/g, '')}@c.us`; const contatoValido = await sessoesWhatsApp[uid].getNumberId(numFormatado); if (contatoValido) { const media = MessageMedia.fromFilePath(path); await sessoesWhatsApp[uid].sendMessage(contatoValido._serialized, media, { caption: '📦 Backup Automático Semanal.' }); } fs.unlinkSync(path); 
        }
    } catch (e) {}
}

console.log("⏰ Motor de agendamentos iniciado. Aguardando horários configurados...");
