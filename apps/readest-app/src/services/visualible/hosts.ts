import {
  VISUALIBLE_AWS_HOST,
  VISUALIBLE_FILE_HOST,
  VISUALIBLE_MARKETPLACE_HOST,
  VISUALIBLE_PIPELINE_HOST,
} from '@/services/constants';

export const getMarketplaceHost = () =>
  process.env['NEXT_PUBLIC_MARKETPLACE_HOST'] ?? VISUALIBLE_MARKETPLACE_HOST;

export const getAwsHost = () => process.env['NEXT_PUBLIC_AWS_HOST'] ?? VISUALIBLE_AWS_HOST;

export const getFileHost = () => process.env['NEXT_PUBLIC_FILE_HOST'] ?? VISUALIBLE_FILE_HOST;

export const getPipelineHost = () =>
  process.env['NEXT_PUBLIC_PIPELINE_HOST'] ?? VISUALIBLE_PIPELINE_HOST;
