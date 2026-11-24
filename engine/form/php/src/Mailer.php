<?php
declare(strict_types=1);

namespace Factory\Form;

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;

/**
 * Transport SMTP authentifié (PHPMailer). Pas de `mail()` local.
 * Le succès signifie « message ACCEPTÉ par le serveur SMTP » — ni livré,
 * ni lu. Les identifiants viennent de variables d'environnement dont seuls
 * les NOMS figurent dans la configuration de la release.
 */
final class Mailer
{
    /** @param array{host:string,port:int,security:string,usernameEnv:string,passwordEnv:string,timeout:int} $smtp */
    public function __construct(private readonly array $smtp)
    {
    }

    /** @throws \RuntimeException avec un code public stable */
    public function send(string $from, string $fromName, string $to, string $replyTo, string $subject, string $body): void
    {
        $user = getenv($this->smtp['usernameEnv']);
        $pass = getenv($this->smtp['passwordEnv']);
        if (!is_string($user) || $user === '' || !is_string($pass) || $pass === '') {
            throw new \RuntimeException('transport_not_configured');
        }
        $m = new PHPMailer(true);
        try {
            $m->isSMTP();
            $m->Host = $this->smtp['host'];
            $m->Port = $this->smtp['port'];
            $m->SMTPAuth = true;
            $m->Username = $user;
            $m->Password = $pass;
            $m->Timeout = $this->smtp['timeout'];
            $m->SMTPAutoTLS = false;
            $m->SMTPSecure = match ($this->smtp['security']) {
                'tls' => PHPMailer::ENCRYPTION_SMTPS,
                'starttls' => PHPMailer::ENCRYPTION_STARTTLS,
                default => '',
            };
            $m->CharSet = PHPMailer::CHARSET_UTF8;
            $m->Encoding = PHPMailer::ENCODING_QUOTED_PRINTABLE;
            $m->setFrom($from, $fromName, false);
            $m->addAddress($to);
            $m->addReplyTo($replyTo);
            $m->Subject = $subject;
            $m->isHTML(false);
            $m->Body = $body;
            $m->XMailer = ' ';
            $m->send();
        } catch (MailException $e) {
            // Détail technique réservé au journal protégé, jamais renvoyé au visiteur.
            throw new \RuntimeException('transport_error', 0, $e);
        }
    }
}
