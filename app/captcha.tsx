/** Google reCAPTCHA v2 checkbox. Renders nothing until RECAPTCHA_SITE_KEY is set. */
export function Captcha() {
  const key = process.env.RECAPTCHA_SITE_KEY;
  if (!key) return null;
  return (
    <>
      <script src="https://www.google.com/recaptcha/api.js" async defer />
      <div className="g-recaptcha" data-sitekey={key} />
    </>
  );
}
