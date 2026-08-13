import type { AppService } from '@/types/system';
import { stubTranslation as _ } from '@/utils/misc';

/**
 * Biometric unlock (Face ID / Touch ID) itself requires the native mobile
 * bridge, which the web build doesn't have — `getBiometricStatus` and
 * `authenticateWithBiometrics` are permanently "unavailable" stubs, and
 * `isBiometricSupported` is permanently unsupported now that the native
 * `isIOSApp`/`isAndroidApp` flags no longer exist on `AppService`. The
 * surrounding decision logic (`shouldAttemptBiometricUnlock`,
 * `defaultBiometricUnlockOnPinSet`, `getBiometryLabelKey`) is plain boolean
 * logic over caller-supplied flags — it's kept real rather than stubbed.
 */

export type BiometryType = 'none';

export const isBiometricSupported = (_appService: AppService | null): boolean => false;

export const getBiometricStatus = async (): Promise<{
  available: boolean;
  biometryType: BiometryType;
}> => ({ available: false, biometryType: 'none' });

export const authenticateWithBiometrics = async (_reason: string): Promise<boolean> => false;

export const shouldAttemptBiometricUnlock = (opts: {
  isMobileApp: boolean;
  biometricUnlockEnabled: boolean;
  available: boolean;
}): boolean => opts.isMobileApp && opts.biometricUnlockEnabled && opts.available;

export const defaultBiometricUnlockOnPinSet = (opts: {
  isMobileApp: boolean;
  available: boolean;
}): boolean => opts.isMobileApp && opts.available;

export const getBiometryLabelKey = (_biometryType: BiometryType): string => _('biometrics');
