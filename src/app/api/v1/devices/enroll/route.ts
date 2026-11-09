import { noContent, route } from '@/server/http/handler';
import { ApiError } from '@/server/http/errors';
import { enrollDevice, redeemPairingCode } from '@/server/auth/device';
import { verifySetupToken } from '@/server/auth/setup-token';
import { enrollDeviceSchema } from '@/server/validation/profile';

export const POST = route({ body: enrollDeviceSchema, public: true }, async (ctx, { body }) => {
  if (body.setupToken) {
    if (!verifySetupToken(ctx, body.setupToken)) throw new ApiError('FORBIDDEN', 'Token de configuración incorrecto.');
    enrollDevice(ctx, 'setup_token', body.label);
  } else {
    const issuer = await redeemPairingCode(ctx, body.pairingCode!);
    if (!issuer) throw new ApiError('FORBIDDEN', 'Código de emparejamiento incorrecto o vencido.');
    enrollDevice(ctx, 'pairing_code', body.label, issuer);
  }
  return noContent();
});
