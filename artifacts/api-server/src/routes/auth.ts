import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "../lib/supabase";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { isAllowedCountry } from "../lib/eu-countries";

const router: IRouter = Router();

const RESET_LANGS = ["fr", "en", "nl", "de", "es", "it", "pt", "pl", "ro", "sv", "da", "fi", "hu", "cs", "tr", "ja", "ko", "vi", "th", "id", "ms", "el", "uk", "et", "zh", "zh-TW", "lt", "sr", "ru", "he", "ar", "hr", "sk", "sl", "lv", "mt", "bg"] as const;
type ResetLang = (typeof RESET_LANGS)[number];

function resetEmailCopy(lang: ResetLang) {
  switch (lang) {
    case "en":
      return {
        tagline: "Email Autopilot for SMBs",
        heading: "Reset your password",
        body: "You requested a password reset for your Inboria account. Click the button below to choose a new password. This link expires in 1 hour.",
        cta: "Reset my password",
        footer: "If you did not request this, you can safely ignore this email — your password will not change.",
        subject: "Reset your Inboria password",
      };
    case "nl":
      return {
        tagline: "Email Autopilot voor KMO's",
        heading: "Wachtwoord opnieuw instellen",
        body: "U heeft het opnieuw instellen van uw Inboria-wachtwoord aangevraagd. Klik op de knop hieronder om een nieuw wachtwoord te kiezen. Deze link verloopt over 1 uur.",
        cta: "Mijn wachtwoord resetten",
        footer: "Als u dit niet heeft aangevraagd, kunt u deze e-mail negeren — uw wachtwoord blijft ongewijzigd.",
        subject: "Stel uw Inboria-wachtwoord opnieuw in",
      };
    case "de":
      return {
        tagline: "E-Mail-Autopilot für KMU",
        heading: "Passwort zurücksetzen",
        body: "Sie haben das Zurücksetzen Ihres Inboria-Passworts angefordert. Klicken Sie auf die Schaltfläche unten, um ein neues Passwort festzulegen. Dieser Link ist 1 Stunde gültig.",
        cta: "Mein Passwort zurücksetzen",
        footer: "Wenn Sie dies nicht angefordert haben, können Sie diese E-Mail ignorieren — Ihr Passwort bleibt unverändert.",
        subject: "Setzen Sie Ihr Inboria-Passwort zurück",
      };
    case "es":
      return {
        tagline: "Email Autopilot para PyMEs",
        heading: "Restablecer su contraseña",
        body: "Ha solicitado restablecer la contraseña de su cuenta Inboria. Haga clic en el botón a continuación para elegir una nueva contraseña. Este enlace caduca en 1 hora.",
        cta: "Restablecer mi contraseña",
        footer: "Si no ha realizado esta solicitud, puede ignorar este correo — su contraseña no se modificará.",
        subject: "Restablezca su contraseña de Inboria",
      };
    case "it":
      return {
        tagline: "Email Autopilot per le PMI",
        heading: "Reimposta la sua password",
        body: "Ha richiesto la reimpostazione della password del suo account Inboria. Clicchi sul pulsante qui sotto per scegliere una nuova password. Questo link scade tra 1 ora.",
        cta: "Reimposta la mia password",
        footer: "Se non ha effettuato questa richiesta, puo ignorare questa email — la sua password non verra modificata.",
        subject: "Reimposti la sua password Inboria",
      };
    case "pt":
      return {
        tagline: "Email Autopilot para PMEs",
        heading: "Redefinir a sua palavra-passe",
        body: "Solicitou a redefinição da palavra-passe da sua conta Inboria. Clique no botão abaixo para escolher uma nova palavra-passe. Este link expira em 1 hora.",
        cta: "Redefinir a minha palavra-passe",
        footer: "Se não foi você quem fez este pedido, pode ignorar este email — a sua palavra-passe não será alterada.",
        subject: "Redefina a sua palavra-passe Inboria",
      };
    case "pl":
      return {
        tagline: "Email Autopilot dla MŚP",
        heading: "Zresetuj swoje hasło",
        body: "Otrzymaliśmy prośbę o zresetowanie hasła do Pana/Pani konta Inboria. Proszę kliknąć przycisk poniżej, aby wybrać nowe hasło. Ten link wygasa za 1 godzinę.",
        cta: "Zresetuj moje hasło",
        footer: "Jeśli to nie Pan/Pani złożył(a) tę prośbę, można zignorować tę wiadomość — hasło pozostanie bez zmian.",
        subject: "Zresetuj swoje hasło Inboria",
      };
    case "ro":
      return {
        tagline: "Email Autopilot pentru IMM-uri",
        heading: "Resetați-vă parola",
        body: "Ați solicitat resetarea parolei pentru contul dumneavoastră Inboria. Vă rugăm să faceți clic pe butonul de mai jos pentru a alege o parolă nouă. Acest link expiră în 1 oră.",
        cta: "Resetați-mi parola",
        footer: "Dacă nu dumneavoastră ați făcut această solicitare, puteți ignora acest email — parola va rămâne neschimbată.",
        subject: "Resetați-vă parola Inboria",
      };
    case "sv":
      return {
        tagline: "Email Autopilot för små och medelstora företag",
        heading: "Återställ ditt lösenord",
        body: "Du har begärt återställning av lösenordet för ditt Inboria-konto. Klicka på knappen nedan för att välja ett nytt lösenord. Denna länk går ut om 1 timme.",
        cta: "Återställ mitt lösenord",
        footer: "Om du inte gjorde denna begäran kan du ignorera detta meddelande — ditt lösenord förblir oförändrat.",
        subject: "Återställ ditt Inboria-lösenord",
      };
    case "da":
      return {
        tagline: "Email Autopilot for SMV'er",
        heading: "Nulstil din adgangskode",
        body: "Du har anmodet om nulstilling af adgangskoden til din Inboria-konto. Klik på knappen nedenfor for at vælge en ny adgangskode. Dette link udløber om 1 time.",
        cta: "Nulstil min adgangskode",
        footer: "Hvis du ikke har anmodet om dette, kan du ignorere denne besked — din adgangskode forbliver uændret.",
        subject: "Nulstil din Inboria-adgangskode",
      };
    case "fi":
      return {
        tagline: "Email Autopilot pk-yrityksille",
        heading: "Nollatkaa salasananne",
        body: "Olette pyytänyt Inboria-tilinne salasanan nollausta. Klikatkaa alla olevaa painiketta valitaksenne uuden salasanan. Tämä linkki vanhenee 1 tunnin kuluttua.",
        cta: "Nollaa salasanani",
        footer: "Jos ette tehnyt tätä pyyntöä, voitte jättää tämän viestin huomiotta — salasananne pysyy muuttumattomana.",
        subject: "Nollatkaa Inboria-salasananne",
      };
    case "hu":
      return {
        tagline: "Email Autopilot kkv-knak",
        heading: "Jelszó visszaállítása",
        body: "Ön az Inboria-fiókja jelszavának visszaállítását kérte. Kérjük, kattintson az alábbi gombra új jelszó választásához. Ez a hivatkozás 1 óra múlva lejár.",
        cta: "Jelszavam visszaállítása",
        footer: "Ha nem Ön kérte ezt, nyugodtan figyelmen kívül hagyhatja ezt az emailt — a jelszava nem változik meg.",
        subject: "Állítsa vissza Inboria-jelszavát",
      };
    case "cs":
      return {
        tagline: "Email Autopilot pro malé a střední podniky",
        heading: "Obnovte své heslo",
        body: "Požádali jste o obnovení hesla k vašemu účtu Inboria. Klikněte prosím na tlačítko níže pro výběr nového hesla. Tento odkaz vyprší za 1 hodinu.",
        cta: "Obnovit mé heslo",
        footer: "Pokud jste tuto žádost neodeslali, můžete tuto zprávu ignorovat — vaše heslo zůstane nezměněno.",
        subject: "Obnovte své heslo Inboria",
      };
    case "tr":
      return {
        tagline: "KOBİ'ler için Email Autopilot",
        heading: "Şifrenizi sıfırlayın",
        body: "Inboria hesabınızın şifresinin sıfırlanmasını talep ettiniz. Yeni bir şifre seçmek için lütfen aşağıdaki düğmeye tıklayın. Bu bağlantı 1 saat içinde sona erer.",
        cta: "Şifremi sıfırla",
        footer: "Bu talebi siz yapmadıysanız, bu mesajı yok sayabilirsiniz — şifreniz değişmeden kalacaktır.",
        subject: "Inboria şifrenizi sıfırlayın",
      };
    case "ja":
      return {
        tagline: "中小企業向けメール自動操縦",
        heading: "パスワードをリセット",
        body: "Inboria アカウントのパスワードリセットをリクエストされました。新しいパスワードを選択するには、下のボタンをクリックしてください。このリンクは1時間で期限切れになります。",
        cta: "パスワードをリセットする",
        footer: "このリクエストに心当たりがない場合は、このメールを無視してください。パスワードは変更されません。",
        subject: "Inboria のパスワードをリセット",
      };
    case "ko":
      return {
        tagline: "중소기업을 위한 이메일 자동 조종",
        heading: "비밀번호 재설정",
        body: "Inboria 계정의 비밀번호 재설정을 요청하셨습니다. 새 비밀번호를 선택하시려면 아래 버튼을 클릭하십시오. 이 링크는 1시간 후에 만료됩니다.",
        cta: "비밀번호 재설정",
        footer: "이 요청을 직접 하지 않으셨다면, 이 이메일을 무시하셔도 됩니다 — 비밀번호는 변경되지 않습니다.",
        subject: "Inboria 비밀번호 재설정",
      };
    case "vi":
      return {
        tagline: "Email Autopilot cho doanh nghiệp vừa và nhỏ",
        heading: "Đặt lại mật khẩu của Quý khách",
        body: "Quý khách đã yêu cầu đặt lại mật khẩu cho tài khoản Inboria. Vui lòng nhấn vào nút bên dưới để chọn mật khẩu mới. Liên kết này sẽ hết hạn sau 1 giờ.",
        cta: "Đặt lại mật khẩu",
        footer: "Nếu Quý khách không gửi yêu cầu này, vui lòng bỏ qua email này — mật khẩu của Quý khách sẽ không thay đổi.",
        subject: "Đặt lại mật khẩu Inboria",
      };
    case "th":
      return {
        tagline: "Email Autopilot สำหรับธุรกิจขนาดกลางและขนาดย่อม",
        heading: "รีเซ็ตรหัสผ่านของท่าน",
        body: "ท่านได้ขอรีเซ็ตรหัสผ่านสำหรับบัญชี Inboria โปรดคลิกที่ปุ่มด้านล่างเพื่อเลือกรหัสผ่านใหม่ ลิงก์นี้จะหมดอายุภายใน 1 ชั่วโมง",
        cta: "รีเซ็ตรหัสผ่าน",
        footer: "หากท่านไม่ได้ส่งคำขอนี้ โปรดเพิกเฉยต่ออีเมลฉบับนี้ — รหัสผ่านของท่านจะไม่ถูกเปลี่ยนแปลง",
        subject: "รีเซ็ตรหัสผ่าน Inboria ของท่าน",
      };
    case "id":
      return {
        tagline: "Email Autopilot untuk UKM",
        heading: "Atur ulang kata sandi Anda",
        body: "Anda telah meminta pengaturan ulang kata sandi untuk akun Inboria Anda. Silakan klik tombol di bawah ini untuk memilih kata sandi baru. Tautan ini akan kedaluwarsa dalam 1 jam.",
        cta: "Atur ulang kata sandi saya",
        footer: "Jika Anda tidak membuat permintaan ini, silakan abaikan email ini — kata sandi Anda tidak akan berubah.",
        subject: "Atur ulang kata sandi Inboria Anda",
      };
    case "ms":
      return {
        tagline: "Email Autopilot untuk PKS",
        heading: "Tetapkan semula kata laluan anda",
        body: "Anda telah meminta untuk menetapkan semula kata laluan akaun Inboria anda. Sila klik butang di bawah untuk memilih kata laluan baharu. Pautan ini akan tamat tempoh dalam masa 1 jam.",
        cta: "Tetapkan semula kata laluan saya",
        footer: "Jika anda tidak membuat permintaan ini, sila abaikan e-mel ini — kata laluan anda tidak akan berubah.",
        subject: "Tetapkan semula kata laluan Inboria anda",
      };
    case "el":
      return {
        tagline: "Email Autopilot για ΜμΕ",
        heading: "Επαναφορά του κωδικού πρόσβασής σας",
        body: "Ζητήσατε την επαναφορά του κωδικού πρόσβασης για τον λογαριασμό σας στο Inboria. Παρακαλώ κάντε κλικ στο παρακάτω κουμπί για να επιλέξετε νέο κωδικό πρόσβασης. Αυτός ο σύνδεσμος θα λήξει σε 1 ώρα.",
        cta: "Επαναφορά του κωδικού μου",
        footer: "Εάν δεν υποβάλατε αυτό το αίτημα, αγνοήστε αυτό το email — ο κωδικός πρόσβασής σας δεν θα αλλάξει.",
        subject: "Επαναφορά του κωδικού Inboria σας",
      };
    case "uk":
      return {
        tagline: "Email Autopilot для МСП",
        heading: "Скиньте Ваш пароль",
        body: "Ви запросили скидання пароля для Вашого облікового запису Inboria. Будь ласка, натисніть кнопку нижче, щоб обрати новий пароль. Це посилання діє протягом 1 години.",
        cta: "Скинути мій пароль",
        footer: "Якщо Ви не надсилали цього запиту, проігноруйте цей лист — Ваш пароль залишиться без змін.",
        subject: "Скидання пароля Inboria",
      };
    case "et":
      return {
        tagline: "E-posti autopilot VKEde jaoks",
        heading: "Lähtestage oma parool",
        body: "Te taotlesite oma Inboria konto parooli lähtestamist. Palun klõpsake allpool oleval nupul, et valida uus parool. See link kehtib 1 tunni.",
        cta: "Lähtesta minu parool",
        footer: "Kui Te ei ole seda taotlust esitanud, ignoreerige seda e-kirja — Teie parool jääb muutumatuks.",
        subject: "Lähtestage oma Inboria parool",
      };
    case "zh":
      return {
        tagline: "面向中小企业的邮件自动驾驶",
        heading: "重置您的密码",
        body: "您请求重置 Inboria 账户的密码。请点击下方按钮以选择新密码。此链接将在 1 小时后失效。",
        cta: "重置我的密码",
        footer: "如果您并未发起此请求,请忽略此邮件——您的密码将保持不变。",
        subject: "重置您的 Inboria 密码",
      };
    case "zh-TW":
      return {
        tagline: "面向中小企業的郵件自動駕駛",
        heading: "重設您的密碼",
        body: "您要求重設 Inboria 帳戶的密碼。請點擊下方按鈕以選擇新密碼。此連結將在 1 小時後失效。",
        cta: "重設我的密碼",
        footer: "如果您並未發起此要求,請忽略此郵件——您的密碼將保持不變。",
        subject: "重設您的 Inboria 密碼",
      };
    case "lt":
      return {
        tagline: "El. pašto autopilotas MVĮ",
        heading: "Iš naujo nustatykite savo slaptažodį",
        body: "Jūs paprašėte iš naujo nustatyti savo Inboria paskyros slaptažodį. Spustelėkite žemiau esantį mygtuką, kad pasirinktumėte naują slaptažodį. Ši nuoroda galioja 1 valandą.",
        cta: "Iš naujo nustatyti slaptažodį",
        footer: "Jei šios užklausos nepateikėte Jūs, ignoruokite šį laišką — Jūsų slaptažodis nepasikeis.",
        subject: "Iš naujo nustatykite savo Inboria slaptažodį",
      };
    case "sr":
      return {
        tagline: "Аутопилот за е-пошту за МСП",
        heading: "Поново поставите Вашу лозинку",
        body: "Захтевали сте поновно постављање лозинке за Ваш Inboria налог. Кликните на дугме испод да изаберете нову лозинку. Ова веза истиче за 1 сат.",
        cta: "Поново постави лозинку",
        footer: "Ако нисте Ви послали овај захтев, занемарите ову поруку — Ваша лозинка ће остати непромењена.",
        subject: "Поново поставите Вашу Inboria лозинку",
      };
    case "ru":
      return {
        tagline: "Email-автопилот для МСП",
        heading: "Сброс Вашего пароля",
        body: "Вы запросили сброс пароля для Вашего аккаунта Inboria. Нажмите на кнопку ниже, чтобы выбрать новый пароль. Эта ссылка действительна в течение 1 часа.",
        cta: "Сбросить мой пароль",
        footer: "Если Вы не отправляли этот запрос, проигнорируйте это письмо — Ваш пароль останется без изменений.",
        subject: "Сбросьте Ваш пароль Inboria",
      };
    case "he":
      return {
        tagline: "טייס אוטומטי לדואר אלקטרוני לעסקים קטנים ובינוניים",
        heading: "איפוס הסיסמה שלך",
        body: "ביקשת לאפס את הסיסמה לחשבון Inboria שלך. לחץ על הכפתור למטה כדי לבחור סיסמה חדשה. הקישור תקף למשך שעה אחת.",
        cta: "אפס את הסיסמה שלי",
        footer: "אם לא ביקשת זאת, אנא התעלם מהודעה זו — הסיסמה שלך תישאר ללא שינוי.",
        subject: "אפס את סיסמת Inboria שלך",
      };
    case "ar":
      return {
        tagline: "الطيار الآلي للبريد الإلكتروني للشركات الصغيرة والمتوسطة",
        heading: "إعادة تعيين كلمة المرور الخاصة بكم",
        body: "لقد طلبتم إعادة تعيين كلمة المرور لحساب Inboria الخاص بكم. انقروا على الزر أدناه لاختيار كلمة مرور جديدة. هذا الرابط صالح لمدة ساعة واحدة.",
        cta: "إعادة تعيين كلمة المرور",
        footer: "إذا لم تكونوا قد قدّمتم هذا الطلب، فيرجى تجاهل هذه الرسالة — وستبقى كلمة المرور الخاصة بكم دون تغيير.",
        subject: "إعادة تعيين كلمة مرور Inboria الخاصة بكم",
      };
    case "hr":
      return {
        tagline: "Email Autopilot za MSP-ove",
        heading: "Resetiranje Vaše lozinke",
        body: "Zatražili ste resetiranje lozinke za Vaš Inboria račun. Kliknite gumb u nastavku za odabir nove lozinke. Ova poveznica vrijedi 1 sat.",
        cta: "Resetiraj moju lozinku",
        footer: "Ako niste Vi poslali ovaj zahtjev, zanemarite ovu poruku — Vaša lozinka ostat će nepromijenjena.",
        subject: "Resetirajte Vašu Inboria lozinku",
      };
    case "sk":
      return {
        tagline: "Email Autopilot pre MSP",
        heading: "Resetovanie Vášho hesla",
        body: "Požiadali ste o resetovanie hesla pre Váš účet Inboria. Kliknite na tlačidlo nižšie pre výber nového hesla. Tento odkaz je platný 1 hodinu.",
        cta: "Resetovať moje heslo",
        footer: "Ak ste túto žiadosť neposlali Vy, túto správu ignorujte — Vaše heslo zostane nezmenené.",
        subject: "Resetujte Vaše heslo Inboria",
      };
    case "sl":
      return {
        tagline: "Email Autopilot za MSP",
        heading: "Ponastavitev Vašega gesla",
        body: "Zahtevali ste ponastavitev gesla za Vaš račun Inboria. Kliknite spodnji gumb za izbiro novega gesla. Ta povezava velja 1 uro.",
        cta: "Ponastavi moje geslo",
        footer: "Če te zahteve niste poslali Vi, prosimo prezrite to sporočilo — Vaše geslo bo ostalo nespremenjeno.",
        subject: "Ponastavite Vaše geslo Inboria",
      };
    case "lv":
      return {
        tagline: "Email Autopilot MVU",
        heading: "Jūsu paroles atiestatīšana",
        body: "Jūs esat pieprasījis paroles atiestatīšanu Jūsu Inboria kontam. Noklikšķiniet uz zemāk esošās pogas, lai izvēlētos jaunu paroli. Šī saite ir derīga 1 stundu.",
        cta: "Atiestatīt manu paroli",
        footer: "Ja Jūs neesat iesniedzis šo pieprasījumu, lūdzu ignorējiet šo ziņu — Jūsu parole paliks nemainīta.",
        subject: "Atiestatiet Jūsu Inboria paroli",
      };
    case "mt":
      return {
        tagline: "Email Autopilot għall-SMEs",
        heading: "Reset tal-password Tagħkom",
        body: "Intom tlabtu reset tal-password għall-kont Inboria Tagħkom. Ikklikkjaw fuq il-buttuna t'hawn taħt biex tagħżlu password ġdida. Din il-link hija valida għal siegħa.",
        cta: "Irresetja l-password tiegħi",
        footer: "Jekk mhux Intom li bgħattu din it-talba, jekk jogħġobkom injoraw dan il-messaġġ — il-password Tagħkom se tibqa' bla bidla.",
        subject: "Irresetjaw il-password Inboria Tagħkom",
      };
    case "bg":
      return {
        tagline: "Email Autopilot за МСП",
        heading: "Възстановяване на Вашата парола",
        body: "Вие поискахте възстановяване на паролата за Вашия акаунт в Inboria. Кликнете върху бутона по-долу, за да изберете нова парола. Тази връзка е валидна 1 час.",
        cta: "Възстанови моята парола",
        footer: "Ако не сте Вие, който е изпратил тази заявка, моля игнорирайте това съобщение — Вашата парола ще остане непроменена.",
        subject: "Възстановете Вашата парола за Inboria",
      };
    default:
      return {
        tagline: "Email Autopilot pour PME",
        heading: "Réinitialisation de votre mot de passe",
        body: "Vous avez demandé la réinitialisation du mot de passe de votre compte Inboria. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans 1 heure.",
        cta: "Réinitialiser mon mot de passe",
        footer: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message — votre mot de passe restera inchangé.",
        subject: "Réinitialisez votre mot de passe Inboria",
      };
  }
}

function renderResetEmailHtml(actionUrl: string, lang: ResetLang): string {
  const t = resetEmailCopy(lang);
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0d1117; color: #ffffff; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2d7dd2; margin: 0;">Inboria</h1>
        <p style="color: #8b9cb3; margin-top: 5px;">${t.tagline}</p>
      </div>
      <h2 style="color: #ffffff; text-align: center;">${t.heading}</h2>
      <p style="color: #c9d1d9; line-height: 1.6;">${t.body}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${actionUrl}" style="background: #2d7dd2; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
          ${t.cta}
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #1f2937; margin: 20px 0;" />
      <p style="color: #6e7681; font-size: 12px; text-align: center;">${t.footer}</p>
    </div>
  `;
}

let cachedResetTransporter: nodemailer.Transporter | null = null;
function getResetTransporter(): nodemailer.Transporter | null {
  if (cachedResetTransporter) return cachedResetTransporter;
  const password = process.env["BREVO_SMTP_PASSWORD"];
  if (!password) return null;
  cachedResetTransporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: "a74939001@smtp-brevo.com",
      pass: password,
    },
  });
  return cachedResetTransporter;
}

router.post("/auth/send-password-reset", async (req, res): Promise<void> => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const redirectTo = String(req.body?.redirectTo || "");
    const langRaw = String(req.body?.lang || "fr").toLowerCase();
    const lang: ResetLang = (RESET_LANGS as readonly string[]).includes(langRaw)
      ? (langRaw as ResetLang)
      : "fr";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    if (!redirectTo || !/^https?:\/\//i.test(redirectTo)) {
      res.status(400).json({ error: "invalid_redirect" });
      return;
    }
    let redirectHost = "";
    try {
      redirectHost = new URL(redirectTo).hostname.toLowerCase();
    } catch {
      res.status(400).json({ error: "invalid_redirect" });
      return;
    }
    const productionHostSuffixes = ["inboria.com", "ncvmail.com"];
    const devHostSuffixes = ["replit.app", "replit.dev", "picard.replit.dev"];
    const allowedHostSuffixes =
      process.env["NODE_ENV"] === "production"
        ? productionHostSuffixes
        : [...productionHostSuffixes, ...devHostSuffixes];
    const isAllowedHost =
      (process.env["NODE_ENV"] !== "production" && redirectHost === "localhost") ||
      allowedHostSuffixes.some((s) => redirectHost === s || redirectHost.endsWith("." + s));
    if (!isAllowedHost) {
      res.status(400).json({ error: "invalid_redirect" });
      return;
    }

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      req.log.info(
        { email, err: linkErr?.message },
        "send-password-reset: no link generated (likely unknown email)",
      );
      res.status(200).json({ ok: true });
      return;
    }

    const transporter = getResetTransporter();
    if (!transporter) {
      req.log.error("BREVO_SMTP_PASSWORD missing — cannot send reset email");
      res.status(200).json({ ok: true });
      return;
    }

    try {
      const info = await transporter.sendMail({
        from: '"Inboria" <jj.neybergh@gmail.com>',
        to: email,
        subject: resetEmailCopy(lang).subject,
        html: renderResetEmailHtml(linkData.properties.action_link, lang),
      });
      req.log.info(
        {
          email,
          lang,
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
          envelope: info.envelope,
        },
        "send-password-reset: email handed off to Brevo",
      );
    } catch (sendErr: any) {
      req.log.error(
        { email, err: sendErr?.message },
        "send-password-reset: Brevo sendMail failed",
      );
    }

    res.status(200).json({ ok: true });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "send-password-reset: unexpected error");
    res.status(200).json({ ok: true });
  }
});

router.post("/auth/register", async (req, res): Promise<void> => {
  try {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { email, password, fullName, country } = parsed.data;

    if (!country || !isAllowedCountry(country)) {
      res.status(400).json({ error: "Inboria est actuellement disponible uniquement dans l'Union Europeenne, l'EEE et la Suisse." });
      return;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, country: country.toUpperCase() },
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (data.user) {
      const profileData: Record<string, unknown> = {
        id: data.user.id,
        full_name: fullName,
        plan: "essai",
        seats: 1,
        emails_used: 0,
        emails_quota: 100,
      };
      if (country) {
        profileData.country = country.toUpperCase();
      }
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(profileData);
      if (profileError && profileError.message?.includes("country")) {
        delete profileData.country;
        await supabaseAdmin.from("profiles").upsert(profileData);
      }
    }

    res.status(201).json({
      user: {
        id: data.user?.id,
        email: data.user?.email,
        fullName,
        plan: "essai",
        seats: 1,
        emailsUsed: 0,
        emailsQuota: 100,
        createdAt: data.user?.created_at,
      },
      session: (data as any).session,
    });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/auth/setup-profile", async (req, res): Promise<void> => {
  try {
    const { userId, fullName, country } = req.body;
    if (!userId) {
      res.status(400).json({ error: "userId requis" });
      return;
    }

    if (!country || !isAllowedCountry(country)) {
      res.status(400).json({ error: "Pays requis (UE/EEE/Suisse uniquement)." });
      return;
    }

    const profileData: Record<string, unknown> = {
      id: userId,
      full_name: fullName || "",
      plan: "essai",
      seats: 1,
      emails_used: 0,
      emails_quota: 100,
    };
    if (country) {
      profileData.country = country.toUpperCase();
    }

    const { error } = await supabaseAdmin.from("profiles").upsert(profileData);

    if (error) {
      console.error("Profile upsert error:", error.message, error.details, error.code);
      if (error.message?.includes("country")) {
        const { error: retryError } = await supabaseAdmin.from("profiles").upsert({
          id: userId,
          full_name: fullName || "",
          plan: "essai",
          seats: 1,
          emails_used: 0,
          emails_quota: 100,
        });
        if (retryError) {
          console.error("Profile upsert retry error:", retryError.message);
          res.status(500).json({ error: "Erreur lors de la creation du profil: " + retryError.message });
          return;
        }
      } else {
        res.status(500).json({ error: "Erreur lors de la creation du profil: " + error.message });
        return;
      }
    }

    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Profile setup failed" });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { email, password } = parsed.data;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ error: "Email ou mot de passe invalide" });
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: profile?.full_name || "",
        plan: profile?.plan ?? "essai",
        seats: profile?.seats ?? 1,
        emailsUsed: profile?.emails_used ?? 0,
        emailsQuota: profile?.emails_quota ?? 100,
        createdAt: data.user.created_at,
      },
      session: (data as any).session,
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", req.userId!)
      .single();

    const authHeader = req.headers.authorization!;
    const token = authHeader.slice(7);
    const { data: userData } = await supabaseAdmin.auth.getUser(token);

    res.json({
      id: req.userId,
      email: userData.user?.email || "",
      fullName: profile?.full_name || "",
      plan: profile?.plan ?? "essai",
      seats: profile?.seats ?? 1,
      emailsUsed: profile?.emails_used ?? 0,
      emailsQuota: profile?.emails_quota ?? 100,
      createdAt: userData.user?.created_at || "",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get user info" });
  }
});

export default router;
