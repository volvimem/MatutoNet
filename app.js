import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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

window.clienteIdEditando = null;
let clienteAtualHistorico = null;
let clienteParaImprimir = null;
let dadosClientes = {};
let dadosHistorico = {};
let chavePixGlobal = "Não configurada"; 
let mostrandoAtrasados = false;
const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

document.getElementById('telCliente').addEventListener('input', e => { let v = e.target.value.replace(/\D/g, "").slice(0, 11); if (v.length > 2) v = v.replace(/^(\d{2})(\d)/g, "($1) $2"); if (v.length > 7) v = v.replace(/(\d{1})(\d{4})(\d{4})$/, "$1 $2-$3"); e.target.value = v; });
document.getElementById('cpfCliente').addEventListener('input', e => { let v = e.target.value.replace(/\D/g, "").slice(0, 11); if (v.length > 3) v = v.replace(/^(\d{3})(\d)/, "$1.$2"); if (v.length > 6) v = v.replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3"); if (v.length > 9) v = v.replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4"); e.target.value = v; });

onValue(ref(db, 'clientes'), snp => { dadosClientes = snp.val() || {}; window.renderizarClientes(); window.atualizarMiniDashboard(); });
onValue(ref(db, 'historico'), snp => { dadosHistorico = snp.val() || {}; window.renderizarClientes(); window.atualizarMiniDashboard(); });
onValue(ref(db, 'config'), snp => { const config = snp.val(); if(config && config.chavePix) { chavePixGlobal = config.chavePix; document.getElementById('chavePixConfig').value = chavePixGlobal; } });

document.getElementById('formConfig').addEventListener('submit', function(e) { e.preventDefault(); const novaChave = document.getElementById('chavePixConfig').value; set(ref(db, 'config'), { chavePix: novaChave }).then(() => { Swal.fire('OK!', 'Chave PIX atualizada.', 'success'); fecharModalConfig(); }); });

window.atualizarMiniDashboard = function() {
    const hj = new Date(); const m = hj.getMonth() + 1; const a = hj.getFullYear();
    let prev = 0, rec = 0;
    Object.keys(dadosClientes).forEach(id => {
        const vPlano = parseFloat(dadosClientes[id].plano) || 0; prev += vPlano;
        if (dadosHistorico[id]?.[a]?.[m] === 'pago') rec += vPlano;
    });
    document.getElementById('resumoPrevisao').innerText = `R$ ${prev.toFixed(2)}`;
    document.getElementById('resumoRecebido').innerText = `R$ ${rec.toFixed(2)}`;
    document.getElementById('resumoAberto').innerText = `R$ ${(prev - rec > 0 ? prev - rec : 0).toFixed(2)}`;
};

document.getElementById('formNovoCliente').addEventListener('submit', function(e) {
    e.preventDefault();
    const cData = { nome: document.getElementById('nomeCliente').value.trim(), cpf: document.getElementById('cpfCliente').value, telefone: document.getElementById('telCliente').value, bairro: document.getElementById('bairroCliente').value, cidade: document.getElementById('cidadeCliente').value, referencia: document.getElementById('refCliente').value || "", localizacao: document.getElementById('locCliente').value || "", vencimento: document.getElementById('vencimentoCliente').value, plano: parseFloat(document.getElementById('planoCliente').value) || 0, emAtraso: false };
    const acao = window.clienteIdEditando ? update(ref(db, 'clientes/' + window.clienteIdEditando), cData) : push(ref(db, 'clientes'), cData);
    acao.then(() => { Swal.fire('Sucesso!', 'Salvo com sucesso.', 'success'); document.getElementById('modalCliente').style.display = 'none'; });
});

window.filtrarAtrasados = function() {
    mostrandoAtrasados = !mostrandoAtrasados; const btn = document.getElementById('btnFiltroAtrasados');
    if(mostrandoAtrasados) { btn.innerHTML = '<i class="fas fa-users"></i> Ver Todos'; btn.style.background = '#f59e0b'; } else { btn.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ver Atrasados'; btn.style.background = '#ef4444'; }
    window.renderizarClientes();
};

window.renderizarClientes = function() {
    const lista = document.getElementById('listaClientes'); lista.innerHTML = ""; 
    const tBusca = (document.getElementById('buscaCliente')?.value || "").toLowerCase().trim();
    
    Object.keys(dadosClientes).forEach(id => {
        const d = dadosClientes[id]; let atrasado = false;
        if(dadosHistorico[id]) Object.values(dadosHistorico[id]).forEach(a => { if(Object.values(a).includes('atrasado')) atrasado = true; });
        if(mostrandoAtrasados && !atrasado) return;
        if(tBusca && !d.nome.toLowerCase().includes(tBusca) && !(d.cpf || "").includes(tBusca)) return;

        const w = (d.telefone || "").replace(/\D/g, '');
        const bdg = atrasado ? '<span style="background:#ef4444; color:white; padding:4px 8px; border-radius:12px; font-size:11px; font-weight:bold;">⚠️ ATRASADO</span>' : '<span style="color: #10b981; font-weight: bold; font-size: 13px;">✅ EM DIA</span>';
        
        lista.innerHTML += `
            <div class="card-cliente" style="background:white; padding:20px; border-radius:10px; box-shadow:0 4px 8px rgba(0,0,0,0.08); border-left:6px solid ${atrasado ? '#ef4444' : '#3b82f6'}; margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; align-items:center;"><h3 style="margin:0; font-size:16px; color:#1e3a8a;">${d.nome}</h3> ${bdg}</div>
                <div style="display:flex; gap:10px; margin-top:15px;">
                    <a href="https://wa.me/55${w}" target="_blank" style="flex:1; background:#25D366; color:white; text-align:center; padding:10px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:14px;"><i class="fab fa-whatsapp"></i> Zap</a>
                    <button onclick="toggleDetalhes('${id}')" style="flex:1; background:#f3f4f6; color:#374151; border:1px solid #d1d5db; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;"><i class="fas fa-id-card"></i> Dados</button>
                </div>
                <div id="detalhes-${id}" style="display:none; background:#f8fafc; padding:15px; margin-top:15px; border-radius:8px; border:1px solid #e2e8f0; font-size:14px;">
                    <p><strong>Venc.:</strong> Dia ${d.vencimento} | <strong>Plano:</strong> R$ ${parseFloat(d.plano).toFixed(2)}</p>
                    <p><strong>Endereço:</strong> ${d.bairro}, ${d.cidade}</p>
                    <div style="display:flex; gap:10px; margin-top: 15px;">
                        <button onclick="abrirModalHistorico('${id}')" style="flex: 1; background: #1e3a8a; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;"><i class="fas fa-calendar-alt"></i> Controle</button>
                        <button onclick="abrirModalImpressao('${id}')" style="flex: 1; background: #8b5cf6; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;"><i class="fas fa-print"></i> Carnê / Foto</button>
                    </div>
                    <div style="margin-top:15px; display:flex; gap:10px;">
                        <button onclick="editarCliente('${id}')" style="flex:1; background:#f59e0b; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;"><i class="fas fa-pen"></i> Editar</button>
                        <button onclick="excluirRegistro('clientes', '${id}')" style="flex:1; background:#ef4444; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;"><i class="fas fa-trash"></i> Apagar</button>
                    </div>
                </div>
            </div>`;
    });
};

window.toggleDetalhes = id => { const e = document.getElementById(`detalhes-${id}`); e.style.display = e.style.display === "block" ? "none" : "block"; };
window.editarCliente = id => { const d = dadosClientes[id]; window.clienteIdEditando = id; document.getElementById('nomeCliente').value = d.nome; document.getElementById('cpfCliente').value = d.cpf; document.getElementById('telCliente').value = d.telefone; document.getElementById('bairroCliente').value = d.bairro; document.getElementById('cidadeCliente').value = d.cidade; document.getElementById('refCliente').value = d.referencia || ""; document.getElementById('locCliente').value = d.localizacao || ""; document.getElementById('vencimentoCliente').value = d.vencimento; document.getElementById('planoCliente').value = d.plano; document.getElementById('tituloModalCliente').innerText = "Editar Cliente"; document.getElementById('modalCliente').style.display = 'block'; };
window.excluirRegistro = (c, id) => { Swal.fire({ title: 'Apagar?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Sim' }).then(r => { if(r.isConfirmed) { remove(ref(db, `${c}/${id}`)); remove(ref(db, `historico/${id}`)); Swal.fire('Removido'); } }); };

// =========================================================================
// 4. SISTEMA DE IMPRESSÃO E COMPARTILHAR FOTO (1 OU 12 MESES)
// =========================================================================
window.abrirModalImpressao = function(id) { clienteParaImprimir = id; document.getElementById('modalImprimir').style.display = 'block'; document.getElementById('printAno').value = new Date().getFullYear(); };

function criarHTMLFatura(d, m, a) {
    const dataVenc = `${String(d.vencimento).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
    return `
        <div class="fatura-print" style="background: white; padding: 30px; margin-bottom: 20px; border: 1px solid #ccc; border-radius: 8px; font-family: Arial, sans-serif; color: #333; width: 100%; max-width: 600px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 20px;">
                <h1 style="color: #1e3a8a; margin: 0; font-size: 24px;">📡 MatutoNet</h1><h2 style="margin: 0; color: #555;">FATURA PIX</h2>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                <div><strong>BENEFICIÁRIO:</strong><br>MatutoNet Provedor<br>Chave PIX: ${chavePixGlobal}</div>
                <div style="text-align: right;"><strong>VENCIMENTO:</strong><br><span style="font-size: 20px; color: #ef4444; font-weight: bold;">${dataVenc}</span></div>
            </div>
            <div style="background: #f8fafc; padding: 15px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                <strong>SACADO / CLIENTE:</strong><br><span>${d.nome.toUpperCase()}</span><br>CPF: <span>${d.cpf}</span><br>Endereço: <span>${d.bairro}, ${d.cidade}</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr style="background: #1e3a8a; color: white;"><th style="padding: 10px; text-align: left;">Descrição do Serviço</th><th style="padding: 10px; text-align: right;">Valor</th></tr>
                <tr><td style="padding: 10px; border-bottom: 1px solid #ccc;">Mensalidade Internet - Ref: ${mesesNomes[m-1]}/${a}</td><td style="padding: 10px; border-bottom: 1px solid #ccc; text-align: right; font-weight: bold; font-size: 18px;">R$ ${parseFloat(d.plano).toFixed(2)}</td></tr>
            </table>
            <div style="text-align: center; border: 2px dashed #10b981; padding: 20px; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #10b981;">PAGUE VIA PIX</h3><p style="font-size: 18px; margin: 10px 0;"><strong>Chave PIX:</strong> ${chavePixGlobal}</p>
            </div>
        </div>`;
}

window.gerarEImprimirFaturas = function() {
    const d = dadosClientes[clienteParaImprimir];
    const mEscolha = parseInt(document.getElementById('printMes').value);
    const a = document.getElementById('printAno').value;
    const area = document.getElementById('areaImpressao'); area.innerHTML = ""; 
    const meses = mEscolha === 0 ? [1,2,3,4,5,6,7,8,9,10,11,12] : [mEscolha];

    meses.forEach(m => area.innerHTML += criarHTMLFatura(d, m, a));
    fecharModalImprimir();
    setTimeout(() => { window.print(); area.innerHTML = ""; }, 500);
};

window.compartilharFatura = function() {
    const d = dadosClientes[clienteParaImprimir];
    const mEscolha = parseInt(document.getElementById('printMes').value);
    const a = document.getElementById('printAno').value;
    const molde = document.getElementById('moldeFatura'); molde.innerHTML = "";
    
    // Agora aceita O Ano Todo (vai gerar uma imagem grandona)
    const meses = mEscolha === 0 ? [1,2,3,4,5,6,7,8,9,10,11,12] : [mEscolha];
    meses.forEach(m => molde.innerHTML += criarHTMLFatura(d, m, a));

    Swal.fire({ title: 'Gerando Imagem...', didOpen: () => Swal.showLoading() });

    html2canvas(molde, { scale: 2 }).then(canvas => {
        canvas.toBlob(async function(blob) {
            const file = new File([blob], `Fatura_${d.nome.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
            if (navigator.share) {
                try {
                    await navigator.share({ title: 'Fatura MatutoNet', files: [file] });
                    fecharModalImprimir(); Swal.close();
                } catch (err) { mostrarFallback(canvas.toDataURL('image/png')); }
            } else { mostrarFallback(canvas.toDataURL('image/png')); }
        }, 'image/png');
        molde.innerHTML = ""; // Limpa a memória
    });
};

function mostrarFallback(imgData) {
    fecharModalImprimir();
    Swal.fire({
        title: 'Fatura Pronta!',
        html: `<p style="font-size: 14px; margin-bottom: 10px;">Clique e segure a imagem para <b>Copiar/Salvar</b>.</p><div style="max-height:400px; overflow-y:auto; border:1px solid #ccc; border-radius:8px;"><img src="${imgData}" style="width: 100%;"></div>`,
        showConfirmButton: true, confirmButtonText: 'Fechar e Voltar'
    });
}

// =========================================================================
// 5. HISTÓRICO E CONTROLE
// =========================================================================
window.abrirModalHistorico = function(id) { clienteAtualHistorico = id; document.getElementById('nomeClienteHistorico').innerText = dadosClientes[id].nome; document.getElementById('modalHistorico').style.display = 'block'; document.getElementById('filtroAno').value = new Date().getFullYear(); window.carregarMesesHistorico(); };
window.carregarMesesHistorico = function() { const a = document.getElementById('filtroAno').value; const g = document.getElementById('gridMeses'); g.innerHTML = ''; const dH = dadosHistorico[clienteAtualHistorico]?.[a] || {}; mesesNomes.forEach((nM, i) => { const n = i + 1; const st = dH[n] || 'pendente'; let cor = st==='pago'?'status-pago':st==='atrasado'?'status-atrasado':'status-pendente'; let ico = st==='pago'?'✅':st==='atrasado'?'❌':'⏳'; g.innerHTML += `<button class="btn-mes ${cor}" onclick="mudarStatusMes(${n}, '${st}', '${nM}')" style="padding: 15px 5px; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold; width: 100%; box-shadow: 0 2px 4px rgba(0,0,0,0.1); font-size: 14px;">${nM}<br><span style="font-size: 11px; display: block; margin-top: 5px;">${ico} ${st.toUpperCase()}</span></button>`; }); };
window.mudarStatusMes = function(m, st, nomeMes) { 
    let nSt = st === 'pendente' ? 'pago' : (st === 'pago' ? 'atrasado' : 'pendente'); let colorIcon = nSt === 'pago' ? '#10b981' : (nSt === 'atrasado' ? '#ef4444' : '#f59e0b');
    Swal.fire({ title: 'Confirmar Alteração', html: `Deseja marcar o mês de <b>${nomeMes}</b> como <b style="color:${colorIcon};">${nSt.toUpperCase()}</b>?`, icon: 'question', showCancelButton: true, confirmButtonColor: colorIcon, cancelButtonColor: '#9ca3af', confirmButtonText: 'Sim, alterar', cancelButtonText: 'Cancelar' }).then((result) => {
        if (result.isConfirmed) { update(ref(db, `historico/${clienteAtualHistorico}/${document.getElementById('filtroAno').value}`), { [m]: nSt }).then(() => { Swal.fire({ title: 'Atualizado!', icon: 'success', timer: 1500, showConfirmButton: false }); window.carregarMesesHistorico(); }); }
    });
};
