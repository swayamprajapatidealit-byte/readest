import React, { useEffect, useState } from 'react';
import { VscClose } from 'react-icons/vsc';
import { TbStack2 } from 'react-icons/tb';
import { RiUserLine, RiMapPin2Line, RiBookLine } from 'react-icons/ri';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { eventDispatcher } from '@/utils/event';
import { saveViewSettings } from '@/helpers/settings';
import { SettingLabel, SectionTitle } from '@/components/settings/primitives';
import { Toggle } from '@/components/primitives/toggle';
import Dropdown from '@/components/Dropdown';
import Menu from '@/components/Menu';

interface EntityIconsMenuProps {
  bookKey: string;
  setIsDropdownOpen?: (open: boolean) => void;
}

// A settings row with a colored leading icon chip and a trailing switch —
// mirrors DisplaySettingsToggler's row anatomy for a consistent header
// submenu look.
const ToggleRow: React.FC<{
  icon: React.ElementType;
  iconClassName: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}> = ({ icon: Icon, iconClassName, label, checked, onChange }) => (
  <div className='flex items-center justify-between gap-3 px-2 py-2'>
    <span className='flex min-w-0 items-center gap-3'>
      <span
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${iconClassName}`}
      >
        <Icon className='h-5 w-5' />
      </span>
      <SettingLabel>{label}</SettingLabel>
    </span>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

// Reuses the exact same fields, persistence (saveViewSettings) and event
// (entity-icon-settings-changed) as before — only the UI anatomy changed to
// match DisplaySettingsToggler's card look.
const EntityIconsMenu: React.FC<EntityIconsMenuProps> = ({ bookKey, setIsDropdownOpen }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { getViewSettings } = useReaderStore();
  const viewSettings = getViewSettings(bookKey)!;

  const [charactersEnabled, setCharactersEnabled] = useState(
    viewSettings.entityIconsCharactersEnabled ?? true,
  );
  const [placesEnabled, setPlacesEnabled] = useState(viewSettings.entityIconsPlacesEnabled ?? true);
  const [glossaryEnabled, setGlossaryEnabled] = useState(
    viewSettings.entityIconsGlossaryEnabled ?? true,
  );

  // skipGlobal: true — this applies only to this exact pane's bookKey, not
  // every open pane/book. A split-view pane of the same book gets its own
  // independent on/off, matching its own separate ViewSettings object rather
  // than the (default-on) global sync.
  useEffect(() => {
    if (charactersEnabled === viewSettings.entityIconsCharactersEnabled) return;
    saveViewSettings(
      envConfig,
      bookKey,
      'entityIconsCharactersEnabled',
      charactersEnabled,
      true,
      false,
    );
    eventDispatcher.dispatch('entity-icon-settings-changed', { bookKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charactersEnabled]);

  useEffect(() => {
    if (placesEnabled === viewSettings.entityIconsPlacesEnabled) return;
    saveViewSettings(envConfig, bookKey, 'entityIconsPlacesEnabled', placesEnabled, true, false);
    eventDispatcher.dispatch('entity-icon-settings-changed', { bookKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesEnabled]);

  useEffect(() => {
    if (glossaryEnabled === viewSettings.entityIconsGlossaryEnabled) return;
    saveViewSettings(
      envConfig,
      bookKey,
      'entityIconsGlossaryEnabled',
      glossaryEnabled,
      true,
      false,
    );
    eventDispatcher.dispatch('entity-icon-settings-changed', { bookKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glossaryEnabled]);

  const allEnabled = charactersEnabled && placesEnabled && glossaryEnabled;
  const toggleAll = () => {
    const next = !allEnabled;
    setCharactersEnabled(next);
    setPlacesEnabled(next);
    setGlossaryEnabled(next);
  };

  return (
    <Menu
      className='entity-icons-menu dropdown-content z-20 mt-1.5 w-72 rounded-2xl border shadow-2xl'
      onCancel={() => setIsDropdownOpen?.(false)}
    >
      <div className='flex items-center justify-between px-4 py-3'>
        <span className='text-base-content text-base font-semibold'>{_('Entity Icons')}</span>
        <button
          type='button'
          aria-label={_('Close')}
          onClick={() => setIsDropdownOpen?.(false)}
          className='btn btn-ghost btn-circle btn-sm'
        >
          <VscClose />
        </button>
      </div>
      <hr aria-hidden='true' className='border-base-200' />

      <div className='space-y-1 px-2 py-3'>
        <SectionTitle className='mb-1'>{_('Content Types')}</SectionTitle>
        <ToggleRow
          icon={RiUserLine}
          iconClassName='bg-primary/10 text-primary'
          label={_('Characters')}
          checked={charactersEnabled}
          onChange={() => setCharactersEnabled(!charactersEnabled)}
        />
        <ToggleRow
          icon={RiMapPin2Line}
          iconClassName='bg-secondary/10 text-secondary'
          label={_('Places')}
          checked={placesEnabled}
          onChange={() => setPlacesEnabled(!placesEnabled)}
        />
        <ToggleRow
          icon={RiBookLine}
          iconClassName='bg-accent/10 text-accent'
          label={_('Glossary')}
          checked={glossaryEnabled}
          onChange={() => setGlossaryEnabled(!glossaryEnabled)}
        />
      </div>

      <hr aria-hidden='true' className='border-base-200' />
      <div className='px-4 py-3'>
        <button
          type='button'
          onClick={toggleAll}
          className='btn btn-sm border-none bg-primary/10 text-primary hover:bg-primary/20 w-full rounded-full'
        >
          {allEnabled ? _('Deselect All') : _('Select All')}
        </button>
      </div>
    </Menu>
  );
};

interface EntityIconsTogglerProps {
  bookKey: string;
  onToggle?: (isOpen: boolean) => void;
}

const EntityIconsToggler: React.FC<EntityIconsTogglerProps> = ({ bookKey, onToggle }) => {
  const _ = useTranslation();

  return (
    <Dropdown
      label={_('Entity Icons')}
      containerClassName='h-8'
      className='exclude-title-bar-mousedown dropdown-bottom dropdown-center'
      buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0'
      toggleButton={<TbStack2 size={20} />}
      onToggle={onToggle}
    >
      <EntityIconsMenu bookKey={bookKey} />
    </Dropdown>
  );
};

export default EntityIconsToggler;
