export function MergePdfTool() {
  return (
    <section className="panel merge-tool-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Merge PDF</p>
          <h2>Combine PDF files in one clean pass.</h2>
        </div>
      </div>
      <p className="panel-description">
        Upload the PDF files you want to combine, adjust the order, and download a single merged
        document. The actual merge workflow is the next step being wired into this preserved shell.
      </p>
      <div className="merge-tool-empty">
        <p className="merge-tool-empty-title">Merge PDF will live here.</p>
        <p className="helper-text">
          This release keeps the current Simple Tools layout and control patterns intact while the
          browser-side PDF workflow is connected.
        </p>
      </div>
    </section>
  );
}
