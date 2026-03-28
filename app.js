// ==========================================
// 1. DASHBOARD COM FILTRO DINÂMICO
// ==========================================
window.atualizarDashboard = function() {
    const mesSelecionado = parseInt(document.getElementById('dashMes').value); // 0 = Ano Todo
    const anoSelecionado = document.getElementById('dashAno').value;

    let receitaRecebidaFiltro = 0;
    let receitaEsperadaFiltro = 0;
    let custosFiltro = 0;

    let arrayReceitas = [0,0,0,0,0,0,0,0,0,0,0,0];
    let arrayCustos = [0,0,0,0,0,0,0,0,0,0,0,0];

    // Lógica para Clientes/Receitas
    Object.keys(dadosClientes).forEach(id => {
        const cliente = dadosClientes[id];
        const valorPlano = parseFloat(cliente.plano) || 0;
        
        for(let m = 1; m <= 12; m++) {
            if (dadosHistorico[id] && dadosHistorico[id][anoSelecionado] && dadosHistorico[id][anoSelecionado][m] === 'pago') {
                arrayReceitas[m-1] += valorPlano;
                
                // Se for "Ano Todo" (0), soma todos os meses pagos do ano
                // Se for um mês específico, soma apenas se m for igual ao selecionado
                if (mesSelecionado === 0 || m === mesSelecionado) {
                    receitaRecebidaFiltro += valorPlano;
                }
            }
            // Soma o que deveria receber (Pendente)
            if (mesSelecionado === 0 || m === mesSelecionado) {
                receitaEsperadaFiltro += valorPlano;
            }
        }
    });

    // Lógica para Custos
    Object.keys(dadosCustos).forEach(id => {
        const custo = dadosCustos[id];
        const valorCusto = parseFloat(custo.valor) || 0;
        const partesData = custo.data.split('/');
        
        if (partesData.length === 3) {
            const mesCusto = parseInt(partesData[1], 10);
            const anoCusto = partesData[2];

            if (anoCusto === anoSelecionado) {
                arrayCustos[mesCusto-1] += valorCusto;
                
                if (mesSelecionado === 0 || mesCusto === mesSelecionado) {
                    custosFiltro += valorCusto;
                }
            }
        }
    });

    // Atualiza os Cartões na tela
    // Se mesSelecionado for 0, o título do cartão poderia ser "Recebido no Ano"
    const pendente = receitaEsperadaFiltro - receitaRecebidaFiltro;
    document.getElementById('dashRecebido').innerText = `R$ ${receitaRecebidaFiltro.toFixed(2)}`;
    document.getElementById('dashPendente').innerText = `R$ ${pendente > 0 ? pendente.toFixed(2) : '0.00'}`;
    document.getElementById('dashCustos').innerText = `R$ ${custosFiltro.toFixed(2)}`;
    document.getElementById('dashLucro').innerText = `R$ ${(receitaRecebidaFiltro - custosFiltro).toFixed(2)}`;

    // Renderiza o Gráfico (Sempre mostra os 12 meses para dar contexto)
    renderizarGraficoAnual(arrayReceitas, arrayCustos);
};

// ==========================================
// 2. SALVAR CUSTO PARCELADO ATÉ 24X
// ==========================================
document.getElementById('formCusto').addEventListener('submit', function(e) {
    e.preventDefault();

    const descricao = document.getElementById('descCusto').value;
    const valorTotal = parseFloat(document.getElementById('valorCusto').value);
    const tipo = document.getElementById('tipoCusto').value;
    const parcelas = parseInt(document.getElementById('parcelasCusto').value);
    
    const valorParcela = valorTotal / parcelas;
    const dataAtual = new Date();

    // Loop para criar as parcelas futuras
    for (let i = 0; i < parcelas; i++) {
        let dataParcela = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + i, 1);
        
        let labelParcela = parcelas > 1 ? ` (${i+1}/${parcelas})` : "";
        
        push(ref(db, 'custos'), {
            descricao: descricao + labelParcela,
            valor: valorParcela,
            tipo: tipo,
            data: dataParcela.toLocaleDateString('pt-BR')
        });
    }

    Swal.fire('Sucesso!', `Custo parcelado em ${parcelas}x com sucesso.`, 'success');
    this.reset();
});
