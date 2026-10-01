import CaptchaClient from "./captcha-client";

/** Google reCAPTCHA v3 (invisible). Renders nothing until RECAPTCHA_SITE_KEY is set. The key must be a v3 key. */
export function Captcha({ action = "signup" }: { action?: string }) {
  const key = process.env.RECAPTCHA_SITE_KEY;
  return key ? <CaptchaClient siteKey={key} action={action} /> : null;
}
