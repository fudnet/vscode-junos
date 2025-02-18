import { CompletionItem, CompletionItemKind, RequestHandler, TextDocumentPositionParams } from "vscode-languageserver";

import { Session } from "./session";
import { prefixPattern } from "./parser";

export function completion(session: Session): RequestHandler<TextDocumentPositionParams, CompletionItem[], void> {
  return (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const uri = textDocumentPosition.textDocument.uri;
    const doc = session.documents.get(uri);
    if (!doc) {
      return [];
    }

    let line = doc.getText().split("\n")[textDocumentPosition.position.line];
    if (!line.match(prefixPattern)) {
      return [];
    }

    line = line.replace(prefixPattern, "");
    const keywords = session.parser.keywords(line);

    const m = line.match(/\s*logical-systems\s+(\S+)/);
    const logicalSystem = m?.[1] || "global";

    // List defined symbols
    const rules = [
      [/\s+interface\s+$/, "interface"],
      [/\s+from\s+(?:source-|destination-)?prefix-list\s+$/, "prefix-list"],
      [/\s+(?:import|export)\s+$/, "policy-statement"],
      [/\s+(?:from\s+community|then\s+community\s+(?:add|delete|set))\s+$/, "community"],
      [/\s+from\s+as-path\s+$/, "as-path"],
      [/\s+from\s+as-path-group\s+$/, "as-path-group"],
      [/\s+filter\s+(?:input|output|input-list|output-list)\s+$/, "firewall-filter"],
      [/\s+then\s+translated\s+(?:source-pool|destination-pool|dns-alg-pool|overload-pool)\s+$/, "nat-pool"],
    ] as [RegExp, string][];

    for (const [pattern, symbolType] of rules) {
      if (line.match(pattern)) {
        addReferences(session, session.definitions.getDefinitions(uri, logicalSystem, symbolType), keywords);
        break;
      }
    }

    return keywords.map((keyword) => ({
      label: keyword,
      kind: keyword === "word" ? CompletionItemKind.Value : CompletionItemKind.Text,
      data: `${line} ${keyword}`,
    }));
  };
}

// eslint-disable-next-line @typescript-eslint/ban-types
function addReferences(session: Session, definitions: Object, keywords: string[]) {
  const index = keywords.indexOf("word");
  if (index < 0) {
    return;
  }

  keywords.splice(index, 1);
  keywords.unshift(...Object.keys(definitions));
}

export function completionResolve(session: Session): RequestHandler<CompletionItem, CompletionItem, void> {
  return (item: CompletionItem): CompletionItem => {
    item.detail = session.parser.description(item.data);
    return item;
  };
}
