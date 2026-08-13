import clsx from 'clsx';
import React, { useEffect, useState } from 'react';

import { Book } from '@/types/book';
import { getBookWithUpdatedMetadata } from '@/utils/book';
import { BookMetadata } from '@/libs/document';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useMetadataEdit } from './useMetadataEdit';
import { isWebAppPlatform } from '@/services/environment';
import { eventDispatcher } from '@/utils/event';
import DeleteConfirmAlert from '@/components/DeleteConfirmAlert';
import Dialog from '@/components/Dialog';
import BookDetailView from './BookDetailView';
import BookDetailEdit from './BookDetailEdit';
import SourceSelector from './SourceSelector';
import Spinner from '../Spinner';

interface BookDetailModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  handleBookDelete?: (book: Book) => void;
  handleBookPurge?: (book: Book) => void;
  handleBookMetadataUpdate?: (book: Book, updatedMetadata: BookMetadata, tags: string[]) => void;
  onMetadataValueClick?: (type: 'tag' | 'subject', value: string) => void;
}

const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  isOpen,
  onClose,
  handleBookDelete,
  handleBookPurge,
  handleBookMetadataUpdate,
  onMetadataValueClick,
}) => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { safeAreaInsets } = useThemeStore();
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [bookMeta, setBookMeta] = useState<BookMetadata | null>(null);
  const [bookTags, setBookTags] = useState<string[]>(book.tags ?? []);
  const [fileSize, setFileSize] = useState<number | null>(null);
  // The parent owns the `book` prop and does not re-pass it after a metadata
  // save, so the details view tracks the saved book locally to refresh its
  // cover/title/author immediately (otherwise it shows the stale prop).
  const [displayBook, setDisplayBook] = useState<Book>(book);

  // Initialize metadata edit hook
  const {
    editedMeta,
    editedTags,
    fieldSources,
    lockedFields,
    fieldErrors,
    searchLoading,
    showSourceSelection,
    availableSources,
    handleFieldChange,
    handleToggleFieldLock,
    handleLockAll,
    handleUnlockAll,
    handleAutoRetrieve,
    handleSourceSelection,
    handleCloseSourceSelection,
    resetToOriginal,
  } = useMetadataEdit(bookMeta, bookTags);

  useEffect(() => {
    const fetchBookDetails = async () => {
      const appService = await envConfig.getAppService();
      try {
        let details = book.metadata || null;
        if (!details && book.downloadedAt) {
          details = await appService.fetchBookDetails(book);
        }
        setBookMeta(details);
        const size = await appService.getBookFileSize(book);
        setFileSize(size);
      } finally {
      }
    };
    fetchBookDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book]);

  useEffect(() => {
    setDisplayBook(book);
    setBookTags(book.tags ?? []);
  }, [book]);

  const handleClose = () => {
    setBookMeta(null);
    setEditMode(false);
    setShowDeleteAlert(false);
    onClose();
  };

  const handleEditMetadata = () => {
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    resetToOriginal();
    setEditMode(false);
  };

  const handleSaveMetadata = () => {
    if (editedMeta && handleBookMetadataUpdate) {
      // The edit field keeps empty segments while typing; drop them and
      // dedupe on save.
      const savedTags = [...new Set(editedTags.map((tag) => tag.trim()).filter(Boolean))];
      setBookMeta({ ...editedMeta });
      setBookTags(savedTags);
      // Capture the updated book before handleBookMetadataUpdate clears the
      // temporary cover fields on editedMeta, so the view refreshes its cover.
      setDisplayBook(getBookWithUpdatedMetadata(book, editedMeta, savedTags));
      handleBookMetadataUpdate(book, editedMeta, savedTags);
      setEditMode(false);
    }
  };

  const handleDeleteRequest = () => {
    setShowDeleteAlert(true);
  };

  const confirmDelete = async (purgeData: boolean) => {
    handleClose();
    if (purgeData && handleBookPurge) {
      handleBookPurge(book);
    } else if (handleBookDelete) {
      handleBookDelete(book);
    }
  };

  const cancelDelete = () => {
    setShowDeleteAlert(false);
  };

  const handleBookExport = async () => {
    setIsLoading(true);
    setTimeout(async () => {
      const success = await appService?.exportBook(book);
      setIsLoading(false);
      if (!isWebAppPlatform()) {
        eventDispatcher.dispatch('toast', {
          type: success ? 'info' : 'error',
          message: success ? _('Book exported successfully.') : _('Failed to export the book.'),
        });
      }
    }, 0);
  };

  return (
    <>
      <div className='fixed inset-0 z-50 flex items-center justify-center'>
        <Dialog
          title={editMode ? _('Edit Metadata') : _('Book Details')}
          isOpen={isOpen}
          onClose={handleClose}
          boxClassName={clsx(
            editMode ? 'sm:min-w-[600px] sm:max-w-[600px]' : 'sm:min-w-[480px] sm:max-w-[480px]',
            'sm:h-auto sm:max-h-[90%]',
          )}
          contentClassName='!px-6 !py-4'
        >
          <div className='flex w-full select-text items-start justify-center'>
            {editMode && bookMeta ? (
              <BookDetailEdit
                book={book}
                metadata={editedMeta}
                tags={editedTags}
                fieldSources={fieldSources}
                lockedFields={lockedFields}
                fieldErrors={fieldErrors}
                searchLoading={searchLoading}
                onFieldChange={handleFieldChange}
                onToggleFieldLock={handleToggleFieldLock}
                onAutoRetrieve={handleAutoRetrieve}
                onLockAll={handleLockAll}
                onUnlockAll={handleUnlockAll}
                onCancel={handleCancelEdit}
                onReset={resetToOriginal}
                onSave={handleSaveMetadata}
              />
            ) : (
              <BookDetailView
                book={displayBook}
                metadata={bookMeta}
                fileSize={fileSize}
                onEdit={handleBookMetadataUpdate ? handleEditMetadata : undefined}
                onDelete={handleBookDelete ? handleDeleteRequest : undefined}
                onExport={handleBookExport}
                onMetadataValueClick={onMetadataValueClick}
              />
            )}
          </div>
        </Dialog>

        {/* Source Selection Modal */}
        {showSourceSelection && (
          <SourceSelector
            sources={availableSources}
            isOpen={showSourceSelection}
            onSelect={handleSourceSelection}
            onClose={handleCloseSourceSelection}
          />
        )}

        {isLoading && (
          <div className='fixed inset-0 z-50 flex items-center justify-center'>
            <Spinner loading />
          </div>
        )}

        {showDeleteAlert && (
          <div
            className={clsx('fixed bottom-0 left-0 right-0 z-50 flex justify-center')}
            style={{
              paddingBottom: `${(safeAreaInsets?.bottom || 0) + 16}px`,
            }}
          >
            <DeleteConfirmAlert
              title={_('Confirm Deletion')}
              message={_('Are you sure to delete the selected book?')}
              showPurgeToggle={!!handleBookPurge}
              onCancel={cancelDelete}
              onConfirm={confirmDelete}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default BookDetailModal;
