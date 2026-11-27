import Markdown from "react-markdown";

const allowedElements = ["p", "strong", "em", "ul", "ol", "li", "br"];

/**
 * @param {{ content: string }} props
 */
export default function MenuMarkdown({ content }) {
  return (
    <Markdown allowedElements={allowedElements} skipHtml unwrapDisallowed>
      {content}
    </Markdown>
  );
}
