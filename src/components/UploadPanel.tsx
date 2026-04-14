import { ChangeEvent, DragEvent, useId, useState } from 'react';

interface UploadPanelProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  fileName?: string;
}

export function UploadPanel({ onFileSelect, disabled = false, fileName }: UploadPanelProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2>Choose your photo</h2>
        </div>
        {fileName ? <span className="file-badge">{fileName}</span> : null}
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
          onChange={handleInputChange}
          disabled={disabled}
        />
        <span className="upload-title">Choose Photo</span>
        <span className="upload-copy">
          Pick a JPEG, PNG, WebP, GIF, BMP, AVIF, SVG, HEIC, or HEIF image. You can also drag and drop on desktop.
        </span>
      </label>
    </section>
  );
}
