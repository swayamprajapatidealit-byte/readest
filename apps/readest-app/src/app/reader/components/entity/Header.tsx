import clsx from 'clsx';
import React from 'react';

import { MdClose, MdOutlinePushPin, MdPushPin } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';

// Slim utility bar only — pin/close controls. The entity's own identity
// (kicker/title/type badge) lives with its content in Content.tsx instead, so
// it scrolls naturally with the rest of the panel rather than being pinned
// chrome. Keeps this bar theme-neutral (no accent color) by design.
const EntityPanelHeader: React.FC<{
  isPinned: boolean;
  handleClose: () => void;
  handleTogglePin: () => void;
}> = ({ isPinned, handleClose, handleTogglePin }) => {
  const _ = useTranslation();
  const iconSize16 = useResponsiveSize(16);
  const iconSize20 = useResponsiveSize(20);

  return (
    <div
      className='entity-panel-header relative flex h-11 items-center justify-end gap-x-2 px-3'
      dir='ltr'
    >
      <button
        title={isPinned ? _('Unpin') : _('Pin')}
        onClick={handleTogglePin}
        className={clsx(
          'btn btn-ghost btn-circle hidden h-7 min-h-7 w-7 sm:flex',
          isPinned ? 'bg-base-300' : 'bg-base-300/65',
        )}
      >
        {isPinned ? <MdPushPin size={iconSize16} /> : <MdOutlinePushPin size={iconSize16} />}
      </button>
      <button
        title={_('Close')}
        onClick={handleClose}
        className='btn btn-ghost btn-circle flex h-7 min-h-7 w-7'
      >
        <MdClose size={iconSize20} />
      </button>
    </div>
  );
};

export default EntityPanelHeader;
