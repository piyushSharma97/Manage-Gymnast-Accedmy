/** reCAPTCHA global types */
export type ReCaptchaInstance = {
  ready: (callback: () => void) => void;
  render: (
    container: HTMLElement,
    config: { sitekey: string; size: string; theme: string },
  ) => number;
  reset: (id: number) => void;
  getResponse: (id: number) => string;
};

declare global {
  interface Window {
    grecaptcha?: ReCaptchaInstance;
    onRecaptchaLoaded?: () => void;
  }
}

export {};
