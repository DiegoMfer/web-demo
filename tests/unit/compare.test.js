// The comparisons of the Compare tab (compare.js).

import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { dataVerdict, splitTriple, compactTerm, differencesView, shapeIri } from "../../compare.js";

const diff = (relation, onlyInFirst = [], onlyInSecond = [], more = {}) => ({ relation, mode: "injective", exact: true, onlyInFirst, onlyInSecond, firstToSecond: [], secondToFirst: [], report: "", ...more });
const EX = [["", "http://example.org/"], ["xsd", "http://www.w3.org/2001/XMLSchema#"]];

describe("the verdict of a comparison of RDF graphs", () => {
  it("says how the graphs are related, and how many triples are only in one of them", () => {
    expect(dataVerdict(diff("isomorphic"))).toEqual({ verdict: "The graphs are isomorphic: they are the same graph, up to the names of their blank nodes", kind: "ok" });
    expect(dataVerdict(diff("equivalent")).kind).toBe("ok");
    expect(dataVerdict(diff("subgraph", [], ["<a:s> <a:p> <a:o>"]))).toEqual({ verdict: "The first graph is contained in the second one · 1 triple only in the second", kind: "fail" });
    expect(dataVerdict(diff("different", ["x", "y"], ["z"])).verdict).toBe("The graphs are different: neither one is contained in the other · 2 triples only in the first, 1 triple only in the second");
    expect(dataVerdict(diff("other")).verdict).toBe("The graphs are other");
  });
});

describe("triples", () => {
  it("are split in their terms", () => {
    expect(splitTriple('<http://a> <http://p> "a \\"quoted\\" text"@en')).toEqual(["<http://a>", "<http://p>", '"a \\"quoted\\" text"@en']);
    expect(splitTriple('_:b1 <http://p> "1"^^<http://www.w3.org/2001/XMLSchema#integer> .')).toEqual(["_:b1", "<http://p>", '"1"^^<http://www.w3.org/2001/XMLSchema#integer>']);
    // A triple term is one term
    expect(splitTriple("<http://a> <http://p> <<( <http://s> <http://q> <http://o> )>>")).toEqual(["<http://a>", "<http://p>", "<<( <http://s> <http://q> <http://o> )>>"]);
    // Not a triple: as it is
    expect(splitTriple("<http://a> <http://p>")).toEqual(["<http://a> <http://p>", "", ""]);
  });

  it("have their IRIs as prefixed names, when a prefix has them", () => {
    expect(compactTerm("<http://example.org/alice>", EX)).toBe(":alice");
    expect(compactTerm('"1"^^<http://www.w3.org/2001/XMLSchema#integer>', EX)).toBe('"1"^^xsd:integer');
    // Not a name that a prefixed name can have
    expect(compactTerm("<http://example.org/a/b>", EX)).toBe("<http://example.org/a/b>");
    expect(compactTerm("<http://other.org/x>", EX)).toBe("<http://other.org/x>");
    expect(compactTerm("_:b1", EX)).toBe("_:b1");
    // The longest namespace, and the last prefix of a namespace
    expect(compactTerm("<http://example.org/v/x>", [...EX, ["v", "http://example.org/v/"]])).toBe("v:x");
    expect(compactTerm("<http://example.org/x>", [["ex", "http://example.org/"], ...EX])).toBe(":x");
  });
});

describe("the differences of two graphs", () => {
  const doc = () => new JSDOM("").window.document;

  it("are a table of the triples only in each graph, with links, and the blank nodes matched", () => {
    const d = doc();
    const view = differencesView(
      d,
      diff("different", ['<http://example.org/a> <http://example.org/p> "1"^^<http://www.w3.org/2001/XMLSchema#integer>'], ["_:x <http://example.org/p> <http://example.org/b>"], { firstToSecond: [["_:y", "<http://example.org/c>"]] }),
      EX,
    );
    const rows = [...view.querySelectorAll("tbody tr")].map((tr) => [...tr.cells].map((td) => td.textContent));
    expect([...view.querySelectorAll("th .th-label")].map((th) => th.textContent)).toEqual(["Only in", "Subject", "Predicate", "Object"]);
    expect(rows).toEqual([
      ["First", ":a", ":p", '"1"^^xsd:integer'],
      ["Second", "_:x", ":p", ":b"],
    ]);
    expect(view.querySelector("tbody a.iri").href).toBe("http://example.org/a");
    expect(view.querySelector("li").textContent).toBe("_:y → :c");
  });

  it("say when there are none", () => {
    const view = differencesView(doc(), diff("isomorphic"), EX);
    expect(view.querySelector("table")).toBeNull();
    expect(view.textContent).toBe("No differences: each triple of a graph is in the other one.");
  });
});

describe("the shapes of the schemas", () => {
  it("are IRIs, prefixed names of the prefixes of their schema, or empty", () => {
    expect(shapeIri(":Person", EX)).toBe("http://example.org/Person");
    expect(shapeIri("<http://example.org/S>", EX)).toBe("http://example.org/S");
    expect(shapeIri("http://example.org/S")).toBe("http://example.org/S");
    expect(shapeIri("  ")).toBeUndefined();
    expect(() => shapeIri("foo:S", EX)).toThrow("The prefix of the shape foo:S is not declared in its schema");
  });
});
