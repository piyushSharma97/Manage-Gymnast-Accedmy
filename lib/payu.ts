import crypto from 'crypto';

/**
 * PayU India — SHA512 request hash (same pipe pattern as official PHP samples).
 * @see https://docs.payu.in/docs/checkout-integration
 */
export function payuRequestHash(params: {
  key: string;
  salt: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
}): string {
  const { key, salt, txnid, amount, productinfo, firstname, email } = params;
  const seq = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
  return crypto.createHash('sha512').update(seq).digest('hex');
}

/** Verify PayU response hash */
export function payuVerifyResponseHash(params: {
  salt: string;
  status: string;
  email: string;
  firstname: string;
  productinfo: string;
  amount: string;
  txnid: string;
  key: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  receivedHash: string;
}): boolean {
  const u1 = params.udf1 ?? '';
  const u2 = params.udf2 ?? '';
  const u3 = params.udf3 ?? '';
  const u4 = params.udf4 ?? '';
  const u5 = params.udf5 ?? '';
  const seq = `${params.salt}|${params.status}||||||||||${u5}|${u4}|${u3}|${u2}|${u1}|${params.email}|${params.firstname}|${params.productinfo}|${params.amount}|${params.txnid}|${params.key}`;
  const calc = crypto.createHash('sha512').update(seq).digest('hex');
  return calc.toLowerCase() === (params.receivedHash || '').toLowerCase();
}

export function payuPaymentBaseUrl(): string {
  const mode = process.env.PAYU_MODE?.toLowerCase();
  if (mode === 'test' || mode === 'sandbox') {
    return 'https://test.payu.in/_payment';
  }
  return 'https://secure.payu.in/_payment';
}
