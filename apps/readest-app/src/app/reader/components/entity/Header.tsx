import clsx from 'clsx';
import React from 'react';

import { MdClose, MdOutlinePushPin, MdPushPin } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import type { EntityCategory } from '@/app/reader/utils/entityMatching';

const EntityPanelHeader: React.FC<{
  title: string;
  category: EntityCategory;
  isPinned: boolean;
  handleClose: () => void;
  handleTogglePin: () => void;
}> = ({ title, category, isPinned, handleClose, handleTogglePin }) => {
  const _ = useTranslation();
  const iconSize15 = useResponsiveSize(15);
  const iconSize18 = useResponsiveSize(18);

  // Literal `_('...')` calls per branch (not a lookup table) so the i18n
  // extraction scanner can find them — see docs/i18n.md.
  const categoryLabel =
    category === 'character'
      ? _('Character')
      : category === 'place'
        ? _('Place')
        : category === 'glossary'
          ? _('Glossary')
          : _('End Note');

  return (
    <div className='entity-panel-header relative flex h-11 items-center gap-x-2 px-3' dir='ltr'>
      <span className='badge badge-sm shrink-0'>{categoryLabel}</span>
      <div className='min-w-0 flex-1 truncate text-sm font-medium'>{title}</div>
      <button
        title={isPinned ? _('Unpin') : _('Pin')}
        onClick={handleTogglePin}
        className={clsx(
          'btn btn-ghost btn-circle hidden h-6 min-h-6 w-6 sm:flex',
          isPinned ? 'bg-base-300' : 'bg-base-300/65',
        )}
      >
        {isPinned ? <MdPushPin size={iconSize15} /> : <MdOutlinePushPin size={iconSize15} />}
      </button>
      <button
        title={_('Close')}
        onClick={handleClose}
        className='btn btn-ghost btn-circle flex h-6 min-h-6 w-6'
      >
        <MdClose size={iconSize18} />
      </button>
    </div>
  );
};

export default EntityPanelHeader;
