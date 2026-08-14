import { redirect, useRouter } from 'next/navigation';
import { isPWA } from '@/services/environment';
import { BOOK_IDS_SEPARATOR } from '@/services/constants';

export const navigateToReader = (
  router: ReturnType<typeof useRouter>,
  bookIds: string[],
  queryParams?: string,
  navOptions?: { scroll?: boolean },
) => {
  const ids = bookIds.join(BOOK_IDS_SEPARATOR);
  if (!isPWA()) {
    router.push(`/reader/${ids}${queryParams ? `?${queryParams}` : ''}`, navOptions);
  } else {
    const params = new URLSearchParams(queryParams || '');
    params.set('ids', ids);
    router.push(`/reader?${params.toString()}`, navOptions);
  }
};

export const navigateToHome = (
  router: ReturnType<typeof useRouter>,
  queryParams?: string,
  navOptions?: { scroll?: boolean },
) => {
  router.replace(`/${queryParams ? `?${queryParams}` : ''}`, navOptions);
};

export const closeReaderWindowOrGoToHome = (router: ReturnType<typeof useRouter>) => {
  navigateToHome(router, '', undefined);
};

export const redirectToHome = () => {
  redirect('/');
};
