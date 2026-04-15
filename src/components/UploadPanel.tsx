import { ChangeEvent, DragEvent, useId, useState } from 'react';

interface UploadPanelProps {
  onFileSelect: (files: File[]) => void;
  disabled?: boolean;
  fileName?: string;
}

export function UploadPanel({ onFileSelect, disabled = false, fileName }: UploadPanelProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const nextFiles = files
      ? Array.from(files).filter(
          (file) =>
            file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        )
      : [];

    if (nextFiles.length > 0) {
      onFileSelect(nextFiles);
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
          <h2>Choose your PDF files</h2>
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
          accept="application/pdf,.pdf"
          multiple
          onChange={handleInputChange}
          disabled={disabled}
        />
        <span className="upload-title">Choose PDF files</span>
        <span className="upload-copy">
          Pick one or more PDF files from your device. You can also drag and drop on desktop.
        </span>
      </label>
    </section>
  );
}