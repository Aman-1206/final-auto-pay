"use client";

import { useEffect, useId, useState } from "react";

export function TableSearch({ label = "Search records" }: { label?: string }) {
  const [query, setQuery] = useState("");
  const id = useId();

  useEffect(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const tables = Array.from(document.querySelectorAll<HTMLTableElement>("[data-searchable-table]"));

    tables.forEach((table) => {
      Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr")).forEach((row) => {
        const text = row.innerText.toLowerCase();
        row.hidden = Boolean(normalizedQuery) && !text.includes(normalizedQuery);
      });
    });
  }, [query]);

  return (
    <label className="field table-search-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="search"
        value={query}
        placeholder="Dealer code, dealer name, company, or invoice"
        onChange={(event) => setQuery(event.target.value)}
      />
    </label>
  );
}
