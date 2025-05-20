require('dotenv').config();
console.log("📧 EMAIL_USER carregado:", process.env.EMAIL_USER);

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const codigos = {};

app.use(cors());
app.use(express.json());

// Configuração do e-mail (Office 365)
const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        ciphers: 'SSLv3'
    }
});

app.use((req, res, next) => {
    console.log(`➡️ Requisição recebida: ${req.method} ${req.url}`);
    next();
});

function converterParaOutlookFormato(data, horario, duracaoMinutos = 20) {
    const [dia, mes, ano] = data.split("/");
    const [hora, minuto] = horario.split(":");

    // ✅ Sem o "Z" (UTC)
    const inicio = new Date(`${ano}-${mes}-${dia}T${hora}:${minuto}:00`);
    const fim = new Date(inicio.getTime() + duracaoMinutos * 60000);

    return {
        inicio: inicio.toISOString(),
        fim: fim.toISOString()
    };
}

// Enviar código por e-mail
app.post('/enviar-codigo', (req, res) => {
    const { email, nome, dia, horario } = req.body;

    if (!email) {
        console.warn("⚠️ Nenhum e-mail recebido!");
        return res.status(400).send("E-mail é obrigatório.");
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    codigos[email] = codigo;

    console.log("📨 Enviando código para:", email);
    console.log("🔐 Código gerado:", codigo);

    const { inicio, fim } = converterParaOutlookFormato(dia, horario);

    const assunto = encodeURIComponent("Agendamento de Massagem");
    const descricao = encodeURIComponent(`Agendamento de Massagem confirmado para ${nome} em ${dia} às ${horario}.`);

    const linkOutlook = `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${assunto}&body=${descricao}&startdt=${inicio}&enddt=${fim}&allday=false&timezone=America/Sao_Paulo`;

    const mailOptions = {
        from: `"Massagem RH" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Código de Confirmação - Massagem',
        html: `
            <p>Olá <strong>${nome}</strong>,</p>
            <p>Seu código de confirmação para o agendamento é:</p>
            <h2 style="color:#024a7a;">${codigo}</h2>
            <hr>
            <p><strong>Dados do Agendamento:</strong></p>
            <ul>
                <li><strong>Nome:</strong> ${nome}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Data:</strong> ${dia}</li>
                <li><strong>Horário:</strong> ${horario}</li>
            </ul>
            <p>
                <a href="${linkOutlook}" 
                    style="background-color:#0078D4;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;" 
                    target="_blank">
                    Adicionar no calendário do Outlook
                </a>
            </p>
            <p>Insira esse código no site para confirmar seu agendamento.</p>
            <br>
            <p style="font-size:12px; color:#777;">Não responda este e-mail.</p>
        `

    };



    console.log("🧪 Corpo do email sendo enviado:");
    console.log(mailOptions.html);
     

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("❌ Erro ao enviar e-mail:", error);
            return res.status(500).send("Erro ao enviar e-mail.");
        }

        console.log("✅ E-mail enviado:", info.response);
        res.send("Código enviado com sucesso.");
    });
});

// Verificar código informado
app.post('/verificar-codigo', (req, res) => {
    const { email, codigo } = req.body;

    if (codigos[email] === codigo) {
        delete codigos[email];
        return res.status(200).json({ sucesso: true, mensagem: "Código verificado com sucesso!" });
    }

    res.status(400).json({ sucesso: false, mensagem: "Código inválido." });
});

// === ENDPOINTS DE LIBERAÇÃO DE MÊS ===

const caminhoLiberacao = path.join(__dirname, 'liberacao_mes.json');

// Salvar liberação de mês
app.post('/salvar-liberacao', (req, res) => {
    const { mes, ano } = req.body;

    if (!mes || !ano) {
        return res.status(400).send("Mês e ano são obrigatórios.");
    }

    const dados = { mes, ano };

    fs.writeFile(caminhoLiberacao, JSON.stringify(dados, null, 2), (err) => {
        if (err) {
            console.error("❌ Erro ao salvar liberação:", err);
            return res.status(500).send("Erro ao salvar liberação.");
        }

        console.log("✅ Liberação salva com sucesso:", dados);
        res.status(200).send("Liberação salva com sucesso.");
    });
});

// Obter liberação de mês
app.get('/obter-liberacao', (req, res) => {
    fs.readFile(caminhoLiberacao, 'utf8', (err, data) => {
        if (err) {
            console.error("⚠️ Erro ao ler liberação:", err);
            return res.status(404).send("Nenhuma liberação encontrada.");
        }

        try {
            const dados = JSON.parse(data);
            res.status(200).json(dados);
        } catch (parseError) {
            console.error("❌ Erro ao parsear JSON:", parseError);
            res.status(500).send("Erro ao ler liberação.");
        }
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

app.get("/feriados", (req, res) => {
    const caminho = path.join(__dirname, "feriados.json");

    if (!fs.existsSync(caminho)) {
        return res.json([]);
    }

    const feriados = JSON.parse(fs.readFileSync(caminho, "utf-8"));
    res.json(feriados);
});
