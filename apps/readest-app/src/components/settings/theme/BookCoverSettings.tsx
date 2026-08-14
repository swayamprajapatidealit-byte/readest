import React from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { BoxedList, SettingsSwitchRow } from '../primitives';

interface BookCoverSettingsProps {
  skeuomorphicCovers: boolean;
  onToggle: (enabled: boolean) => void;
  'data-setting-id'?: string;
}

const BookCoverSettings: React.FC<BookCoverSettingsProps> = ({
  skeuomorphicCovers,
  onToggle,
  'data-setting-id': dataSettingId,
}) => {
  const _ = useTranslation();

  return (
    <BoxedList title={_('Book Covers')} data-setting-id={dataSettingId}>
      <SettingsSwitchRow
        label={_('Skeuomorphic Book Covers')}
        checked={skeuomorphicCovers}
        onChange={() => onToggle(!skeuomorphicCovers)}
      />
    </BoxedList>
  );
};

export default BookCoverSettings;
