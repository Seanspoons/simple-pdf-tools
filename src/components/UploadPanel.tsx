import { ChangeEvent, DragEvent, useId, useState } from 'react';

interface UploadPanelProps {
  onFileSelect: (files: File[]) => void;
  disabled?: boolean;
  fileName?: string;
  multiple?: boolean;
  eyebrow?: string;
  heading?: string;
  title?: string;
  copy?: string;
}

export function UploadPanel({
  onFileSelect,
  disabled = false,
  fileName,
  multiple = true,
  eyebrow = 'Step 1',
  heading = 'Choose your PDF files',
  title = 'Choose PDF files',
  copy = 'Pick one or more PDF files from your device. You can also drag and drop on desktop.'
}: UploadPanelProps) {
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
          <p className="eyebrow">{eyebrow}</p>
          <h2>{heading}</h2>
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
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled}
        />
        <span className="upload-title">{title}</span>
        <span className="upload-copy">{copy}</span>
      </label>
    </section>
  );
}
