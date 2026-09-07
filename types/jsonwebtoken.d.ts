declare module 'jsonwebtoken' {
  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: string,
    options?: object
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: string,
    options?: object
  ): any;
}