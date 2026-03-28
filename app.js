// Função para alternar entre as telas do menu inferior
function mudarTela(idTela, elementoClicado) {
    // 1. Esconde todas as telas
    const telas = document.querySelectorAll('.tela');
    telas.forEach(tela => tela.classList.remove('ativa'));

    // 2. Mostra a tela que o usuário clicou
    const telaAtiva = document.getElementById(idTela);
    telaAtiva.classList.add('ativa');

    // 3. Remove a cor "ativa" de todos os botões do menu
    const botoes = document.querySelectorAll('.nav-item');
    botoes.forEach(botao => botao.classList.remove('ativo'));

    // 4. Coloca a cor "ativa" no botão que acabou de ser clicado
    elementoClicado.classList.add('ativo');
}
