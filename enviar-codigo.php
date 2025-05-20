<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'vendor/autoload.php';

$mail = new PHPMailer(true);

try {
    $mail->SMTPDebug = 2;
    $mail->Debugoutput = 'html';

    $mail->isSMTP();
    $mail->Host       = 'smtp.office365.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'seu-email@empresa.com.br';  // Office 365
    $mail->Password   = 'sua-senha-ou-senha-app';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = 587;

    $mail->setFrom('seu-email@empresa.com.br', 'Massagem');
    $mail->addAddress('seu-email@empresa.com.br'); // pode ser o mesmo, só pra teste

    $mail->isHTML(true);
    $mail->Subject = 'Teste com Office 365';
    $mail->Body    = 'Esse é um teste do PHPMailer usando Office 365.';

    $mail->send();
    echo 'Mensagem enviada com sucesso!';
} catch (Exception $e) {
    echo "Erro ao enviar: {$mail->ErrorInfo}";
}
