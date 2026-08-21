import clsx from 'clsx';
import React from 'react';
import { FaHeadphones } from 'react-icons/fa6';
import { RiArrowGoBackLine, RiArrowGoForwardLine } from 'react-icons/ri';
import { RiQuillPenLine } from 'react-icons/ri';
import { MdCheck, MdTour } from 'react-icons/md';

import { AnnotationToolType } from '@/types/annotator';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useNotebookStore } from '@/store/notebookStore';
import { useTranslation } from '@/hooks/useTranslation';
import { eventDispatcher } from '@/utils/event';
import { saveViewSettings } from '@/helpers/settings';
import { annotationToolQuickActions } from './annotator/AnnotationTools';
import QuickActionMenu from './annotator/QuickActionMenu';
import ViewMenu from './ViewMenu';
import MenuItem from '@/components/MenuItem';
import Menu from '@/components/Menu';

interface HeaderMenuProps {
  bookKey: string;
  menuClassName?: string;
  setIsDropdownOpen?: (open: boolean) => void;
}

const HeaderMenu: React.FC<HeaderMenuProps> = ({ bookKey, menuClassName, setIsDropdownOpen }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { getView, getViewState, getViewSettings } = useReaderStore();
  const { sideBarBookKey, setSideBarBookKey } = useSidebarStore();
  const { isNotebookVisible, toggleNotebook } = useNotebookStore();

  const view = getView(bookKey);
  const viewSettings = getViewSettings(bookKey);
  const viewState = getViewState(bookKey);

  const enableAnnotationQuickActions = viewSettings?.enableAnnotationQuickActions;
  const annotationQuickAction = viewSettings?.annotationQuickAction;
  const annotationQuickActionButton =
    annotationToolQuickActions.find((button) => button.type === annotationQuickAction) ||
    annotationToolQuickActions[0]!;

  const handleGoBack = () => {
    view?.history.back();
  };

  const handleGoForward = () => {
    view?.history.forward();
  };

  const handleSpeakText = () => {
    const eventType = viewState?.ttsEnabled ? 'tts-stop' : 'tts-speak';
    eventDispatcher.dispatch(eventType, { bookKey });
  };

  const handleToggleNotebook = () => {
    if (sideBarBookKey === bookKey) {
      toggleNotebook();
    } else {
      setSideBarBookKey(bookKey);
      if (!isNotebookVisible) toggleNotebook();
    }
  };

  const handleAnnotationQuickActionSelect = (action: AnnotationToolType | null) => {
    if (annotationQuickAction === action) action = null;
    saveViewSettings(envConfig, bookKey, 'annotationQuickAction', action, false, true);
  };

  return (
    <Menu
      className={clsx(
        'header-menu dropdown-content z-20 mt-1.5 border',
        'shadow-2xl',
        menuClassName,
      )}
      onCancel={() => setIsDropdownOpen?.(false)}
    >
      <MenuItem
        label={_('Go Back')}
        Icon={RiArrowGoBackLine}
        disabled={!view?.history.canGoBack}
        transient
        onClick={handleGoBack}
      />
      <MenuItem
        label={_('Go Forward')}
        Icon={RiArrowGoForwardLine}
        disabled={!view?.history.canGoForward}
        transient
        onClick={handleGoForward}
      />
      <MenuItem
        label={viewState?.ttsEnabled ? _('Stop Reading') : _('Speak')}
        Icon={FaHeadphones}
        iconClassName={viewState?.ttsEnabled ? 'text-blue-500' : ''}
        transient
        onClick={handleSpeakText}
      />
      <MenuItem
        label={_('Notebook')}
        Icon={RiQuillPenLine}
        toggled={sideBarBookKey === bookKey && isNotebookVisible}
        transient
        onClick={handleToggleNotebook}
      />

      <hr aria-hidden='true' className='border-base-300 my-1' />
      <MenuItem
        label={_('Take a Tour')}
        Icon={MdTour}
        transient
        onClick={() => eventDispatcher.dispatch('start-product-tour', { bookKey })}
      />

      {enableAnnotationQuickActions && (
        <>
          <hr aria-hidden='true' className='border-base-300 my-1' />
          <MenuItem
            label={_('Quick Action')}
            description={_(annotationQuickActionButton.label)}
            Icon={annotationQuickAction ? MdCheck : undefined}
          >
            <QuickActionMenu
              selectedAction={annotationQuickAction}
              onActionSelect={handleAnnotationQuickActionSelect}
              setIsDropdownOpen={setIsDropdownOpen}
            />
          </MenuItem>
        </>
      )}

      <hr aria-hidden='true' className='border-base-300 my-1' />
      <MenuItem label={_('View Options')}>
        <ViewMenu bookKey={bookKey} setIsDropdownOpen={setIsDropdownOpen} />
      </MenuItem>
    </Menu>
  );
};

export default HeaderMenu;
