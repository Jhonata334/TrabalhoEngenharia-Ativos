document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("calendario")) {
        carregarCalendario();
    }

    carregarAgendamentos();

    const botaoAgendar = document.getElementById("botao-agendar");
    if (botaoAgendar) {
        botaoAgendar.addEventListener("click", agendar);
    }

    const mesInput = document.getElementById("mesLiberado");
    const anoInput = document.getElementById("anoLiberado");

    if (mesInput && anoInput) {
        function notificarSelecao() {
            const mesSelecionado = mesInput.value;
            const anoSelecionado = anoInput.value;

            if (mesSelecionado && anoSelecionado) {
                mostrarAlerta(`Você selecionou: ${mesSelecionado}/${anoSelecionado}`, "info");
            }
        }

        mesInput.addEventListener("change", notificarSelecao);
        anoInput.addEventListener("input", notificarSelecao);
    }
});

let agendamentoPendente = null;

let horarioTemporariamenteReservado = null;
let temporizadorConfirmacao = null;
let intervaloContagem = null;

let intervaloContador;

async function carregarCalendario() {
    const calendario = document.getElementById("calendario");
    const mesAtual = document.getElementById("mes-atual");

    let dataAtual = new Date();
    let ano = dataAtual.getFullYear();
    let mes = dataAtual.getMonth();
    let diaHoje = dataAtual.getDate();

    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    mesAtual.innerText = `${meses[mes]} ${ano}`;
    calendario.innerHTML = "";

    let feriadosSet = new Set();

    try {
        const response = await fetch("feriados.json");
        if (!response.ok) throw new Error("Erro ao carregar feriados");
        const feriados = await response.json();
        feriadosSet = new Set(feriados);
    } catch (error) {
        console.warn("⚠️ Não foi possível carregar feriados:", error);
    }

    let primeiroDia = new Date(ano, mes, 1).getDay();
    let totalDias = new Date(ano, mes + 1, 0).getDate();

    for (let i = 0; i < primeiroDia; i++) {
        calendario.appendChild(document.createElement("div"));
    }

    for (let dia = 1; dia <= totalDias; dia++) {
        let data = new Date(ano, mes, dia);
        let diaSemana = data.getDay();
        let dataFormatada = `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}/${ano}`;

        let diaElemento = document.createElement("div");
        diaElemento.textContent = dia;

        const isFeriado = feriadosSet.has(dataFormatada);

        if (dia === diaHoje && mes === dataAtual.getMonth() && ano === dataAtual.getFullYear()) {
            diaElemento.classList.add("hoje");
        } else if (dia < diaHoje) {
            diaElemento.classList.add("desativado");
        } else if (isFeriado) {
            diaElemento.classList.add("feriado");
        } else if (diaSemana === 3 || diaSemana === 5) {
            diaElemento.classList.add("ativo");
            diaElemento.onclick = function () {
                selecionarDia(dia, mes + 1, ano);
            };
        }

        calendario.appendChild(diaElemento);
    }
}

function selecionarDia(dia, mes, ano) {
    let diaFormatado = dia.toString().padStart(2, "0");
    let mesFormatado = mes.toString().padStart(2, "0");
    let dataFormatada = `${diaFormatado}/${mesFormatado}/${ano}`;

    localStorage.setItem("diaSelecionado", dataFormatada);
    atualizarHorariosDisponiveis(dataFormatada);

    document.querySelectorAll(".calendario div").forEach(el => el.classList.remove("selecionado"));

    let dias = document.querySelectorAll("#calendario div");
    dias[dia + new Date(ano, mes - 1, 1).getDay() - 1]?.classList.add("selecionado");

    mostrarAlerta(`Você selecionou o dia ${dataFormatada}`, "info");
}

function atualizarHorariosDisponiveis(diaSelecionado) {
    const horariosFixos = [
        "09:00", "09:20", "09:40", "10:00", "10:20", "10:40",
        "11:00", "11:20", "11:40", "12:00", "13:00", "13:20",
        "13:40", "14:00", "14:20", "14:40", "15:00", "15:20",
        "15:40", "16:00", "16:20"
    ];

    const agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];
    const horariosOcupados = agendamentos
        .filter(a => a.dia === diaSelecionado)
        .map(a => a.horario);

    const grade = document.getElementById("grade-horarios");
    grade.innerHTML = "";

    horariosFixos.forEach(horario => {
        const btn = document.createElement("button");
        btn.textContent = horario;
        btn.classList.add("botao-horario");
        btn.setAttribute("data-horario", horario);

        if (horariosOcupados.includes(horario)) {
            btn.classList.add("ocupado");
        } else {
            btn.addEventListener("click", function () {
                // Limpa anterior
                if (horarioTemporariamenteReservado) {
                    const anterior = document.querySelector(`button[data-horario="${horarioTemporariamenteReservado}"]`);
                    anterior?.classList.remove("selecionado", "ocupado");
                    clearTimeout(temporizadorConfirmacao);
                    clearInterval(intervaloContador);
                    horarioTemporariamenteReservado = null;
                }

                // Seleciona novo horário
                document.querySelectorAll(".botao-horario").forEach(b => b.classList.remove("selecionado"));
                btn.classList.add("selecionado", "ocupado");
                document.getElementById("horarioSelecionado").value = horario;
                horarioTemporariamenteReservado = horario;

                // Exibe contador
                let tempoRestante = 120; // 2 minutos
                const divContador = document.getElementById("contador-tempo");
                const spanTempo = document.getElementById("tempo-restante");

                // Mostrará o contador depois no popup, não aqui
                spanTempo.textContent = tempoRestante;

                intervaloContador = setInterval(() => {
                    tempoRestante--;
                    spanTempo.textContent = tempoRestante;

                    if (tempoRestante <= 0) {
                        clearInterval(intervaloContador);
                        clearTimeout(temporizadorConfirmacao);
                        btn.classList.remove("selecionado", "ocupado");
                        document.getElementById("horarioSelecionado").value = "";
                        horarioTemporariamenteReservado = null;
                        divContador.style.display = "none";
                        mostrarAlerta("Tempo para confirmar expirou. Selecione o horário novamente.", "erro");
                    }
                }, 1000);

                // Remove o horário após 2 minutos se não confirmar
                temporizadorConfirmacao = setTimeout(() => {
                    clearInterval(intervaloContador);
                    btn.classList.remove("selecionado", "ocupado");
                    document.getElementById("horarioSelecionado").value = "";
                    horarioTemporariamenteReservado = null;
                    divContador.style.display = "none";
                }, 120000); // 2 minutos
            });
        }

        grade.appendChild(btn);
    });
}


function agendar() {
    let nome = document.getElementById("nome").value;
    let email = document.getElementById("email").value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        mostrarAlerta("E-mail inválido. Verifique e tente novamente.", "erro");
        return;
    }

    let horario = document.getElementById("horarioSelecionado").value;
    let dia = localStorage.getItem("diaSelecionado");

    if (!nome || !email || !horario || !dia) {
        mostrarAlerta("Preencha todos os campos e selecione um dia!", "erro");
        return;
    }

    let agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];

    // Verifica se o mesmo e-mail está sendo usado com outro nome
    const conflitoNome = agendamentos.find(a => a.email === email && a.nome !== nome);
    const conflitoEmail = agendamentos.find(a => a.nome === nome && a.email !== email);

    if (conflitoNome) {
        mostrarAlerta("Este e-mail já foi utilizado com outro nome. Verifique seus dados.", "erro");
        return;
    }

    if (conflitoEmail) {
        mostrarAlerta("Este nome já foi utilizado com outro e-mail. Verifique seus dados.", "erro");
        return;
    }


    let horarioOcupado = agendamentos.some(ag => ag.dia === dia && ag.horario === horario);
    if (horarioOcupado) {
        mostrarAlerta("Este horário já está agendado. Por favor, escolha outro.", "erro");
        return;
    }

    // Lógica de agendamentos do mês e consecutivos
    const [_, mesNum, anoNum] = dia.split("/");
    const agendamentosMes = agendamentos.filter(ag =>
        ag.email === email && ag.dia.split("/")[1] === mesNum && ag.dia.split("/")[2] === anoNum
    );

    if (agendamentosMes.length >= 2) {
        mostrarAlerta("Você já fez 2 agendamentos neste mês.", "erro");
        return;
    }

    // Verifica se já há agendamento no mesmo dia
    const agendamentosMesmoDia = agendamentosMes.filter(ag => ag.dia === dia);

    if (agendamentosMesmoDia.length === 1) {
        const horarioExistente = agendamentosMesmoDia[0].horario;

        const paresConsecutivos = {
            "09:00": "09:20",
            "09:40": "10:00",
            "10:20": "10:40",
            "11:00": "11:20",
            "11:40": "12:00",
            "13:00": "13:20",
            "13:40": "14:00",
            "14:20": "14:40",
            "15:00": "15:20",
            "15:40": "16:00",
            "16:20": "16:40"
        };

        const ehConsecutivo =
            paresConsecutivos[horarioExistente] === horario || paresConsecutivos[horario] === horarioExistente;

        if (!ehConsecutivo) {
            mostrarAlerta("Você já possui um agendamento neste dia que não é consecutivo.", "erro");
            return;
        }
    } else if (agendamentosMesmoDia.length >= 2) {
        mostrarAlerta("Você já possui 2 agendamentos neste dia.", "erro");
        return;
    }

    // Tudo certo, segue com a confirmação
    agendamentoPendente = { nome, email, horario, dia };
    document.getElementById("textoConfirmacao").innerText =
        `Nome: ${nome}\nEmail: ${email}\nData: ${dia}\nHorário: ${horario}`;
    document.getElementById("popupConfirmacao").style.display = "flex";
}


function fecharPopup() {
    document.getElementById("popupConfirmacao").style.display = "none";
}

function carregarAgendamentos() {
    let listaAtivos = document.getElementById("lista-agendamentos");
    let listaCancelados = document.getElementById("lista-cancelados");

    if (!listaAtivos || !listaCancelados) return;

    listaAtivos.innerHTML = "";
    listaCancelados.innerHTML = "";

    const agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];

    agendamentos.forEach((agendamento, index) => {
        let item = document.createElement("div");
        item.classList.add("agendamento-item");

        item.innerHTML = `
            <p><strong>Nome:</strong> ${agendamento.nome}</p>
            <p><strong>Email:</strong> ${agendamento.email}</p>
            <p><strong>Data:</strong> ${agendamento.dia}</p>
            <p><strong>Horário:</strong> ${agendamento.horario}</p>
        `;

        if (agendamento.cancelado) {
            // Mostra nos cancelados (com botão de reativar)
            item.innerHTML += `
                <button onclick="reativarAgendamento(${index})">Reativar Agendamento</button>
            `;
            listaCancelados.appendChild(item);
        } else {
            // Mostra nos ativos (com botões)
            item.innerHTML += `
                <button onclick="editarAgendamento(${index})">Editar</button>
                <button onclick="cancelarAgendamento(${index})">Cancelar</button>
                <button onclick="excluirAgendamento(${index})" style="background-color: #dc3545; color: white;">Excluir</button>
            `;
            listaAtivos.appendChild(item);
        }
    });
}


function cancelarAgendamento(index) {
    document.getElementById("popupConfirmacaoCancelamento").style.display = "flex";
    window.indiceCancelamento = index;
}

function confirmarCancelamento() {
    const agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];

    agendamentos[window.indiceCancelamento].cancelado = true;

    localStorage.setItem("agendamentos", JSON.stringify(agendamentos));
    carregarAgendamentos();
    fecharPopupCancelamento();
    mostrarAlerta("Você cancelou o agendamento.", "erro");
}



function fecharPopupCancelamento() {
    document.getElementById("popupConfirmacaoCancelamento").style.display = "none";
}

let indiceEditando = null;

function editarAgendamento(index) {
    const agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];
    const ag = agendamentos[index];

    document.getElementById("editarNome").value = ag.nome;
    document.getElementById("editarEmail").value = ag.email;
    document.getElementById("editarData").value = ag.dia;
    document.getElementById("editarHorario").value = ag.horario;

    indiceEditando = index;
    document.getElementById("editarPopup").style.display = "flex";
}

function fecharEdicao() {
    document.getElementById("editarPopup").style.display = "none";
    document.body.classList.remove("admin-edicao-ativa");
}

function salvarEdicao() {
    const agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];

    agendamentos[indiceEditando] = {
        nome: document.getElementById("editarNome").value,
        email: document.getElementById("editarEmail").value,
        dia: document.getElementById("editarData").value,
        horario: document.getElementById("editarHorario").value
    };

    localStorage.setItem("agendamentos", JSON.stringify(agendamentos));
    fecharEdicao();
    carregarAgendamentos();
    mostrarAlerta("Agendamento editado com sucesso!", "sucesso");
}

function mostrarMensagem(mensagem) {
    let msgBox = document.getElementById("mensagem-confirmacao");
    msgBox.textContent = mensagem;
    msgBox.classList.add("mensagem-visivel");

    setTimeout(() => {
        msgBox.classList.remove("mensagem-visivel");
    }, 3000);
}

function confirmarAgendamento() {
    console.log("🟢 Função confirmarAgendamento chamada");
    mostrarAlerta("Agendamento sendo confirmado...", "info");
    document.getElementById("popupConfirmacao").style.display = "none";
    document.getElementById("contador-tempo").style.display = "none";
    clearInterval(intervaloContador);


    const email = agendamentoPendente?.email;
    console.log("📨 Enviando código para:", email); // <-- Adicione isto

    if (!email) {
        mostrarAlerta("Erro ao recuperar o e-mail do agendamento.", "erro");
        return;
    }

    function mostrarSpinner() {
        document.getElementById("spinner").style.display = "block";
    }

    fetch("http://localhost:3001/enviar-codigo", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: agendamentoPendente.email,
            nome: agendamentoPendente.nome,
            dia: agendamentoPendente.dia,
            horario: agendamentoPendente.horario
        })
    })
        .then(response => {
            if (response.ok) {
                console.log("✅ Código enviado com sucesso");
                document.getElementById("popupCodigo").style.display = "flex";
                document.getElementById("contador-tempo").style.display = "block";
                iniciarContadorConfirmacao();
            } else {
                mostrarAlerta("Erro ao enviar o código por e-mail.", "erro");
            }
        })
        .catch(error => {
            function esconderSpinner() {
                document.getElementById("spinner").style.display = "none";
            }
            console.error("❌ Erro ao enviar código:", error);
            mostrarAlerta("Erro ao conectar com o servidor de e-mail.", "erro");
        });
 
    document.getElementById('grade-horarios').style.display = 'none';
}

function iniciarContadorConfirmacao() {
    clearInterval(intervaloContador);
    let tempo = 60;
    const contador = document.getElementById("contador-tempo");
    const spanTempo = document.getElementById("tempo-restante");

    spanTempo.textContent = tempo;
    contador.style.display = "block";

    intervaloContador = setInterval(() => {
        tempo--;
        spanTempo.textContent = tempo;

        if (tempo <= 0) {
            clearInterval(intervaloContador);
            contador.style.display = "none";
            mostrarAlerta("Tempo para confirmar o código expirou. Selecione o horário novamente.", "erro");
            document.getElementById("popupCodigo").style.display = "none";
            horarioTemporariamenteReservado = null;
            document.getElementById("horarioSelecionado").value = "";
            atualizarHorariosDisponiveis(agendamentoPendente?.dia || "");
        }
    }, 1000);
}


// Abrir o popup de login
function abrirLogin() {
    document.getElementById("popupLogin").style.display = "block";
}

// Função chamada ao clicar no botão "Entrar"
function entrarComoAdmin() {
    const usuario = document.getElementById("usuario").value.trim();
    const senha = document.getElementById("senha").value.trim();

    if (usuario === "admin" && senha === "admin123") {
        window.open("administrador.html", "_blank"); // Abre a página em uma nova aba
        document.getElementById("popupLogin").style.display = "none"; // Fecha o popup de login
        document.getElementById("usuario").value = "";
        document.getElementById("senha").value = "";
    } else {
        alert("Usuário ou senha incorretos.");
    }
}


// Cancelar login e fechar popup
function cancelarLogin() {
    document.getElementById("popupLogin").style.display = "none";
    document.getElementById("usuario").value = "";
    document.getElementById("senha").value = "";
}


function fecharLogin() {
    document.getElementById("popupLogin").style.display = "none";
}

document.getElementById("botao-login").addEventListener("click", function () {
    verificarLogin();
});

function verificarLogin() {
    const usuario = document.getElementById("usuario").value.trim();
    const senha = document.getElementById("senha").value.trim();

    const usuarioCorreto = "Getho";
    const senhaCorreta = "Massagem@123";

    if (usuario === usuarioCorreto && senha === senhaCorreta) {
        // Abre a página do administrador diretamente dentro do evento de clique
        let novaAba = window.open("administrador.html", "_blank");

        if (!novaAba) {
            alert("O navegador bloqueou a abertura da nova aba. Permita pop-ups e tente novamente.");
        }
    } else {
        mostrarAlerta("Usuário ou senha incorretos!", "erro");
    }
}


function mostrarAlerta(mensagem, tipo = 'info') {
    const alerta = document.getElementById('alerta-personalizado');
    alerta.textContent = mensagem;
    alerta.className = `alerta ${tipo}`;
    alerta.style.display = 'block';
    setTimeout(() => {
        alerta.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        alerta.style.opacity = '0';
        setTimeout(() => {
            alerta.style.display = 'none';
        }, 300);
    }, 3000);
}

function confirmarCancelarAgendamento(index) {
    window.indiceCancelamento = index;
    document.getElementById("popupConfirmacaoCancelamento").style.display = "flex";
}

function liberarMes() {
    const mes = document.getElementById("mesLiberado").value;
    const ano = document.getElementById("anoLiberado").value;

    if (!mes || !ano) {
        mostrarAlerta("Por favor, selecione um mês e um ano válidos.", "erro");
        return;
    }

    // Salva no localStorage para a outra página usar
    localStorage.setItem("mesLiberado", mes);
    localStorage.setItem("anoLiberado", ano);

    const nomeMes = document.getElementById("mesLiberado").options[document.getElementById("mesLiberado").selectedIndex].text;
    document.getElementById("statusLiberacao").innerText = `Agendamentos liberados para: ${nomeMes} de ${ano}`;
    mostrarAlerta("Agendamento liberado com sucesso!", "sucesso");
}


function atualizarCalendario(mes, ano) {
    // Substitua esse trecho com sua lógica de renderização do calendário
    const calendario = document.getElementById("calendario");
    if (!calendario) return;

    // Exemplo genérico para exibir a data liberada
    calendario.innerText = `Agendamentos disponíveis para: ${mes.toString().padStart(2, '0')}/${ano}`;

    // Aqui você também pode filtrar os dias da semana (quarta e sexta), se quiser
}

function exibirCalendario(mes, ano) {
    const calendario = document.getElementById("calendario");
    if (!calendario) return;

    const nomeMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    calendario.innerHTML = `<h3>${nomeMeses[mes - 1]} de ${ano}</h3>`;

    // Aqui você pode recriar os dias válidos (quartas e sextas, por exemplo)
    // Dica: use new Date(ano, mes - 1, dia).getDay() para ver se é quarta (3) ou sexta (5)
}

document.addEventListener("DOMContentLoaded", () => {
    atualizarTituloCalendario();
});

function atualizarTituloCalendario() {
    const mes = localStorage.getItem("mesLiberado");
    const ano = localStorage.getItem("anoLiberado");

    if (!mes || !ano) return;

    const nomeMeses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const titulo = document.getElementById("titulo-calendario");
    if (titulo) {
        titulo.textContent = `${nomeMeses[parseInt(mes) - 1]} de ${ano}`;
    }
}

function salvarMesLiberado() {
    const mes = document.getElementById("mesLiberado").value;
    const ano = document.getElementById("anoLiberado").value;

    localStorage.setItem("mesLiberado", mes);
    localStorage.setItem("anoLiberado", ano);

    alert("Mês de agendamento atualizado!");
}

document.getElementById("adminBtn").addEventListener("click", function () {
    document.getElementById("adminLoginBackground").style.display = "block";
    document.getElementById("loginContainer").style.display = "block";
});


document.body.classList.add("admin-edicao-ativa");

function abrirEdicao(nome, email, data, horario) {
    document.getElementById("editarNome").value = nome;
    document.getElementById("editarEmail").value = email;
    document.getElementById("editarData").value = data;
    document.getElementById("editarHorario").value = horario;

    document.getElementById("editarPopup").style.display = "block";
    document.body.classList.add("admin-edicao-ativa");
}

function fecharEdicao() {
    document.getElementById("editarPopup").style.display = "none";
    document.body.classList.remove("admin-edicao-ativa");
}

// ==== LOGIN DO ADMINISTRADOR ====

const abrirLoginBtn = document.getElementById("adminBtn");
const popupLogin = document.getElementById("popupLogin");
const entrarBtn = document.getElementById("entrarBtn");
const cancelarBtn = document.getElementById("cancelarBtn");
const senhaInput = document.getElementById("senhaAdmin");

// Abre o popup de login
if (abrirLoginBtn) {
    abrirLoginBtn.addEventListener("click", () => {
        popupLogin.style.display = "block";
    });
}

// Botão de Cancelar
if (cancelarBtn) {
    cancelarBtn.addEventListener("click", () => {
        popupLogin.style.display = "none";
        senhaInput.value = "";
    });
}

// Botão de Entrar
if (entrarBtn) {
    entrarBtn.addEventListener("click", () => {
        const senha = senhaInput.value.trim();
        if (senha === "Massagem@123") {
            document.body.classList.add("admin-edicao-ativa");
            popupLogin.style.display = "none";
            senhaInput.value = "";
        } else {
            alert("Senha incorreta.");
        }
    });
}

// Função chamada ao clicar no botão "Entrar"
function entrarComoAdmin() {
    const usuario = document.getElementById("usuario").value.trim();
    const senha = document.getElementById("senha").value.trim();

    const usuariosAutorizados = [
        { usuario: "Getho", senha: "Massagem@123" },
        { usuario: "Jhonata", senha: "Jhonata@123" },
    ];

    const autorizado = usuariosAutorizados.find(
        u => u.usuario === usuario && u.senha === senha
    );

    if (autorizado) {
        window.open("administrador.html", "_blank");
        document.getElementById("popupLogin").style.display = "none";
        document.getElementById("usuario").value = "";
        document.getElementById("senha").value = "";
    } else {
        Swal.fire({
            icon: "error",
            title: "Acesso negado",
            text: "Usuário ou senha incorretos.",
            confirmButtonColor: "#d33",
            confirmButtonText: "OK"
        });
    }
}

// Função chamada ao clicar no botão "Cancelar"
function cancelarLogin() {
    document.getElementById("popupLogin").style.display = "none";
    document.getElementById("usuario").value = "";
    document.getElementById("senha").value = "";
}

// Aplica o fundo especial ao entrar em modo de edição
function aplicarFundoEdicao() {
    document.body.classList.add("admin-edicao-ativa");
}

// Altera a função existente para incluir o fundo especial
function editarAgendamento(index) {
    const agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];
    const ag = agendamentos[index];

    document.getElementById("editarNome").value = ag.nome;
    document.getElementById("editarEmail").value = ag.email;
    document.getElementById("editarData").value = ag.dia;
    document.getElementById("editarHorario").value = ag.horario;

    indiceEditando = index;
    document.getElementById("editarPopup").style.display = "flex";

    aplicarFundoEdicao(); // Aplica o fundo
}

function reativarAgendamento(index) {
    const agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];

    agendamentos[index].cancelado = false;

    localStorage.setItem("agendamentos", JSON.stringify(agendamentos));
    carregarAgendamentos();
    mostrarAlerta("Agendamento reativado com sucesso!", "sucesso");
}

document.querySelector('.login-popup').style.display = 'flex';

function apagarTodosAgendamentos() {
    Swal.fire({
        title: "Confirmação",
        text: "Tem certeza que deseja apagar todos os agendamentos?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc3545",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Sim, apagar!",
        cancelButtonText: "Cancelar"
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem("agendamentos"); // Remove todos os agendamentos
            carregarAgendamentos(); // Atualiza a tela para refletir a mudança
            Swal.fire("Pronto!", "Todos os agendamentos foram apagados.", "success");
        }
    });
}

function apagarAgendamentosAtivos() {
    Swal.fire({
        title: "Confirmação",
        text: "Tem certeza que deseja apagar apenas os agendamentos ativos?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc3545",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Sim, apagar!",
        cancelButtonText: "Cancelar"
    }).then((result) => {
        if (result.isConfirmed) {
            const agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];

            const somenteCancelados = agendamentos.filter(ag => ag.cancelado);

            localStorage.setItem("agendamentos", JSON.stringify(somenteCancelados));
            carregarAgendamentos();

            Swal.fire("Pronto!", "Todos os agendamentos ativos foram apagados.", "success");
        }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const mesAtual = new Date().getMonth() + 1; // Obtém o mês atual (1-12)
    document.getElementById("mesRelatorio").value = mesAtual;
});

function exportarRelatorioExcel() {
    const ano = document.getElementById("anoRelatorio").value;
    const mes = document.getElementById("mesRelatorio").value;

    const mesesNome = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const nomeMes = mesesNome[parseInt(mes) - 1];

    const agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];

    const dados = agendamentos.filter(ag => {
        const [dia, mesAgendamento, anoAgendamento] = ag.dia.split("/");
        return parseInt(mesAgendamento) === parseInt(mes) && anoAgendamento === ano;
    });

    if (dados.length === 0) {
        if (dados.length === 0) {
            Swal.fire({
                icon: "info",
                title: "Nenhum agendamento encontrado",
                text: `Não há agendamentos registrados para ${nomeMes} de ${ano}.`,
                confirmButtonColor: "#007bff",
                confirmButtonText: "OK"
            });
            return;
        }
    }

    const worksheet = XLSX.utils.json_to_sheet(dados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatorio_Agendamentos");

    XLSX.writeFile(workbook, `Relatorio_${nomeMes}_${ano}.xlsx`);
}

function abrirPopupConsulta() {
    document.getElementById("popupConsultaAgendamento").style.display = "flex";
}

function fecharConsulta() {
    document.getElementById("popupConsultaAgendamento").style.display = "none";
}

function consultarAgendamento() {
    const nome = document.getElementById("consultaNome").value.trim();
    const email = document.getElementById("consultaEmail").value.trim();

    if (!nome || !email) {
        Swal.fire("Atenção!", "Preencha o nome e o e-mail para consultar.", "warning");
        return;
    }

    const agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];
    const resultados = agendamentos.filter(ag => ag.nome === nome && ag.email === email);

    const resultadoDiv = document.getElementById("resultadoConsulta");
    resultadoDiv.innerHTML = "";

    if (resultados.length === 0) {
        resultadoDiv.innerHTML = `<p style="color: red;">Nenhum agendamento encontrado.</p>`;
        document.getElementById("botaoComprovanteContainer").style.display = "none";
    } else {
        resultados.forEach(ag => {
            resultadoDiv.innerHTML += `
                <p><strong>Data:</strong> ${ag.dia}</p>
                <p><strong>Horário:</strong> ${ag.horario}</p>
                <hr>
            `;
        });

        document.getElementById("botaoComprovanteContainer").style.display = "flex";
    }

    resultadoDiv.style.display = "block";
}


function gerarComprovante() {
    const nome = document.getElementById("consultaNome").value.trim();
    const email = document.getElementById("consultaEmail").value.trim();
    const resultadoDiv = document.getElementById("resultadoConsulta");

    if (!nome || !email || resultadoDiv.innerHTML.trim() === "") {
        Swal.fire("Erro!", "Nenhum agendamento encontrado para gerar comprovante.", "error");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFont("helvetica");
    doc.setFontSize(14);
    doc.text("Comprovante de Agendamento", 20, 20);
    doc.setFontSize(12);
    doc.text(`Nome: ${nome}`, 20, 40);
    doc.text(`Email: ${email}`, 20, 50);
    doc.text("Detalhes:", 20, 60);

    let y = 70;
    resultadoDiv.querySelectorAll("p").forEach(p => {
        doc.text(p.innerText, 20, y);
        y += 10;
    });

    doc.save(`Comprovante_${nome}.pdf`);
}

document.getElementById("terceirosForm").classList.add("mostrar");

function salvarAgendamento() {
    if (!agendamentoPendente) return;

    let agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];
    agendamentos.push(agendamentoPendente);
    localStorage.setItem("agendamentos", JSON.stringify(agendamentos));

    mostrarAlerta(`Agendamento confirmado para ${agendamentoPendente.nome} em ${agendamentoPendente.dia} às ${agendamentoPendente.horario}`, "sucesso");

    document.getElementById("nome").value = "";
    document.getElementById("email").value = "";
    document.getElementById("horarioSelecionado").value = "";
    localStorage.removeItem("diaSelecionado");

    document.getElementById("grade-horarios").innerHTML = ""; // limpa os botões de horário

    clearTimeout(temporizadorConfirmacao);
    horarioTemporariamenteReservado = null;
    atualizarHorariosDisponiveis(agendamentoPendente.dia);

    agendamentoPendente = null;
    fecharPopupCodigo();
}

function verificarCodigoDigitado() {
    const codigo = document.getElementById("codigoConfirmacao").value.trim();
    const email = agendamentoPendente?.email;

    if (!codigo || !email) {
        mostrarAlerta("Preencha o código corretamente.", "erro");
        return;
    }

    fetch("http://localhost:3001/verificar-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, codigo })
    })
        .then(async res => {
            const data = await res.json();
            console.log("🟢 RESPOSTA DO BACKEND:", data); // <-- Adiciona isso

            if (res.ok && data.sucesso) {
                salvarAgendamento();

                document.getElementById("contador-tempo").style.display = "none";
                clearInterval(intervaloContador);
            } else {
                mostrarAlerta(data.mensagem || "Código inválido.", "erro");
            }
        })
        .catch(err => {
            console.error("❌ Erro ao verificar código:", err);
            mostrarAlerta("Erro ao se conectar com o servidor.", "erro");
        });
}

function fecharPopupCodigo() {
    document.getElementById("popupCodigo").style.display = "none";
}

function excluirAgendamento(index) {
    Swal.fire({
        title: "Excluir agendamento?",
        text: "Essa ação não pode ser desfeita!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc3545",
        cancelButtonColor: "#aaa",
        confirmButtonText: "Sim, excluir",
        cancelButtonText: "Cancelar"
    }).then((result) => {
        if (result.isConfirmed) {
            let agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];
            agendamentos.splice(index, 1); // Remove o agendamento do índice
            localStorage.setItem("agendamentos", JSON.stringify(agendamentos));
            carregarAgendamentos(); // Atualiza a lista na tela

            Swal.fire("Excluído!", "O agendamento foi removido.", "success");
        }
    });
}

function reenviarCodigo() {
    if (!agendamentoPendente) {
        mostrarAlerta("Erro: Nenhum agendamento pendente.", "erro");
        return;
    }

    const { email, nome, dia, horario } = agendamentoPendente;

    fetch("http://localhost:3001/enviar-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nome, dia, horario })
    })
        .then(response => {
            if (response.ok) {
                mostrarAlerta("Código reenviado para o e-mail!", "sucesso");
                iniciarContadorConfirmacao(); // Reinicia a contagem
            } else {
                mostrarAlerta("Erro ao reenviar código.", "erro");
            }
        })
        .catch(error => {
            console.error("❌ Erro ao reenviar código:", error);
            mostrarAlerta("Erro de conexão ao reenviar código.", "erro");
        });
}

function gerarRelatorioDia() {
    const dataSelecionada = document.getElementById("dataRelatorioDia").value;

    if (!dataSelecionada) {
        Swal.fire("Erro", "Por favor, selecione uma data.", "warning");
        return;
    }

    const agendamentos = JSON.parse(localStorage.getItem("agendamentos")) || [];

    const dataFormatada = dataSelecionada.split("-").reverse().join("/");

    const dados = agendamentos.filter(ag => ag.dia === dataFormatada);

    if (dados.length === 0) {
        Swal.fire("Sem registros", `Não há agendamentos em ${dataFormatada}.`, "info");
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dados);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatorio_Dia");

    XLSX.writeFile(workbook, `Relatorio_${dataFormatada}.xlsx`);
}
