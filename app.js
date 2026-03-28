// 1. Importando o Firebase diretamente da internet
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// 2. A sua configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDyCmGEBYtXmlbUhjpxK9799zs1QRNHNog",
  authDomain: "matutonett.firebaseapp.com",
  databaseURL: "https://matutonett-default-rtdb.firebaseio.com",
  projectId: "matutonett",
  storageBucket: "matutonett.firebasestorage.app",
  messagingSenderId: "200313185232",
  appId: "1:200313185232:web:1f092ca06d81bfc3d94fd5"
};

// 3. Inicializando o App e o Banco de Dados
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 4. Fazendo o botão de Salvar Cliente funcionar (Ponto 7)
// Substitua 'formNovoCliente' pelo ID real do formulário no seu HTML
document.getElementById('formNovoCliente').addEventListener('submit', function(event) {
    event.preventDefault(); // Impede a página de recarregar

    // Pegando os valores digitados (Ajuste os IDs conforme o seu HTML)
    const nome = document.getElementById('nomeCliente').value;
    const plano = document.getElementById('planoCliente').value;
    const linkMaps = document.getElementById('linkMaps').value; // Referente ao Ponto 8

    // Criando uma referência para a pasta "clientes" no Firebase
    const clientesRef = ref(db, 'clientes');
    
    // push() gera um ID único e aleatório para esse novo cliente
    const novoClienteRef = push(clientesRef); 

    // set() salva os dados no banco
    set(novoClienteRef, {
        nome: nome,
        plano: plano,
        linkMaps: linkMaps,
        emAtraso: false, // Referente ao Ponto 5: Cliente começa sem estar devendo
        dataCadastro: new Date().toISOString()
    })
    .then(() => {
        alert("Cliente cadastrado com sucesso no sistema!");
        document.getElementById('formNovoCliente').reset(); // Limpa os campos
    })
    .catch((error) => {
        console.error("Erro ao salvar cliente:", error);
        alert("Ocorreu um erro ao salvar o cliente. Verifique o console.");
    });
});
