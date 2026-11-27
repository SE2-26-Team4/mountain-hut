import { useId, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

import MenuMarkdown from "./MenuMarkdown.jsx";

const extensions = [
  StarterKit.configure({
    blockquote: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    link: false,
    strike: false,
    underline: false,
  }),
  Markdown,
];

/**
 * @param {{
 *   initialContent?: string,
 *   onChange?: (content: string) => void,
 *   showPreview?: boolean,
 * }} props
 */
export default function MenuEditor({
  initialContent = "",
  onChange,
  showPreview = true,
}) {
  const inputLabel = useId();
  const previewLabel = useId();
  const [content, setContent] = useState(initialContent);

  const editor = useEditor({
    extensions,
    content: initialContent,
    contentType: "markdown",
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": inputLabel,
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const markdown = updatedEditor.getMarkdown();
      setContent(markdown);
      onChange?.(markdown);
    },
  });

  if (!editor) {
    return null;
  }

  const formattingButtons = [
    {
      label: "Bold",
      icon: "bi-type-bold",
      pressed: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      icon: "bi-type-italic",
      pressed: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Bulleted list",
      icon: "bi-list-ul",
      pressed: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      icon: "bi-list-ol",
      pressed: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Indent list item",
      icon: "bi-text-indent-left",
      disabled: !editor.can().sinkListItem("listItem"),
      run: () => editor.chain().focus().sinkListItem("listItem").run(),
    },
    {
      label: "Outdent list item",
      icon: "bi-text-indent-right",
      disabled: !editor.can().liftListItem("listItem"),
      run: () => editor.chain().focus().liftListItem("listItem").run(),
    },
  ];

  return (
    <div className="row g-3">
      <section
        className={showPreview ? "col-12 col-md-6" : "col-12"}
        aria-labelledby={inputLabel}
      >
        <h3 id={inputLabel} className="h6 mb-2">
          Menu text
        </h3>

        <div className="mh-menu-editor">
          <div
            className="mh-menu-editor-toolbar"
            role="group"
            aria-label="Menu formatting"
          >
            {formattingButtons.map(
              ({ label, icon, pressed, disabled, run }) => (
                <button
                  key={label}
                  type="button"
                  className="btn btn-sm mh-menu-editor-format"
                  aria-label={label}
                  aria-pressed={pressed}
                  disabled={disabled}
                  title={label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={run}
                >
                  <i className={`bi ${icon}`} aria-hidden="true" />
                </button>
              ),
            )}
          </div>

          <EditorContent editor={editor} className="mh-menu-editor-content" />
        </div>
      </section>

      {showPreview && (
        <section className="col-12 col-md-6" aria-labelledby={previewLabel}>
          <h3 id={previewLabel} className="h6 mb-2">
            Public preview
          </h3>

          <div className="mh-menu-editor-preview">
            {content.trim() ? (
              <MenuMarkdown content={content} />
            ) : (
              <p className="text-secondary mb-0">Your menu will appear here.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
