import { redirect, useRouter } from 'next/navigation';

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
