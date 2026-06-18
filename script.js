// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBs7ZMHgx4CSx36ipfEYdHOaEmo7Frf8oo",
    authDomain: "controle-impressoes-dom-bosco.firebaseapp.com",
    projectId: "controle-impressoes-dom-bosco",
    storageBucket: "controle-impressoes-dom-bosco.firebasestorage.app",
    messagingSenderId: "510832467271",
    appId: "1:510832467271:web:eb524fcf4e394901ac0062"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let registros = [];
let limitesCota = {}; // Agora é dinâmico, alimentado pelo Firebase!

// Expor funções para o HTML
window.atualizarTela = atualizarTela;
window.limparFiltros = limparFiltros;
window.verificarCota = verificarCota;
window.registrarImpressao = registrarImpressao;
window.excluirRegistro = excluirRegistro;
window.apagarTudo = apagarTudo;
window.exportarCSV = exportarCSV;
window.adicionarProfessor = adicionarProfessor;
window.excluirProfessor = excluirProfessor;

// 1. ESCUTA EM TEMPO REAL: PROFESSORES (Nova Coleção)
const qProfessores = query(collection(db, "professores"), orderBy("nome", "asc"));
onSnapshot(qProfessores, (querySnapshot) => {
    limitesCota = {}; 
    const datalist = document.getElementById('listaProfessores');
    let htmlDatalist = '';
    let htmlGerenciamento = '<ul class="prof-list">';

    querySnapshot.forEach((docSnap) => {
        const prof = docSnap.data();
        limitesCota[prof.nome] = prof.cota; // Alimenta a lógica de limites
        
        // Constrói as opções da barra de pesquisa
        htmlDatalist += `<option value="${prof.nome}">`;
        
        // Constrói a lista visual no painel de gestão
        htmlGerenciamento += `
            <li class="prof-item">
                <span><strong>${prof.nome}</strong> (Cota: ${prof.cota})</span>
                <button onclick="excluirProfessor('${docSnap.id}')" class="btn-deletar" title="Apagar Utilizador">🗑️</button>
            </li>
        `;
    });
    
    htmlGerenciamento += '</ul>';
    
    if (querySnapshot.empty) {
        htmlGerenciamento = '<p class="no-records">Nenhum utilizador cadastrado. Adicione acima.</p>';
    }

    datalist.innerHTML = htmlDatalist;
    document.getElementById('listaGerenciamentoProfessores').innerHTML = htmlGerenciamento;
});

// 2. ESCUTA EM TEMPO REAL: IMPRESSÕES
const q = query(collection(db, "impressoes"), orderBy("dataCompleta", "desc"));
onSnapshot(q, (querySnapshot) => {
    registros = [];
    querySnapshot.forEach((docSnap) => {
        let registro = docSnap.data();
        registro.id = docSnap.id; 
        registros.push(registro);
    });
    atualizarTela();
    if(document.getElementById('nomeUsuario').value !== "") verificarCota();
});

// FUNÇÕES DE GESTÃO DE PROFESSORES
function adicionarProfessor() {
    const nome = document.getElementById('novoProfNome').value.trim();
    const cota = parseInt(document.getElementById('novoProfCota').value);
    
    if (!nome) return alert("Por favor, digite o nome do utilizador ou setor.");
    if (isNaN(cota) || cota <= 0) return alert("Por favor, digite uma cota mensal válida.");

    // Usa o nome como ID. Se o nome já existir, atualiza a cota. Se não, cria.
    setDoc(doc(db, "professores", nome), {
        nome: nome,
        cota: cota
    }).then(() => {
        document.getElementById('novoProfNome').value = '';
        document.getElementById('novoProfCota').value = '';
    }).catch((error) => {
        alert("Erro ao gravar utilizador: " + error);
    });
}

function excluirProfessor(idFirebase) {
    if (confirm("Tem a certeza que deseja apagar este utilizador? O seu histórico de impressões antigo continuará a existir nos relatórios.")) {
        deleteDoc(doc(db, "professores", idFirebase)).catch(e => alert("Erro ao apagar: " + e));
    }
}

// RESTANTE DAS FUNÇÕES DO SISTEMA
function calcularUsoNoMes(nome, mesVerificar, anoVerificar) {
    let totalUsado = 0;
    for (let reg of registros) {
        if (reg.nome === nome && reg.mes === mesVerificar && reg.ano === anoVerificar) {
            totalUsado += reg.quantidade;
        }
    }
    return totalUsado;
}

function verificarCota() {
    const nomeInput = document.getElementById('nomeUsuario').value;
    const alertaCota = document.getElementById('alertaCota');
    
    let nomeReal = nomeInput;
    if (limitesCota[nomeInput] === undefined && limitesCota[nomeInput + " "] !== undefined) {
        nomeReal = nomeInput + " "; 
    }
    
    if (nomeInput && limitesCota[nomeReal] !== undefined) {
        const dataAtual = new Date();
        const limite = limitesCota[nomeReal];
        const usado = calcularUsoNoMes(nomeReal, dataAtual.getMonth() + 1, dataAtual.getFullYear());
        const restante = limite - usado;
        
        document.getElementById('nomeCotaTexto').innerText = nomeReal;
        document.getElementById('valorCotaTexto').innerText = restante;
        
        if (restante <= 0) {
            alertaCota.classList.add('esgotada');
        } else {
            alertaCota.classList.remove('esgotada');
        }
        
        alertaCota.style.display = 'block';
    } else {
        alertaCota.style.display = 'none';
    }
}

function registrarImpressao() {
    const dataInput = document.getElementById('dataLancamento').value;
    const nomeInputEl = document.getElementById('nomeUsuario');
    const qtdInput = document.getElementById('qtdImpressoes');
    
    const nomeInput = nomeInputEl.value;
    const qtd = parseInt(qtdInput.value);
    
    if (!nomeInput) return alert("Por favor, informe um setor ou professor!");

    let nomeReal = nomeInput;
    if (limitesCota[nomeInput] === undefined && limitesCota[nomeInput + " "] !== undefined) {
        nomeReal = nomeInput + " "; 
    }

    if (limitesCota[nomeReal] === undefined) {
        alert("⚠️ Nome inválido!\n\nPor favor, escolha um nome que esteja na lista sugerida.");
        return;
    }
    
    if (isNaN(qtd) || qtd <= 0) return alert("Por favor, insira uma quantidade válida!");

    let dataRegistro;
    if (dataInput) {
        const [ano, mes, dia] = dataInput.split('-');
        dataRegistro = new Date(ano, mes - 1, dia, 12, 0, 0); 
    } else {
        dataRegistro = new Date();
    }

    const mesRegistro = dataRegistro.getMonth() + 1;
    const anoRegistro = dataRegistro.getFullYear();

    const limite = limitesCota[nomeReal];
    const usado = calcularUsoNoMes(nomeReal, mesRegistro, anoRegistro);
    
    const novoRegistro = {
        nome: nomeReal,
        quantidade: qtd,
        dataCompleta: dataRegistro.toISOString(),
        dia: dataRegistro.getDate(),
        mes: mesRegistro,
        ano: anoRegistro
    };

    addDoc(collection(db, "impressoes"), novoRegistro)
    .then(() => {
        document.getElementById('dataLancamento').value = '';
        nomeInputEl.value = '';
        qtdInput.value = '';
        
        const novoUsado = usado + qtd;
        if (novoUsado > limite) {
            const excedido = novoUsado - limite;
            alert(`⚠️ Cota Excedida!\n\nO lançamento foi salvo, mas ${nomeReal.trim()} ultrapassou o limite mensal.\nO saldo dele agora está negativo em ${excedido} cópia(s).`);
        }
    })
    .catch((error) => alert("Erro ao salvar no banco de dados."));
}

function excluirRegistro(idRegistroFirebase) {
    if (confirm(`Tem a certeza que deseja apagar este lançamento?`)) {
        deleteDoc(doc(db, "impressoes", idRegistroFirebase));
    }
}

function apagarTudo() {
    if (registros.length === 0) return alert("O sistema já está vazio.");

    if (confirm("⚠️ ATENÇÃO EXTREMA ⚠️\n\nVocê está prestes a apagar TODOS os registros salvos.\nIsto não pode ser desfeito.\n\nTem a certeza absoluta?")) {
        registros.forEach((reg) => {
            deleteDoc(doc(db, "impressoes", reg.id));
        });
        alert("Comandos de exclusão enviados para a base de dados.");
    }
}

function exportarCSV() {
    if (registros.length === 0) return alert("Não há dados para exportar.");
    let csvContent = "\uFEFFData,Professor/Setor,Quantidade\n";
    registros.forEach(reg => {
        const dataFormatada = new Date(reg.dataCompleta).toLocaleDateString('pt-BR');
        csvContent += `${dataFormatada},"${reg.nome}",${reg.quantidade}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "relatorio_impressoes_escola.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function atualizarTela() {
    const dataInicioInput = document.getElementById('dataInicio').value;
    const dataFimInput = document.getElementById('dataFim').value;
    const usuarioFiltroInput = document.getElementById('usuarioFiltro').value; 
    
    let usuarioFiltroReal = usuarioFiltroInput;
    if (usuarioFiltroInput && limitesCota[usuarioFiltroInput] === undefined && limitesCota[usuarioFiltroInput + " "] !== undefined) {
        usuarioFiltroReal = usuarioFiltroInput + " "; 
    }

    const dataAtual = new Date();
    const mesAtual = dataAtual.getMonth() + 1;
    const anoAtual = dataAtual.getFullYear();
    const diaAtual = dataAtual.getDate();

    let somaPeriodo = 0;
    let somaMes = 0;
    let htmlLista = '';

    let dataInicioFilter = null;
    let dataFimFilter = null;

    if (dataInicioInput) dataInicioFilter = new Date(dataInicioInput + 'T00:00:00');
    if (dataFimInput) dataFimFilter = new Date(dataFimInput + 'T23:59:59');

    if (dataInicioFilter && !dataFimFilter) dataFimFilter = new Date(dataInicioInput + 'T23:59:59');
    else if (!dataInicioFilter && dataFimFilter) dataInicioFilter = new Date(dataFimInput + 'T00:00:00');

    const isFiltroPadrao = (!dataInicioFilter && !dataFimFilter);
    const isFiltroDiaUnico = (dataInicioInput && !dataFimInput) || (dataInicioInput === dataFimInput);

    let mesRef = dataInicioFilter ? dataInicioFilter.getMonth() + 1 : mesAtual;
    let anoRef = dataInicioFilter ? dataInicioFilter.getFullYear() : anoAtual;

    for (let i = 0; i < registros.length; i++) {
        const reg = registros[i];
        const dataReg = new Date(reg.dataCompleta);
        const bateFiltroUsuario = (usuarioFiltroReal === "" || reg.nome === usuarioFiltroReal);
        
        if (bateFiltroUsuario) {
            if (reg.mes === mesRef && reg.ano === anoRef) somaMes += reg.quantidade;
            
            let mostrarRegistro = false;
            if (isFiltroPadrao) {
                if (reg.dia === diaAtual && reg.mes === mesAtual && reg.ano === anoAtual) mostrarRegistro = true;
            } else {
                if (dataReg >= dataInicioFilter && dataReg <= dataFimFilter) mostrarRegistro = true;
            }

            if (mostrarRegistro) {
                somaPeriodo += reg.quantidade;
                const diaFormatado = String(reg.dia).padStart(2, '0');
                const mesFormatado = String(reg.mes).padStart(2, '0');
                
                htmlLista += `
                    <div class="record">
                        <div class="record-user">
                            <strong>${reg.nome}</strong>
                            <span class="record-date">${diaFormatado}/${mesFormatado}</span>
                        </div>
                        <div class="record-info">
                            <span>${reg.quantidade} folhas</span>
                            <button class="btn-deletar" onclick="excluirRegistro('${reg.id}')">🗑️</button>
                        </div>
                    </div>
                `;
            }
        }
    }

    const nomeTitulo = usuarioFiltroReal && limitesCota[usuarioFiltroReal] !== undefined ? ` - ${usuarioFiltroReal}` : '';
    let tituloEsq = 'Total Hoje';
    let tituloHist = 'Lançamentos de Hoje';

    if (!isFiltroPadrao) {
        if (isFiltroDiaUnico) {
            const [a, m, d] = (dataInicioInput || dataFimInput).split('-');
            tituloEsq = `Total em ${d}/${m}/${a}`;
            tituloHist = `Lançamentos de ${d}/${m}/${a}`;
        } else {
            const diaIn = String(dataInicioFilter.getDate()).padStart(2, '0');
            const mesIn = String(dataInicioFilter.getMonth() + 1).padStart(2, '0');
            const diaFim = String(dataFimFilter.getDate()).padStart(2, '0');
            const mesFim = String(dataFimFilter.getMonth() + 1).padStart(2, '0');
            tituloEsq = `Total no Período`;
            tituloHist = `Lançamentos (${diaIn}/${mesIn} até ${diaFim}/${mesFim})`;
        }
    }

    document.getElementById('tituloDia').innerText = tituloEsq + nomeTitulo;
    document.getElementById('tituloHistorico').innerText = tituloHist + nomeTitulo;
    
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    document.getElementById('tituloMes').innerText = `Total Mês (${meses[mesRef-1]})` + nomeTitulo;

    document.getElementById('totalDia').innerText = somaPeriodo.toLocaleString('pt-BR');
    document.getElementById('totalMes').innerText = somaMes.toLocaleString('pt-BR');
    
    const listaDiv = document.getElementById('listaRegistros');
    listaDiv.innerHTML = htmlLista || '<p class="no-records">Nenhum lançamento encontrado para este filtro.</p>';
}

function limparFiltros() {
    document.getElementById('dataInicio').value = '';
    document.getElementById('dataFim').value = '';
    document.getElementById('usuarioFiltro').value = '';
    atualizarTela();
    document.getElementById('alertaCota').style.display = 'none'; 
}
// FUNÇÕES DO MODAL (Janela Flutuante)
window.abrirModal = function() {
    document.getElementById('modalGerenciar').style.display = 'block';
};

window.fecharModal = function() {
    document.getElementById('modalGerenciar').style.display = 'none';
};

// Se o usuário clicar fora da caixinha branca, o modal também fecha
window.onclick = function(event) {
    const modal = document.getElementById('modalGerenciar');
    if (event.target === modal) {
        modal.style.display = "none";
    }
};