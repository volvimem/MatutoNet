const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const admin = require('firebase-admin');
const cron = require('node-cron');
const puppeteer = require('puppeteer');
const fs = require('fs');
const express = require('express');

// === SERVIDOR FANTASMA ===
const app = express();
app.get('/', (req, res) => {
    res.send('📡 Robô de Cobranças MatutoNet está Online e Operante!');
});

const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://matutonett-default-rtdb.firebaseio.com"
    });
}
const db = admin.database();

const sessoesWhatsApp = {};
const travaIniciando = {};

function iniciarSessaoWhatsApp(uid) {
    if (sessoesWhatsApp[uid]) {
        sessoesWhatsApp[uid].destroy().catch(()=>{});
        delete sessoesWhatsApp[uid];
    }
    
    console.log(`[${uid}] Iniciando robô...`);
    
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: uid }),
        puppeteer: { 
            headless: true,
            timeout: 60000,
            protocolTimeout: 300000,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--disable-accelerated-2d-canvas', 
                '--no-first-run', 
                '--no-zygote', 
                '--disable-gpu'
            ] 
        }
    });

    client.on('qr', (qr) => db.ref(`config/${uid}/qrCode`).set(qr));
    
    client.on('ready', () => {
        console.log(`✅ [${uid}] WhatsApp conectado com sucesso!`);
        db.ref(`config/${uid}/qrCode`).remove(); 
        db.ref(`config/${uid}/statusRobo`).set('conectado');
    });
    
    client.on('disconnected', (motivo) => {
        console.log(`❌ [${uid}] WhatsApp Desconectado! Motivo:`, motivo);
        db.ref(`config/${uid}/statusRobo`).set('desconectado');
        delete sessoesWhatsApp[uid];
        client.destroy().catch(()=>{});
        
        setTimeout(() => {
            console.log(`🔄 [${uid}] Tentando auto-reconexão após falha...`);
            iniciarSessaoWhatsApp(uid);
        }, 60000); 
    });
    
    client.on('auth_failure', () => {
        console.log(`🚨 [${uid}] Falha de Autenticação. Precisa ler o QR Code de novo.`);
        db.ref(`config/${uid}/statusRobo`).set('desconectado');
        delete sessoesWhatsApp[uid];
        client.destroy().catch(()=>{});
    });

    client.initialize().catch(err => {
        console.error(`[${uid}] Erro ao inicializar:`, err);
        db.ref(`config/${uid}/statusRobo`).set('desconectado');
        delete sessoesWhatsApp[uid];
    });
    
    sessoesWhatsApp[uid] = client;
}

const escutarComandos = (snapshot) => {
    const uid = snapshot.key;
    const config = snapshot.val();
    if (config && config.statusRobo === 'iniciar') {
        if (travaIniciando[uid]) return;
        travaIniciando[uid] = true;
        db.ref(`config/${uid}/statusRobo`).set('preparando'); 
        console.log(`🔄 Comando recebido para ${uid}! Ligando motor com segurança...`);
        iniciarSessaoWhatsApp(uid);
        setTimeout(() => { travaIniciando[uid] = false; }, 30000);
    }
};

db.ref('config').on('child_added', escutarComandos);
db.ref('config').on('child_changed', escutarComandos);

cron.schedule('* * * * *', async () => {
    const strData = new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"});
    const agora = new Date(strData);
    const hhmm = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
    console.log(`⏱️ [${hhmm}] Robô inspecionando horários de todos os usuários...`);

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
    } catch (e) {
        console.log("Erro na rotina cron:", e.message);
    }
}, { timezone: "America/Sao_Paulo" });

function calcularCRC16(payload) { let crc = 0xFFFF; for (let i = 0; i < payload.length; i++) { crc ^= (payload.charCodeAt(i) << 8); for (let j = 0; j < 8; j++) { if ((crc & 0x8000) > 0) crc = (crc << 1) ^ 0x1021; else crc = crc << 1; } } return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'); }

function gerarPayloadPix(chave, valorPlano) { 
    let c = chave.trim(); 
    if (c.startsWith('000201')) return c; 
    
    if (!c.includes('@')) c = c.replace(/[^a-zA-Z0-9+]/g, ''); 

    let payload = "000201"; 
    let gui = "0014br.gov.bcb.pix";
    let keyStr = `01${c.length.toString().padStart(2, '0')}${c}`;
    let id26Value = gui + keyStr;
    payload += `26${id26Value.length.toString().padStart(2, '0')}${id26Value}`;
    payload += "520400005303986";

    if (valorPlano && parseFloat(valorPlano) > 0) { 
        let v = parseFloat(valorPlano).toFixed(2); 
        payload += `54${v.length.toString().padStart(2, '0')}${v}`; 
    } 
    payload += "5802BR5909MATUTONET6007SURUBIM";
    
    let id62Value = "0503***";
    payload += `62${id62Value.length.toString().padStart(2, '0')}${id62Value}`;
    payload += "6304";
    
    return payload + calcularCRC16(payload); 
}

function extrairDataVencimento(cliente) {
    let v = String(cliente.vencimento || 1);
    if (v.includes('-')) {
        return new Date(v + "T00:00:00");
    } else {
        let dia = parseInt(v) || 1;
        let mes = cliente.mesCadastro || 1;
        let ano = cliente.anoCadastro || 2024;
        return new Date(ano, mes - 1, dia);
    }
}

async function enviarFaturaComPDF(uid, cliente, mes, ano, textoCaption, chaveSimples, pixCopiaCola) {
    let numBase = cliente.telefone.replace(/\D/g, '');
    let numCom9 = `55${numBase}@c.us`;
    let numSem9 = numBase.length === 11 ? `55${numBase.substring(0,2)}${numBase.substring(3)}@c.us` : numCom9;

    const valor = parseFloat(cliente.plano).toFixed(2);
    
    const dataPrimeiroVenc = extrairDataVencimento(cliente);
    const vDia = dataPrimeiroVenc.getDate();
    
    const dataVenc = `${String(vDia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
    const primeiroNome = cliente.nome.split(' ')[0].toUpperCase();

    const htmlFatura = `<html><body style="width: 600px; padding: 30px; font-family: Arial; color: #333; background: white; border: 1px solid #ccc;"><div style="display: flex; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;"><h1 style="color: #1e3a8a; margin: 0; font-size: 24px;">📡 MatutoNet</h1><h2 style="margin: 0; color: #555;">FATURA PIX</h2></div><p><strong>Cliente:</strong> ${cliente.nome}</p><p><strong>CPF:</strong> ${cliente.cpf}</p><hr><p><strong>Vencimento:</strong> <span style="font-size: 20px; color: #ef4444; font-weight: bold;">${dataVenc}</span></p><p><strong>Valor do Plano:</strong> <span style="font-size: 18px; font-weight: bold;">R$ ${valor}</span></p><div style="text-align: center; border: 2px dashed #10b981; padding: 20px; border-radius: 8px; margin-top: 20px;"><h3 style="margin-top: 0; color: #10b981;">PAGUE VIA PIX</h3><p><strong>Chave PIX:</strong> ${chaveSimples}</p></div></body></html>`;

    try {
        console.log(`⏳ Gerando e enviando PDF para ${cliente.nome}...`);
        const clientDoUsuario = sessoesWhatsApp[uid];

        const browser = await puppeteer.launch({ 
            headless: true, 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--disable-gpu'
            ] 
        });
        const page = await browser.newPage();
        await page.setContent(htmlFatura);
        const pdfCru = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        const pdfTraduzido = Buffer.from(pdfCru).toString('base64');
        const nomeArquivo = `Fatura_MatutoNet_${primeiroNome}.pdf`;
        const media = new MessageMedia('application/pdf', pdfTraduzido, nomeArquivo);

        try {
            await clientDoUsuario.sendMessage(numCom9, media, { caption: textoCaption });
            setTimeout(async () => { await clientDoUsuario.sendMessage(numCom9, pixCopiaCola); }, 1500);
        } catch (err) {
            if (numBase.length === 11) {
                await clientDoUsuario.sendMessage(numSem9, media, { caption: textoCaption });
                setTimeout(async () => { await clientDoUsuario.sendMessage(numSem9, pixCopiaCola); }, 1500);
            }
        }
        console.log(`✅ Fatura PDF enviada com sucesso para ${cliente.nome}!`);
    } catch (error) { console.error(`🚨 ERRO ao enviar PDF:`, error.message); }
}

async function rotinaLembretesUID(uid, config) {
    if (!config.chavePix) return; const diasLembrete = parseInt(config.diasLembrete) || 5; const repetirLembrete = config.repetirLembrete === true || config.repetirLembrete === "true";
    try {
        const snapClientes = await db.ref(`clientes/${uid}`).once('value'); const snapHistorico = await db.ref(`historico/${uid}`).once('value'); const clientes = snapClientes.val(); const historico = snapHistorico.val() || {}; if (!clientes) return; const hoje = new Date(); hoje.setHours(0,0,0,0);
        for (let id in clientes) {
            const cliente = clientes[id]; 
            
            let dataPrimeiroVenc = extrairDataVencimento(cliente);
            let vDia = dataPrimeiroVenc.getDate();

            let dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), vDia); 
            if (hoje.getDate() > 15 && vDia < 15) dataVenc.setMonth(dataVenc.getMonth() + 1); 
            else if (hoje.getDate() < 15 && vDia > 15) dataVenc.setMonth(dataVenc.getMonth() - 1); 
            
            if (dataVenc < dataPrimeiroVenc) continue;

            let mesAlvo = dataVenc.getMonth() + 1; let anoAlvo = dataVenc.getFullYear(); let status = historico[id]?.[anoAlvo]?.[mesAlvo] || 'pendente'; if (status === 'pago') continue;
            
            if (cliente.pausaCobranca) {
                const dp = new Date(cliente.pausaCobranca + "T23:59:59");
                if (dp >= hoje) continue;
            }

            let diffDias = Math.round((dataVenc.getTime() - hoje.getTime()) / (1000 * 3600 * 24)); let strDataVenc = `${String(vDia).padStart(2, '0')}/${String(mesAlvo).padStart(2, '0')}/${anoAlvo}`; let pixCopiaCola = gerarPayloadPix(config.chavePix, cliente.plano);
            const primeiroNome = cliente.nome.split(' ')[0].toUpperCase(); const valor = parseFloat(cliente.plano).toFixed(2);
            
            if (diffDias === diasLembrete) { 
                let msg = `Olá *${primeiroNome}*!\nSua fatura MatutoNet vence em ${diasLembrete} dias (${strDataVenc}).\nValor: R$ ${valor}.\n\nSegue o PDF da sua fatura e, logo abaixo, o código PIX Copia e Cola para facilitar o pagamento:`; 
                await enviarFaturaComPDF(uid, cliente, mesAlvo, anoAlvo, msg, config.chavePix, pixCopiaCola);
            } else if (diffDias > 0 && diffDias < diasLembrete && repetirLembrete) { 
                let msg = `Olá *${primeiroNome}*!\nSua fatura MatutoNet vence em ${diffDias} dias (${strDataVenc}).\nValor: R$ ${valor}.\n\nSegue o PDF da sua fatura e, logo abaixo, o código PIX Copia e Cola para facilitar o pagamento:`; 
                await enviarFaturaComPDF(uid, cliente, mesAlvo, anoAlvo, msg, config.chavePix, pixCopiaCola);
            } else if (diffDias === 0) { 
                let msg = `Olá *${primeiroNome}*!\nSua fatura MatutoNet vence HOJE (${strDataVenc}).\nValor: R$ ${valor}.\n\nSegue o PDF da sua fatura e, logo abaixo, o código PIX Copia e Cola para facilitar o pagamento:`; 
                await enviarFaturaComPDF(uid, cliente, mesAlvo, anoAlvo, msg, config.chavePix, pixCopiaCola);
            }
        }
    } catch (e) { console.error(e); }
}

async function rotinaAtrasadosUID(uid, config) {
    if (!config.chavePix) return; const repetirCobranca = config.repetirCobranca === true || config.repetirCobranca === "true";
    try {
        const snapClientes = await db.ref(`clientes/${uid}`).once('value'); const snapHistorico = await db.ref(`historico/${uid}`).once('value'); const clientes = snapClientes.val(); const historico = snapHistorico.val() || {}; if (!clientes) return; const hoje = new Date(); hoje.setHours(0,0,0,0);
        for (let id in clientes) {
            const cliente = clientes[id]; 
            
            let dataPrimeiroVenc = extrairDataVencimento(cliente);
            let vDia = dataPrimeiroVenc.getDate();

            let dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), vDia); 
            if (hoje.getDate() > 15 && vDia < 15) dataVenc.setMonth(dataVenc.getMonth() + 1); 
            else if (hoje.getDate() < 15 && vDia > 15) dataVenc.setMonth(dataVenc.getMonth() - 1); 
            
            if (dataVenc < dataPrimeiroVenc) continue;

            let mesAlvo = dataVenc.getMonth() + 1; let anoAlvo = dataVenc.getFullYear(); let status = historico[id]?.[anoAlvo]?.[mesAlvo] || 'pendente'; if (status === 'pago') continue;
            
            if (cliente.pausaCobranca) {
                const dp = new Date(cliente.pausaCobranca + "T23:59:59");
                if (dp >= hoje) continue;
            }

            let diffDias = Math.round((dataVenc.getTime() - hoje.getTime()) / (1000 * 3600 * 24)); let strDataVenc = `${String(vDia).padStart(2, '0')}/${String(mesAlvo).padStart(2, '0')}/${anoAlvo}`; let pixCopiaCola = gerarPayloadPix(config.chavePix, cliente.plano);
            const primeiroNome = cliente.nome.split(' ')[0].toUpperCase(); const valor = parseFloat(cliente.plano).toFixed(2);
            
            if (diffDias === -1) { 
                await db.ref(`historico/${uid}/${id}/${anoAlvo}`).update({ [mesAlvo]: 'atrasado' }); 
                let msg = `⚠️ *Aviso MatutoNet* ⚠️\n\nOlá *${primeiroNome}*!\nIdentificamos que a sua fatura com vencimento em ${strDataVenc} consta em ABERTO.\nValor: R$ ${valor}.\n\nEvite a suspensão do sinal! Segue o PDF e o PIX Copia e Cola para regularização:`; 
                await enviarFaturaComPDF(uid, cliente, mesAlvo, anoAlvo, msg, config.chavePix, pixCopiaCola);
            } else if (diffDias < -1 && repetirCobranca) { 
                let msg = `⚠️ *Aviso MatutoNet* ⚠️\n\nOlá *${primeiroNome}*!\nSua fatura vencida no dia ${strDataVenc} continua em ABERTO.\nValor: R$ ${valor}.\n\nSegue o PDF e o PIX logo abaixo para regularização e evitar o corte:`; 
                await enviarFaturaComPDF(uid, cliente, mesAlvo, anoAlvo, msg, config.chavePix, pixCopiaCola);
            }
        }
    } catch (e) { console.error(e); }
}

// === FUNÇÃO DE AUTO-RECONEXÃO ===
async function autoConectarAoIniciar() {
    console.log("🔄 Verificando sessões anteriores no Firebase para auto-reconexão...");
    try {
        const snapConfig = await db.ref('config').once('value');
        const todasConfigs = snapConfig.val() || {};
        
        for (let uid in todasConfigs) {
            if (todasConfigs[uid].statusRobo === 'conectado') {
                console.log(`[${uid}] Restabelecendo conexão do WhatsApp...`);
                if (!sessoesWhatsApp[uid] && !travaIniciando[uid]) {
                    travaIniciando[uid] = true;
                    iniciarSessaoWhatsApp(uid);
                    setTimeout(() => { travaIniciando[uid] = false; }, 30000);
                }
            }
        }
    } catch (error) {
        console.error("🚨 Erro na auto-reconexão:", error.message);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor ativado com sucesso na porta ${PORT}! O robô agora tem Auto-Reconexão de 24h.`);
    // Chama a função de auto-reconexão assim que o servidor fica online
    autoConectarAoIniciar(); 
});
