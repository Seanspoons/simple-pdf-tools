import { ChangeEvent, DragEvent, useId, useState } from 'react';
import { MAX_COLLAGE_IMAGES } from '../../constants';

interface CollageUploadPanelProps {
  onFilesSelect: (files: FileList | File[]) => void;
  disabled?: boolean;
  imageCount: number;
}

export function CollageUploadPanel({
  onFilesSelect,
  disabled = false,
  imageCount
}: CollageUploadPanelProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFilesSelect(files);
    }

    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files.length > 0) {
      onFilesSelect(event.dataTransfer.files);
    }
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2>Add your photos</h2>
        </div>
        <span className="dimension-badge">{imageCount} selected</span>
      </div>

      <label
        htmlFor={inputId}
        className={`upload-dropzone ${isDragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          id={inputId}
          className="sr-only"
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          onChange={handleInputChange}
          disabled={disabled}
        />
        <span className="upload-title">Add Photos</span>
        <span className="upload-copy">
          Add 2 to {MAX_COLLAGE_IMAGES} photos. Portrait, landscape, and square images all work.
        </span>
      </label>
    </section>
  );
}
